-- Lexify V2 foundation: enriched saved_words + AI logs/cache

alter table saved_words
  add column if not exists source_url text,
  add column if not exists source_type text,
  add column if not exists source_title text,
  add column if not exists context_sentence text,
  add column if not exists context_paragraph text,
  add column if not exists cefr_level text,
  add column if not exists topic_tags text[],
  add column if not exists ipa text,
  add column if not exists saved_at timestamptz default now(),
  add column if not exists last_seen_in_reading_at timestamptz;

update saved_words
   set source_type = 'legacy'
 where source_type is null;

create table if not exists ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  feature text not null,
  model text not null,
  tokens_in integer default 0,
  tokens_out integer default 0,
  cost_estimate numeric(12, 6) default 0,
  latency_ms integer default 0,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_calls_feature_created_idx
  on ai_calls (feature, created_at desc);

create index if not exists ai_calls_user_created_idx
  on ai_calls (user_id, created_at desc);

create table if not exists ai_cache (
  cache_key text primary key,
  payload jsonb not null,
  feature text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists ai_cache_expires_idx
  on ai_cache (expires_at);
