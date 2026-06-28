-- Create helper trigger function for updating updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Profiles Table (Synced automatically with auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Media Library Table (Catalogs movies, TV shows, and anime episodes)
create table public.media_library (
  id uuid default gen_random_uuid() primary key,
  drive_file_id text not null,
  title text not null,
  series text,
  season integer,
  episode integer,
  media_type text not null check (media_type in ('movie', 'tv-show', 'anime')),
  poster_url text,
  backdrop_url text,
  runtime integer,
  file_size bigint,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Unique index on drive_file_id to prevent duplicate media imports
create unique index media_library_drive_file_id_idx on public.media_library(drive_file_id);
-- Index on media_type to optimize catalog filters
create index media_library_media_type_idx on public.media_library(media_type);

-- User Progress Table (Tracks watch state and progress metrics per profile)
create table public.user_progress (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  media_id uuid not null references public.media_library(id) on delete cascade,
  playback_position integer default 0 not null,
  completed boolean default false not null,
  last_watched timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint user_progress_profile_media_unique unique (profile_id, media_id)
);

-- Indexes to optimize progress retrieval queries
create index user_progress_profile_id_idx on public.user_progress(profile_id);
create index user_progress_media_id_idx on public.user_progress(media_id);

-- Intro Meta Table (Stores intro timestamp indexes for skipping intro sections)
create table public.intro_meta (
  id uuid default gen_random_uuid() primary key,
  media_id uuid not null unique references public.media_library(id) on delete cascade,
  intro_start integer not null,
  intro_end integer not null,
  updated_at timestamp with time zone default now() not null
);

-- Index to optimize intro checks
create index intro_meta_media_id_idx on public.intro_meta(media_id);

-- Attach handle_updated_at trigger to tables
create trigger trigger_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger trigger_media_library_updated_at
  before update on public.media_library
  for each row execute procedure public.handle_updated_at();

create trigger trigger_user_progress_updated_at
  before update on public.user_progress
  for each row execute procedure public.handle_updated_at();

create trigger trigger_intro_meta_updated_at
  before update on public.intro_meta
  for each row execute procedure public.handle_updated_at();

-- Automatically sync users signed up through auth.users to profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.media_library enable row level security;
alter table public.user_progress enable row level security;
alter table public.intro_meta enable row level security;

-- Profiles Security Policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Media Library Security Policies
create policy "Media library is viewable by authenticated users"
  on public.media_library for select
  to authenticated
  using (true);

-- User Progress Security Policies (Users can only read/write their own progress)
create policy "Users can view their own progress"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "Users can insert their own progress"
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "Users can update their own progress"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Users can delete their own progress"
  on public.user_progress for delete
  to authenticated
  using (auth.uid() = profile_id);

-- Intro Meta Security Policies
create policy "Intro meta is viewable by authenticated users"
  on public.intro_meta for select
  to authenticated
  using (true);
