#!/usr/bin/env bash
# Renderiza o material e salva um PNG para conferência visual.
# Uso: conferir_render.sh material.html [altura] [saida.png]
# Depois: abra/leia o PNG. Procure por texto encostando na borda de card,
# rótulo de SVG cortado, legenda sumida e tabela empurrando a página.
set -euo pipefail
HTML="${1:?informe o arquivo html}"
ALTURA="${2:-2400}"
SAIDA="${3:-${HTML%.html}.png}"
ABS="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"

for BIN in /opt/pw-browsers/chromium "$(command -v chromium || true)" \
           "$(command -v chromium-browser || true)" "$(command -v google-chrome || true)"; do
  [ -x "${BIN:-}" ] || continue
  "$BIN" --headless --disable-gpu --no-sandbox \
         --window-size=1280,"$ALTURA" --screenshot="$SAIDA" "file://$ABS" 2>/dev/null || true
  [ -s "$SAIDA" ] && { echo "render salvo: $SAIDA"; exit 0; }
done
echo "nenhum navegador headless encontrado — confira o material abrindo no navegador" >&2
exit 1
