# -*- coding: utf-8 -*-
"""Gera diagrama de raias (swimlane) em SVG a partir de um spec JSON.

Por que existe: desenhar raia à mão em SVG dá errado de um jeito específico —
rótulo estoura a borda do nó, seta cruza caixa, coluna sai do viewBox. Este
script fixa a grade (raia x linha), quebra o texto e roteia as setas em
cotovelo, então o que sobra pra você é decidir o processo, não a geometria.

Uso:
    python raias.py spec.json > figura.svg
    python raias.py spec.json -o figura.svg

Spec (JSON):
{
  "aria": "Descrição do fluxo para leitor de tela",
  "lanes": ["Dono", "Ultravis", "Provedor de IA"],
  "rows": 5,
  "nodes": [
    {"id": "ini", "lane": 0, "row": 0, "kind": "start"},
    {"id": "p",   "lane": 0, "row": 1, "text": "Cadastra prompt", "sub": "web"},
    {"id": "d",   "lane": 1, "row": 2, "text": "Marca citada?", "kind": "dec"},
    {"id": "api", "lane": 2, "row": 2, "text": "Responde", "kind": "ext"},
    {"id": "fim", "lane": 1, "row": 4, "kind": "end"}
  ],
  "edges": [
    {"from": "ini", "to": "p"},
    {"from": "p", "to": "d", "label": "cron 06:00"},
    {"from": "d", "to": "fim", "label": "não", "side": "left"}
  ]
}

kind do nó:
  act   (padrão) caixa branca — ação de uma pessoa
  sys   caixa preta — passo automático do sistema
  ext   caixa tracejada — sistema de terceiro (OpenAI, Supabase, Railway)
  dec   losango — decisão; o texto vira pergunta e as setas saem rotuladas
  start / end   bolinha de início e de fim

`sub` é a linha mono pequena embaixo do rótulo — use pra origem/frequência
("cron 0 6 * * *", "tabela results"), que é o que faz o diagrama ser auditável.
"""
import argparse
import json
import sys
from html import escape

LANE_W, HEAD_H, ROW_H, NODE_W, NODE_H, PAD = 252, 40, 88, 208, 60, 22

INK = '#26251F'
LINE = '#55524A'
MUTED = '#7A776E'


def wrap(text, n=30):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 <= n:
            cur = (cur + ' ' + w).strip()
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


class Fig:
    def __init__(self, lanes, rows):
        self.lanes = lanes
        self.rows = rows
        self.nodes = {}
        self.parts = []

    def cx(self, lane):
        return PAD + lane * LANE_W + LANE_W / 2

    def cy(self, row):
        return PAD + HEAD_H + 26 + row * ROW_H + NODE_H / 2

    def node(self, nid, lane, row, text, kind='act', sub=None):
        x, y = self.cx(lane), self.cy(row)
        self.nodes[nid] = (x, y, kind)
        lines = wrap(text, 28 if kind != 'dec' else 22)
        if kind == 'dec':
            h = NODE_H + 8
            self.parts.append(
                f'<polygon points="{x},{y-h/2-6} {x+NODE_W/2},{y} {x},{y+h/2+6} {x-NODE_W/2},{y}" '
                f'fill="#FBF1DF" stroke="#B8741C" stroke-width="1.4"/>')
            fill = '#7A4E12'
        elif kind == 'ext':
            self.parts.append(
                f'<rect x="{x-NODE_W/2}" y="{y-NODE_H/2}" width="{NODE_W}" height="{NODE_H}" rx="8" '
                f'fill="#F4F2EB" stroke="#9A968A" stroke-width="1.2" stroke-dasharray="5 3"/>')
            fill = '#4C4940'
        elif kind == 'sys':
            self.parts.append(
                f'<rect x="{x-NODE_W/2}" y="{y-NODE_H/2}" width="{NODE_W}" height="{NODE_H}" rx="8" '
                f'fill="#26251F" stroke="none"/>')
            fill = '#FFFFFF'
        else:
            self.parts.append(
                f'<rect x="{x-NODE_W/2}" y="{y-NODE_H/2}" width="{NODE_W}" height="{NODE_H}" rx="8" '
                f'fill="#FFFFFF" stroke="#55524A" stroke-width="1.3"/>')
            fill = INK
        n = len(lines)
        y0 = y - (n - 1) * 6.5 - (5 if sub else 0)
        for i, ln in enumerate(lines):
            self.parts.append(
                f'<text x="{x}" y="{y0 + i*13 + 4}" text-anchor="middle" '
                f'font-family="IBM Plex Sans, sans-serif" font-size="10.5" font-weight="600" '
                f'fill="{fill}">{escape(ln)}</text>')
        if sub:
            self.parts.append(
                f'<text x="{x}" y="{y0 + n*13 + 5}" text-anchor="middle" '
                f'font-family="JetBrains Mono, monospace" font-size="8" '
                f'fill="{"#B9B5A8" if kind == "sys" else "#8C8878"}">{escape(sub)}</text>')

    def dot(self, nid, lane, row, end=False):
        x, y = self.cx(lane), self.cy(row)
        self.nodes[nid] = (x, y, 'dot')
        if end:
            self.parts.append(
                f'<circle cx="{x}" cy="{y}" r="10" fill="none" stroke="{INK}" stroke-width="1.4"/>')
            self.parts.append(f'<circle cx="{x}" cy="{y}" r="6" fill="{INK}"/>')
        else:
            self.parts.append(f'<circle cx="{x}" cy="{y}" r="8" fill="{INK}"/>')

    def edge(self, a, b, label=None, side=None):
        (x1, y1, k1), (x2, y2, k2) = self.nodes[a], self.nodes[b]
        h1 = 10 if k1 == 'dot' else (NODE_H / 2 + 7 if k1 == 'dec' else NODE_H / 2)
        h2 = 10 if k2 == 'dot' else (NODE_H / 2 + 7 if k2 == 'dec' else NODE_H / 2)
        w1 = 10 if k1 == 'dot' else NODE_W / 2
        w2 = 10 if k2 == 'dot' else NODE_W / 2
        if abs(x1 - x2) < 2:                      # mesma raia, vertical
            pts = f'{x1},{y1+h1} {x2},{y2-h2}'
            lx, ly, anchor = x1 + 8, (y1 + h1 + y2 - h2) / 2 + 3, 'start'
        elif abs(y1 - y2) < 2:                    # mesma linha, horizontal
            d = 1 if x2 > x1 else -1
            pts = f'{x1+d*w1},{y1} {x2-d*w2},{y2}'
            lx, ly, anchor = (x1 + x2) / 2, y1 - 8, 'middle'
        else:                                     # cotovelo
            d = 1 if x2 > x1 else -1
            if y2 > y1:
                pts = f'{x1},{y1+h1} {x1},{y2} {x2-d*w2},{y2}'
                lx, ly, anchor = x1 + d * 10, y2 - 7, ('start' if d > 0 else 'end')
            else:
                pts = f'{x1+d*w1},{y1} {x2},{y1} {x2},{y2+h2}'
                lx, ly = x1 + d * (w1 + 12), y1 - 9
                anchor = 'start' if d > 0 else 'end'
        self.parts.append(
            f'<polyline points="{pts}" fill="none" stroke="{LINE}" stroke-width="1.3" '
            f'marker-end="url(#a)"/>')
        if label:
            if side == 'left':
                lx -= 14
                anchor = 'end'
            self.parts.append(
                f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" '
                f'font-family="JetBrains Mono, monospace" font-size="8.2" font-style="italic" '
                f'fill="{MUTED}">{escape(label)}</text>')

    def svg(self, aria):
        w = PAD * 2 + LANE_W * len(self.lanes)
        h = PAD * 2 + HEAD_H + 26 + self.rows * ROW_H
        out = [
            f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{escape(aria)}" '
            f'xmlns="http://www.w3.org/2000/svg">',
            '<defs><marker id="a" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" '
            'markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0 0 L10 4 L0 8 z" fill="{LINE}"/></marker></defs>',
            f'<rect x="0" y="0" width="{w}" height="{h}" fill="#FFFFFF"/>',
        ]
        for i, ln in enumerate(self.lanes):
            x = PAD + i * LANE_W
            out.append(
                f'<rect x="{x}" y="{PAD}" width="{LANE_W}" height="{HEAD_H}" fill="#EEEBE1" '
                f'stroke="#C6C2B5" stroke-width="1"/>')
            out.append(
                f'<text x="{x+LANE_W/2}" y="{PAD+25}" text-anchor="middle" '
                f'font-family="IBM Plex Sans, sans-serif" font-size="10.5" font-weight="700" '
                f'letter-spacing="0.04em" fill="{INK}">{escape(ln)}</text>')
            if i:
                out.append(
                    f'<line x1="{x}" y1="{PAD+HEAD_H}" x2="{x}" y2="{h-PAD}" stroke="#DFDCD2" '
                    f'stroke-width="1" stroke-dasharray="3 4"/>')
        out += self.parts
        out.append('</svg>')
        return '\n'.join(out)


def build(spec):
    lanes = spec['lanes']
    nodes = spec['nodes']
    rows = spec.get('rows') or max(n['row'] for n in nodes) + 1
    fig = Fig(lanes, rows)
    for n in nodes:
        kind = n.get('kind', 'act')
        if kind in ('start', 'end'):
            fig.dot(n['id'], n['lane'], n['row'], end=(kind == 'end'))
        else:
            fig.node(n['id'], n['lane'], n['row'], n.get('text', ''), kind, n.get('sub'))
    for e in spec.get('edges', []):
        fig.edge(e['from'], e['to'], e.get('label'), e.get('side'))
    return fig.svg(spec.get('aria', 'Diagrama de raias'))


def main():
    ap = argparse.ArgumentParser(description='Gera SVG de raias a partir de um spec JSON.')
    ap.add_argument('spec', help='arquivo JSON com lanes/nodes/edges (use - para stdin)')
    ap.add_argument('-o', '--out', help='arquivo de saída (padrão: stdout)')
    args = ap.parse_args()
    raw = sys.stdin.read() if args.spec == '-' else open(args.spec, encoding='utf-8').read()
    svg = build(json.loads(raw))
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(svg + '\n')
    else:
        sys.stdout.write(svg + '\n')


if __name__ == '__main__':
    main()
