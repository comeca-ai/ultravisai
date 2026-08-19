# -*- coding: utf-8 -*-
"""Gerador dos diagramas UML de atividade (raias) da documentação Ultravis."""
from html import escape

LANE_W, HEAD_H, ROW_H, NODE_W, NODE_H, PAD = 252, 40, 88, 208, 60, 22

def wrap(text, n=30):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 <= n:
            cur = (cur + ' ' + w).strip()
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

class Fig:
    def __init__(self, lanes, rows):
        self.lanes = lanes
        self.rows = rows
        self.nodes = {}
        self.parts = []
    def cx(self, lane): return PAD + lane * LANE_W + LANE_W / 2
    def cy(self, row): return PAD + HEAD_H + 26 + row * ROW_H + NODE_H / 2
    def node(self, nid, lane, row, text, kind='act', sub=None):
        self.nodes[nid] = (self.cx(lane), self.cy(row), kind)
        x, y = self.cx(lane), self.cy(row)
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
            fill = '#26251F'
        n = len(lines)
        y0 = y - (n - 1) * 6.5 - (5 if sub else 0)
        for i, ln in enumerate(lines):
            self.parts.append(
                f'<text x="{x}" y="{y0 + i*13 + 4}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" '
                f'font-size="10.5" font-weight="600" fill="{fill}">{escape(ln)}</text>')
        if sub:
            self.parts.append(
                f'<text x="{x}" y="{y0 + n*13 + 5}" text-anchor="middle" font-family="JetBrains Mono, monospace" '
                f'font-size="8" fill="{"#B9B5A8" if kind=="sys" else "#8C8878"}">{escape(sub)}</text>')
    def dot(self, nid, lane, row, end=False):
        x, y = self.cx(lane), self.cy(row)
        self.nodes[nid] = (x, y, 'dot')
        if end:
            self.parts.append(f'<circle cx="{x}" cy="{y}" r="10" fill="none" stroke="#26251F" stroke-width="1.4"/>')
            self.parts.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#26251F"/>')
        else:
            self.parts.append(f'<circle cx="{x}" cy="{y}" r="8" fill="#26251F"/>')
    def edge(self, a, b, label=None, side=None):
        (x1, y1, k1), (x2, y2, k2) = self.nodes[a], self.nodes[b]
        h1 = 10 if k1 == 'dot' else (NODE_H/2 + 7 if k1 == 'dec' else NODE_H/2)
        h2 = 10 if k2 == 'dot' else (NODE_H/2 + 7 if k2 == 'dec' else NODE_H/2)
        w1 = 10 if k1 == 'dot' else NODE_W/2
        w2 = 10 if k2 == 'dot' else NODE_W/2
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
                lx, ly, anchor = x1 + d*10, y2 - 7, ('start' if d > 0 else 'end')
            else:
                pts = f'{x1+d*w1},{y1} {x2},{y1} {x2},{y2+h2}'
                lx, ly = x1 + d * (w1 + 12), y1 - 9
                anchor = 'start' if d > 0 else 'end'
        self.parts.append(
            f'<polyline points="{pts}" fill="none" stroke="#55524A" stroke-width="1.3" marker-end="url(#a)"/>')
        if label:
            if side == 'left': lx -= 14; anchor = 'end'
            self.parts.append(
                f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" font-family="JetBrains Mono, monospace" '
                f'font-size="8.2" font-style="italic" fill="#7A776E">{escape(label)}</text>')
    def svg(self, aria):
        w = PAD * 2 + LANE_W * len(self.lanes)
        h = PAD * 2 + HEAD_H + 26 + self.rows * ROW_H
        out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{escape(aria)}" '
               f'xmlns="http://www.w3.org/2000/svg">',
               '<defs><marker id="a" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="7" '
               'orient="auto-start-reverse"><path d="M0 0 L10 4 L0 8 z" fill="#55524A"/></marker></defs>',
               f'<rect x="0" y="0" width="{w}" height="{h}" fill="#FFFFFF"/>']
        for i, ln in enumerate(self.lanes):
            x = PAD + i * LANE_W
            out.append(f'<rect x="{x}" y="{PAD}" width="{LANE_W}" height="{HEAD_H}" fill="#EEEBE1" '
                       f'stroke="#C6C2B5" stroke-width="1"/>')
            out.append(f'<text x="{x+LANE_W/2}" y="{PAD+25}" text-anchor="middle" '
                       f'font-family="IBM Plex Sans, sans-serif" font-size="10.5" font-weight="700" '
                       f'letter-spacing="0.04em" fill="#26251F">{escape(ln)}</text>')
            if i:
                out.append(f'<line x1="{x}" y1="{PAD+HEAD_H}" x2="{x}" y2="{h-PAD}" stroke="#DFDCD2" '
                           f'stroke-width="1" stroke-dasharray="3 4"/>')
        out += self.parts
        out.append('</svg>')
        return '\n'.join(out)
