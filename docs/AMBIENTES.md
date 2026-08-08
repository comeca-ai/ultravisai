# Ambientes, deploy e onde testar

> Mapa dos ambientes da Ultravis e o fluxo de "testa antes, sobe depois".
> Para o estado geral do projeto, ver `../CONTEXTO.md`.
>
> **Última atualização:** 08/ago/2026

---

## TL;DR — onde eu testo?

- **Antes de mergear:** cada Pull Request ganha uma URL de **preview**
  automática na Vercel (staging do frontend). Abre, testa, só então mergeia.
- **Depois de mergear:** a `main` sobe sozinha para **produção**
  (ultravis.ai).
- **URL de staging estável:** a branch **`staging`** tem sempre a mesma URL
  de preview — bom para deixar algo "de pé" para alguém revisar.

---

## Os ambientes

| Ambiente | Onde | URL | Quem vê | Deploy |
|---|---|---|---|---|
| **Produção** | Vercel (web) + Railway (API) | https://ultravis.ai · https://api.ultravis.ai | Público (domínio custom) | Automático ao mergear na `main` |
| **Preview / staging** | Vercel (web) | `utravisaiclaude-git-<branch>-ultravis.vercel.app` | **Só o time** (login Vercel/SSO) | Automático a cada push em qualquer branch/PR |
| **Staging estável** | Vercel (web) | `utravisaiclaude-git-staging-ultravis.vercel.app` | Só o time (SSO) | Automático a cada push na branch `staging` |
| **Local** | sua máquina | http://localhost:3000 | Só você | `cd web && yarn dev` |
| **Operação** | Railway | https://api.ultravis.ai/ops | Login próprio (Basic Auth) | Junto com o server |

> **Nomes de branch curtos = URL limpa.** Branches longas viram um hash
> (ex.: `...-git-claude-ansvisor-architectur-a4ca08-...`). Para uma URL
> previsível, use nomes curtos (`fix-custos`, `staging`).

## O fluxo padrão (frontend)

```
branch de trabalho ──push──▶ preview URL (testa aqui)
        │
        └── PR ──▶ CI (typecheck+lint+format+testes) ──▶ merge na main ──▶ produção
```

1. Trabalhe numa branch.
2. `git push` → a Vercel cria/atualiza a **preview URL** daquela branch.
3. Abra a preview (pede login Vercel) e valide a mudança visual/comportamento.
4. Abra o PR → a **CI** roda sozinha (precisa ficar verde).
5. Merge na `main` → deploy automático em produção (~1–2 min).

## Ponto de atenção importante (dado compartilhado)

Hoje as previews usam o **mesmo backend e o mesmo banco de produção**
(as variáveis `NEXT_PUBLIC_API_URL` / Supabase valem para preview também).
Ou seja:

- ✅ **Seguro** para testar mudança de **UI, textos, layout, i18n** — o que é
  a grande maioria dos casos (ex.: a página de Custos).
- ⚠️ **Cuidado** com ações que **escrevem ou custam** (despachar scrapes,
  criar marca, rodar rastreamento): numa preview elas mexem em produção e
  gastam crédito de verdade. Para testar esse tipo de fluxo com isolamento,
  precisaríamos de um **stack de staging separado** (ver abaixo).

## Quando montar um staging isolado (backend + banco próprios)

Só vale o custo/esforço quando formos mexer forte no **backend/dados** e
quisermos testar sem tocar produção. Envolveria:

- um projeto **Supabase** de staging (banco + auth próprios);
- um serviço **Railway** de staging (API própria) — e crédito Cloro de teste;
- variáveis de ambiente **escopadas para "Preview"** na Vercel apontando para
  esse backend de staging.

**Recomendação atual:** ainda **não** — enquanto o grosso das mudanças é de
frontend, as previews cobrem. Revisitar ao entrar em features pesadas de
backend (atribuição, billing) ou quando houver clientes pagantes que não
podem ser afetados por teste.

## Rollback

Todo deploy de produção fica como candidato a rollback na Vercel
(Deployments → "Promote to Production" / "Rollback"). Não precisa reverter
commit para voltar rápido — mas depois alinhe o código com o que ficou no ar.
