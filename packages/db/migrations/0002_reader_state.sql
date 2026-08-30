-- Adds per-article saved/dismissed triage state and a human-readable
-- explanation of predicted_score, both needed by the Forecast reader UI.

alter table articles
  add column is_saved boolean not null default false,
  add column is_dismissed boolean not null default false,
  add column reason text;

create index articles_saved_idx on articles (user_id, is_saved) where is_saved;
