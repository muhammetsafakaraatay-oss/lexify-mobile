create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cefr_level text check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  daily_goal integer not null default 10,
  reminder_hour integer check (reminder_hour between 0 and 23),
  reminder_minute integer check (reminder_minute between 0 and 59),
  reminder_enabled boolean not null default true,
  interests text[] not null default '{}',
  push_token text,
  timezone text,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists daily_activity (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  reviews_done integer not null default 0,
  words_added integer not null default 0,
  reading_minutes integer not null default 0,
  goal_met boolean not null default false,
  primary key (user_id, day)
);

create index if not exists daily_activity_user_day_idx
  on daily_activity (user_id, day desc);

alter table user_preferences enable row level security;
alter table daily_activity enable row level security;

create policy "own prefs" on user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own activity" on daily_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
