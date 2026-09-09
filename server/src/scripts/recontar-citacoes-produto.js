/**
 * Recalcula `prompt_results.citation_count` no histórico com a definição de
 * citação do dono (07/set): domínio próprio MAIS link de terceiro que traga
 * claramente o produto. Ver `ajustar.md`, Parte 3.
 *
 * Run: `node src/scripts/recontar-citacoes-produto.js`
 *
 * NASCE EM SIMULAÇÃO. Sem `CITACOES_APLICAR=1` o script não escreve nada —
 * só mostra o que mudaria e lista uma amostra das citações que passariam a
 * contar. É a "amostragem manual antes de ligar" que o próprio levantamento
 * pediu, e existe por um motivo concreto: marca de nome comum ("Polar"
 * também é urso polar) pode inflar o número, e um número inflado na frente
 * do cliente é pior que um número conservador.
 *
 * Fluxo recomendado:
 *   1. rodar sem env nenhuma e LER a amostra;
 *   2. se houver falso positivo, cadastrar `brands.citation_terms` com o
 *      termo composto ("Polar Vantage") e rodar de novo;
 *   3. só então `CITACOES_APLICAR=1`.
 *
 * Env:
 *   - CITACOES_APLICAR   '1' grava; qualquer outra coisa = simulação
 *   - CITACOES_MARCA     limita a uma marca (uuid); vazio = todas as ativas
 *   - CITACOES_AMOSTRA   quantas citações novas listar por marca (default 20)
 *   - CITACOES_LOTE      linhas por página (default 1000)
 *
 * `visibility_score` NÃO é recalculado, pela mesma razão documentada em
 * `citation-recount.js`: é uma heurística de um instante no tempo, e
 * reescrevê-la mudaria retroativamente os gráficos de tendência. Contar mais
 * citações SOBE o score daqui pra frente — o degrau no gráfico é real e
 * merece nota na tela, não um reescrever silencioso do passado. A decisão
 * entre "recalcular tudo" e "valer daqui pra frente" é do dono e está
 * registrada como pendente no ajustar.md.
 */

import 'dotenv/config';
import supabaseAdmin from '../config/supabase.js';
import {
  contarCitacoesDoProduto,
  citacaoTrazOProduto,
  extractHostname,
} from '../lib/response-parser.js';

const APLICAR = process.env.CITACOES_APLICAR === '1';
const MARCA = process.env.CITACOES_MARCA || null;
const AMOSTRA = Number.parseInt(process.env.CITACOES_AMOSTRA ?? '20', 10);
const LOTE = Number.parseInt(process.env.CITACOES_LOTE ?? '1000', 10);
const MAX_LINHAS = 500_000;

async function carregarMarcas() {
  let q = supabaseAdmin.from('brands').select('id, name, aliases, citation_terms');
  if (MARCA) q = q.eq('id', MARCA);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function dominiosDaMarca(brandId) {
  const { data, error } = await supabaseAdmin
    .from('brand_domains')
    .select('domain')
    .eq('brand_id', brandId);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.domain).filter(Boolean);
}

async function processarMarca(marca) {
  const domains = await dominiosDaMarca(marca.id);
  const termos =
    marca.citation_terms?.length > 0
      ? marca.citation_terms
      : [marca.name, ...(marca.aliases || [])].filter(Boolean);

  const normalizados = domains
    .map((d) => extractHostname(d) ?? String(d).trim().toLowerCase())
    .filter(Boolean);
  const ehPropria = (url) => {
    const host = extractHostname(url || '');
    return Boolean(host && normalizados.some((d) => host === d || host.endsWith(`.${d}`)));
  };

  let lidas = 0;
  let mudariam = 0;
  let atualizadas = 0;
  let somaAntes = 0;
  let somaDepois = 0;
  const amostra = [];

  for (let offset = 0; offset < MAX_LINHAS; offset += LOTE) {
    const { data: rows, error } = await supabaseAdmin
      .from('prompt_results')
      .select('id, citations, citation_count')
      .eq('brand_id', marca.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + LOTE - 1);
    if (error) throw new Error(error.message);

    const lote = rows || [];
    lidas += lote.length;

    for (const row of lote) {
      const citations = Array.isArray(row.citations) ? row.citations : [];
      const novo = contarCitacoesDoProduto(citations, { domains, termos }).total;
      somaAntes += row.citation_count || 0;
      somaDepois += novo;
      if (novo === row.citation_count) continue;
      mudariam += 1;

      // A amostra mostra o que a regra NOVA passou a aceitar — é o que a
      // pessoa precisa ler pra confiar (ou não) no número.
      if (amostra.length < AMOSTRA) {
        for (const c of citations) {
          if (amostra.length >= AMOSTRA) break;
          if (ehPropria(c?.url)) continue;
          if (citacaoTrazOProduto(c, termos)) {
            amostra.push({ url: c?.url, title: c?.title });
          }
        }
      }

      if (APLICAR) {
        const { error: errUp } = await supabaseAdmin
          .from('prompt_results')
          .update({ citation_count: novo })
          .eq('id', row.id);
        if (errUp) throw new Error(errUp.message);
        atualizadas += 1;
      }
    }

    if (lote.length < LOTE) break;
  }

  return { lidas, mudariam, atualizadas, somaAntes, somaDepois, termos, amostra };
}

async function main() {
  const marcas = await carregarMarcas();
  if (marcas.length === 0) {
    console.log('nenhuma marca encontrada');
    return;
  }

  console.log(
    APLICAR
      ? '=== APLICANDO (as linhas serão gravadas) ==='
      : '=== SIMULAÇÃO — nada será gravado (CITACOES_APLICAR=1 pra valer) ===',
  );

  for (const marca of marcas) {
    const r = await processarMarca(marca);
    console.log(
      `\n${marca.name} (${marca.id})\n` +
        `  termos usados: ${r.termos.join(' · ') || '(nenhum)'}\n` +
        `  linhas lidas: ${r.lidas} · linhas que mudam: ${r.mudariam}` +
        (APLICAR ? ` · gravadas: ${r.atualizadas}` : '') +
        `\n  total de citações: ${r.somaAntes} → ${r.somaDepois}`,
    );
    if (r.amostra.length) {
      console.log('  amostra do que passou a contar (confira a olho):');
      for (const c of r.amostra) console.log(`    - ${c.title || '(sem título)'}\n      ${c.url}`);
    }
  }

  if (!APLICAR) {
    console.log('\nNada foi gravado. Conferiu a amostra? Rode com CITACOES_APLICAR=1.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
