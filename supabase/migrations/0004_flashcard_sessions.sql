-- Lexify Flashcards: gameplay session log
-- Records each completed (or aborted) Match/Review session for analytics.

create table if not exists flashcard_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references flashcard_decks(id) on delete cascade,
  mode text not null default 'match' check (mode in ('match', 'flip', 'review', 'write')),
  score integer not null default 0,
  duration_seconds integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  max_streak integer not null default 0,
  completed_at timestamptz not null default now()
);

create index if not exists flashcard_sessions_user_idx
  on flashcard_sessions (user_id, completed_at desc);

create index if not exists flashcard_sessions_deck_idx
  on flashcard_sessions (deck_id, completed_at desc);

alter table flashcard_sessions enable row level security;

drop policy if exists "sessions_select_own" on flashcard_sessions;
create policy "sessions_select_own" on flashcard_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on flashcard_sessions;
create policy "sessions_insert_own" on flashcard_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on flashcard_sessions;
create policy "sessions_delete_own" on flashcard_sessions
  for delete using (auth.uid() = user_id);
