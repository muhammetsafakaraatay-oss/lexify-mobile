-- Lexify Writing module: IELTS-style writing drafts
-- One row per attempt. `status='draft'` while in progress, `completed` when user submits.

create table if not exists writing_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Prompt snapshot (denormalized; the prompt library is in code and can change between versions)
  prompt_id text not null,
  prompt_type text not null check (prompt_type in ('task1_letter','task1_chart','task2_essay','free')),
  prompt_category text not null default 'general',
  prompt_title text not null,
  prompt_body text not null,
  target_words integer not null default 250,
  suggested_minutes integer not null default 40,

  -- User content
  title text not null default '',
  content text not null default '',
  word_count integer not null default 0,
  duration_seconds integer not null default 0,
  status text not null default 'draft' check (status in ('draft','completed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists writing_tasks_user_idx
  on writing_tasks (user_id, updated_at desc);

create index if not exists writing_tasks_status_idx
  on writing_tasks (user_id, status, updated_at desc);

-- Touch updated_at on every UPDATE
create or replace function writing_tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_writing_tasks_touch on writing_tasks;
create trigger trg_writing_tasks_touch
before update on writing_tasks
for each row execute function writing_tasks_touch_updated_at();

-- RLS
alter table writing_tasks enable row level security;

drop policy if exists "writing_tasks_select_own" on writing_tasks;
create policy "writing_tasks_select_own" on writing_tasks
  for select using (auth.uid() = user_id);

drop policy if exists "writing_tasks_insert_own" on writing_tasks;
create policy "writing_tasks_insert_own" on writing_tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "writing_tasks_update_own" on writing_tasks;
create policy "writing_tasks_update_own" on writing_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "writing_tasks_delete_own" on writing_tasks;
create policy "writing_tasks_delete_own" on writing_tasks
  for delete using (auth.uid() = user_id);
