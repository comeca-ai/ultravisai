-- cloro_pending_tasks — webhook-mode bookkeeping for Cloro scraper tasks.
--
-- When CLORO_WEBHOOK_URL is set, the tracking worker records every submitted
-- Cloro task here so /cloro/callback can map the async result back to its
-- prompt/brand (see server/src/workers/tracking-worker.js and
-- server/src/server.js). Rows are deleted as results arrive; anything older
-- than the 2h delivery window is swept by cleanupStalePendingTasks().
--
-- The table was referenced by the server but never created by any migration
-- (the numbering gap at 00007 upstream), so webhook-mode tracking and the
-- startup sweep failed with PGRST205 "Could not find the table
-- 'public.cloro_pending_tasks'". Note: upstream also numbers migrations from
-- 00034; filenames differ so both can coexist when syncing the fork.

CREATE TABLE IF NOT EXISTS "public"."cloro_pending_tasks" (
    "task_id" "text" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "scraper_id" "text" NOT NULL,
    "region" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cloro_pending_tasks_pkey" PRIMARY KEY ("task_id"),
    CONSTRAINT "cloro_pending_tasks_prompt_id_fkey" FOREIGN KEY ("prompt_id")
        REFERENCES "public"."prompts"("id") ON DELETE CASCADE,
    CONSTRAINT "cloro_pending_tasks_brand_id_fkey" FOREIGN KEY ("brand_id")
        REFERENCES "public"."brands"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."cloro_pending_tasks" OWNER TO "postgres";

-- The webhook drain loop polls by brand, and the stale sweep filters by age.
CREATE INDEX IF NOT EXISTS "idx_cloro_pending_tasks_brand_id"
    ON "public"."cloro_pending_tasks" ("brand_id");
CREATE INDEX IF NOT EXISTS "idx_cloro_pending_tasks_submitted_at"
    ON "public"."cloro_pending_tasks" ("submitted_at");

-- Internal server-only table: the server uses the service role key (bypasses
-- RLS). Enabling RLS with no policies keeps anon/authenticated clients out.
ALTER TABLE "public"."cloro_pending_tasks" ENABLE ROW LEVEL SECURITY;
