-- Removes the fixed 9-tag taxonomy (Tech/Politics/Art/Science/Sports/
-- Business/Health/Entertainment/Education) that new user_profiles rows
-- previously seeded into tag_weights. Tags are fully open-ended now — the
-- ML classification pipeline (see specs/ML_CLASSIFICATION_SPEC.md) and
-- manual tagging are the only sources of tag vocabulary going forward, and
-- scoring already defaults any unknown tag's weight to 0.5 (neutral), so
-- there's nothing else that depends on a fixed set existing.

alter table user_profiles alter column tag_weights set default '{}'::jsonb;

-- Clean break: clear any of the 9 defaults still sitting in existing rows.
-- Only removes entries that were never nudged away from the seeded neutral
-- 0.5 — a weight the user's ratings actually moved is real learned signal,
-- not leftover taxonomy, and is left untouched.
update user_profiles
set tag_weights = (
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(tag_weights)
  where key not in (
    'Tech', 'Politics', 'Art', 'Science', 'Sports',
    'Business', 'Health', 'Entertainment', 'Education'
  )
  or value::float <> 0.5
);
