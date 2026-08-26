---
name: material-visual
description: Transforma dados, análises ou decisões em um material visual entregável — página HTML auto-contida no padrão da casa (painel de números, relatório, diagrama de processo, retrospectiva, one-pager para cliente ou sócio). Use SEMPRE que pedirem "faz um painel", "monta um relatório visual", "transforma isso num HTML", "gera um dashboard/one-pager/apresentação disso", "coloca isso bonito para mandar", "versão visual", "material para o cliente/sócio/board", ou quando o resultado de uma análise precisar sair do terminal e virar algo que alguém abre e entende sozinho — mesmo que a pessoa não diga a palavra "visual". Também dispare quando enviarem um material de referência (print, PDF, HTML) pedindo "no padrão do anexo" com dados reais. NÃO use para editar telas de produto (isso é código da aplicação), para slides .pptx (use a skill de pptx) ou para responder uma pergunta que cabe em três frases no chat.
---

# Material visual

Um material visual bem feito faz uma coisa: a pessoa abre, entende sozinha, e confia no número. Confiança é a parte difícil — e é ela que separa um painel de um enfeite.

## O que decide se o material presta

**Todo número tem origem declarada.** Antes de escrever qualquer valor na página, ele veio de algum lugar: uma consulta no banco, um arquivo, um cálculo que dá para refazer. Se você não conseguiu buscar o número, ele não vira estimativa — vira uma declaração explícita de ausência. Essa é a diferença entre um material que sustenta uma decisão e um que só parece bonito.

**O que não foi medido aparece na página.** Não some, não é preenchido com um valor plausível, não vira "N/D" discreto no rodapé. Ganha um bloco com o rótulo **"não coletamos os dados"** dizendo o que seria preciso para medir. Quem lê precisa saber a fronteira entre o que você sabe e o que você não sabe — e vai confiar mais no resto justamente por isso.

**Cada bloco vem com a frase que diz o que ele significa.** Um gráfico sem leitura obriga o leitor a adivinhar a conclusão. Depois de cada figura ou tabela, uma ou duas frases: o que esse número quer dizer, e o que ele implica. É a diferença entre relatório e instrumento.

**Aproximação declarada continua sendo dado bom.** Se você contou "respostas que citam alguém da categoria" comparando domínios em vez de entidades, diga isso na nota do bloco. Aproximação honesta vale mais que precisão fingida.

## Como montar

**1. Busque os números primeiro.** Consulte o banco, leia os arquivos, rode o código. Cada seção do material nasce de uma consulta real; se a consulta não existe, a seção não existe (ou vira um bloco de "não coletamos"). Anote a janela de tempo, o total da amostra e os filtros — isso vai para a faixa de instrumentação no topo.

**2. Escolha a forma pelo que o dado é**, não pelo que é bonito:
- **Funil** — quando há etapas com perda entre elas (execuções → com fontes → citam a categoria → citam você).
- **Barras horizontais** — comparação entre poucos itens nomeados (marca × concorrentes, dimensões de um índice).
- **Barra segmentada** — partes de um todo que soma 100% (distribuição de posições, camadas de fonte).
- **Heatmap** — a mesma métrica cruzando duas dimensões (marca × motor).
- **Tabela** — quando os valores exatos importam mais que a forma (fontes citadas, agenda de processos).
- **Diagrama de raias** — processo com atores e decisões; use o gerador em `scripts/raias.py` em vez de posicionar caixa por caixa à mão.
- **Cards de número grande** — três a cinco valores que resumem tudo; o número em destaque é o que a pessoa vai repetir em voz alta.

**3. Escreva na ordem em que a pessoa lê**: faixa de instrumentação (amostra, janela, proveniência) → o número que resume → as quebras que explicam → o que ainda não medimos → o que fazer com isso → rodapé de método.

**4. Use o estilo da casa** (`assets/estilo-casa.css`): fundo papel, Fraunces nos títulos, IBM Plex Sans no corpo, JetBrains Mono nos números e rótulos. Copie o CSS para dentro do arquivo — o material precisa abrir sozinho, sem depender de nada além das fontes do Google. Antes de escrever HTML na mão, abra `references/padroes.md`: os dez blocos que este CSS espera já estão lá prontos, com as armadilhas de cada um anotadas. Copiar e trocar os números é mais rápido e erra menos que reinventar a marcação.

**5. Confira renderizando** — `scripts/conferir_render.sh material.html`. Isso gera um PNG e você olha. Texto que encosta na borda do card, rótulo cortado, legenda que sumiu: só aparecem no render. Este passo já pegou erro em três de cinco materiais feitos com este padrão; não pule.

**6. Entregue nos dois formatos**: publique como artifact (link que a pessoa abre) e mande o arquivo. Se o material documenta o projeto, versione junto — material de referência não deve morar em anexo de conversa.

## Regras de forma que economizam retrabalho

- **HTML auto-contido.** Estilo inline, SVG à mão, zero biblioteca, zero script. Uma página que depende de CDN morre no primeiro firewall.
- **Número grande = o que a pessoa repete.** Se o pedido é "presença de 22,2%", o destaque é `22,2%` e o "12 de 54 prompts" fica no subtítulo. Inverta assim que a pessoa disser qual é o número que importa.
- **Cor tem significado, não decoração.** Um acento só, usado para o que exige ação; verde para o que está saudável; âmbar para decisão; cinza para o resto. Se tudo é colorido, nada é.
- **Tabela larga rola dentro do próprio bloco** (`overflow-x:auto`), nunca empurra a página.
- **Rodapé de método** em toda entrega: de onde vieram os dados, qual a janela, o que é aproximação e o que ficou de fora. Três linhas resolvem.

## Quando vier um material de referência

Se a pessoa mandar um print, PDF ou HTML dizendo "faz no padrão disso": extraia a **estrutura** (que seções existem, em que ordem, que notação) e o **sistema visual** (paleta, tipografia, densidade), e preencha com os dados reais dela. Onde a referência tem uma seção que você não consegue preencher com dado real, é exatamente ali que entra o bloco de "não coletamos os dados" — não invente para completar o formato.

Para PDF sem texto extraível, `pymupdf` resolve (`page.get_text()`); para renderizar e olhar, o mesmo script de conferência serve.

## O que costuma dar errado

- **Rótulo dentro de SVG estourando a caixa.** Encurte o texto; SVG não quebra linha sozinho.
- **Legenda de tabela cortada** quando a tabela tem `overflow:hidden` — coloque a legenda fora do elemento da tabela.
- **Números que não fecham entre blocos.** Se dois blocos usam denominadores diferentes de propósito (por prompt × por resposta), diga em cada um qual é a unidade. Dois números diferentes e ambos corretos é normal — desde que a página explique.
- **Material bonito com dado velho.** A faixa de instrumentação com a janela de coleta evita que alguém leia um painel de duas semanas atrás como se fosse de hoje.

## Arquivos desta skill

- `assets/estilo-casa.css` — a base visual pronta para copiar no `<style>`.
- `scripts/conferir_render.sh` — renderiza o HTML e salva um PNG para você olhar antes de entregar.
- `scripts/raias.py` — gerador de diagrama de atividade com raias: você escreve um JSON com `lanes`, `nodes` (lane/row/kind) e `edges`, ele devolve o SVG com o texto quebrado e as setas roteadas em cotovelo. `python raias.py spec.json -o fig.svg`; o docstring do arquivo tem o spec completo.
- `references/padroes.md` — os blocos prontos (funil, barras, barra segmentada, heatmap, cards de "não coletamos", faixa de instrumentação, rodapé de método) com o HTML de cada um.
