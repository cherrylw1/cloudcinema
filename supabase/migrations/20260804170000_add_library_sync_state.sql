create table if not exists public.library_sync_state (
  id text primary key,
  root_folder_id text not null,
  change_page_token text not null,
  last_full_sync_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

alter table public.library_sync_state enable row level security;

create trigger trigger_library_sync_state_updated_at
  before update on public.library_sync_state
  for each row execute procedure public.handle_updated_at();
