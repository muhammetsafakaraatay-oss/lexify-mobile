-- Lexify Flashcards: Quizlet-style decks + cards
-- Tables: flashcard_decks, flashcard_cards
-- RLS: per-user access via auth.uid()

create table if not exists flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  source text not null default 'manual' check (source in ('manual', 'vocab')),
  vocab_list_id uuid,
  card_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flashcard_decks_user_idx
  on flashcard_decks (user_id, updated_at desc);

create table if not exists flashcard_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references flashcard_decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  status text not null default 'unseen' check (status in ('unseen', 'known', 'unknown')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists flashcard_cards_deck_idx
  on flashcard_cards (deck_id, created_at asc);

create index if not exists flashcard_cards_user_idx
  on flashcard_cards (user_id);

-- Trigger: keep card_count in sync
create or replace function flashcard_update_card_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update flashcard_decks
       set card_count = card_count + 1,
           updated_at = now()
     where id = new.deck_id;
    return new;
  elsif tg_op = 'DELETE' then
    update flashcard_decks
       set card_count = greatest(card_count - 1, 0),
           updated_at = now()
     where id = old.deck_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_flashcard_card_count_ins on flashcard_cards;
create trigger trg_flashcard_card_count_ins
after insert on flashcard_cards
for each row execute function flashcard_update_card_count();

drop trigger if exists trg_flashcard_card_count_del on flashcard_cards;
create trigger trg_flashcard_card_count_del
after delete on flashcard_cards
for each row execute function flashcard_update_card_count();

-- Trigger: bump deck updated_at on card status change
create or replace function flashcard_touch_deck()
returns trigger
language plpgsql
as $$
begin
  update flashcard_decks
     set updated_at = now()
   where id = new.deck_id;
  return new;
end;
$$;

drop trigger if exists trg_flashcard_touch_deck on flashcard_cards;
create trigger trg_flashcard_touch_deck
after update on flashcard_cards
for each row execute function flashcard_touch_deck();

-- RLS
alter table flashcard_decks enable row level security;
alter table flashcard_cards enable row level security;

drop policy if exists "decks_select_own" on flashcard_decks;
create policy "decks_select_own" on flashcard_decks
  for select using (auth.uid() = user_id);

drop policy if exists "decks_insert_own" on flashcard_decks;
create policy "decks_insert_own" on flashcard_decks
  for insert with check (auth.uid() = user_id);

drop policy if exists "decks_update_own" on flashcard_decks;
create policy "decks_update_own" on flashcard_decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "decks_delete_own" on flashcard_decks;
create policy "decks_delete_own" on flashcard_decks
  for delete using (auth.uid() = user_id);

drop policy if exists "cards_select_own" on flashcard_cards;
create policy "cards_select_own" on flashcard_cards
  for select using (auth.uid() = user_id);

drop policy if exists "cards_insert_own" on flashcard_cards;
create policy "cards_insert_own" on flashcard_cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on flashcard_cards;
create policy "cards_update_own" on flashcard_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on flashcard_cards;
create policy "cards_delete_own" on flashcard_cards
  for delete using (auth.uid() = user_id);
