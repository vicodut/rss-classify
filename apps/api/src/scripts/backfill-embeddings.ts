import "reflect-metadata";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: ".env.local" });

import { Effect } from "effect";
import { createServiceRoleClient } from "@rss-agg/db";
import { loadConfig } from "../core/config.js";
import { EmbeddingsService, prepareTextForEmbedding } from "../modules/embeddings/embeddings.service.js";

/**
 * One-off backfill for articles.embedding on rows that predate migration
 * 0003 — new articles get embedded at ingest time (feeds.service.ts) and
 * never need this. Run once, manually, before relying on ML
 * tagging/scoring for a project with pre-existing data:
 *
 *   pnpm --filter api run backfill:embeddings
 *
 * Uses the service-role client since this spans every user and there's no
 * per-request bearer token for RLS to key off of — same carve-out as the
 * feed-refresh scheduler.
 */
const BATCH_SIZE = 50;
const CONCURRENCY = 5;

async function main() {
  const config = loadConfig();
  const db = createServiceRoleClient({
    url: config.SUPABASE_URL,
    anonKey: config.SUPABASE_ANON_KEY,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });

  const embeddings = new EmbeddingsService(config);
  await embeddings.initialize();

  let totalBackfilled = 0;
  for (;;) {
    const { data: rows, error } = await db
      .from("articles")
      .select("id, title, content")
      .is("embedding", null)
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const vectors = await embeddings.embed(rows.map((row) => prepareTextForEmbedding(row.title, row.content)));

    await Effect.runPromise(
      Effect.forEach(
        rows,
        (row, i) =>
          Effect.tryPromise(async () => {
            const { error: updateError } = await db
              .from("articles")
              .update({ embedding: vectors[i], embedding_model: config.EMBEDDING_MODEL })
              .eq("id", row.id);
            if (updateError) throw updateError;
          }),
        { concurrency: CONCURRENCY },
      ),
    );

    totalBackfilled += rows.length;
    console.log(`Backfilled ${totalBackfilled} articles so far...`);
  }

  console.log(`Done. Backfilled ${totalBackfilled} articles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
