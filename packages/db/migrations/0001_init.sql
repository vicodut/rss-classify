-- RSS Aggregator — initial schema
-- Run in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  description text,
  last_fetched timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references feeds(id) on delete cascade,
  url text not null,
  title text not null,
  content text,
  source text,
  tags text[] not null default '{}',
  user_rating int check (user_rating between 1 and 5),
  predicted_score float check (predicted_score between 0 and 5),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored,
  unique (user_id, url)
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tag_weights jsonb not null default '{
    "Tech": 0.5, "Politics": 0.5, "Art": 0.5, "Science": 0.5,
    "Sports": 0.5, "Business": 0.5, "Health": 0.5,
    "Entertainment": 0.5, "Education": 0.5
  }',
  keyword_weights jsonb not null default '{}',
  total_articles_rated int not null default 0,
  average_rating float not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index articles_user_score_idx on articles (user_id, predicted_score desc);
create index articles_tags_idx on articles using gin (tags);
create index articles_published_idx on articles (published_at desc);
create index articles_search_idx on articles using gin (search_vector);
create index feeds_user_idx on feeds (user_id);

-- ============================================================
-- New-user bootstrap: create a profile row the moment someone signs up
-- ============================================================

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security — every table is strictly owner-scoped
-- ============================================================

alter table articles enable row level security;
alter table feeds enable row level security;
alter table user_profiles enable row level security;

create policy "Users manage own articles"
  on articles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own feeds"
  on feeds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own profile"
  on user_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
