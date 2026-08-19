# -*- coding: utf-8 -*-
import figs

CSS = """
:root{
  --bg:#F7F6F2; --card:#FFFFFF; --sunk:#EEEBE1;
  --ink:#26251F; --ink2:#4C4940; --faint:#8C8878;
  --rule:#DFDCD2; --rule2:#C6C2B5;
  --amber:#B8741C; --amberSoft:#FBF1DF;
  --good:#1F7A4D; --goodSoft:#EBF4EF;
  --sans:'IBM Plex Sans',-apple-system,sans-serif;
  --serif:'Fraunces',Georgia,serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 30px}
::selection{background:var(--amber);color:#fff}

/* capa */
.cover{background:var(--card);border-bottom:1px solid var(--rule);padding:54px 0 46px}
.eyebrow{font-family:var(--mono);font-size:.63rem;letter-spacing:.34em;text-transform:uppercase;color:var(--faint)}
.prod{font-family:var(--mono);font-size:.95rem;font-weight:700;color:var(--good);margin-top:16px}
h1{font-family:var(--serif);font-weight:500;font-size:2.35rem;letter-spacing:-.02em;margin-top:6px;text-wrap:balance}
.covsub{color:var(--ink2);margin-top:10px;max-width:74ch}
.covmeta{display:flex;gap:22px;flex-wrap:wrap;font-family:var(--mono);font-size:.7rem;color:var(--ink2);margin-top:26px;padding-top:18px;border-top:1px solid var(--rule)}
.covmeta b{color:var(--ink)}
.covline{font-size:.86rem;color:var(--faint);margin-top:14px}

.page{padding:34px 0 64px}
.fig{margin-top:38px}
.fignum{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--good);font-weight:700}
h2{font-family:var(--serif);font-size:1.35rem;font-weight:500;margin-top:4px;letter-spacing:-.01em}
.note{color:var(--ink2);font-size:.88rem;max-width:82ch;margin-top:7px}
.figbox{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:16px;margin-top:14px;overflow-x:auto}
.figbox svg{display:block;width:100%;min-width:760px;height:auto}
.figread{margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule2);font-size:.86rem;color:var(--ink2)}
.figread b{color:var(--ink)}

h3{font-family:var(--serif);font-size:1.15rem;font-weight:500;margin-top:36px}
table{width:100%;border-collapse:collapse;margin-top:12px;background:var(--card);border:1px solid var(--rule);border-radius:10px;overflow:hidden}
.cap{font-family:var(--mono);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-top:26px}
th{font-family:var(--mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);font-weight:500;text-align:left;padding:10px 13px;background:var(--sunk);border-bottom:1px solid var(--rule2)}
td{padding:10px 13px;border-bottom:1px solid var(--rule);font-size:.85rem;vertical-align:top;color:var(--ink2)}
td:first-child{color:var(--ink);font-weight:600}
tr:last-child td{border-bottom:none}
td .mono,.mono{font-family:var(--mono);font-size:.78rem}
.sim{color:var(--good);font-weight:600}
.nao{color:var(--amber);font-weight:600}

.sym{display:inline-block;width:34px;height:20px;vertical-align:-5px;margin-right:9px}

.adr{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:20px 24px;margin-top:14px}
.adr p{font-size:.87rem;color:var(--ink2);margin-bottom:11px}
.adr p:last-child{margin-bottom:0}
.adr b{color:var(--ink)}
.adr .id{font-family:var(--mono);font-size:.72rem;font-weight:700;color:var(--good)}

.foot{font-family:var(--mono);font-size:.68rem;color:var(--ink2);line-height:1.9;border-top:1px solid var(--rule);padding-top:20px;margin-top:40px}
.foot b{color:var(--good)}
@media (max-width:820px){.wrap{padding:0 18px}h1{font-size:1.8rem}}
@media print{body{background:#fff}.figbox{break-inside:avoid}}
"""

def sym_act():
    return ('<svg class="sym" viewBox="0 0 40 22"><rect x="1" y="1" width="38" height="20" rx="6" '
            'fill="#fff" stroke="#55524A" stroke-width="1.3"/></svg>')
def sym_sys():
    return ('<svg class="sym" viewBox="0 0 40 22"><rect x="1" y="1" width="38" height="20" rx="6" '
            'fill="#26251F"/></svg>')
def sym_ext():
    return ('<svg class="sym" viewBox="0 0 40 22"><rect x="1" y="1" width="38" height="20" rx="6" '
            'fill="#F4F2EB" stroke="#9A968A" stroke-dasharray="4 3" stroke-width="1.2"/></svg>')
def sym_dec():
    return ('<svg class="sym" viewBox="0 0 40 22"><polygon points="20,1 39,11 20,21 1,11" '
            'fill="#FBF1DF" stroke="#B8741C" stroke-width="1.3"/></svg>')
def sym_dot():
    return ('<svg class="sym" viewBox="0 0 40 22"><circle cx="12" cy="11" r="7" fill="#26251F"/>'
            '<circle cx="30" cy="11" r="8.5" fill="none" stroke="#26251F" stroke-width="1.3"/>'
            '<circle cx="30" cy="11" r="5" fill="#26251F"/></svg>')
def sym_lane():
    return ('<svg class="sym" viewBox="0 0 40 22"><rect x="1" y="1" width="38" height="8" fill="#EEEBE1" '
            'stroke="#C6C2B5"/><line x1="20" y1="9" x2="20" y2="21" stroke="#DFDCD2" stroke-dasharray="3 3"/></svg>')
def sym_arrow():
    return ('<svg class="sym" viewBox="0 0 40 22"><line x1="2" y1="11" x2="31" y2="11" stroke="#55524A" '
            'stroke-width="1.3"/><path d="M31 6 L39 11 L31 16 z" fill="#55524A"/></svg>')

HTML = """<title>Processos Ultravis · UML</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>{{css}}</style>

<div class="cover">
  <div class="wrap">
    <div class="eyebrow">Documentação técnica</div>
    <div class="prod">ultravis.ai</div>
    <h1>Diagrama UML de Processos</h1>
    <p class="covsub">Diagramas de atividade da plataforma — do cadastro da marca até a ação que o cliente executa e o censo seguinte mede.</p>
    <div class="covmeta">
      <span>Versão da plataforma: <b>44 migrations · 19/ago/2026</b></span>
      <span>Processos documentados: <b>4</b></span>
      <span>Fonte: <b>código em produção</b></span>
    </div>
    <p class="covline">Ultravis — visibilidade de marcas nas respostas de IA, mercado brasileiro. Todos os processos abaixo estão rodando: agendas, componentes e serviços externos são os do sistema em produção.</p>
  </div>
</div>

<div class="wrap page">

  <div class="fig">
    <div class="fignum">Figura 1</div>
    <h2>Cadastro e onboarding da marca</h2>
    <p class="note">Diagrama de atividade (UML) com raias por ator. Sequência única, feita uma vez por marca: cadastro → leitura do site real → sugestão assistida → confirmação humana → prompt-set ativo.</p>
    <div class="figbox">{{f1}}</div>
    <p class="figread"><b>A confirmação humana é obrigatória.</b> A plataforma sugere tópicos, prompts e concorrentes a partir do site real, mas nada entra no prompt-set sem o cliente aprovar — a mesma regra que impede o sistema de inventar concorrente ou tópico que a marca não reconhece.</p>
  </div>

  <div class="fig">
    <div class="fignum">Figura 2</div>
    <h2>Censo semanal de rastreamento</h2>
    <p class="note">O processo central da plataforma: do disparo do cron até a linha gravada. Duas fases de coleta (motores web por coletor assíncrono, modelos de API direto) convergem no mesmo parser.</p>
    <div class="figbox">{{f2}}</div>
    <p class="figread"><b>O sentimento só roda quando há menção.</b> Resposta sem a marca não gasta chamada de LLM — e a análise de sentimento nunca divide por respostas em que a marca não aparece. O coletor trabalha em modo webhook: um deploy no meio do censo não perde as tarefas já enviadas.</p>
  </div>

  <div class="fig">
    <div class="fignum">Figura 3</div>
    <h2>Enriquecimento contínuo e vigilância</h2>
    <p class="note">Quatro agendas independentes do censo. As três primeiras enriquecem o dado; a quarta fiscaliza o próprio sistema — saúde da máquina e consistência dos números.</p>
    <div class="figbox">{{f3}}</div>
    <p class="figread"><b>O vigia de consistência é o produto interno da nossa própria dor.</b> Dez invariantes nascidos de bugs reais: concorrente duplicado somando em dobro, marcas quase-idênticas dividindo os números, motor configurado que parou de entregar, prompt de marca com grafia que o parser não reconhece.</p>
  </div>

  <div class="fig">
    <div class="fignum">Figura 4</div>
    <h2>Do dado à ação — o ciclo de valor</h2>
    <p class="note">Como o dado coletado vira decisão do cliente. Os dois índices não se somam: a Citabilidade é a alavanca onde se age, o Score é o resultado que se mede.</p>
    <div class="figbox">{{f4}}</div>
    <p class="figread"><b>O loop fecha no censo seguinte.</b> A Auditoria indica o que fazer a partir do que foi lido do site — "encontramos X, falta Y" —, o cliente executa, e a coleta seguinte registra o efeito na alavanca. É o que separa relatório de instrumento.</p>
  </div>

  <h3>Legenda e detalhamento</h3>

  <div class="cap">Tabela 1 · Notação usada nos diagramas</div>
  <table>
    <thead><tr><th style="width:210px">Símbolo</th><th>Significado</th></tr></thead>
    <tbody>
      <tr><td>{{s_dot}} Círculo / círculo duplo</td><td>Estado inicial e estado final do processo</td></tr>
      <tr><td>{{s_act}} Retângulo claro</td><td>Atividade executada por pessoa (cliente, admin, operador)</td></tr>
      <tr><td>{{s_sys}} Retângulo escuro</td><td>Atividade automática da plataforma (server, worker ou app)</td></tr>
      <tr><td>{{s_ext}} Retângulo tracejado</td><td>Serviço externo — fornecedor fora do nosso controle</td></tr>
      <tr><td>{{s_dec}} Losango âmbar</td><td>Ponto de decisão, com as saídas rotuladas</td></tr>
      <tr><td>{{s_lane}} Raia vertical</td><td>Responsável pela atividade (ator ou subsistema)</td></tr>
      <tr><td>{{s_arr}} Seta</td><td>Transição de controle; rótulo em itálico indica a condição ou o dado transportado</td></tr>
    </tbody>
  </table>

  <div class="cap">Tabela 2 · Pontos de decisão</div>
  <table>
    <thead><tr><th style="width:240px">Decisão</th><th>Caminho <span class="sim">sim</span></th><th>Caminho <span class="nao">não</span></th></tr></thead>
    <tbody>
      <tr><td>A marca foi mencionada na resposta? <span class="mono">(Fig. 2)</span></td><td>Analisa o sentimento da resposta e grava com o veredito</td><td>Grava a resposta sem chamar o LLM — sentimento não se aplica e não entra no denominador</td></tr>
      <tr><td>Algo fora do esperado? <span class="mono">(Fig. 3)</span></td><td>Alerta por e-mail e webhook, deduplicado por 6 h, e destaca no painel</td><td>Segue apenas registrado no painel do operador</td></tr>
      <tr><td>O cliente confirma as sugestões? <span class="mono">(Fig. 1)</span></td><td>Prompt-set é ativado e entra no próximo censo</td><td>Nada é ativado — a plataforma não decide sozinha o que rastrear</td></tr>
    </tbody>
  </table>

  <div class="cap">Tabela 3 · Fases, gatilhos e saídas</div>
  <table>
    <thead><tr><th style="width:150px">Fase</th><th style="width:170px">Ator / subsistema</th><th style="width:200px">Gatilho</th><th>Saída</th></tr></thead>
    <tbody>
      <tr><td>Onboarding</td><td>Cliente + app</td><td>Marca nova cadastrada</td><td>Prompt-set ativo com tópicos, concorrentes e motores confirmados</td></tr>
      <tr><td>Coleta</td><td>Worker de rastreamento</td><td>Cron semanal ou execução manual</td><td>Respostas brutas dos motores, com a lista de fontes de cada uma</td></tr>
      <tr><td>Extração</td><td>Parser de resposta</td><td>Resposta recebida</td><td>Menções da marca e dos concorrentes, citações do domínio próprio</td></tr>
      <tr><td>Sentimento</td><td>Modelo de linguagem</td><td>Resposta com menção à marca</td><td>Positivo, neutro ou negativo — gravado na linha</td></tr>
      <tr><td>Ranking</td><td>Enriquecimento (30 min)</td><td>Linha com menção e sem ranking</td><td>Ordem de aparição da marca no texto, de 1º em diante</td></tr>
      <tr><td>Avaliações</td><td>Coletor de reviews</td><td>Cron semanal</td><td>Presença, nota e volume por plataforma; ausência declarada quando não verificável</td></tr>
      <tr><td>Leitura do site</td><td>Varredura mensal</td><td>Cron mensal</td><td>Sinais por página-chave: JSON-LD, FAQ, títulos, meta tags, llms.txt</td></tr>
      <tr><td>Vigilância</td><td>Watchdog + consistência</td><td>A cada 15 minutos</td><td>Alertas de saúde e de consistência dos números</td></tr>
      <tr><td>Leitura do cliente</td><td>App</td><td>Acesso às telas</td><td>Citabilidade, Score, resumo de visibilidade e indicações da Auditoria</td></tr>
    </tbody>
  </table>

  <div class="cap">Tabela 4 · Agenda real dos processos automáticos</div>
  <table>
    <thead><tr><th style="width:230px">Processo</th><th style="width:190px">Frequência</th><th>Variável de configuração</th></tr></thead>
    <tbody>
      <tr><td>Censo de rastreamento</td><td>Semanal — segunda, 06:00 UTC</td><td class="mono">DAILY_CRON_SCHEDULE</td></tr>
      <tr><td>Ordem de aparição (ranking)</td><td>A cada 30 minutos</td><td class="mono">APPEARANCE_RANK_CRON</td></tr>
      <tr><td>Checagem de avaliações</td><td>Semanal — segunda, 08:30 UTC</td><td class="mono">REVIEW_CHECK_CRON</td></tr>
      <tr><td>Varredura do site</td><td>Mensal — dia 1, 09:00 UTC</td><td class="mono">SITE_CRAWL_CRON</td></tr>
      <tr><td>Vigias (saúde + consistência)</td><td>A cada 15 minutos</td><td class="mono">WATCHDOG_INTERVAL_MIN</td></tr>
      <tr><td>Vigia do upstream</td><td>A cada 3 dias, 09:00 UTC</td><td class="mono">— fixo no código</td></tr>
    </tbody>
  </table>

  <h3>Decisões de arquitetura referenciadas</h3>
  <div class="adr">
    <p><span class="id">ADR-1</span> · <b>Web sem servidor, worker sempre ligado.</b> O rastreamento leva minutos a horas, tem cron e recebe webhooks — trabalho que ambiente serverless não sustenta. O app roda na borda; o worker roda em processo persistente.</p>
    <p><span class="id">ADR-2</span> · <b>Coletor em modo webhook, não em espera ativa.</b> Deploy no meio de um censo matava execuções em polling. Com callback assíncrono e registro das tarefas pendentes, o resultado pago sobrevive a reinício e a deploy.</p>
    <p><span class="id">ADR-5</span> · <b>Fork disciplinado.</b> O núcleo herdado não é reescrito; toda feature é aditiva — rota, componente ou migration nova. Correção pontual no núcleo é permitida, documentada na linha.</p>
    <p><span class="id">ADR-6</span> · <b>Tabelas operacionais só do servidor.</b> Fila e execuções ficam invisíveis ao aplicativo por segurança de linha; a consequência aceita é que o log de execução vive no painel do operador, não na tela do cliente.</p>
    <p><span class="id">ADR-7</span> · <b>Modelo de IA por função, via configuração.</b> Cada função — sugestão de tópico, de prompt, de concorrente, auditoria, sentimento — escolhe o modelo por variável de ambiente: troca de provedor sem deploy.</p>
    <p><span class="id">ADR-8</span> · <b>Vigia de domínio em código próprio.</b> Ferramenta genérica não entende degradação de domínio — "sentimento 100% neutro" significa provedor caindo em fallback, e nenhum monitor de prateleira sabe disso. O vigia mora dentro do próprio servidor.</p>
    <p><span class="id">19/ago</span> · <b>Dois índices que não se somam.</b> A Citabilidade mede a alavanca (seus ativos), o Score mede o resultado (as respostas de IA). Somar seria contar causa e efeito na mesma conta. O resumo de visibilidade mostra três números sem nota ponderada.</p>
    <p><span class="id">19/ago</span> · <b>A tela só mostra o que mede.</b> Dimensões sem mecanismo de medição ficam fora do Score até existir a medição — e o que não é coletável é declarado como não coletado, nunca estimado.</p>
  </div>

  <div class="foot">
    <b>DOCUMENTO GERADO DO ESTADO REAL DA PLATAFORMA</b> — agendas, componentes, serviços externos e pontos de decisão conferidos no código em produção em 19/ago/2026 (44 migrations aplicadas).<br>
    ESCOPO — os quatro processos automáticos que rodam hoje. Fluxos previstos e ainda não implementados não aparecem nestes diagramas.<br>
    INSPIRAÇÃO — formato e notação inspirados na documentação UML de processos do reembolsa.ia (board FigJam), adaptados aos processos da Ultravis.
  </div>

</div>
"""

vals = dict(
    css=CSS, f1=figs.fig1(), f2=figs.fig2(), f3=figs.fig3(), f4=figs.fig4(),
    s_act=sym_act(), s_sys=sym_sys(), s_ext=sym_ext(), s_dec=sym_dec(),
    s_dot=sym_dot(), s_lane=sym_lane(), s_arr=sym_arrow())
out = HTML
for k, v in vals.items():
    out = out.replace('{{' + k + '}}', v)
open('processos-uml.html', 'w').write(out)
print('html ok')
