-- Add column is_approved to public.profiles
alter table public.profiles add column is_approved boolean not null default false;

-- Revise RLS policies for public.media_library to require is_approved = true
drop policy "Media library is viewable by authenticated users" on public.media_library;
create policy "Media library is viewable by approved users"
  on public.media_library for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));

-- Revise RLS policies for public.intro_meta to require is_approved = true
drop policy "Intro meta is viewable by authenticated users" on public.intro_meta;
create policy "Intro meta is viewable by approved users"
  on public.intro_meta for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));

-- Revise RLS policies for public.user_progress to require is_approved = true
drop policy "Users can view their own progress" on public.user_progress;
drop policy "Users can insert their own progress" on public.user_progress;
drop policy "Users can update their own progress" on public.user_progress;
drop policy "Users can delete their own progress" on public.user_progress;

create policy "Approved users can view their own progress"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = profile_id and exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));

create policy "Approved users can insert their own progress"
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = profile_id and exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));

create policy "Approved users can update their own progress"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = profile_id and exists (select 1 from public.profiles where id = auth.uid() and is_approved = true))
  with check (auth.uid() = profile_id and exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));

create policy "Approved users can delete their own progress"
  on public.user_progress for delete
  to authenticated
  using (auth.uid() = profile_id and exists (select 1 from public.profiles where id = auth.uid() and is_approved = true));
