# MCP & API v1 da Ultravis

> A Ultravis expõe seus dados de visibilidade em IA como um **servidor MCP**
> (para clientes como Claude Desktop e Cursor) e como uma **API REST v1**
> (para scripts e BI, ex.: Looker Studio). Ambos vivem no app Next.js e
> autenticam por **API key**. Estado geral: `../CONTEXTO.md`.
>
> **Última atualização:** 08/ago/2026

---

## 1. O que é

Qualquer cliente compatível com **MCP** (Model Context Protocol) — Claude
Desktop, Cursor, Zed, Claude Code… — pode conectar na Ultravis e "conversar"
com os dados da sua marca: *"qual a visibilidade da Polar em IA esta semana?"*,
*"quem as IAs mais citam na minha categoria?"*. A resposta vem **da Ultravis**.

- **Endpoint MCP:** `https://ultravis.ai/api/mcp` (Streamable HTTP)
- **API REST v1:** `https://ultravis.ai/api/v1/*`
- **Auth:** Bearer **API key** (prefixo `ans_`), gerada em **Settings → API Keys**
- Código: `web/src/app/api/mcp`, `web/src/app/api/v1`, `web/src/lib/mcp/`

## 2. Gerar uma API key

1. Entre no dashboard → **Settings → API Keys**.
2. Crie uma chave e **copie na hora** (ela começa com `ans_` e só aparece uma vez).
3. Guarde como segredo — trate como senha (não colar em chat/commit).

## 3. Testar com curl

```bash
export ULTRAVIS_API_KEY="ans_sua_chave"

curl -s -X POST https://ultravis.ai/api/mcp \
  -H "Authorization: Bearer $ULTRAVIS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

- **Lista de tools** de volta → está tudo certo.
- **401 `Invalid API key`** → chave errada/inativa.
- **404** → rota não deployada (não deve acontecer em produção).

## 4. Conectar no Claude Desktop

O Claude Desktop lê `claude_desktop_config.json` (Settings → Developer → Edit
Config). Use a ponte `mcp-remote` para um servidor HTTP com header de auth:

```json
{
  "mcpServers": {
    "ultravis": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://ultravis.ai/api/mcp",
        "--header",
        "Authorization: Bearer ans_sua_chave"
      ]
    }
  }
}
```

Reinicie o Claude Desktop; a Ultravis aparece como servidor MCP e as tools
ficam disponíveis no chat.

## 5. Conectar no Cursor

O Cursor suporta MCP HTTP nativo. Em `.cursor/mcp.json` (projeto) ou nas
configurações globais:

```json
{
  "mcpServers": {
    "ultravis": {
      "url": "https://ultravis.ai/api/mcp",
      "headers": { "Authorization": "Bearer ans_sua_chave" }
    }
  }
}
```

> O formato exato de config pode variar com a versão do cliente — se mudar,
> o essencial é sempre: **URL do endpoint + header `Authorization: Bearer`**.

## 6. API REST v1 (scripts / BI / Looker Studio)

Mesma auth (Bearer `ans_`), superfície REST paralela ao MCP:

| Endpoint | O quê |
|---|---|
| `/api/v1/whoami` | valida a chave e retorna o contexto |
| `/api/v1/brands` | marcas acessíveis |
| `/api/v1/visibility-summary` | resumo de visibilidade |
| `/api/v1/visibility-trend` | série diária de visibilidade |
| `/api/v1/competitor-comparison` | share of voice vs concorrentes |
| `/api/v1/citations` | domínios/fontes citados |
| `/api/v1/ai-traffic` | tráfego de IA por plataforma |
| `/api/v1/prompt-performance` | desempenho por prompt |
| `/api/v1/shopping-cards` | cards de shopping |

O **conector de Looker Studio** (`integrations/looker-studio`) consome essa
API — para usá-lo com a Ultravis, aponte o `BASE_URL` (em `Code.js`) e o
`urlFetchWhitelist` (em `appsscript.json`) para `https://ultravis.ai` e
rebrande o logo/nome antes de publicar.

## 7. Ferramentas MCP disponíveis (23)

Marcas & visibilidade: `list_brands`, `get_visibility_summary`,
`get_visibility_trend`, `get_product_visibility`, `get_ai_traffic`.
Concorrência & citações: `get_competitor_comparison`, `list_citations`.
Prompts & tópicos: `list_prompts`, `get_prompt_performance`,
`get_prompt_volumes`, `list_topics`, `list_topic_suggestions`,
`accept_topic_suggestion`, `dismiss_topic_suggestion`.
Conteúdo: `list_content_opportunities`, `get_content_opportunity`,
`generate_content_brief`, `update_opportunity_status`.
Auditoria de site: `list_site_audits`, `get_site_audit`, `run_site_audit`,
`get_site_audit_quota`. Shopping: `list_shopping_cards`.

> Sempre chame `list_brands` primeiro para resolver o `brand_id` antes das
> demais tools.

## 8. Notas

- O servidor MCP se anuncia como **`ultravis`** (rebrandeado do upstream
  `ansvisor`). O prefixo das chaves segue `ans_` (trocar invalidaria chaves
  existentes; migração fica para depois, se desejado).
- A **API key é um segredo** — rotacione se vazar; revogue em Settings → API Keys.
