# Padrões de bloco — HTML pronto para colar

Blocos que já sobreviveram a entrega real. Todos assumem que
`assets/estilo-casa.css` está inline no `<head>`. Copie o bloco, troque os
números, apague o que não usar.

Índice:
1. [Capa](#1-capa)
2. [Faixa de instrumentação](#2-faixa-de-instrumentação)
3. [Cartões de número](#3-cartões-de-número)
4. [Barra segmentada](#4-barra-segmentada)
5. [Barras horizontais (ranking)](#5-barras-horizontais-ranking)
6. [Funil](#6-funil)
7. [Heatmap](#7-heatmap)
8. [Tabela com legenda](#8-tabela-com-legenda)
9. ["Não coletamos os dados"](#9-não-coletamos-os-dados)
10. [Rodapé de método](#10-rodapé-de-método)

Regra que atravessa todos: **cada bloco vem com a frase que diz o que ele
significa** (`.leitura`). Um gráfico sem leitura obriga o dono a adivinhar, e
ele vai adivinhar errado.

---

## 1. Capa

```html
<header class="cover"><div class="wrap">
  <p class="eyebrow">Ultravis · painel de visibilidade</p>
  <h1>Polar</h1>
  <p class="covsub">Como a marca aparece nas respostas de IA — 54 prompts,
     3 motores, janela de 26/jul a 26/ago de 2026.
     Gerado em 26/ago/2026 a partir de <code>results</code> em produção.</p>
</div></header>
```

A capa precisa dizer **de quando são os dados**, não só quando o arquivo foi
gerado. Quem abre isso três semanas depois não tem como saber a diferença.

---

## 2. Faixa de instrumentação

Vai logo abaixo da capa. Declara, antes de qualquer número, o que está medido
e o que não está — isso muda a leitura do documento inteiro.

```html
<div class="instr"><div class="wrap instr-in">
  <span class="prov">dados reais</span>
  <span><b>Medido</b> presença · ranking · sentimento · fontes citadas</span>
  <span class="sep"></span>
  <span><b>Não medido</b> volume de busca · cliques · conversão</span>
  <span class="sep"></span>
  <span><b>Janela</b> 26/jul–26/ago/2026 · 4 862 respostas</span>
</div></div>
```

---

## 3. Cartões de número

Um número grande por cartão. O contrato é o número; o resto é subtítulo menor
embaixo — invertido, o cartão vira parágrafo e ninguém lê.

```html
<div class="nums">
  <div class="num-card">
    <p class="k">Presença</p>
    <p class="n">22,2<span class="u">%</span></p>
    <p class="s">12 de 54 prompts com a marca em pelo menos uma resposta</p>
  </div>
  <div class="num-card">
    <p class="k">Ranking médio</p>
    <p class="n">#3,4</p>
    <p class="s">entre as marcas citadas, quando aparece</p>
  </div>
  <div class="num-card na">
    <p class="k">Conversão</p>
    <p class="n">—</p>
    <p class="s">não coletamos os dados</p>
  </div>
</div>
```

---

## 4. Barra segmentada

Para uma composição que soma 100% (sentimento, distribuição de posição). Só
funciona com 2 a 5 fatias; acima disso vira confete.

```html
<div class="seg" role="img"
     aria-label="Sentimento: 61% positivo, 33% neutro, 6% negativo">
  <span style="width:61%;background:var(--good)"></span>
  <span style="width:33%;background:var(--mut)"></span>
  <span style="width:6%;background:var(--red)"></span>
</div>
<ul class="legend">
  <li><i style="background:var(--good)"></i>Positivo <b>61%</b></li>
  <li><i style="background:var(--mut)"></i>Neutro <b>33%</b></li>
  <li><i style="background:var(--red)"></i>Negativo <b>6%</b></li>
</ul>
<p class="leitura">A marca raramente é citada de forma negativa; o problema é
   de <em>frequência</em>, não de reputação.</p>
```

---

## 5. Barras horizontais (ranking)

Sempre ordenado por valor, sempre com o número na ponta. Marque a linha da
marca do cliente — é a única que o leitor procura.

```html
<table class="bars">
  <tr class="me"><th>Polar</th><td><span style="width:22%"></span></td><td class="v">12</td></tr>
  <tr><th>Garmin</th><td><span style="width:74%"></span></td><td class="v">40</td></tr>
  <tr><th>Whoop</th><td><span style="width:39%"></span></td><td class="v">21</td></tr>
</table>
<p class="cap">Prompts em que cada marca aparece (de 54)</p>
```

Largura da barra = valor ÷ maior valor × 100%. Se você normalizar por outra
coisa, escreva qual na legenda — barra com escala escondida é o jeito mais
comum de um painel mentir sem querer.

---

## 6. Funil

Etapas que necessariamente encolhem. Mostre o **absoluto e a retenção** de uma
etapa para a outra; só o absoluto esconde onde vaza.

```html
<ol class="funnel">
  <li><span class="lbl">Prompts rastreados</span>
      <span class="track"><span class="bar" style="width:100%">54</span></span>
      <span class="pct">—</span></li>
  <li><span class="lbl">Com resposta válida</span>
      <span class="track"><span class="bar" style="width:94%">51</span></span>
      <span class="pct">94%</span></li>
  <li><span class="lbl">Com a marca citada</span>
      <span class="track"><span class="bar" style="width:22%">12</span></span>
      <span class="pct">24%</span></li>
</ol>
<p class="leitura">A perda está entre "responde" e "cita": 39 prompts geram
   resposta sem nenhuma menção à marca.</p>
```

---

## 7. Heatmap

Cruzamento de duas dimensões pequenas (motor × categoria, semana × motor).
Acima de ~8×8 fica ilegível — vire tabela.

```html
<table class="heat">
  <thead><tr><th></th><th>ChatGPT</th><th>Gemini</th><th>Claude</th></tr></thead>
  <tbody>
    <tr><th>Comparação</th><td class="h3">7</td><td class="h1">2</td><td class="h0">0</td></tr>
    <tr><th>Recomendação</th><td class="h2">4</td><td class="h2">5</td><td class="h1">1</td></tr>
  </tbody>
</table>
<p class="cap">Menções por motor e tipo de prompt · h0 = 0 · h1 = 1–2 · h2 = 3–5 · h3 = 6–9 · h4 = 10+</p>
```

As classes `h0`–`h4` estão no CSS da casa. Use faixas fixas e diga quais são —
escala contínua sem legenda não é lida, é chutada.

---

## 8. Tabela com legenda

A legenda vai **fora** do `<table>`, em `<div class="cap">`. `<caption>` dentro
de tabela com `overflow:hidden` no container some — já aconteceu.

```html
<div class="cap">Domínios mais citados nas respostas que mencionam a marca</div>
  <table>
    <thead><tr><th>Domínio</th><th class="num">Citações</th><th class="num">Share</th></tr></thead>
    <tbody>
      <tr><td>polar.com</td><td class="num">31</td><td class="num">18%</td></tr>
      <tr><td>dcrainmaker.com</td><td class="num">24</td><td class="num">14%</td></tr>
    </tbody>
  </table>
```

A legenda (`.cap`) vem **antes** da tabela. Números em coluna pedem `class="num"` (alinha à direita e liga
`tabular-nums`) — sem isso a coluna serrilha e some a comparação visual.

---

## 9. "Não coletamos os dados"

O bloco mais importante do conjunto. Quando falta dado, a saída **não** é
estimar, omitir nem deixar o cartão vazio: é dizer o que não foi coletado e por
quê. Isso é o que separa um painel de um argumento de venda.

```html
<section class="gap">
  <h2>O que este painel não mostra</h2>
  <ul>
    <li><b>Volume de busca por prompt</b> — não coletamos os dados;
        os prompts são cadastrados manualmente, não vêm de um provedor de volume.</li>
    <li><b>Cliques e conversão</b> — não coletamos os dados;
        exigiria integração com analytics do site do cliente.</li>
  </ul>
</section>
```

Escreva `não coletamos os dados` com essas palavras. "N/D", "—" e "em breve"
são lidos como falha do sistema; a frase é lida como escopo.

---

## 10. Rodapé de método

Fecha o documento dizendo de onde vem cada número. É o que permite alguém
conferir sem te perguntar.

```html
<footer class="foot">
  <h3>Método</h3>
  <p><b>Presença</b> = prompts com ≥1 menção ÷ prompts rastreados na janela.
     Fonte: <code>results.mention_count &gt; 0</code>, agregado por
     <code>prompt_id</code>.</p>
  <p><b>Ranking</b> = posição da marca na lista de marcas citadas da resposta,
     média simples das respostas com menção. Respostas sem lista ordenada não
     entram no cálculo.</p>
  <p><b>Sentimento</b> classificado por LLM em positivo/neutro/negativo,
     calculado só sobre respostas com menção.</p>
  <p>Janela 26/jul–26/ago/2026 · 4 862 respostas · gerado em 26/ago/2026.</p>
</footer>
```

Se um número foi arredondado, aproximado ou vem de amostra, o rodapé é onde
isso se declara — não a nota de rodapé em cinza 8px que ninguém abre.
