-- ═══════════════════════════════════════════════════════════════════════════
-- schema.d1.sql — Espelho D1 do banco Ultravis (experimento, produção intocada)
-- ═══════════════════════════════════════════════════════════════════════════
-- Tradução do schema Postgres (supabase/schema.sql + migrations 00034–00044)
-- para SQLite / Cloudflare D1. 37 tabelas. Fonte da verdade continua sendo o
-- Supabase — este arquivo é um espelho de leitura/experimento (fases na seção
-- "Espelho D1" do ../README.md).
--
-- Aplicado pelo workflow deploy-server-container:
--   npx wrangler@4.129.0 d1 execute ultravis-espelho --remote --file=d1/schema.d1.sql -y
--
-- Convenções de tradução (aplicadas em TODAS as tabelas):
--   uuid        → TEXT (UUIDs do Postgres entram como texto; default local =
--                 lower(hex(randomblob(16))) — 32 hex, único, NÃO formatado
--                 como UUID RFC; linhas importadas mantêm o UUID original)
--   jsonb       → TEXT com JSON (usar json_extract/json_valid do SQLite)
--   timestamptz → TEXT ISO-8601 UTC (default strftime('%Y-%m-%dT%H:%M:%fZ'))
--   numeric     → REAL
--   boolean     → INTEGER 0/1 (CHECK quando NOT NULL)
--   text[]      → TEXT com JSON array (default '[]')
--   enum        → TEXT + CHECK com os valores do enum
--   bigint      → INTEGER (SQLite já é 64-bit)
--
-- O QUE SE PERDEU NA TRADUÇÃO (global — não emulado de propósito):
--   * RLS: as ~20 tabelas com Row Level Security no Postgres ("cada org só vê
--     o seu") aqui NÃO têm segurança nenhuma — D1 não tem roles nem policies.
--     Qualquer consumidor do espelho enxerga tudo. Cabeçalho de cada tabela
--     lista as policies perdidas.
--   * Supabase Auth: o schema auth.* não existe. FKs para auth.users(id)
--     (profiles.id, invitations.invited_by, api_keys.user_id,
--     agent_conversations.user_id, agent_token_usage.user_id) viraram TEXT
--     sem FK — documentado por tabela.
--   * Triggers: on_auth_user_created (cria profile no signup),
--     trg_agent_conversations_touch_updated_at / trg_agent_token_usage_touch_
--     updated_at (updated_at automático) e brands_archive_before_delete
--     (arquivo-morto de marca) não existem — updated_at vira responsabilidade
--     do escritor; o arquivo-morto simplesmente não acontece aqui (ver
--     README.md, seção "Não migradas": brand_archives ficou fora).
--   * RPCs/funções: insights_aggregates, competitor_aggregates,
--     share_of_voice_aggregates, visibility_trend_aggregates,
--     prompt_performance_aggregates, tracked_prompt_count,
--     prompt_visibility_summaries, insights_filter_options,
--     visible_prompt_stats, get_latest_prompt_results, handle_new_user,
--     handle_updated_at, archive_brand_before_delete — nenhuma existe em D1;
--     agregações teriam que ser reescritas como SQL no worker.
--   * GRANTs (anon/authenticated/service_role) — sem equivalente.
--   * NUMERIC(p,s) exato → REAL (ponto flutuante): centavos/scores podem ter
--     diferenças de arredondamento no espelho.
--
-- D1 já roda com enforcement de foreign keys; o PRAGMA abaixo cobre execução
-- local (sqlite3 / miniflare) onde o default é OFF.
PRAGMA foreign_keys = ON;

-- ───────────────────────────────────────────────────────────────────────────
-- 1 · organizations — a conta-cliente (plano, limites, Stripe, chave BYOK)
-- Perdido: RLS (admin update / authenticated insert / member-or-creator
-- select; "Users cannot update plan fields directly").
-- Nota: a FK anthropic_api_key_set_by → profiles é forward (profiles é criada
-- logo abaixo) — SQLite aceita: FKs são resolvidas no DML, não no CREATE.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'incomplete',
  stripe_customer_id TEXT,
  subscription_ends_at TEXT,
  stripe_subscription_id TEXT,
  plan_overrides TEXT,                          -- jsonb
  anthropic_api_key_encrypted TEXT,             -- 00010 (BYOK)
  anthropic_api_key_last4 TEXT,
  anthropic_api_key_set_at TEXT,
  anthropic_api_key_set_by TEXT REFERENCES profiles(id) ON DELETE SET NULL
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2 · profiles — usuários (1:1 com auth.users no Postgres)
-- Perdido: FK id → auth.users(id) ON DELETE CASCADE (Supabase Auth não existe
-- em D1); trigger on_auth_user_created que criava a linha no signup; RLS
-- ("own row select"/"own row update"); enum user_role virou CHECK.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                          -- uuid de auth.users, sem FK
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin','manager','analyst','agency_partner')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  onboarding_completed INTEGER DEFAULT 0        -- boolean
);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles (organization_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3 · invitations — convites de time (00002)
-- Perdido: FK invited_by → auth.users; RLS (member view / admin
-- insert-update-delete); enums user_role e invitation_status viraram CHECK;
-- default de expires_at now()+7 dias traduzido com modificador do strftime.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('admin','manager','analyst','agency_partner')),
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,                     -- uuid de auth.users, sem FK
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_org_email_pending_idx
  ON invitations (organization_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token);

-- ───────────────────────────────────────────────────────────────────────────
-- 4 · api_keys — bearer tokens da API v1/MCP (00003)
-- Perdido: FK user_id → auth.users; RLS (dono vê/cria/revoga/apaga as suas).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,                        -- uuid de auth.users, sem FK
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);

-- ───────────────────────────────────────────────────────────────────────────
-- 5 · brands — a marca monitorada (objeto central)
-- Perdido: RLS (member select / admin-manager insert-update / admin delete);
-- gatilho brands_archive_before_delete (00037 — o arquivo-morto NÃO acontece
-- neste espelho: DELETE aqui perde os dados relacionados via CASCADE);
-- default de tracking_code usava gen_random_bytes(16) → randomblob(16).
-- aliases text[] (00036) → TEXT JSON.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  industry TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  tracking_code TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  region TEXT DEFAULT 'US',
  language TEXT DEFAULT 'en',
  shopping_mode_enabled INTEGER NOT NULL DEFAULT 0 CHECK (shopping_mode_enabled IN (0,1)),  -- 00012
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),                          -- 00020
  aliases TEXT NOT NULL DEFAULT '[]',           -- 00036 (text[] → JSON)
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_brands_organization_id ON brands (organization_id);
CREATE INDEX IF NOT EXISTS idx_brands_tracking_code ON brands (tracking_code);

-- ───────────────────────────────────────────────────────────────────────────
-- 6 · brand_domains — domínios oficiais da marca
-- Perdido: RLS (member select / admin-manager insert-update-delete).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_domains (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  country TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_brand_domains_brand_id ON brand_domains (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 7 · brand_platforms — presença/config por plataforma de IA
-- Perdido: RLS (4 policies "through org").
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_platforms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  check_frequency TEXT NOT NULL DEFAULT 'daily',
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  api_model TEXT,
  UNIQUE (brand_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_brand_platforms_brand_id ON brand_platforms (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 8 · competitors — gabarito de mercado por marca
-- Perdido: RLS (00016 — member select/insert/update/delete via org).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_competitors_brand_id ON competitors (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 9 · topics — tópicos que agrupam prompts
-- Perdido: RLS (00016 — member select/insert/update/delete via org).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_topics_brand ON topics (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 10 · prompt_sets — conjuntos de prompts por marca
-- Perdido: RLS (member select / admin-manager insert-update-delete).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_sets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────────────────────────────────────────────────────────
-- 11 · prompts — as perguntas rastreadas
-- Perdido: RLS (4 policies via prompt_set → brand → org).
-- platforms/regions/models text[] → TEXT JSON. work_status (00031) com CHECK.
-- is_brand_prompt (00040 — share direto × orgânico).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_set_id TEXT NOT NULL REFERENCES prompt_sets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT,
  platforms TEXT NOT NULL DEFAULT '[]',         -- text[] → JSON
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  regions TEXT NOT NULL DEFAULT '[]',           -- text[] → JSON
  models TEXT NOT NULL DEFAULT '[]',            -- text[] → JSON
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  work_status TEXT CHECK (work_status IS NULL OR work_status IN ('todo','in_progress','done')),  -- 00031
  is_brand_prompt INTEGER NOT NULL DEFAULT 0 CHECK (is_brand_prompt IN (0,1))                    -- 00040
);
CREATE INDEX IF NOT EXISTS idx_prompts_topic ON prompts (topic_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 12 · prompt_results — O CORAÇÃO: uma linha por resposta de IA
-- Perdido: RLS ("Users can read own org prompt results" + service-role
-- insert/delete); as RPCs get_latest_prompt_results (2 assinaturas,
-- DISTINCT ON) e toda a família *_aggregates que lê daqui.
-- citations/competitor_mentions/shopping_cards/inline_products/search_queries
-- jsonb → TEXT JSON. visibility_score numeric → REAL.
-- appearance_rank/appearance_rivals (00043).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_results (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  citations TEXT NOT NULL DEFAULT '[]',         -- jsonb
  mention_count INTEGER NOT NULL DEFAULT 0,
  citation_count INTEGER NOT NULL DEFAULT 0,
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  visibility_score REAL NOT NULL DEFAULT 0,
  model_used TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  region TEXT,
  competitor_mentions TEXT NOT NULL DEFAULT '[]',  -- jsonb
  shopping_cards TEXT NOT NULL DEFAULT '[]',       -- 00005 (jsonb)
  inline_products TEXT NOT NULL DEFAULT '[]',      -- 00012 (jsonb)
  search_queries TEXT NOT NULL DEFAULT '[]',       -- 00021 (jsonb)
  appearance_rank INTEGER,                         -- 00043
  appearance_rivals INTEGER                        -- 00043
);
CREATE INDEX IF NOT EXISTS idx_prompt_results_brand_id ON prompt_results (brand_id);
CREATE INDEX IF NOT EXISTS idx_prompt_results_created_at ON prompt_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_results_prompt_id ON prompt_results (prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_results_brand_created ON prompt_results (brand_id, created_at DESC);  -- 00006
CREATE INDEX IF NOT EXISTS prompt_results_appearance_pending_idx                                            -- 00043
  ON prompt_results (created_at DESC) WHERE appearance_rank IS NULL AND mention_count > 0;

-- ───────────────────────────────────────────────────────────────────────────
-- 13 · prompt_result_shopping_cards — cards de shopping normalizados (00011)
-- Perdido: RLS (org member select + service-role insert/delete).
-- price_amount/rating numeric → REAL. raw jsonb → TEXT JSON.
-- matched_brand_id é polimórfico de propósito (sem FK — igual ao Postgres).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_result_shopping_cards (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_result_id TEXT NOT NULL REFERENCES prompt_results(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  product_title TEXT,
  product_brand TEXT,
  price_amount REAL,
  price_currency TEXT,
  image_url TEXT,
  merchant_url TEXT,
  merchant_domain TEXT,
  rating REAL,
  review_count INTEGER,
  raw TEXT NOT NULL,                            -- jsonb
  matched_brand_id TEXT,                        -- polimórfico, sem FK (de propósito)
  matched_brand_role TEXT NOT NULL DEFAULT 'other'
    CHECK (matched_brand_role IN ('own','competitor','other')),
  platform TEXT NOT NULL,
  region TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (prompt_result_id, position)
);
CREATE INDEX IF NOT EXISTS prompt_result_shopping_cards_brand_role_idx
  ON prompt_result_shopping_cards (brand_id, matched_brand_role);
CREATE INDEX IF NOT EXISTS prompt_result_shopping_cards_product_brand_idx
  ON prompt_result_shopping_cards (product_brand);
CREATE INDEX IF NOT EXISTS prompt_result_shopping_cards_merchant_domain_idx
  ON prompt_result_shopping_cards (merchant_domain);

-- ───────────────────────────────────────────────────────────────────────────
-- 14 · prompt_volumes — volume de busca por prompt (DataForSEO)
-- Perdido: RLS server-only (00016 — habilitada SEM policy: só service role).
-- keywords/google_volumes jsonb → TEXT JSON. ai_volume_multiplier
-- numeric(4,3) → REAL. competition (00004) com CHECK.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_volumes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL UNIQUE REFERENCES prompts(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  keywords TEXT NOT NULL,                       -- jsonb
  google_volumes TEXT NOT NULL,                 -- jsonb
  total_google_volume INTEGER NOT NULL,
  ai_volume_multiplier REAL NOT NULL,
  est_ai_volume INTEGER NOT NULL,
  location_code INTEGER,
  language_code TEXT,
  fetched_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  competition_index INTEGER,                    -- 00004
  competition TEXT CHECK (competition IS NULL OR competition IN ('LOW','MEDIUM','HIGH'))
);
CREATE INDEX IF NOT EXISTS idx_prompt_volumes_est_ai_volume ON prompt_volumes (est_ai_volume DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_volumes_prompt_id ON prompt_volumes (prompt_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 15 · prompt_notes — thread de anotações por prompt (00031)
-- Perdido: RLS (member select / admin-manager insert-delete).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_prompt_notes_prompt ON prompt_notes (prompt_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 16 · prompt_target_urls — URLs-alvo por prompt + stats de citação (00031/32)
-- Perdido: RLS (member select / admin-manager insert-delete).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_target_urls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  added_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cited_count INTEGER NOT NULL DEFAULT 0,       -- 00032
  first_cited_at TEXT,                          -- 00032
  last_cited_at TEXT,                           -- 00032
  UNIQUE (prompt_id, url)
);
CREATE INDEX IF NOT EXISTS idx_prompt_target_urls_prompt ON prompt_target_urls (prompt_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 17 · cloro_pending_tasks — fila do modo webhook do Cloro (00034)
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- PK natural task_id (text), sem default.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cloro_pending_tasks (
  task_id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scraper_id TEXT NOT NULL,
  region TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cloro_pending_tasks_brand_id ON cloro_pending_tasks (brand_id);
CREATE INDEX IF NOT EXISTS idx_cloro_pending_tasks_submitted_at ON cloro_pending_tasks (submitted_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 18 · jobs — ledger de execuções (censo, rodadas manuais)
-- Perdido: RLS server-only (00016 — habilitada SEM policy: só service role).
-- data/progress/result jsonb → TEXT JSON. CHECKs de status/type preservados.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type TEXT NOT NULL CHECK (type IN ('tracking','content')),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','active','completed','failed','cancelled')),
  data TEXT NOT NULL DEFAULT '{}',              -- jsonb
  progress TEXT,                                -- jsonb
  result TEXT,                                  -- jsonb
  failed_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_brand_id ON jobs (brand_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs (type, status);

-- ───────────────────────────────────────────────────────────────────────────
-- 19 · topic_suggestions — sugestões de tópicos por LLM (00030)
-- Perdido: RLS (member select / admin-manager-analyst update).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_suggestions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'llm',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','added','dismissed')),
  added_topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_topic_suggestions_brand_status ON topic_suggestions (brand_id, status);

-- ───────────────────────────────────────────────────────────────────────────
-- 20 · prompt_suggestions — inbox de sugestões de prompts (00035)
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- Default de expires_at now()+72h → strftime com '+72 hours'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_suggestions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  topic_name TEXT,
  suggested_text TEXT NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'llm',
  status TEXT NOT NULL DEFAULT 'new',
  est_volume INTEGER,
  added_prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+72 hours')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_prompt_suggestions_brand_status ON prompt_suggestions (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_suggestions_generated_at ON prompt_suggestions (generated_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 21 · fanout_query_intents — cache de intent das sub-queries (00022)
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- PK natural: a query normalizada.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fanout_query_intents (
  query TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────────────────────────────────────────────────────────────────────
-- 22 · volume_usage — quota mensal de análises de volume por org
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS volume_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  action TEXT NOT NULL,
  prompt_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_volume_usage_org_month ON volume_usage (organization_id, used_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 23 · content_opportunities — recomendações de conteúdo por prompt/marca
-- Perdido: RLS (member select / admin-manager insert-update-delete).
-- source_data/webhook_response/brief jsonb → TEXT JSON.
-- opportunity_score numeric(5,2) → REAL.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_opportunities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'owned',
  impact TEXT NOT NULL DEFAULT 'medium',
  opportunity_score REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  source_data TEXT DEFAULT '{}',                -- jsonb
  webhook_sent_at TEXT,
  webhook_response TEXT,                        -- jsonb
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  brief TEXT                                    -- jsonb
);
CREATE INDEX IF NOT EXISTS idx_co_brand_id ON content_opportunities (brand_id);
CREATE INDEX IF NOT EXISTS idx_co_score ON content_opportunities (opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_co_status ON content_opportunities (status);

-- ───────────────────────────────────────────────────────────────────────────
-- 24 · brief_usage — quota mensal de briefs gerados (00015)
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brief_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES content_opportunities(id) ON DELETE SET NULL,
  used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_brief_usage_org_month ON brief_usage (organization_id, used_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 25 · webhook_configs — webhooks de saída por marca
-- Perdido: RLS (member select / admin-manager insert-update-delete).
-- events text[] → TEXT JSON (default era '{opportunity.sent}').
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT,
  events TEXT DEFAULT '["opportunity.sent"]',   -- text[] → JSON
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (brand_id, name)
);
CREATE INDEX IF NOT EXISTS idx_wc_brand_id ON webhook_configs (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 26 · site_audits — auditoria de citabilidade, uma linha por run (00017/18)
-- Perdido: RLS (member select/insert/update/delete via org).
-- category_scores/recommendations jsonb → TEXT JSON. total_score → REAL.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_audits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  final_url TEXT,
  status TEXT NOT NULL DEFAULT 'running',       -- running | completed | failed
  total_score REAL,
  category_scores TEXT NOT NULL DEFAULT '{}',   -- jsonb
  signals_evaluated INTEGER,
  signals_total INTEGER,
  rubric_version TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  recommendations TEXT NOT NULL DEFAULT '[]'    -- 00018 (jsonb)
);
CREATE INDEX IF NOT EXISTS site_audits_brand_id_idx ON site_audits (brand_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 27 · audit_signal_results — um sinal avaliado por linha (00017)
-- Perdido: RLS (member select/insert/delete herdando do audit pai).
-- evidence jsonb → TEXT JSON. score numeric → REAL.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_signal_results (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  audit_id TEXT NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL,                         -- pass | warn | fail | na
  score REAL,
  evidence TEXT NOT NULL DEFAULT '{}',          -- jsonb
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (audit_id, signal_key)
);
CREATE INDEX IF NOT EXISTS audit_signal_results_audit_id_idx ON audit_signal_results (audit_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 28 · site_audit_usage — quota mensal de audits por org (00019)
-- Perdido: RLS server-only (habilitada SEM policy — só service role).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_audit_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id TEXT REFERENCES site_audits(id) ON DELETE SET NULL,
  used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_site_audit_usage_org_month ON site_audit_usage (organization_id, used_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 29 · site_crawls — varredura multi-página do site (00042, fork)
-- Perdido: RLS (member select; escrita só service role).
-- pages/coverage jsonb → TEXT JSON. score numeric → REAL.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_crawls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  page_count INTEGER,
  pages_scored INTEGER,
  score REAL,
  pages TEXT,                                   -- jsonb
  coverage TEXT,                                -- jsonb
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS site_crawls_brand_created_idx ON site_crawls (brand_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 30 · brand_review_checks — checagem direta de plataformas de review
-- (00041, fork — D4 do IC). found=NULL significa "não verificável".
-- Perdido: RLS (member select; escrita só service role).
-- rating numeric → REAL.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_review_checks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT,
  found INTEGER,                                -- boolean; NULL = não verificável
  rating REAL,
  review_count INTEGER,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (brand_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_brand_review_checks_brand_id ON brand_review_checks (brand_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 31 · index_weights — pesos calibráveis do Índice de Citabilidade
-- (00039, fork). Seed preservado (INSERT OR IGNORE = on conflict do nothing).
-- Perdido: RLS ("authenticated read"; escrita só service role via /ops).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS index_weights (
  dim_key TEXT PRIMARY KEY
    CHECK (dim_key IN ('dim1','dim2','dim3','dim4','dim5','dim6')),
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO index_weights (dim_key, weight) VALUES
  ('dim1', 15), ('dim2', 20), ('dim3', 12), ('dim4', 18), ('dim5', 22), ('dim6', 13);

-- ───────────────────────────────────────────────────────────────────────────
-- 32 · sent_pulses — dedupe do Daily Pulse (00038 + uso no server)
-- ATENÇÃO: o CREATE TABLE desta tabela NÃO existe nas migrations do repo
-- (herdada do upstream, criada direto na produção). DDL abaixo RECONSTRUÍDO
-- a partir do uso em server/src/lib/pulse/engine.js + do índice parcial da
-- migration 00038. Conferir contra a produção antes da fase B (carga).
-- Perdido: RLS server-only. warning_keys text[] → TEXT JSON.
-- Índice parcial de janela usa json_extract no lugar de payload->'window'->>'to'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sent_pulses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  pulse_date TEXT NOT NULL,                     -- 'YYYY-MM-DD'
  frequency TEXT,
  payload TEXT NOT NULL DEFAULT '{}',           -- jsonb (métricas + window)
  warning_keys TEXT NOT NULL DEFAULT '[]',      -- text[] → JSON
  email_sent INTEGER DEFAULT 0,
  email_recipient_count INTEGER DEFAULT 0,
  webhook_sent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (brand_id, pulse_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS sent_pulses_brand_window_key
  ON sent_pulses (brand_id, json_extract(payload, '$.window.to'))
  WHERE json_extract(payload, '$.window.to') IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 33 · ai_traffic_logs — visitas vindas de IAs (pixel de tracking)
-- Perdido: RLS (org member select + service-role insert).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_traffic_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  referrer TEXT,
  source_platform TEXT,
  user_agent TEXT,
  ip_address TEXT,
  country TEXT,
  language TEXT,
  screen TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_traffic_logs_brand_created ON ai_traffic_logs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_traffic_logs_brand_id ON ai_traffic_logs (brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_traffic_logs_created_at ON ai_traffic_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_traffic_logs_source_platform ON ai_traffic_logs (source_platform);

-- ───────────────────────────────────────────────────────────────────────────
-- 34 · reports — relatórios imutáveis (snapshot em payload) (00023)
-- Perdido: RLS (member select/insert/delete; sem UPDATE de propósito —
-- a imutabilidade era garantida pela AUSÊNCIA de policy de update, aqui não
-- há nada impedindo um UPDATE). payload jsonb → TEXT JSON.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'executive_summary',
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',           -- jsonb
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS reports_brand_id_idx ON reports (brand_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 35 · agent_conversations — chat do agente in-app (00009)
-- Perdido: FK user_id → auth.users; RLS (dono lê/escreve as suas); trigger
-- trg_agent_conversations_touch_updated_at (updated_at automático).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,                        -- uuid de auth.users, sem FK
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_updated
  ON agent_conversations (user_id, updated_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 36 · agent_messages — mensagens do chat do agente (00009)
-- Perdido: RLS (via conversa do dono). tool_calls/tool_result jsonb → TEXT.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls TEXT,                              -- jsonb
  tool_call_id TEXT,
  tool_name TEXT,
  tool_result TEXT,                             -- jsonb
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conv_created
  ON agent_messages (conversation_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────
-- 37 · agent_token_usage — bucket mensal de tokens do agente (00009)
-- Perdido: FK user_id → auth.users; RLS (dono lê o seu); trigger de
-- updated_at. bigint → INTEGER (64-bit no SQLite).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_token_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,                        -- uuid de auth.users, sem FK
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,                     -- 'YYYY-MM'
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, organization_id, year_month)
);
CREATE INDEX IF NOT EXISTS idx_agent_token_usage_user_month
  ON agent_token_usage (user_id, year_month);

-- ─── censo_agregados ─────────────────────────────────────────────────────────
-- NÃO é espelho de tabela do Supabase: é a ponte de leitura (07/set). O worker
-- (que tem a SERVICE_ROLE como Secret) agrega o censo lá e grava aqui só
-- CONTAGENS por dia x marca x motor — nada de texto de resposta, citação ou
-- dado de usuário. Assim /espelho/censo e o pipeline leem os números sem que
-- nenhuma credencial nova precise existir. Ver src/censo-espelho.js.
CREATE TABLE IF NOT EXISTS censo_agregados (
  dia            TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
  marca          TEXT NOT NULL,
  motor          TEXT NOT NULL,
  respostas      INTEGER NOT NULL DEFAULT 0,
  mencoes        INTEGER NOT NULL DEFAULT 0,
  citacoes       INTEGER NOT NULL DEFAULT 0,
  sent_pos       INTEGER NOT NULL DEFAULT 0,
  sent_neu       INTEGER NOT NULL DEFAULT 0,
  sent_neg       INTEGER NOT NULL DEFAULT 0,
  atualizado_em  TEXT NOT NULL,
  PRIMARY KEY (dia, marca, motor)
);
CREATE INDEX IF NOT EXISTS idx_censo_agregados_dia ON censo_agregados (dia);

-- fim — 37 tabelas. brand_archives ficou FORA (ver README.md, "Não migradas").
