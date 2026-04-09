-- ============================================================
-- StrangerKiss — Schéma PostgreSQL pour Supabase
-- Exécuter dans Supabase → SQL Editor → New Query
-- ============================================================

-- ------------------------------------------------------------
-- 1. Utilisateurs (auth SMS + crédits)
-- ------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  credits     integer not null default 3,
  created_at  timestamptz not null default now(),
  constraint uq_users_phone unique (phone),
  constraint chk_credits_positive check (credits >= 0)
);

-- Row Level Security : lecture/écriture uniquement via service_role (API routes)
alter table public.users enable row level security;
create policy "service role only" on public.users using (false);

-- ------------------------------------------------------------
-- 2. Profils / pins sur la carte (géolocalisation)
-- ------------------------------------------------------------
create table if not exists public.user_pins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  name        text not null,
  age         integer not null,
  gender      text not null,
  nationality text not null default '',
  bio         text not null default '',
  appearance  text not null default '',
  looking_for text not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now(),
  constraint chk_age     check (age >= 18 and age <= 99),
  constraint chk_gender  check (gender in ('homme', 'femme', 'non-binaire', 'autre')),
  constraint chk_looking check (looking_for in ('hug', 'french_kiss'))
);

create index if not exists idx_pins_location on public.user_pins (lat, lng);
create index if not exists idx_pins_created  on public.user_pins (created_at);
create index if not exists idx_pins_user     on public.user_pins (user_id);

alter table public.user_pins enable row level security;
create policy "lecture publique"  on public.user_pins for select using (true);
create policy "insertion publique" on public.user_pins for insert with check (true);

-- ------------------------------------------------------------
-- 3. Messages du chat
-- Texte, selfies base64 (data:image/jpeg;base64,...),
-- et marqueurs de consentement :
--   §MEETING_REQUEST§  — demande de rencontre
--   §MEETING_ACCEPTED§ — rencontre acceptée
--   §MEETING_REFUSED§  — rencontre refusée
-- ------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null,   -- user_pins.id de l'émetteur
  to_id       uuid not null,   -- user_pins.id du destinataire
  content     text not null,
  created_at  timestamptz not null default now(),
  constraint chk_content_not_empty check (length(content) > 0)
);

create index if not exists idx_messages_conv     on public.messages (from_id, to_id, created_at);
create index if not exists idx_messages_conv_rev on public.messages (to_id, from_id, created_at);

alter table public.messages enable row level security;
create policy "lecture publique"   on public.messages for select using (true);
create policy "insertion publique" on public.messages for insert with check (true);

-- Activer le realtime pour le chat
alter publication supabase_realtime add table public.messages;

-- ------------------------------------------------------------
-- 4. Demandes de rencontre (consentement mutuel + crédit)
-- ------------------------------------------------------------
create table if not exists public.match_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null,   -- user_pins.id du demandeur
  target_id     uuid not null,   -- user_pins.id du destinataire
  status        text not null default 'pending',
  credit_spent  boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint uq_match        unique (requester_id, target_id),
  constraint chk_status      check (status in ('pending', 'accepted', 'refused'))
);

alter table public.match_requests enable row level security;
create policy "lecture publique"   on public.match_requests for select using (true);
create policy "insertion publique" on public.match_requests for insert with check (true);
create policy "mise à jour publique" on public.match_requests for update using (true);

-- ------------------------------------------------------------
-- 5. Blocages (masquage symétrique après refus de rencontre)
-- ------------------------------------------------------------
create table if not exists public.blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null,   -- user_pins.id du profil qui bloque
  blocked_id  uuid not null,   -- user_pins.id du profil bloqué
  created_at  timestamptz not null default now(),
  constraint uq_block unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;
create policy "lecture publique"   on public.blocks for select using (true);
create policy "insertion publique" on public.blocks for insert with check (true);

-- ------------------------------------------------------------
-- 6. Modération (signalements + bans)
-- ------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_pin_id  uuid not null,   -- user_pins.id du signalant
  reported_pin_id  uuid not null,   -- user_pins.id du signalé
  reason           text,
  created_at       timestamptz not null default now(),
  constraint uq_report unique (reporter_pin_id, reported_pin_id)
);

alter table public.reports enable row level security;
create policy "lecture service role" on public.reports for select using (true);
create policy "insertion publique"   on public.reports for insert with check (true);

create table if not exists public.banned_phones (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  ban_type     text not null default '24h',   -- '24h' ou 'permanent'
  banned_until timestamptz,                   -- null si permanent
  reason       text,
  created_at   timestamptz not null default now(),
  constraint uq_banned_phone unique (phone),
  constraint chk_ban_type check (ban_type in ('24h', 'permanent'))
);

alter table public.banned_phones enable row level security;
-- Lecture uniquement via service_role (vérification côté serveur)
create policy "service role only" on public.banned_phones using (false);

-- ------------------------------------------------------------
-- 7. Liste d'attente pré-lancement (waitlist)
-- ------------------------------------------------------------
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  created_at timestamptz not null default now(),
  constraint uq_waitlist_phone unique (phone)
);

alter table public.waitlist enable row level security;
create policy "lecture publique"   on public.waitlist for select using (true);
create policy "insertion publique" on public.waitlist for insert with check (true);

-- ------------------------------------------------------------
-- 8. Fonctions RPC (appelées depuis les API routes via service_role)
-- ------------------------------------------------------------

-- Déduire 1 crédit de façon atomique
create or replace function public.spend_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_credits integer;
begin
  update public.users
  set credits = credits - 1
  where id = p_user_id and credits >= 1
  returning credits into new_credits;

  if not found then
    raise exception 'insufficient_credits';
  end if;

  return new_credits;
end;
$$;

-- Ajouter des crédits après paiement Stripe
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
as $$
declare
  new_credits integer;
begin
  update public.users
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_credits;

  return new_credits;
end;
$$;

-- ------------------------------------------------------------
-- 6. Nettoyage automatique des pins > 24h
-- Option A : pg_cron (Supabase Pro)
--   select cron.schedule('cleanup-pins', '0 * * * *',
--     'delete from public.user_pins where created_at < now() - interval ''24 hours''');
-- Option B : à appeler manuellement ou depuis une API route cron
--   delete from public.user_pins where created_at < now() - interval '24 hours';
-- ------------------------------------------------------------
