-- Lexify — SRS (Spaced Repetition) migration
-- SM-2 tabanlı; tüm kullanıcı kelimelerine ek kolonlar.
-- Geriye dönük uyumluluk: `mastered` ve `review_count` kolonları korunur.

alter table saved_words
  add column if not exists ease numeric not null default 2.5,
  add column if not exists interval_days integer not null default 0,
  add column if not exists repetitions integer not null default 0,
  add column if not exists lapses integer not null default 0,
  add column if not exists due_at timestamptz not null default now(),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists stage text not null default 'new'
    check (stage in ('new','learning','review','mastered','leech'));

-- Mevcut kayıtların stage'ini, eski `mastered` durumuna göre normalize et
update saved_words
   set stage = 'mastered'
 where mastered = true
   and stage = 'new';

-- Sorgu desenleri için indeksler
create index if not exists saved_words_user_due_idx
  on saved_words (user_id, due_at);

create index if not exists saved_words_user_stage_idx
  on saved_words (user_id, stage);

-- Not: `mastered` kolonu deprecated. Yeni kod `stage='mastered'` ile çalışır,
-- fakat `gradeWord` mastered'e geçişte `mastered=true` de yazar (eski ekranlar bozulmasın diye).
-- İleride bir migration ile `mastered` kaldırılacak.
