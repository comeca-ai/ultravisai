# ULTRAVIS BR — Setup Completo (Ansvisor Brasileira)

> **Data:** 07/ago/2026  
> **Estado:** Setup em progresso  
> **Objetivo:** Rodar Ansvisor customizado 100% pt-BR, marca Ultravis, domínio ultravis.ai

---

## 1. Arquitetura Final

```
VISITANTE
   │
   ▼
LANDING — Vercel (React bundle estático + landing novo)
https://ultravis.ai
repo: comeca-ai/ansvisor-br (ou manter comeca-ai/ansvisor)
   │ CTAs sign-up/sign-in apontam pro app
   ▼
APP (front) — Vercel (Next.js 16, pt-BR, cores ultravis)
https://app.ultravis.ai
repo: comeca-ai/ansvisor-br · Root Directory = web
   │
   ├── auth/dados ──► SUPABASE (Postgres + Auth + RLS)
   │                  Mesma conta jer@ultravis.ai
   │                  Novo project (isolado de MVP anterior)
   │                  ref: [SEU_REF_NOVO]
   │
   └── API ────────► BACKEND — Railway (Express + worker + cron)
                     https://api.ultravis.ai
                     repo: comeca-ai/ansvisor-br · Root = /server
                        ├─► CLORO (scraper das IAs)
                        ├─► GEMINI (sugestão de prompts / sentimento)
                        └─► cron: configurável (semanal → diário)
```

---

## 2. Pré-requisitos & Acessos

### Contas/Serviços (você já tem)
- ✅ GitHub org `comeca-ai` (write access)
- ✅ Supabase account `jer@ultravis.ai`
- ✅ Railway workspace `comeca-ai`
- ✅ Vercel team `ultravis`
- ✅ Cloro API key (em chat, vai rotacionar)
- ✅ Google Gemini API key (em chat, vai rotacionar)
- ✅ Domínio `ultravis.ai` (registrado, DNS pronto?)

### Ferramentas Locais
- Node.js 20+
- Yarn (web)
- npm (server)
- Git

---

## 3. Step-by-Step Setup

### **PASSO 1: Preparar Repositório**

Você tem 2 opções:

**Opção A: Renomear o repo existente `comeca-ai/ansvisor` → `comeca-ai/ansvisor-br`**
```bash
# No GitHub, Settings → Rename repository
# (Depois atualize o local clone)
```

**Opção B: Manter `comeca-ai/ansvisor` e criar `comeca-ai/ansvisor-br` novo**
```bash
# Localmente:
git clone https://github.com/ansvisor/ansvisor.git ansvisor-br
cd ansvisor-br
git remote remove origin
git remote add origin https://github.com/comeca-ai/ansvisor-br.git
git push -u origin main
```

*Recomendação: Opção B (menos disrupção)*

---

### **PASSO 2: Configurar Environment Variables**

#### **Web** (`web/.env.local`)
```bash
# Supabase (NOVO project)
NEXT_PUBLIC_SUPABASE_URL=https://[SEU_REF_NOVO].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY_NOVO]

# API Backend
NEXT_PUBLIC_API_URL=https://api.ultravis.ai
# (ou https://ultravis-server-production.up.railway.app até ter domínio)

# App mode
NEXT_PUBLIC_IS_CLOUD=false
NEXT_PUBLIC_APP_URL=https://app.ultravis.ai

# Não-público (build time, Vercel injeta)
SUPABASE_URL=https://[SEU_REF_NOVO].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_NOVO]
STRIPE_SECRET_KEY=sk_test_placeholder_unused
```

#### **Server** (`server/.env`)
```bash
# Supabase
SUPABASE_URL=https://[SEU_REF_NOVO].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY_NOVO]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_NOVO]

# AI Providers
CLORO_API_KEY=[CLORO_KEY_NOVO - ROTACIONAR]
GOOGLE_GENERATIVE_AI_API_KEY=[GEMINI_KEY_NOVO - ROTACIONAR]

# Plataforma
PLATFORM_PROVIDER=cloro
IS_CLOUD=false
NODE_ENV=production

# Cron
DAILY_CRON_SCHEDULE=0 6 * * 1
# (seg 06:00 UTC semanal; mudar p/ '0 6 * * *' = diário)

# CORS
ALLOWED_ORIGINS=https://ultravis.ai,https://app.ultravis.ai,https://www.ultravis.ai,http://localhost:3000,http://localhost:80

# Stripe (não usado, mas precisa existir)
STRIPE_SECRET_KEY=sk_test_placeholder_unused
```

---

### **PASSO 3: Supabase — Novo Project**

1. **Criar project novo** na conta `jer@ultravis.ai`
   - Nome: "Ultravis BR" (ou similar)
   - Region: `us-west-2` (mesmo do MVP anterior, melhor)
   - Anote: `project_ref` (ex: `abcd1234efgh5678`)

2. **Aplicar schema completo**
   - Dashboard → SQL Editor
   - Copie `supabase/schema.sql` (do repo)
   - Cole e clique **Run**
   - ⏳ Espera ~1 min (vai criar todas as tabelas, RLS, triggers)

3. **Copiar chaves**
   - Settings → API
   - Copie: `Project URL`, `anon key`, `service_role key`
   - Recole em `.env` files (web + server)

4. **RLS Check**
   - Tabelas públicas (brands, prompts, etc.) já vêm com RLS habilitado
   - ✅ Sem necessidade de tocar

---

### **PASSO 4: Railway — Novo Service (Backend)**

1. **Criar service**
   - Railway dashboard → Seu projeto `ultravis`
   - New → GitHub Repo
   - Conecte `comeca-ai/ansvisor-br`
   - Root Directory: `/server`

2. **Configure Environment**
   - Variables → Cole os valores de `server/.env`
   - Deploy key (Railway gera automático)

3. **Domínio**
   - Settings → Networking → Custom Domain
   - `api.ultravis.ai` (ou `ultravis-server-production.up.railway.app` temporário)

4. **Deploy**
   - Clique **Deploy**
   - Logs devem mostrar: `server running` + `daily cron active`

---

### **PASSO 5: Vercel — 2 Projects (Landing + App)**

#### **Project 1: Landing**
1. New Project → Import Git repo
2. Repo: `comeca-ai/ansvisor-br`
3. Root Directory: (deixa em branco — é raiz)
4. Build command: (deixa default — Next.js)
5. Deploy
6. Domínio: `ultravis.ai` (Settings → Domains)

#### **Project 2: App**
1. New Project → Import Git repo
2. Repo: `comeca-ai/ansvisor-br` (mesmo repo)
3. Root Directory: `web`
4. Environment: Cole `web/.env.local` (Vercel → Settings → Environment Variables)
5. Deploy
6. Domínio: `app.ultravis.ai` (Settings → Domains)

---

### **PASSO 6: Customizações pt-BR (Código)**

#### **Nome & Descrição**
```typescript
// web/src/config/site.ts
export const siteConfig = {
  name: 'Ultravis',
  description: 'Monitore como ChatGPT, Gemini, Claude e Perplexity falam da sua marca. Score de visibilidade, concorrentes, citações e relatórios — em português.',
  url: 'https://ultravis.ai',
  ogImage: 'https://app.ultravis.ai/opengraph-image',
  links: {
    github: 'https://github.com/ansvisor/ansvisor',
    docs: 'https://docs.ultravis.ai',
  },
};
```

#### **Linguagem Padrão**
```typescript
// web/src/i18n/routing.ts
// Já deve estar pt-BR por padrão
// Se não, alterar locales = ['pt-BR', ...]
```

#### **Cores** (já fazem — revisar)
```css
/* web/src/app/globals.css */
:root {
  --background: #f4f2ed;  /* creme */
  --foreground: #0b0d10;  /* tinta */
  --primary: #d8452f;     /* vermelho */
  --border: #e2ded5;      /* borda */
  /* ... (resto igual) */
}
```

---

### **PASSO 7: Landing Page (sua customização)**

A landing atual é um **React bundle estático**. Duas opções:

**Opção A: Manter bundle atual + atualizar CTAs**
```html
<!-- index.html da landing -->
<!-- Trocar hrefs escapados para apontar pro app novo -->
\"#sign-up\"   → \"https://app.ultravis.ai/sign-up\"
\"#sign-in\"   → \"https://app.ultravis.ai/sign-in\"
```

**Opção B: Reconstruir como Next.js puro (RECOMENDADO)**
- Você pode criar `web/src/app/page.tsx` como landing
- Mesmo domínio `ultravis.ai`
- Mesma paleta de cores
- Melhor SEO + zero bundle warnings

*Recomendação: Opção B (mais clean, melhor integração)*

---

### **PASSO 8: Health Check Ponta-a-Ponta**

1. Abra landing: `https://ultravis.ai`
   - ✅ Página carrega em creme (`#f4f2ed`)
   - ✅ Logo `( · )` visível
   - ✅ CTA apontando pro app

2. Clique em "Criar Conta"
   - ✅ Redireciona pra `https://app.ultravis.ai/sign-up`
   - ✅ Página em português
   - ✅ Fundo creme + tema consistente

3. Crie conta (teste)
   - ✅ Email de confirmação chega
   - ✅ Loga e entra no dashboard

4. Crie marca + prompts
   - ✅ Dashboard exibe pt-BR
   - ✅ Clique "Rodar Prompts Agora"

5. Aguarde rastreio
   - ✅ Backend logs mostram jobs
   - ✅ Após ~30-60 seg, score > 0 aparece
   - ✅ Citações + competitors preenchidos

6. Verá os logs do backend
   - Railway → ultravis (novo service) → Logs
   - Procure por: `tracking run completed`

---

## 4. Variáveis de Ambiente (Resumo)

| Serviço | Variável | Origem | Ação |
|---------|----------|--------|------|
| Vercel (web) | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard | Copiar |
| Vercel (web) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard | Copiar |
| Vercel (web) | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Copiar |
| Vercel (web) | `NEXT_PUBLIC_API_URL` | Railway URL | Copiar |
| Railway (server) | `SUPABASE_URL` | Supabase Dashboard | Copiar |
| Railway (server) | `SUPABASE_ANON_KEY` | Supabase Dashboard | Copiar |
| Railway (server) | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Copiar |
| Railway (server) | `CLORO_API_KEY` | Seu painel Cloro | **Rotacionar** |
| Railway (server) | `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio | **Rotacionar** |

---

## 5. 🔴 Rotação de Segredos (HOJE)

Estes 3 vazaram em chat:

1. **Supabase `service_role`** (novo project)
   - Não precisa rotacionar (é novo)

2. **CLORO_API_KEY**
   - Painel Cloro → gerar nova key → recolar no Railway

3. **GOOGLE_GENERATIVE_AI_API_KEY**
   - Google AI Studio → nova key → recolar no Railway

4. **Tokens antigos (Railway + Vercel)**
   - Revogar os existentes (se houver)

---

## 6. Domínio `ultravis.ai` — DNS

Se o domínio ainda não está apontado:

**No registrador (GoDaddy, Namecheap, etc.):**

```dns
// Para a landing (Vercel)
ultravis.ai  CNAME  cname.vercel-dns.com.

// Para o app (Vercel, outro projeto)
app.ultravis.ai  CNAME  cname.vercel-dns.com.

// Para o backend (Railway)
api.ultravis.ai  CNAME  [railway-domain-cname]
```

Vercel + Railway mostram o CNAME correto no painel de domínio de cada serviço.

---

## 7. Próximos Passos

- [ ] Criar/renomear repo → `ansvisor-br`
- [ ] Setup Supabase (novo project)
- [ ] Setup Railway (novo service backend)
- [ ] Setup Vercel (2 projects: landing + app)
- [ ] Customizações pt-BR + cores
- [ ] Landing page integrada
- [ ] Health check ponta-a-ponta
- [ ] Rotação de segredos
- [ ] DNS apontado
- [ ] Pronto pra divulgar 🎉

---

## 8. Referências

- 📚 [Ansvisor Docs](https://docs.ansvisor.com)
- 🔧 [Supabase Docs](https://supabase.com/docs)
- 🚂 [Railway Docs](https://railway.app/docs)
- ⚡ [Vercel Docs](https://vercel.com/docs)

---

**Última atualização:** 07/ago/2026  
**Próxima ação:** Confirmar setup e começar Passo 1
