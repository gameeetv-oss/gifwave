-- GifWave — 10 Eki 2026
-- 1) Kaydedilen sesler: hesaba bağlı liste (başka cihazda girince de gelir)
create table if not exists public.saved_sounds (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  url           text not null,
  title         text,
  from_username text,
  created_at    timestamptz not null default now(),
  unique (user_id, url)
);

alter table public.saved_sounds enable row level security;

drop policy if exists "saved_sounds_select_own" on public.saved_sounds;
drop policy if exists "saved_sounds_insert_own" on public.saved_sounds;
drop policy if exists "saved_sounds_delete_own" on public.saved_sounds;

create policy "saved_sounds_select_own" on public.saved_sounds
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_sounds_insert_own" on public.saved_sounds
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_sounds_delete_own" on public.saved_sounds
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on public.saved_sounds to authenticated;

-- 2) Müzik deposu: giriş yapmış kullanıcı yalnızca KENDİ klasörüne ses yükleyebilsin
--    (şu an hiç yükleme izni yok; "Videodan ses al" bu yüzden hata veriyordu)
drop policy if exists "music_insert_own_folder" on storage.objects;
drop policy if exists "music_delete_own_folder" on storage.objects;

create policy "music_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "music_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
