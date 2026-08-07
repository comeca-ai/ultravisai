# Checklist de rebrand — POC <nome>

Rebrand de POC toca **somente** os arquivos abaixo (camada 2 da ARQUITETURA-POCS.md §6). Se parecer necessário tocar em outro lugar, pare e releia a §3 (regras anti-drift).

## Mínimo (15 min)

- [ ] **Nome e URLs** — `web/src/config/site.ts` (`name`, `description`, `url`, `ogImage`, `links`, `legal`)
- [ ] **Cores** — `web/src/app/globals.css`: ajustar tokens principais
  - `--background` · `--foreground` · `--primary` · `--border`
- [ ] **Logos** — substituir `web/public/logo_light.svg` e `web/public/logo_dark.svg`

## Opcional

- [ ] **Textos** — `web/messages/pt-BR.json` (e `en.json` se a POC for bilíngue); o default do fork já é pt-BR
- [ ] **Idiomas** — `web/src/i18n/routing.ts` (`locales`, `defaultLocale`) — só se a POC pedir outro idioma
- [ ] **Tema claro/escuro default** — o fork já usa `light` como default no ThemeProvider

## Verificação

- [ ] `cd web && yarn lint && yarn typecheck`
- [ ] Abrir `/` e `/dashboard`: nome, logo e cores da POC aparecem em claro e escuro
- [ ] OG image / título da aba corretos
