# Mapa do banco — Ultravis (v01 · 07/set/2026)

> Fonte: `supabase/schema.sql` (gerado das migrations) + migrations 00034–00044
> do fork. Projeto de produção: `twhqjfbealruvcbvkegc` (Supabase/Postgres).
> **37 tabelas · 43 migrations aplicadas (numeração até 00044; a 00007 não
> existe) · RLS ativa nas tabelas de cliente · 3+ RPCs.**

## Domínios e tabelas

### 1 · Identidade & acesso (multi-tenant)
| Tabela | Papel | Segurança |
|---|---|---|
| `organizations` | A conta-cliente (ex.: Polar) — plano, limites | RLS |
| `profiles` | Usuários (FK → organizations) | RLS |
| `invitations` | Convites de time | RLS |
| `api_keys` | Chaves da API v1/MCP | RLS |

### 2 · Marcas (o objeto central)
| Tabela | Papel |
|---|---|
| `brands` | A marca monitorada (FK → organizations); aliases (00036), flag de prompts de marca (00040) |
| `brand_domains` · `brand_platforms` | Domínios oficiais e presenças por plataforma |
| `competitors` | Gabarito de mercado (nome + domínio) por marca |
| `topics` | Tópicos que agrupam prompts |
| `brand_archives` | **Arquivo-morto** (00037): gatilho BEFORE DELETE empacota a marca inteira em JSONB — exclusão nunca perde dados |

### 3 · Rastreamento (o coração)
| Tabela | Papel |
|---|---|
| `prompt_sets` → `prompts` | As perguntas rastreadas (FK → topics) |
| **`prompt_results`** | Uma linha por resposta de IA: texto, `citations` (TODAS as fontes), `mention_count`, `citation_count` (da marca), sentimento, `visibility_score`, `appearance_rank` (00043), motor, região |
| `cloro_pending_tasks` | Fila do modo webhook do Cloro (00034) — resultado sobrevive a restart |
| `jobs` | Ledger de execuções (censo, rodadas manuais) — server-only |
| `prompt_target_urls` | URLs-alvo e quando foram citadas |
| `prompt_notes` | Anotações por prompt |

### 4 · Métricas & sugestões
`prompt_volumes` (volume de busca) · `volume_usage` · `topic_suggestions` ·
`prompt_suggestions` (00035) · `fanout_query_intents` (fan-out) ·
`index_weights` (00039 — pesos do IC calibráveis no /ops)

### 5 · Conteúdo & ação
`content_opportunities` (recomendações por prompt/marca) · `brief_usage`

### 6 · Auditoria de site (Citabilidade)
`site_audits` · `audit_signal_results` · `site_audit_usage` ·
`site_crawls` (00042 — crawl multi-página)

### 7 · Reviews & pulso
`brand_review_checks` (00041 — Trustpilot/G2/Capterra direto) ·
`sent_pulses` (00038 — dedupe do Daily Pulse) · `webhook_configs`

### 8 · Tráfego & agente
`ai_traffic_logs` (visitas vindas de IAs) · `agent_conversations` ·
`agent_messages` · `agent_token_usage` · `reports`

## Regras estruturais (não quebrar)

1. **RLS é a segurança**: "cada organização só vê o seu" vive no banco, não no
   código. `jobs`/`prompt_volumes` são server-only (RLS sem policy — só a
   service role lê). Qualquer banco substituto teria que reimplementar isso.
2. **Migrations numeram a partir de 00034 no fork** (00034–00044 nossas);
   upstream usa os mesmos números com nomes diferentes — sync exige renumerar.
3. **Nada se apaga de verdade**: o arquivo-morto captura DELETE de marca por
   app, MCP e SQL. Ainda assim, **TRUNCATE/zerar não passa pelo gatilho** —
   zerar tabela perde dados de forma irrecuperável.
4. **Auth do app é Supabase Auth** (login, magic link) — fora do schema
   público, mas parte do mesmo projeto.

## Sobre "zerar"

Zerar a produção = perder o histórico da Polar (censos desde 10/ago, 163
menções, material das telas do cliente). Se a intenção for **uma base limpa
de teste/dev**, o caminho seguro é: projeto NOVO no Supabase → aplicar as
migrations do repo na ordem (`supabase/migrations/*.sql`) → schema idêntico,
zero dados, produção intocada. Este mapa + as migrations SÃO a receita de
reconstrução completa.

---
*v01 · 07/set/2026 · gerado por script sobre schema.sql; conferir contra o
banco real quando a leitura via Actions destravar.*
