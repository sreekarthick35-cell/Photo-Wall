-- Run in the Supabase SQL editor.
create table if not exists public.cards (
  id          uuid primary key,
  image_url   text not null,
  frame_color text not null check (frame_color in ('blue','green','cyan','orange')),
  note        text not null default '' check (char_length(note) <= 140),
  author_name text not null default '' check (char_length(author_name) <= 40),
  instagram   text not null default '' check (char_length(instagram) <= 30),
  x           double precision not null,
  y           double precision not null,
  rotation    double precision not null,
  pin_color   text not null,
  created_at  timestamptz not null default now(),
  hidden      boolean not null default false,
  like_count    integer not null default 0,
  comment_count integer not null default 0
);
create index if not exists cards_created_idx on public.cards (created_at);

-- Rate limiting: one row per device and action kind. Private (RLS on, no policies): service role only.
create table if not exists public.rate_log (
  device_id  text not null,
  kind       text not null check (kind in ('post','comment')),
  created_at timestamptz not null default now(),
  primary key (device_id, kind)
);
alter table public.rate_log enable row level security;

-- Likes (one per device per card) and comments. Private: all access goes through the server.
create table if not exists public.likes (
  card_id   uuid not null references public.cards(id) on delete cascade,
  device_id text not null,
  primary key (card_id, device_id)
);
alter table public.likes enable row level security;

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 40),
  body        text not null check (char_length(body) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index if not exists comments_card_idx on public.comments (card_id, created_at);
alter table public.comments enable row level security;

-- Keep the denormalised counters on cards in sync (realtime UPDATE events then carry the counts).
create or replace function public.bump_card_counter() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'likes' then
    update public.cards set like_count = (select count(*) from public.likes where card_id = coalesce(new.card_id, old.card_id)) where id = coalesce(new.card_id, old.card_id);
  else
    update public.cards set comment_count = (select count(*) from public.comments where card_id = coalesce(new.card_id, old.card_id)) where id = coalesce(new.card_id, old.card_id);
  end if;
  return null;
end $$;
drop trigger if exists likes_count on public.likes;
create trigger likes_count after insert or delete on public.likes for each row execute function public.bump_card_counter();
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_card_counter();

-- Public (anon) can read visible cards only. All writes go through the server (service role).
alter table public.cards enable row level security;
drop policy if exists "read visible cards" on public.cards;
create policy "read visible cards" on public.cards for select to anon using (hidden = false);

-- Realtime
alter publication supabase_realtime add table public.cards;

-- Storage: public-read bucket; uploads only via the service role.
insert into storage.buckets (id, name, public) values ('cards', 'cards', true) on conflict (id) do nothing;
