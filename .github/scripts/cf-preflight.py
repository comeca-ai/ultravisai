"""Lê uma resposta da API da Cloudflare no stdin e diz, em português, o que ela
prova sobre o token. Existe como arquivo (e não embutido no workflow) porque a
versão em heredoc quebrava: o `sed` que desindentava não sobrevive a Python
aninhado, e o run #22 morreu com IndentationError em todas as sondagens.

Uso: <resposta json> | python3 cf-preflight.py <ler|escrever|politicas>
"""

import json
import sys


def carregar():
    try:
        return json.load(sys.stdin)
    except Exception:
        return None


def veredito_escrita(d):
    """DELETE num script inexistente: a API nega por PERMISSÃO (10000) antes de
    olhar se o alvo existe. Então 10000 = sem Workers Scripts:Edit, e
    'não encontrado' (10007) = a permissão existe. Nada é criado nem apagado."""
    erros = d.get("errors") or []
    codigos = [e.get("code") for e in erros]
    msgs = "; ".join(str(e.get("message")) for e in erros)
    if d.get("success"):
        return "SIM (sucesso — alvo inexistente)"
    if 10000 in codigos:
        return "NAO — falta Workers Scripts: Edit (%s)" % msgs
    if any(c in (10007, 10090) for c in codigos) or "not found" in msgs.lower():
        return "SIM — escreve (alvo inexistente: %s)" % msgs
    return "indeterminado: %s %s" % (codigos, msgs)


def politicas(d):
    if not d.get("success"):
        return [
            "  (o token nao pode listar a si mesmo — precisa de "
            "User -> API Tokens: Read; nao e obrigatorio pro deploy)"
        ]
    linhas = []
    for t in d.get("result") or []:
        linhas.append('  token "%s" (%s)' % (t.get("name"), t.get("status")))
        for pol in t.get("policies") or []:
            for g in pol.get("permission_groups") or []:
                linhas.append("    - %s" % g.get("name"))
    return linhas or ["  (nenhum token retornado)"]


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else "ler"
    d = carregar()
    if d is None:
        print("indeterminado (resposta nao-JSON)")
        return
    if modo == "ler":
        msgs = "; ".join(str(e.get("message")) for e in d.get("errors") or [])
        print("sim" if d.get("success") else "NAO: %s" % msgs)
    elif modo == "escrever":
        print(veredito_escrita(d))
    elif modo == "politicas":
        for linha in politicas(d):
            print(linha)
    else:
        print("modo desconhecido: %s" % modo)


if __name__ == "__main__":
    main()
