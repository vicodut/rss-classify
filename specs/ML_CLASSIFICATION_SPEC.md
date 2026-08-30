# ML-Based Article Classification & Scoring — Spec

## 📋 Summary

Today, article tagging (`apps/api/src/modules/scoring/tagging.service.ts`) is pure keyword
substring-matching against a hardcoded list of 9 tags, and relevance scoring
(`apps/api/src/modules/scoring/scoring.service.ts`) is a linear formula over per-tag weights
nudged ±0.05 on each rating. Both work, but neither actually understands article content, and
tags can only be corrected as a side effect of rating an article — there's no standalone
"fix this tag" action.

This spec replaces both with an embedding-based system: articles get a real semantic vector
from their content, new articles are tagged by finding the nearest previously-**confirmed**
articles (k-NN classification), and relevance scoring is regressed the same way from your
nearest previously-**rated** articles. Tags become open-ended — there's no fixed list
anymore, any tag you've ever manually confirmed becomes something the system can recognize
again. Everything runs in-process in the existing Node/Fastify backend via open-source,
self-hosted models — no paid API, no new language, no new service to operate.

This is additive to the existing Phase 1/2 system, not a rewrite: the keyword heuristic in
`tagging.service.ts` stays exactly as-is and becomes the permanent cold-start fallback for
users/tags with no history yet.

---

## 🔒 Personalization boundary

This is worth stating explicitly, because "fully personalized, no cross-user sharing" could
be read two different ways.

**Shared, fixed infrastructure**: the pretrained sentence-embedding model's weights. It is
never fine-tuned on this app's data, by anyone. It's a deterministic function from text to
vector — same category of "shared" as everyone's articles going through the same
`to_tsvector('english', ...)` full-text index today. A frozen feature extractor cannot leak
preference signal between users because it has no memory of any user's data to begin with.

**Personal, RLS-isolated data**: every tag assignment, every "confirmed" flag, every rating,
and every classification decision made *from* that shared feature extractor. All of it lives
in per-user rows, protected by the same owner-scoped RLS policies already covering `articles`
today. Nothing about one user's tagging or ratings is ever visible to, or influences, another
user's classification or scores.

If a genuinely fully-isolated embedding model per user is wanted instead, that's explicitly
not what this spec builds — training or fine-tuning a real model per user is infeasible at
personal-RSS-reader data volumes (a few hundred to a few thousand articles per user) and
would need to be revisited as a much larger project.

---

## 🏗️ Architecture overview

```
Feed refresh (existing: feeds.service.ts → refreshOneFeed)
  │
  ├─ rss-parser fetches items (unchanged)
  │
  ├─ NEW: strip HTML, truncate to title + ~200 words → embed via EmbeddingsService
  │        (batched: one pipeline call per feed's new items)
  │
  ├─ tagArticle() keyword heuristic runs (unchanged, always runs)
  │
  ├─ NEW: ClassificationService.classifyTags(db, userId, embedding)
  │        → k-NN over this user's tags_confirmed=true articles
  │        → if confident: tags = k-NN result
  │        → else: tags = keyword heuristic result (today's behavior)
  │
  ├─ scoreArticle() — extended (see Scoring algorithm below) to use
  │        k-NN over this user's rated articles when available,
  │        keyword-weight score otherwise (today's behavior)
  │
  └─ upsert article row: tags, embedding, embedding_model, predicted_score
     (tags_confirmed = false — nothing at ingest time is human-confirmed)

Manual correction (NEW: PATCH /articles/:id/tags, or existing POST /articles/:id/rate's
tags override)
  │
  └─ tags_confirmed = true, recompute this article's score
     (this article is now eligible as a k-NN neighbor for future classification/scoring)
```

The key mechanism, used for **both** tagging and scoring, is the same: k-NN over embeddings
already sitting in the `articles` table, filtered to rows the user has actually
confirmed/rated. No separate model training step, no background job, no new tables beyond two
columns and a boolean flag.

---

## 🗄️ Database schema

One migration, no new tables. Both new columns inherit the existing owner-scoped RLS policy
on `articles` automatically — this is the main practical payoff of k-NN-over-embeddings
versus the alternative (a per-user tag-prototype table), which would have needed its own
table, its own RLS policy, and exact-arithmetic bookkeeping on every tag removal.

`packages/db/migrations/0002_ml_classification.sql`:

```sql
-- Enables pgvector. Supabase supports this out of the box.
create extension if not exists vector;

alter table articles
  add column embedding vector(384),
  add column embedding_model text,
  add column tags_confirmed boolean not null default false;

-- Optional even at MVP: brute-force cosine distance over a few thousand
-- per-user rows is sub-millisecond. Add an index only if EXPLAIN ANALYZE
-- on real data says it's needed.
-- create index articles_embedding_idx on articles
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

Why `embedding_model` matters: if the embedding model is ever swapped (e.g. upgrading from
MiniLM to BGE-small), vectors from the old and new models are **not comparable** — cosine
similarity between them is meaningless, not just lower-quality. Every k-NN query must filter
`embedding_model = <current model>` so a model swap can never silently corrupt classification
by mixing vector spaces. The current model name is read from `AppConfig.EMBEDDING_MODEL` (new
env var, added to `apps/api/src/core/config.ts`'s existing zod schema).

Why `tags_confirmed` matters: without it, ML-*predicted* tags would eventually get used as
training examples for future predictions — a classic self-training feedback loop where the
model reinforces its own mistakes with no human check. Setting it `true` only on an explicit
human action (rating with a tag override, or the new tag-edit endpoint) keeps the k-NN
"training set" honest.

---

## 📡 API contract changes

All changes are in `packages/contract/src/schemas.ts` and `packages/contract/src/contract.ts`.

### `articleSchema` — one new field

```ts
export const articleSchema = z.object({
  // ...existing fields unchanged...
  tagsConfirmed: z.boolean(),
});
```

### New: manual tag correction, decoupled from rating

```ts
export const updateArticleTagsBodySchema = z.object({
  tags: z.array(z.string()),
});
export type UpdateArticleTagsBody = z.infer<typeof updateArticleTagsBodySchema>;
```

New route in the `articles` sub-router:

```ts
updateTags: {
  method: "PATCH",
  path: "/articles/:id/tags",
  body: updateArticleTagsBodySchema,
  responses: {
    200: articleSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
  summary: "Manually correct an article's tags, independent of rating",
},
```

Semantics — **full-replacement**, not add/remove deltas (matches `RatingDialog.tsx`'s
existing local `tags: string[]` state, so the frontend needs no new mental model):

1. `articles.tags = body.tags`, `articles.tags_confirmed = true`.
2. Recompute **only this article's** `predicted_score` via the existing `scoreArticle`
   formula under the user's current profile weights.
3. Does **not** call `learnFromRating` and does **not** trigger the existing full
   unrated-articles re-rank that `POST /articles/:id/rate` does. Correcting a mislabeled tag
   is a labeling event, not a preference signal — it shouldn't silently move the score of
   every other unrated article the way an actual rating does.

`rateArticleBodySchema`'s existing optional `tags` field is **kept as-is** — good one-dialog
UX in `RatingDialog.tsx`, no reason to force a second round-trip. But this surfaces a real bug
in the *existing* `rate()` implementation that needs fixing alongside this work:
`articles.service.ts`'s `rate()` already accepts a `tags` override today but has no concept of
provenance. It must be updated to also set `tags_confirmed = true` whenever `body.tags` is
present — otherwise a rating-time tag correction wouldn't be usable as a k-NN training
example, which defeats half the point of this system.

### `userProfileSchema` — classifier tuning knobs

```ts
export const userProfileSchema = z.object({
  // ...existing fields unchanged...
  tagKnnK: z.number().int().min(1).max(50),
  tagKnnMinVotes: z.number().int().min(1),
  tagKnnSimilarityFloor: z.number().min(0).max(1),
});
```

Defaults: `tagKnnK = 10`, `tagKnnMinVotes = 2`, `tagKnnSimilarityFloor = 0.18`. Editable via
the existing `PATCH /profile` (`updateProfileBodySchema` gains the same three optional
fields) — this is a one-person app, so self-service tuning through a mechanism that already
exists beats a config file or a redeploy.

---

## 🏷️ Classification algorithm (tagging)

Runs once per new article at feed-ingest time, and is re-run implicitly whenever needed by
the same code path — there's no separate "reclassify" job.

**Tier 2 (primary, once the user has ≥1 confirmed article):**

```sql
select tags
from articles
where user_id = :userId
  and tags_confirmed = true
  and embedding_model = :currentModel
order by embedding <=> :newArticleEmbedding
limit :tagKnnK  -- default 10
```

1. Take the K nearest neighbors by cosine distance (pgvector `<=>` operator).
2. For each tag that appears on at least `tagKnnMinVotes` (default 2) of those K neighbors,
   assign it to the new article. An article can end up with multiple tags, same as today.
3. Sanity floor: if the single *best* neighbor's similarity is below `tagKnnSimilarityFloor`
   (default 0.18), treat this as "no confident match at all" regardless of vote counts, and
   fall through to Tier 1 instead of forcing a low-confidence guess.

**Tier 1 (fallback — unchanged existing code):** the current `TaggingService.tagArticle()`
keyword heuristic. Used whenever a user has zero confirmed articles yet, or the Tier 2 floor
check fails. This is why `tagging.service.ts` is not being deleted or modified — it becomes
the permanent cold-start path, not legacy code.

**Why vote-based k-NN instead of a fixed cosine-similarity threshold**: a single hand-picked
similarity number (e.g. "0.4 means match") is fragile — intra-topic similarity for short RSS
snippets commonly sits in a mushy 0.25–0.55 band with no clean cutoff, and the right number
varies per tag and per user's tagging habits. Voting across K neighbors is far more robust and
needs no per-tag calibration.

**Why not a per-tag prototype/centroid instead of live k-NN**: a single running-average vector
per tag collapses multi-modal tags. A user's "Tech" tag plausibly spans both "new iPhone
hardware" and "Rust compiler internals" articles — semantically distant clusters whose average
is close to neither. k-NN over the actual stored examples doesn't have this problem, and,
since `embedding` is already stored on every article for the scoring use case below, it needs
zero extra bookkeeping (no running-sum table, no exact-subtraction-on-removal logic, no extra
RLS policy).

---

## 📊 Scoring algorithm

Extends `ScoringService.scoreArticle`. The existing formula's structure is kept
(`tagScore * 0.6 + secondTerm * 0.4`); only the second term changes:

```
score = tagScore * 0.6 + secondTerm * 0.4

secondTerm =
  knnScore       if the user has ≥1 rated article with a stored embedding (Tier 2)
  keywordScore   otherwise (Tier 1 — today's existing behavior, unchanged)

clamp(score, 0, 5)
```

**`knnScore`** — k-NN regression over the user's rating history:

```sql
select user_rating, embedding <=> :newArticleEmbedding as distance
from articles
where user_id = :userId
  and user_rating is not null
  and embedding_model = :currentModel
order by distance
limit :tagKnnK  -- same K as tag classification, reused
```

`knnScore` = similarity-weighted average of the neighbors' `user_rating` values (already in
the 0–5 range the formula expects, so no rescaling needed). This is a direct, literal answer
to "the ML should take care of my previous manual ratings" — a new article's predicted score
is regressed from how you rated the articles most similar to it in content, not from a
whole-tag scalar weight.

**Why this replaces `keywordScore` rather than adding a third blended term**: both terms are
trying to capture the same thing — "does this resemble things I've liked" — and
keyword-matching is strictly cruder now that content embeddings exist. Running two overlapping
personalization signals long-term just doubles the surface area to reason about and tune for
no real benefit. `keywordWeights` stays in the schema and profile rather than being
deprecated, though, for two reasons: it's the only *explainable, manually-editable* signal a
user can directly inspect and hand-tune (you can eyeball and edit exact keyword weights; you
can't eyeball an embedding), and it's exactly what naturally fills the Tier-1 cold-start slot
before any ratings exist.

**Consistency fix bundled into this work**: `scoreArticle` currently defaults an unknown tag's
weight to `0` (`weights.tagWeights[tag] ?? 0`), while `learnFromRating` defaults the same case
to `0.5`. With open-ended tags now common (a user can create a brand-new tag any time via the
tag-edit endpoint), this inconsistency means a freshly-created tag actively drags a new
article's score down to zero for that term until the tag is rated once — instead of starting
neutral like every other newly-introduced preference does elsewhere in the system. Align
`scoreArticle` to default to `0.5` as well.

---

## 🧠 Embedding pipeline

New file: `apps/api/src/modules/embeddings/embeddings.service.ts` — a pure internal
`@injectable()` singleton (registered in `core/di-container.ts` alongside the other services),
with **no HTTP routes** — nothing in `packages/contract` exposes this directly, it's an
implementation detail of the tagging/scoring pipeline.

```ts
@injectable()
export class EmbeddingsService {
  async initialize(): Promise<void> { /* loads and warms the pipeline once */ }
  async embed(texts: string[]): Promise<number[][]> { /* batched */ }
}
```

- **Library**: [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js) —
  note this is the *current* maintained package name. The originally-popular
  `@xenova/transformers` was absorbed into Hugging Face and is now the legacy/unmaintained
  name; don't build on it.
- **Model**: see comparison table below. Configurable via `EMBEDDING_MODEL` env var (new field
  on `AppConfig` in `apps/api/src/core/config.ts`, following the same zod-validated pattern as
  every other config value there), not hardcoded — this, combined with the `embedding_model`
  column, makes a future model swap a deliberate, trackable migration instead of a silent
  vector-space mismatch.
- **Warm-up**: `initialize()` is called once at server startup, in `main.ts` before
  `app.listen()` — not lazily on first request, to avoid a latency spike hitting whichever
  request happens to be first.
- **Preprocessing** (both required, neither exists today):
  1. **Strip HTML** from `content` before embedding. RSS `content` is stored raw from
     `rss-parser` (`item.content ?? item.contentSnippet ?? item.summary`) and is never
     HTML-stripped anywhere today — the existing keyword matcher tolerates stray markup fine
     (it's just substring search), but leftover tags/boilerplate would pollute a semantic
     vector.
  2. **Explicit truncation**: `title + " " + first ~200 words of stripped content`, rather
     than relying on the model's implicit ~256-token limit. Blind truncation and deliberate
     lead-truncation can select very different, differently-representative text — pin this
     explicitly rather than leaving it to chance.
- **Batching**: `refreshOneFeed` in `feeds.service.ts` calls `embed()` once per feed refresh
  with all of that feed's new items in one batch call, not once per article. This is both a
  throughput win and the concrete mitigation for the one real performance question this design
  raises (below).
- **Event loop**: Fastify's event loop is single-threaded, and it's worth naming the concern
  explicitly rather than silently ignoring it — but `worker_threads`/`piscina` offloading is
  not warranted for this MVP. `transformers.js` inference is async at the JS boundary (the
  actual matmul work runs in the ONNX runtime's native/WASM backend, not a blocking JS loop),
  this is a single-user-scale app (`RSS_FETCH_CONCURRENCY` defaults to 3), and refreshes are
  periodic/on-demand rather than concurrent request load. Batching per-refresh (above) is the
  right-sized mitigation; revisit worker offloading only if real usage shows it's actually a
  problem.

### Model comparison

| Model | Dim | Size (quantized) | License | transformers.js support | Notes |
|---|---|---|---|---|---|
| **`Xenova/bge-small-en-v1.5`** (recommended) | 384 | ~35MB | MIT | First-class | Purpose-tuned for retrieval/semantic-similarity — the actual task here — rather than general sentence similarity. Tends to benchmark above MiniLM on topic-similarity-style tasks (MTEB). Same dimension as MiniLM, so no extra storage cost for the choice. |
| `Xenova/all-MiniLM-L6-v2` | 384 | ~23MB | Apache-2.0 | First-class, most battle-tested | Smaller and the most widely-used starting point if you'd rather default to the safest/most-documented option first and switch later (the `embedding_model` column makes that switch trackable, not silent). |
| `Xenova/all-mpnet-base-v2` | 768 | ~420MB (fp32; smaller quantized) | Apache-2.0 | First-class | Higher quality, but 2-4x heavier and double the storage per vector. Given how coarse RSS topic classification already is, MiniLM/BGE-small quality is very likely sufficient — only worth revisiting if real-world k-NN accuracy turns out to be a genuine problem. |

---

## 🔄 Migration & backfill plan

**New articles**: embedded once at ingest time in `refreshOneFeed`, right where
`tagArticle`/`scoreArticle` already run today (`feeds.service.ts`). Never re-embedded later.

**Existing rows**: a one-off manual script (e.g. `pnpm --filter api run backfill:embeddings`),
not a lazy on-read backfill (adds latency and partial-completion bookkeeping for no benefit)
and not a job queue (unnecessary machinery at this scale). Stream
`articles where embedding is null`, batch through `EmbeddingsService`, update in chunks —
reuse the same `Effect.forEach(..., { concurrency: N })` pattern already used for the
unrated-articles re-score loop in `articles.service.ts`'s `rate()`. At low-thousands of rows
this completes in well under a minute and only needs to run once, manually, before the
feature ships.

**`tags_confirmed` backfill**: `tags_confirmed = (user_rating is not null)` for existing rows.
Under the current UX, `RatingDialog.tsx` always surfaces tags for edit before a rating
submits, so a rated article's tags were at least seen/implicitly reviewed by the user;
unrated articles' tags are purely keyword-heuristic guesses and default to `false`.

No prototype-table backfill needed — there is no prototype table in this design.

---

## ✅ Implementation checklist

**Database**
- [ ] `packages/db/migrations/0002_ml_classification.sql` — enable `vector` extension, add
      `articles.embedding`/`embedding_model`/`tags_confirmed`
- [ ] Update `packages/db/src/types.ts`'s `ArticleRow` and `Database` types to match
- [ ] One-off backfill script for existing rows (embeddings + `tags_confirmed` heuristic)

**Contract** (`packages/contract`)
- [ ] `articleSchema` gains `tagsConfirmed`
- [ ] New `updateArticleTagsBodySchema` + `articles.updateTags` route
      (`PATCH /articles/:id/tags`)
- [ ] `userProfileSchema` / `updateProfileBodySchema` gain `tagKnnK`, `tagKnnMinVotes`,
      `tagKnnSimilarityFloor`

**Backend** (`apps/api`)
- [ ] `core/config.ts` — add `EMBEDDING_MODEL` env var
- [ ] New `modules/embeddings/embeddings.service.ts` — `@huggingface/transformers` wrapper,
      warmed at startup in `main.ts`
- [ ] New `modules/scoring/classification.service.ts` — k-NN tag classifier (Tier 2) +
      fallback to existing `TaggingService` (Tier 1)
- [ ] `modules/scoring/scoring.service.ts` — add `knnScore` term, wire Tier 1/Tier 2 branch,
      fix the `tagWeights[tag] ?? 0` → `?? 0.5` consistency bug
- [ ] `modules/scoring/tagging.service.ts` — **no changes**, becomes the permanent fallback
- [ ] `modules/articles/articles.service.ts` — new `updateTags` method; fix `rate()` to set
      `tags_confirmed = true` when `body.tags` is present
- [ ] `modules/articles/articles.module.ts` — wire the new `PATCH /articles/:id/tags` route
- [ ] `modules/feeds/feeds.service.ts` — `refreshOneFeed` computes + stores the embedding
      (batched per feed), calls the new classification path
- [ ] `core/di-container.ts` — register `EmbeddingsService`, `ClassificationService`

**Frontend** (`apps/web`) — not required for the ML system to function, listed for
completeness
- [ ] Optional: wire `RatingDialog.tsx`'s tag edits (when rating isn't also changing) to the
      new `PATCH /articles/:id/tags` instead of always going through `rate()` — not required,
      `rate()`'s tag override still works fine
- [ ] Optional follow-up, not required for v1: `TagFilters.tsx` currently only shows the
      fixed 9 `DEFAULT_TAGS`; with open-ended tags this could later show a dynamic
      distinct-tags list instead

---

## 🚫 Explicitly out of scope

- **Per-user tag-prototype/centroid table.** Considered and rejected in favor of live k-NN
  over stored embeddings — see the Classification algorithm section for why (multi-modal tag
  collapse, extra bookkeeping, extra RLS surface, all avoided).
- **Per-user trained logistic/linear regression classifier.** A tempting "Phase 2" once
  enough ratings accumulate, but multi-label classification this way means one binary
  classifier per tag plus a negative-sampling strategy per tag — real design work, not a
  footnote. Left as a separate future spec to write once k-NN's actual real-world accuracy on
  this user's real feed content is known, rather than committed to now on spec alone.
- **A separate Python ML microservice or a self-hosted LLM (Ollama, etc.)** for
  classification. Explicitly ruled out — in-process Node inference was the chosen direction.
- **Cross-user shared classification of any kind.** Explicitly ruled out — see
  Personalization boundary above.

---

## ❓ Open questions / tuning notes

- `tagKnnK = 10`, `tagKnnMinVotes = 2`, `tagKnnSimilarityFloor = 0.18` are reasonable starting
  defaults, not settled science — expect to adjust after seeing real classification behavior
  against this user's actual feed content and tagging habits. They're profile fields
  specifically so this can happen via `PATCH /profile` without a redeploy.
- Whether `bge-small-en-v1.5` actually outperforms `all-MiniLM-L6-v2` in practice on short,
  often-truncated RSS snippets (as opposed to the longer-document retrieval tasks it's
  typically benchmarked on) is worth empirically checking once both are easy to swap between
  via `EMBEDDING_MODEL` — the spec's model-versioning support exists partly to make that A/B
  comparison cheap to run for real.
