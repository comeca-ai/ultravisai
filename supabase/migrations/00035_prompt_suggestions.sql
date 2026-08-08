-- prompt_suggestions: suggestion inbox used by the server's prompt-workflow
-- routes (/api/prompts/suggestions). The table exists in the upstream cloud
-- schema and in the generated web types (src/types/supabase.ts) but no
-- migration ever created it — same inherited gap as cloro_pending_tasks
-- (00034). Server access uses the service role; RLS stays enabled with no
-- policies, matching that precedent.

CREATE TABLE IF NOT EXISTS public.prompt_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  topic_name text,
  suggested_text text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'llm',
  status text NOT NULL DEFAULT 'new',
  est_volume integer,
  added_prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_suggestions_brand_status
  ON public.prompt_suggestions (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_suggestions_generated_at
  ON public.prompt_suggestions (generated_at DESC);

ALTER TABLE public.prompt_suggestions ENABLE ROW LEVEL SECURITY;
