# Skills do projeto

Skills empacotadas que capturam padrões de trabalho já validados nesta operação.
Cada pasta é a fonte (editável); o `.skill` ao lado é o pacote instalável.

## material-visual

Produz a versão visual de um material entregue: painel de números, relatório,
diagrama de processo, retrospectiva, one-pager para cliente ou sócio — sempre
HTML auto-contido no padrão da casa.

Codifica o que foi aprendido nos cinco materiais entregues em 26/ago (painel
Polar, wireframe de processos, doc UML, retrospectiva de decisões, relatório de
verificação):

- todo número tem origem declarada;
- o que não foi medido vira bloco **"não coletamos os dados"**, nunca estimativa;
- cada bloco vem com a frase que diz o que ele significa;
- conferência obrigatória renderizando antes de entregar.

Traz `assets/estilo-casa.css` (paleta papel, Fraunces/Plex/Mono, dez blocos de
gráfico), `references/padroes.md` (HTML pronto de cada bloco),
`scripts/raias.py` (gerador de diagrama de raias a partir de spec JSON) e
`scripts/conferir_render.sh` (render headless para inspeção).

Instalar: arraste `material-visual.skill` para o Claude, ou copie a pasta
`material-visual/` para `~/.claude/skills/`.
