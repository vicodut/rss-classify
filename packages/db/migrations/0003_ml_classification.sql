-- ML-based classification & scoring (see specs/ML_CLASSIFICATION_SPEC.md).
-- Adds a content embedding per article plus a provenance flag distinguishing
-- human-confirmed tags from machine guesses, and two k-NN RPC functions used
-- by the backend instead of raw vector-distance ordering (which the
-- supabase-js query builder can't express directly).

create extension if not exists vector;

alter table articles
  add column embedding vector(384),
  add column embedding_model text,
  add column tags_confirmed boolean not null default false;

-- Backfill heuristic for rows that predate this column: under the existing
-- UX, RatingDialog always surfaces tags for edit before a rating submits, so
-- a rated article's tags were at least seen/implicitly reviewed.
update articles set tags_confirmed = true where user_rating is not null;

alter table user_profiles
  add column tag_knn_k int not null default 10,
  add column tag_knn_min_votes int not null default 2,
  add column tag_knn_similarity_floor float not null default 0.18;

-- Optional even at MVP: brute-force cosine distance over a few thousand
-- per-user rows is sub-millisecond. Add an index only if EXPLAIN ANALYZE
-- on real data says it's needed.
-- create index articles_embedding_idx on articles
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- security invoker (the default): runs as the calling role, so RLS on
-- `articles` still applies through this function exactly as it would
-- through a normal select — match_user_id is a query filter for index
-- usage, not a trust boundary.
create function match_confirmed_tags(
  query_embedding vector(384),
  match_user_id uuid,
  match_model text,
  match_count int
)
returns table (tags text[], similarity float)
language sql stable
as $$
  select tags, 1 - (embedding <=> query_embedding) as similarity
  from articles
  where user_id = match_user_id
    and tags_confirmed = true
    and embedding_model = match_model
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

create function match_rated_articles(
  query_embedding vector(384),
  match_user_id uuid,
  match_model text,
  match_count int
)
returns table (user_rating int, similarity float)
language sql stable
as $$
  select user_rating, 1 - (embedding <=> query_embedding) as similarity
  from articles
  where user_id = match_user_id
    and user_rating is not null
    and embedding_model = match_model
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_confirmed_tags(vector, uuid, text, int) to authenticated;
grant execute on function match_rated_articles(vector, uuid, text, int) to authenticated;
