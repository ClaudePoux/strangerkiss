-- ============================================================
-- StrangerKiss — Schéma PostgreSQL pour Supabase
-- Exécuter dans Supabase → SQL Editor → New Query
-- ============================================================

-- ------------------------------------------------------------
-- 1. Utilisateurs (auth SMS + crédits)
-- ------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  phone       text,                               -- nullable : null = utilisateur anonyme (avant vérification SMS)
  ref_code    text unique,                        -- code de parrainage généré à la vérification
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
  last_seen   timestamptz not null default now(),          -- mis à jour toutes les 4 min (ping actif)
  constraint chk_age     check (age >= 18 and age <= 99),
  constraint chk_gender  check (gender in ('homme', 'femme', 'non-binaire', 'autre')),
  constraint chk_looking check (looking_for in ('hug', 'french_kiss'))
);

create index if not exists idx_pins_location  on public.user_pins (lat, lng);
create index if not exists idx_pins_created   on public.user_pins (created_at);
create index if not exists idx_pins_user      on public.user_pins (user_id);
create index if not exists idx_pins_last_seen on public.user_pins (last_seen);

-- Colonne last_seen pour les tables déjà créées (migration incrémentale)
alter table public.user_pins add column if not exists last_seen timestamptz not null default now();

-- Nettoyage immédiat des anciens pins sans last_seen ou expirés
-- À exécuter dans Supabase → SQL Editor après avoir ajouté la colonne :
--   DELETE FROM public.user_pins WHERE last_seen < now() - interval '10 minutes';
-- Le nettoyage est aussi automatique : la route GET /api/db/pins le fait en arrière-plan.

alter table public.user_pins enable row level security;
create policy "lecture publique"    on public.user_pins for select using (true);
create policy "insertion publique"  on public.user_pins for insert with check (true);
create policy "mise à jour publique" on public.user_pins for update using (true);
create policy "suppression publique" on public.user_pins for delete using (true);

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
-- 9. Bêta-testeurs (accès anticipé complet avant le lancement)
-- ------------------------------------------------------------
create table if not exists public.beta_testers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  constraint uq_beta_phone unique (phone)
);

alter table public.beta_testers enable row level security;
-- Lecture uniquement via service_role (vérification côté serveur)
create policy "service role only" on public.beta_testers using (false);

-- ------------------------------------------------------------
-- 10. Codes OTP pour la vérification SMS (sms_codes)
-- ------------------------------------------------------------
create table if not exists public.sms_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sms_codes_phone on public.sms_codes (phone);

alter table public.sms_codes enable row level security;
create policy "service role only" on public.sms_codes using (false);

-- ------------------------------------------------------------
-- 11. Parrainages
-- ------------------------------------------------------------
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_user_id  uuid not null references public.users(id) on delete cascade,
  referred_user_id  uuid not null references public.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  constraint uq_referred unique (referred_user_id)  -- un seul parrain par filleul
);

alter table public.referrals enable row level security;
create policy "service role only" on public.referrals using (false);

-- ------------------------------------------------------------
-- Mise à jour de la table users :
--   - phone devient nullable (utilisateurs anonymes avant vérification)
--   - ajout ref_code pour le système de parrainage
-- À exécuter si la table existe déjà :
--   alter table public.users alter column phone drop not null;
--   alter table public.users add column if not exists ref_code text unique;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 12. Sessions admin (expiration 24h)
-- ------------------------------------------------------------
create table if not exists public.admin_sessions (
  token       text primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);

alter table public.admin_sessions enable row level security;
create policy "service role only" on public.admin_sessions using (false);

-- Nettoyage automatique des sessions expirées (optionnel avec pg_cron)
-- select cron.schedule('cleanup-admin-sessions', '0 * * * *',
--   'delete from public.admin_sessions where expires_at < now()');

-- ------------------------------------------------------------
-- 12b. Tentatives de connexion admin (rate limiting)
-- ------------------------------------------------------------
create table if not exists public.admin_attempts (
  id           uuid primary key default gen_random_uuid(),
  ip           text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_admin_attempts_ip on public.admin_attempts (ip, attempted_at);

alter table public.admin_attempts enable row level security;
create policy "service role only" on public.admin_attempts using (false);

-- ------------------------------------------------------------
-- 13. Admins (accès à l'interface /boss)
-- ------------------------------------------------------------
create table if not exists public.admins (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  constraint uq_admins_phone unique (phone)
);

alter table public.admins enable row level security;
create policy "service role only" on public.admins using (false);

-- ------------------------------------------------------------
-- 13. Surveillance VIP
-- ------------------------------------------------------------
create table if not exists public.vip_watches (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint uq_vip_phone unique (phone)
);

alter table public.vip_watches enable row level security;
create policy "service role only" on public.vip_watches using (false);

create table if not exists public.vip_alerts (
  id           uuid primary key default gen_random_uuid(),
  watch_id     uuid not null references public.vip_watches(id) on delete cascade,
  phone        text not null,
  connected_at timestamptz not null default now()
);

alter table public.vip_alerts enable row level security;
create policy "service role only" on public.vip_alerts using (false);

-- ------------------------------------------------------------
-- 6. Nettoyage automatique des pins > 24h
-- Option A : pg_cron (Supabase Pro)
--   select cron.schedule('cleanup-pins', '0 * * * *',
--     'delete from public.user_pins where created_at < now() - interval ''24 hours''');
-- Option B : à appeler manuellement ou depuis une API route cron
--   delete from public.user_pins where created_at < now() - interval '24 hours';
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 14. Attestation de majorité + enquête post-expérience
-- Nouvelles colonnes sur la table users (migration incrémentale)
-- À exécuter si la table users existe déjà :
-- ------------------------------------------------------------

-- Vérification d'âge (page d'accueil, première visite)
alter table public.users add column if not exists age_verified boolean not null default false;
alter table public.users add column if not exists birth_year  integer;

-- Enquête post-expérience (une seule fois après meeting accepté/refusé)
alter table public.users add column if not exists survey_done       boolean not null default false;
alter table public.users add column if not exists gender_survey     text;   -- 'homme', 'femme', 'autre'
alter table public.users add column if not exists travel_situation  text;   -- 'seul', 'couple', 'les_deux'

-- ------------------------------------------------------------
-- 15. Pages légales éditables (mentions légales, CGU, etc.)
-- ------------------------------------------------------------
create table if not exists public.legal_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,               -- 'mentions-legales', 'politique-de-confidentialite', 'notre-histoire', 'cgv'
  content_fr  text not null default '',
  content_en  text not null default '',
  content_de  text not null default '',
  content_it  text not null default '',
  content_es  text not null default '',
  content_ru  text not null default '',
  content_zh  text not null default '',
  content_ja  text not null default '',
  updated_at  timestamptz not null default now(),
  constraint uq_legal_pages_slug unique (slug)
);

alter table public.legal_pages enable row level security;
-- Lecture publique (pour les pages publiques)
create policy "lecture publique"   on public.legal_pages for select using (true);
-- Écriture uniquement via service_role (API admin)
create policy "service role only write" on public.legal_pages for all using (false) with check (false);

-- ------------------------------------------------------------
-- 16. Enquête post-expérience — ajout discovery_channel
--     (comment l'utilisateur a connu l'app)
-- ------------------------------------------------------------
alter table public.users add column if not exists discovery_channel text;

-- gender_survey n'est plus collecté (remplacé par le genre du profil).
-- Conserver la colonne pour ne pas perdre les données existantes.
-- Pour la supprimer une fois les données archivées :
--   alter table public.users drop column if exists gender_survey;

-- ------------------------------------------------------------
-- 17. Sécurité RLS — toutes les tables en service_role only
--
-- Contexte : l'alerte Supabase signale des tables avec RLS activé
-- mais des policies permissives (using true) accessibles via anon key.
-- Toutes les opérations passent par les API routes Next.js (service_role).
-- Le client anon ne doit jamais accéder directement aux données.
--
-- À exécuter dans Supabase → SQL Editor → New Query
-- ------------------------------------------------------------

-- user_pins : remplacer les 4 policies publiques
drop policy if exists "lecture publique"     on public.user_pins;
drop policy if exists "insertion publique"   on public.user_pins;
drop policy if exists "mise à jour publique" on public.user_pins;
drop policy if exists "suppression publique" on public.user_pins;
create policy "service role only" on public.user_pins using (false);

-- messages : remplacer les 2 policies publiques
-- Note : le realtime Supabase fonctionne via service_role côté serveur
drop policy if exists "lecture publique"   on public.messages;
drop policy if exists "insertion publique" on public.messages;
create policy "service role only" on public.messages using (false);

-- match_requests : remplacer les 3 policies publiques
drop policy if exists "lecture publique"     on public.match_requests;
drop policy if exists "insertion publique"   on public.match_requests;
drop policy if exists "mise à jour publique" on public.match_requests;
create policy "service role only" on public.match_requests using (false);

-- blocks : remplacer les 2 policies publiques
drop policy if exists "lecture publique"   on public.blocks;
drop policy if exists "insertion publique" on public.blocks;
create policy "service role only" on public.blocks using (false);

-- reports : remplacer les 2 policies (select using true + insert with check true)
drop policy if exists "lecture service role" on public.reports;
drop policy if exists "insertion publique"   on public.reports;
create policy "service role only" on public.reports using (false);

-- waitlist : remplacer les 2 policies publiques
drop policy if exists "lecture publique"   on public.waitlist;
drop policy if exists "insertion publique" on public.waitlist;
create policy "service role only" on public.waitlist using (false);

-- legal_pages : remplacer la lecture publique + la policy d'écriture partielle
drop policy if exists "lecture publique"        on public.legal_pages;
drop policy if exists "service role only write" on public.legal_pages;
create policy "service role only" on public.legal_pages using (false);

-- Tables déjà correctement configurées (aucune action requise) :
--   users, banned_phones, beta_testers, sms_codes, referrals,
--   admin_sessions, admin_attempts, admins, vip_watches, vip_alerts


-- ------------------------------------------------------------
-- 18. Profils fictifs pour le mode demo pre-lancement
-- ------------------------------------------------------------
create table if not exists public.demo_pins (
  id           serial primary key,
  country      text        not null,  -- 'fr','it','de','es','en','ee'
  name         text        not null,
  age          integer     not null,
  gender       text        not null check (gender in ('homme','femme','non-binaire')),
  nationality  text        not null,
  bio          text        not null,
  appearance   text        not null,
  looking_for  text        not null check (looking_for in ('hug','french_kiss'))
);

alter table public.demo_pins enable row level security;
create policy "service role only" on public.demo_pins using (false);
create index if not exists demo_pins_country_idx on public.demo_pins(country);

-- ============================================================
-- Profils fictifs -- FR (1-100)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('fr','Camille',24,'femme','FR','Exploratrice solitaire, j''aime les cafés inconnus','Cheveux châtains, veste beige, sac à dos rouge','hug'),
('fr','Jade',27,'femme','FR','Voyageuse solo entre deux missions','Lunettes rondes, manteau kaki, baskets blanches','hug'),
('fr','Léa',22,'femme','FR','Étudiante en Erasmus, curieuse de tout','Tresse blonde, sweat gris, jean bleu','french_kiss'),
('fr','Manon',31,'femme','FR','Photographe de rue, toujours en mouvement','Casquette noire, veste en cuir, appareil photo','hug'),
('fr','Inès',26,'femme','FR','Backpackeuse entre deux continents','Cheveux bouclés, écharpe orange, boots marron','french_kiss'),
('fr','Lucie',29,'femme','FR','Solo depuis Bordeaux, ouverte aux rencontres vraies','Robe fleurie, sac bandoulière rouge','hug'),
('fr','Noémie',34,'femme','FR','Coach de voyage, passionnée de connexions humaines','Pull beige, lunettes soleil, cheveux courts','french_kiss'),
('fr','Chloé',23,'femme','FR','Interrail en solo, première fois seule','Bonnet rouge, sac à dos vert, air rêveur','hug'),
('fr','Margaux',38,'femme','FR','Consultante nomade entre Paris et Lisbonne','Blazer gris, cheveux noirs, carnet dans la main','hug'),
('fr','Alice',25,'femme','FR','Artiste en résidence, cherche l''inattendu','Béret coloré, longue veste, écharpe jaune','french_kiss'),
('fr','Sarah',30,'femme','FR','Infirmière en congé sabbatique','Queue-de-cheval, doudoune bleue, sac banane','hug'),
('fr','Emma',28,'femme','FR','Libraire voyageuse, toujours un livre à la main','Lunettes épaisses, trench beige, cheveux mi-longs','hug'),
('fr','Zoé',33,'femme','FR','Musicienne, guitare dans le dos','Veste jean, boots noires, sourire facile','french_kiss'),
('fr','Mathilde',36,'femme','FR','Architecte en vacances, yeux grands ouverts','Manteau blanc, cheveux attachés, carnet de croquis','hug'),
('fr','Pauline',21,'femme','FR','Lycéenne en voyage de fin d''études','Short jean, t-shirt rayé, baskets colorées','hug'),
('fr','Aurélie',41,'femme','FR','Mère solo qui reprend la route','Cheveux roux, veste légère, regard déterminé','hug'),
('fr','Clara',27,'femme','FR','Danseuse contemporaine de passage','Body noir, large pantalon, chignon haut','french_kiss'),
('fr','Océane',24,'femme','FR','Éco-voyageuse, sac de 7kg max','Vêtements neutres, chaussures de marche, sourire chaleureux','hug'),
('fr','Charlotte',32,'femme','FR','Journaliste pigiste en repérage','Trench olive, carnet jaune, cheveux courts','french_kiss'),
('fr','Élise',29,'femme','FR','Chercheuse en pause terrain, curieuse des gens','Pull col roulé gris, jean, lunettes dorées','hug'),
('fr','Louise',26,'femme','FR','Solo depuis Lyon, adore les marchés locaux','Panier en osier, robe légère, cheveux au vent','hug'),
('fr','Anaïs',35,'femme','FR','Yogini nomade, cherche le calme et la connexion','Legging coloré, sac souple, bague ethnique','french_kiss'),
('fr','Victoire',23,'femme','FR','Stagiaire internationale entre deux vols','Veste blazer, cheveux mi-longs, sourire timide','hug'),
('fr','Juliette',40,'femme','FR','Actrice de théâtre en tournée','Écharpe bordeaux, bottes à talon, sac velours','french_kiss'),
('fr','Clémence',28,'femme','FR','Randonneuse urbaine, jamais sans sa carte','Anorak vert, chaussures de rando, cheveux nattes','hug'),
('fr','Diane',44,'femme','FR','Médecin humanitaire entre deux missions','Cheveux poivre et sel, veste fonctionnelle, sourire fatigué mais sincère','hug'),
('fr','Béatrice',52,'femme','FR','Retraitée précoce qui explore l''Europe','Cheveux blancs, imperméable coloré, bonne humeur','hug'),
('fr','Gabrielle',38,'femme','FR','Directrice artistique en escapade','Look minimaliste, pochette design, cheveux courts','french_kiss'),
('fr','Nathalie',46,'femme','FR','Traductrice interprète en conférence','Tenue professionnelle légère, badges de congrès','hug'),
('fr','Marion',33,'femme','FR','Cuisinière passionnée en voyage culinaire','Tablier taché, carnet de recettes, sacoches de marché','hug'),
('fr','Hélène',29,'femme','FR','Biologiste marine en déplacement','Pull marin, jumelles, cheveux attachés','french_kiss'),
('fr','Iris',25,'femme','FR','Influenceuse voyage, plus discrète en vrai','Look soigné mais accessible, téléphone en permanence','hug'),
('fr','Solène',31,'femme','FR','Institutrice en vacances bien méritées','Robe légère, sac paille, lunettes de soleil','hug'),
('fr','Laure',37,'femme','FR','Consultante RH qui se demande pourquoi elle l''est','Tailleur décontracté, carnet Moleskine, air pensif','french_kiss'),
('fr','Virginie',43,'femme','FR','Avocate qui décompresse enfin','Lunettes chics, sac cuir, look chic-décontracté','hug'),
('fr','Stéphanie',39,'femme','FR','Coach de vie entre deux séances','Tenue sport-chic, sourire contagieux','french_kiss'),
('fr','Delphine',48,'femme','FR','Historienne de l''art en repérage de musées','Carnet illustré, lunettes vintage, foulard coloré','hug'),
('fr','Anaëlle',22,'femme','FR','Gap year après le bac, tout découvrir','Sac à dos énorme, baskets usées, curiosité infinie','hug'),
('fr','Christelle',55,'femme','FR','Grand-mère active qui voyage sans ses enfants','Cheveux gris élégants, appareil photo compact','hug'),
('fr','Amandine',27,'femme','FR','Ostéopathe itinérante, corps et âme en mouvement','Tenue ample, sac de praticien, mains sûres','french_kiss'),
('fr','Isabelle',45,'femme','FR','Directrice d''école en visite pédagogique','Sac professionnel, regard bienveillant, tenue sobre','hug'),
('fr','Françoise',58,'femme','FR','Retraitée dynamique, Europe en train','Cheveux courts élégants, imperméable pratique','hug'),
('fr','Valérie',42,'femme','FR','DRH qui découvre le slow travel','Valise soignée, air décontracté tout neuf pour elle','french_kiss'),
('fr','Sandrine',36,'femme','FR','Cheffe cuisinière en voyage d''inspiration','Blouse de cuisine pliée dans le sac, nez affiné','hug'),
('fr','Corinne',50,'femme','FR','Infirmière cadre qui prend enfin l''air','Tenue décontractée, montre médicale au poignet','hug'),
('fr','Hugo',25,'homme','FR','Baroudeur entre deux saisons, libre comme l''air','Pull marin, jean effiloché, cheveux en désordre','hug'),
('fr','Tom',29,'homme','FR','Développeur en workation, curieux des villes','T-shirt blanc, veste légère, sac à dos tech','french_kiss'),
('fr','Lucas',23,'homme','FR','Étudiant Erasmus, premier voyage solo','Sweat à capuche, jean slim, baskets rouges','hug'),
('fr','Théo',32,'homme','FR','Chef cuisinier en vacances forcées','Tablier de cuir, barbe courte, mains expressives','french_kiss'),
('fr','Mathis',27,'homme','FR','Photographe indépendant, partout et nulle part','Veste militaire, appareil autour du cou, lunettes soleil','hug'),
('fr','Axel',34,'homme','FR','Commercial qui en a marre des hôtels business','Costard froissé, valise trolley, cravate dans la poche','hug'),
('fr','Raphaël',26,'homme','FR','Musicien en tournée, cherche l''énergie des rencontres','Bonnet gris, guitare acoustique, veste en jean','french_kiss'),
('fr','Baptiste',30,'homme','FR','Surfeur entre deux spots','Short coloré, sweat délavé, cheveux salés','hug'),
('fr','Antoine',22,'homme','FR','Lycéen en road trip avec ses potes','T-shirt de concert, jean troué, énergie débordante','french_kiss'),
('fr','Julien',38,'homme','FR','Ingénieur en pause, redécouvrant la lenteur','Polo blanc, pantalon chino, montre simple','hug'),
('fr','Nicolas',31,'homme','FR','Journaliste de voyage, toujours en quête de l''histoire','Trench marron, carnet rouge, regard curieux','hug'),
('fr','Pierre',44,'homme','FR','Architecte qui voyage pour s''inspirer','Lunettes design, sac cuir, tenue sobre et élégante','french_kiss'),
('fr','Guillaume',28,'homme','FR','Trader digital, préfère les cafés aux bureaux','Mac sur les genoux, hoodie gris, AirPods','hug'),
('fr','Sébastien',36,'homme','FR','Guide de randonnée en vacances paradoxales','Chaussures de trail, polaire bleue, cartes topographiques','hug'),
('fr','Clément',24,'homme','FR','Graphiste freelance, dessinant partout','Tote bag avec crayons, veste colorée, cheveux mi-longs','french_kiss'),
('fr','Florian',29,'homme','FR','Kiné en pause méritée, détendu et ouvert','Pull over loose, jean, look décontracté','hug'),
('fr','Romain',33,'homme','FR','Comédien entre deux castings','Veste en laine, livre de poche, sourire charmeur','french_kiss'),
('fr','Kevin',26,'homme','FR','Steward en escale, 3h à tuer en ville','Uniforme bleu, valise cabine, air fatigué mais sympa','hug'),
('fr','Adrien',41,'homme','FR','Papa solo qui reprend goût à l''aventure','Veste outdoor, sac à dos fonctionnel, regard bienveillant','hug'),
('fr','Marc',47,'homme','FR','Commercial fatigué qui cherche un vrai moment','Costume froissé, cravate desserrée, regard sincère','hug'),
('fr','Denis',53,'homme','FR','Retraité actif, tour d''Europe en train','Chapeau de randonnée, sac fonctionnel, sourire ouvert','hug'),
('fr','Patrick',60,'homme','FR','Veuf qui redécouvre la vie à 60 ans','Veste propre, regard timide mais chaleureux','hug'),
('fr','Stéphane',42,'homme','FR','Architecte paysagiste, la nature dans les yeux','Chemise lin, carnets de terrain, montre analogique','french_kiss'),
('fr','Christophe',38,'homme','FR','Pompier en repos, calme et attentif','Physique athlétique, veste simple, regard posé','hug'),
('fr','François',34,'homme','FR','Chercheur CNRS en déplacement','Sac à dos plein de docs, veste académique, distrait sympa','hug'),
('fr','Michel',57,'homme','FR','Patron de PME qui voyage enfin pour lui','Look soigné décontracté, montre de qualité','french_kiss'),
('fr','Olivier',45,'homme','FR','Enseignant de lycée en voyage pédagogique personnel','Pull chiné, lunettes, livre en poche','hug'),
('fr','Vincent',36,'homme','FR','Kinésithérapeute sportif en compétition marathon','Tenue running, montre GPS, corps en forme','hug'),
('fr','Laurent',49,'homme','FR','Directeur photo de cinéma entre deux tournages','Veste technique, œil professionnel, discrétion','french_kiss'),
('fr','Jacques',62,'homme','FR','Retraité de l''éducation nationale en grand voyage','Sac à dos de qualité, guide Michelin, curiosité intacte','hug'),
('fr','Bernard',55,'homme','FR','Chef d''entreprise qui décompresse enfin','Look décontracté surprenant chez lui, vraiment heureux','hug'),
('fr','Robert',48,'homme','FR','Médecin généraliste en congrès international','Badge de congrès, sacoche médicale, regard rassurant','french_kiss'),
('fr','Alex',27,'non-binaire','FR','Artiste entre genres et frontières, libre','Tenue androgyne, bijoux ethniques, sourire malicieux','hug'),
('fr','Sam',24,'non-binaire','FR','Performer de rue en résidence artistique','Pantalon large, veste brodée, cheveux colorés','french_kiss'),
('fr','Rémy',30,'non-binaire','FR','Thérapeute holistique en voyage intérieur','Habit ample naturel, pierres au cou, paix dans les yeux','hug'),
('fr','Lou',26,'non-binaire','FR','Illustrateur·rice de passage, observe tout','Carnet de croquis, veste oversize, lunettes épaisses','hug'),
('fr','Eli',28,'non-binaire','FR','Militant·e culturel·le, toujours en mouvement','Sac en bandoulière, badges militants, regard vif','french_kiss'),
('fr','Morgan',31,'non-binaire','FR','Designer UX qui observe les usages humains','Tenue fluide, écouteurs stylés, regard analytique','hug'),
('fr','Charlie',34,'non-binaire','FR','Écrivain·e entre deux chapitres, carnet sur soi','Manteau large, stylo derrière l''oreille, sourire rêveur','french_kiss'),
('fr','Jules',29,'non-binaire','FR','Danseur·se contemporain·e en tournée européenne','Corps en mouvement même immobile, tenue souple','hug'),
('fr','Noa',25,'non-binaire','FR','Étudiant·e en genre et sexualités, curieux·se de tout','Look affirmé, badges, discussion fascinante garantie','hug'),
('fr','Sasha',27,'non-binaire','FR','Vidéaste documentariste, toujours une caméra','Veste technique, micro-cravate visible, regard attentif','french_kiss');

-- ============================================================
-- Profils fictifs -- IT (101-200)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('it','Sofia',25,'femme','IT','Studentessa in Erasmus, scopro l''Europa da sola','Capelli neri, giacca rossa, zaino verde','hug'),
('it','Giulia',28,'femme','IT','Fotografa freelance, sempre in movimento','Capelli castani, macchina foto al collo, jeans','french_kiss'),
('it','Valentina',31,'femme','IT','Architetta in viaggio d''ispirazione','Occhiali design, cappotto bianco, taccuino','hug'),
('it','Chiara',24,'femme','IT','Backpacker tra un treno e l''altro','Capelli lunghi, scarpe da trekking, sorriso aperto','french_kiss'),
('it','Francesca',27,'femme','IT','Giornalista in cerca di storie vere','Taccuino giallo, impermeabile verde, capelli mossi','hug'),
('it','Martina',33,'femme','IT','Medica in vacanza, finalmente libera','Capelli a coda, occhiali da sole, zaino medico','hug'),
('it','Laura',29,'femme','IT','Designer grafica nomade','Mac sotto il braccio, cuffie colorate, look minimal','french_kiss'),
('it','Serena',22,'femme','IT','Studentessa di lettere, prima avventura sola','Borsa di tela, libro in mano, aria curiosa','hug'),
('it','Alessia',36,'femme','IT','Chef in fuga dalla cucina per qualche giorno','Grembiule di cuoio, mani espressive, sorriso caldo','french_kiss'),
('it','Elisa',30,'femme','IT','Traduttrice simultanea in conferenza','Look professionale, badge al collo, aria concentrata','hug'),
('it','Roberta',34,'femme','IT','Biologa marina in trasferta','Maglione blu mare, binocolo, capelli raccolti','hug'),
('it','Paola',38,'femme','IT','Psicologa in viaggio di ricerca','Quaderno di appunti, sguardo attento, tono calmo','french_kiss'),
('it','Monica',26,'femme','IT','Ballerina classica in tournée','Capelli a chignon, borsa da danza, postura elegante','hug'),
('it','Stefania',41,'femme','IT','Manager HR che ha bisogno di staccare','Tailleur rilassato, trolley, sorriso stanco ma vero','hug'),
('it','Giovanna',23,'femme','IT','Gap year dopo la laurea, tutto è possibile','Zaino enorme, scarpe consunte, energia pura','french_kiss'),
('it','Isabella',29,'femme','IT','Stilista in cerca d''ispirazione per strada','Look ricercato, occhio critico ma simpatico, borse multiple','hug'),
('it','Annalisa',32,'femme','IT','Musicista jazz in giro per festival','Strumento in spalla, aria bohémien, sorriso facile','french_kiss'),
('it','Cinzia',44,'femme','IT','Avvocata in pausa meritata','Cappotto di qualità, borsetta elegante, occhiali firmati','hug'),
('it','Daniela',37,'femme','IT','Ricercatrice universitaria in convegno','Borsa piena di libri, sguardo acuto, jeans','hug'),
('it','Silvia',25,'femme','IT','Fotografa di moda in trasferta','Reflex al collo, look editoriale, capelli ossigenati','french_kiss'),
('it','Federica',31,'femme','IT','Farmacista in viaggio botanico','Borsa di campo, guanti da giardinaggio, aria serena','hug'),
('it','Beatrice',28,'femme','IT','Attrice di teatro in tournée estiva','Sciarpa bordeaux, stivali, borsa di velluto','french_kiss'),
('it','Giorgia',24,'femme','IT','Social media manager in workation','Laptop e telefono sempre in mano, caffè sempre pronto','hug'),
('it','Adele',35,'femme','IT','Sommelier in tour enogastronomico','Bicchiere da degustazione in borsa, aria competente','hug'),
('it','Ilaria',27,'femme','IT','Yogini nomade, cerca connessioni vere','Tappetino arrotolato, abiti naturali, serenità contagiosa','french_kiss'),
('it','Cecilia',40,'femme','IT','Nutrizionista che gira per mercati locali','Borsa di tela, lista della spesa, sorriso salutista','hug'),
('it','Ornella',47,'femme','IT','Ceramista in cerca di argille nuove','Mani sporche di argilla, grembiule, aria creativa','hug'),
('it','Patrizia',53,'femme','IT','Guida turistica in giorno libero','Passo sicuro, conoscenza totale della città, relax visibile','french_kiss'),
('it','Elena',34,'femme','IT','Trader online, ufficio ovunque ci sia WiFi','Laptop, caffè, look casual ma attento','hug'),
('it','Rossana',29,'femme','IT','Insegnante in viaggio formativo','Borsa piena di appunti, aria curiosa, domande infinite','hug'),
('it','Valeria',36,'femme','IT','Runner amatoriale in giro per maratone','Scarpe da corsa, orologio GPS, fisico allenato','french_kiss'),
('it','Tiziana',42,'femme','IT','Scrittrice di romanzi storici, cerca atmosfere','Vestito vintage, quaderno di note, aria assorta','hug'),
('it','Pamela',31,'femme','IT','Fisioterapista in congresso professionale','Zaino tecnico, tuta comoda, mani sicure','hug'),
('it','Rossella',26,'femme','IT','Visual artist in residenza internazionale','Capelli blu, vestiti senza macchie quasi, sguardo vivace','french_kiss'),
('it','Agnese',23,'femme','IT','Studentessa di lingue, parla tutto tranne l''inglese','Libro di frasi, sorriso aperto, aria giocosa','hug'),
('it','Carla',45,'femme','IT','Dirigente scolastica in visita educativa','Borsa professionale, sguardo benevolo, abbigliamento sobrio','hug'),
('it','Renata',58,'femme','IT','Pensionata dinamica, Europa in treno','Capelli corti eleganti, impermeabile pratico','hug'),
('it','Assunta',50,'femme','IT','Casalinga che finalmente viaggia per sé','Borsa ricamata, sguardo stupito dalla libertà','hug'),
('it','Concetta',39,'femme','IT','Avvocatessa che scopre il viaggio lento','Borsa di qualità, look rilassato insolito per lei','french_kiss'),
('it','Rosaria',44,'femme','IT','Medico di base in congresso internazionale','Badge del congresso, borsa medica, sguardo rassicurante','hug'),
('it','Marco',26,'homme','IT','Barman in vacanza, mischia ovunque','Camicia aperta, jeans bianchi, sorriso facile','hug'),
('it','Luca',30,'homme','IT','Fotoreporter, sempre in transito','Giacca militare, reflex pesante, sguardo curioso','french_kiss'),
('it','Andrea',24,'homme','IT','Ingegnere informatico in workation','Zaino tecnologico, cuffie, t-shirt tech','hug'),
('it','Davide',33,'homme','IT','Sommelier in giro per vigne','Naso raffinato, taccuino di degustazione, modi eleganti','french_kiss'),
('it','Alessandro',28,'homme','IT','Musicista rock tra un concerto e l''altro','Chitarra in spalla, giacca di pelle, aria vissuta','hug'),
('it','Matteo',22,'homme','IT','Studente in Erasmus, prima volta solo','Zaino universitario, entusiasmo contagioso','hug'),
('it','Federico',36,'homme','IT','Chef stellato in vacanza anonima','Abbigliamento casual, mani sicure, palato raffinato','french_kiss'),
('it','Stefano',31,'homme','IT','Giornalista sportivo in trasferta','Giubbotto reporter, taccuino, occhio rapido','hug'),
('it','Riccardo',27,'homme','IT','Grafico freelance, disegna ovunque','Borsa con matite, giacca colorata, capelli lunghi','french_kiss'),
('it','Giorgio',40,'homme','IT','Architetto in cerca d''ispirazione urbana','Occhiali da vista, cartella di disegni, passo curioso','hug'),
('it','Roberto',45,'homme','IT','Imprenditore che vuole staccare davvero','Look business-casual, orologio bello, sorriso raro ma vero','hug'),
('it','Claudio',38,'homme','IT','Regista di documentari sempre in giro','Giubbotto tecnico, microfono a clip visibile, sguardo attento','french_kiss'),
('it','Emanuele',29,'homme','IT','Personal trainer in vacanza meritata','Fisico atletico, abbigliamento sportivo, energia positiva','hug'),
('it','Filippo',23,'homme','IT','Artista di strada in residenza','Abiti colorati di vernice, borsa con tele, aria creativa','french_kiss'),
('it','Simone',35,'homme','IT','Medico di base che ricarica le pile','Felpa comoda, sguardo rassicurante, passo tranquillo','hug'),
('it','Massimo',43,'homme','IT','Direttore creativo tra due campagne','Look curato ma rilassato, portfolio sotto il braccio','hug'),
('it','Pietro',26,'homme','IT','Velista in terra ferma per qualche giorno','Felpa da vela, pelle abbronzata, mani forti','french_kiss'),
('it','Lorenzo',32,'homme','IT','Docente universitario in convegno internazionale','Giacca accademica, borsa di libri, aria distante-simpatica','hug'),
('it','Nicola',29,'homme','IT','Cuoco di strada, sempre in movimento','Grembiule da strada, valigia di spezie, buon umore','french_kiss'),
('it','Giovanni',50,'homme','IT','Padre solo che riscopre la libertà di viaggiare','Giubbotto pratico, sorriso aperto, sguardo sereno','hug'),
('it','Loris',48,'homme','IT','Pilota di linea in scalo di 8 ore','Uniforme sbottonata, valigia pilota, stanchezza elegante','hug'),
('it','Bruno',55,'homme','IT','Pensionato dinamico, Europa in treno','Cappello da viaggio, zaino leggero, passo sicuro','hug'),
('it','Carlo',41,'homme','IT','Ingegnere civile in sopralluogo','Casco in borsa, scarpe robuste, aria tecnica','french_kiss'),
('it','Dario',37,'homme','IT','Pasticcere in giro per fiere internazionali','Mani delicate, valigetta di attrezzi, naso fine','hug'),
('it','Enzo',46,'homme','IT','Pescatore sportivo in gita di cultura','Stivali di gomma, aria serena, voglia di parlare','hug'),
('it','Fabio',34,'homme','IT','Veterinario in conferenza scientifica','Zaino professionale, aria calma, ama tutti gli animali','french_kiss'),
('it','Gerardo',29,'homme','IT','Pompiere in riposo, calmo e rassicurante','Fisico solido, veste semplice, sguardo tranquillo','hug'),
('it','Ivano',43,'homme','IT','Direttore di marketing in fuga dal board','Completo rilassato, telefono spento quasi, sorriso vero','hug'),
('it','Jacopo',27,'homme','IT','Assistente di volo in scalo improvvisato','Uniforme, trolley cabin, aria leggermente jet-lagged','french_kiss'),
('it','Leo',31,'homme','IT','Cuoco specializzato in cucina di strada','Grembiule da campo, borsa di spezie, entusiasmo culinario','hug'),
('it','Rio',27,'non-binaire','IT','Artista performativo tra generi e confini','Abito androgino, gioielli etnici, sorriso malizioso','hug'),
('it','Nico',24,'non-binaire','IT','Musicista elettronica in tour europeo','Cuffie grandi, giacca tecnica, fare tranquillo','french_kiss'),
('it','Fio',30,'non-binaire','IT','Terapeuta olistica in viaggio interiore','Abito naturale ampio, pietre al collo, calma radiante','hug'),
('it','Cami',26,'non-binaire','IT','Illustratore·trice in residenza artistica','Taccuino di schizzi, giacca oversize, occhiali spessi','hug'),
('it','Dani',28,'non-binaire','IT','Attivista culturale sempre in movimento','Borsa a tracolla, spille militanti, sguardo vivace','french_kiss'),
('it','Blake',29,'non-binaire','IT','Performer di strada in residenza artistica','Pantaloni larghi, giacca ricamata, capelli colorati','french_kiss'),
('it','Sae',25,'non-binaire','IT','Danzatore·trice contemporaneo·a in tournée','Corpo sempre in movimento, abbigliamento ampio','hug'),
('it','Feen',31,'non-binaire','IT','Scrittore·trice di sceneggiature, osserva tutto','Cappotto largo, penna dietro l''orecchio, sorriso sognante','hug'),
('it','Zef',33,'non-binaire','IT','Compositore·trice elettronica tra live set','Cuffie studio, giacca tecnica, passo ritmato','french_kiss'),
('it','Miro',27,'non-binaire','IT','Videomaker documentarista','Giacca tecnica, microfono a clip, sguardo attento','hug');

-- ============================================================
-- Profils fictifs -- DE (201-300)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('de','Anna',26,'femme','DE','Alleinreisende zwischen zwei Projekten, offen für echte Begegnungen','Braune Haare, rote Jacke, Wanderrucksack','hug'),
('de','Sophie',29,'femme','DE','Fotografin auf Städtereise','Kamera um den Hals, Jeans, neugieriger Blick','french_kiss'),
('de','Julia',24,'femme','DE','Erasmus-Studentin auf Entdeckungsreise','Blondes Haar, Uni-Hoodie, bunte Turnschuhe','hug'),
('de','Lena',32,'femme','DE','Architektin auf der Suche nach Inspiration','Designerbrille, weißer Mantel, Skizzenbuch','french_kiss'),
('de','Marie',27,'femme','DE','Krankenschwester im wohlverdienten Urlaub','Sportlicher Look, Rucksack, entspanntes Lächeln','hug'),
('de','Laura',31,'femme','DE','Journalistin auf Recherche','Grüner Trenchcoat, gelbes Notizbuch, lockige Haare','hug'),
('de','Nina',23,'femme','DE','Gap Year nach dem Abitur, alles entdecken','Riesiger Rucksack, abgenutzte Schuhe, pure Energie','french_kiss'),
('de','Mia',28,'femme','DE','Designerin im Workation-Modus','MacBook, Kopfhörer, minimalistischer Look','hug'),
('de','Clara',34,'femme','DE','Ärztin auf Forschungsreise','Funktionale Tasche, aufmerksamer Blick, ruhige Art','hug'),
('de','Hannah',25,'femme','DE','Musikerin auf Tour','Instrument auf dem Rücken, Bohème-Look, leichtes Lächeln','french_kiss'),
('de','Sarah',30,'femme','DE','Marketing-Managerin auf der Flucht vor Excel','Blazer gelockert, Trolley, echtes Lächeln','hug'),
('de','Emma',36,'femme','DE','Yogalehrerin auf spiritueller Reise','Naturfarbene Kleidung, Yoga-Matte, Gelassenheit','hug'),
('de','Lisa',22,'femme','DE','Studentin der Kunstgeschichte, erstes Solo-Abenteuer','Kunstbuch, Vintage-Brille, stilles Staunen','french_kiss'),
('de','Leonie',29,'femme','DE','Therapeutin zwischen zwei Seminaren','Weiche Kleidung, Heilsteine, sanfte Energie','hug'),
('de','Katharina',35,'femme','DE','Filmregisseurin beim Motiv-Scouting','Technische Weste, Klemmbrett, scharfer Blick','french_kiss'),
('de','Stefanie',40,'femme','DE','Unternehmensberaterin, die endlich abschaltet','Geknitterter Blazer, Reisekoffer, echter Erschöpfung','hug'),
('de','Tanja',26,'femme','DE','Tänzerin auf Europatournée','Stets in Bewegung, weite Hose, Chignon','hug'),
('de','Verena',33,'femme','DE','Biologin auf Feldforschung','Feldausrüstung, Fernglas, Haare zum Zopf gebunden','french_kiss'),
('de','Kerstin',38,'femme','DE','Rechtsanwältin im wohlverdienten Urlaub','Eleganter, aber entspannter Look, Ledertasche','hug'),
('de','Melanie',27,'femme','DE','Entwicklungshelferin zwischen zwei Einsätzen','Funktionale Kleidung, Armbänder aus aller Welt','hug'),
('de','Petra',44,'femme','DE','Gymnasiallehrerin auf Bildungsreise','Strickpullover, Notizblock, wacher Geist','french_kiss'),
('de','Anja',31,'femme','DE','Sommelière auf Weinreise','Degustation Taschenbuch, elegante aber praktische Kleidung','hug'),
('de','Claudia',37,'femme','DE','Stadtplanerin für neues Projekt unterwegs','Technische Karte, Stift hinter dem Ohr, nachdenklicher Blick','hug'),
('de','Monika',48,'femme','DE','Früh in Rente und Europa erkunden','Graues Haar elegant, bunter Regenmantel, gute Laune','french_kiss'),
('de','Sabine',52,'femme','DE','Schriftstellerin auf der Suche nach Material','Weiter Mantel, Stift immer dabei, beobachtend','hug'),
('de','Helga',49,'femme','DE','Lehrerin auf Erkundungsreise','Praktischer Rucksack, Notizbuch, wissbegieriger Blick','hug'),
('de','Brigitte',57,'femme','DE','Großmutter auf Europareise, ohne die Kinder','Elegant graues Haar, kompakte Kamera, beste Stimmung','hug'),
('de','Gisela',43,'femme','DE','Sozialarbeiterin erholt sich endlich','Bequeme Kleidung, warmes Lächeln, ruhige Präsenz','hug'),
('de','Heike',35,'femme','DE','Umweltingenieurin auf Nachhaltigkeitskonferenz','Öko-Kleidung, Metalltrinkflasche, grüne Überzeugungen','french_kiss'),
('de','Dagmar',39,'femme','DE','Ernährungsberaterin auf Marktbesuch','Leinentasche, Einkaufsliste, gesundheitsbegeistertes Lächeln','hug'),
('de','Gudrun',46,'femme','DE','Keramikerin auf der Suche nach neuen Tonerden','Lehmverschmierte Hände, Schürze, kreative Aura','hug'),
('de','Renate',51,'femme','DE','Hobbysportlerin und Freiheit-Suchende','Laufschuhe, GPS-Uhr, trainierter Körper','french_kiss'),
('de','Meike',28,'femme','DE','Social-Media-Fotografin, diskreter als gedacht','Gepflegtes, zugängliches Aussehen, Handy immer dabei','hug'),
('de','Hannelore',54,'femme','DE','Pensionärin die endlich alleine reist','Elegantes graues Haar, praktische Tasche, Neugier','hug'),
('de','Friederike',33,'femme','DE','Politikwissenschaftlerin auf Kongress','Aktentasche, Brille, nachdenklicher Blick','french_kiss'),
('de','Ingrid',47,'femme','DE','Ärztin im Sabbatical, neugierig auf alles','Sportlich-eleganter Look, Wanderstöcke','hug'),
('de','Rosemarie',60,'femme','DE','Witwe die das Reisen wiederzuentdeckt','Elegante weiße Haare, warmes Lächeln, Neugier pur','hug'),
('de','Hildegard',55,'femme','DE','Pensionierte Lehrerin auf Abenteuerreise','Wanderschuhe, Reiseführer, unendliche Energie','hug'),
('de','Waltraud',42,'femme','DE','Unternehmerin die sich eine Pause gönnt','Eleganter Freizeitlook, schöne Uhr, seltenes echtes Lächeln','french_kiss'),
('de','Karoline',27,'femme','DE','Doktorandin zwischen zwei Experimenten','Labortasche, Notizbuch, zerstreuter Charme','hug'),
('de','Bettina',36,'femme','DE','Grafikdesignerin die analoge Welt erkundet','Skizzenbuch, bunte Stifte, kreativer Blick','hug'),
('de','Max',27,'homme','DE','Backpacker zwischen Saison und Saison, frei wie der Wind','Marineblauer Pullover, ausgefranste Jeans, zerzaustes Haar','hug'),
('de','Felix',30,'homme','DE','IT-Entwickler im Workation','Weißes T-Shirt, leichte Jacke, Tech-Rucksack','french_kiss'),
('de','Leon',24,'homme','DE','Erasmus-Student, erste Solo-Reise','Kapuzenpullover, enge Jeans, rote Sneaker','hug'),
('de','Lukas',33,'homme','DE','Fotoreporter, immer unterwegs','Militärjacke, Kamera, Sonnenbrille','french_kiss'),
('de','Jan',28,'homme','DE','Musiker auf Tournée, sucht Energie','Graue Mütze, Akustikgitarre, Lederjacke','hug'),
('de','Patrick',35,'homme','DE','Ingenieur im Projekturlaub','Poloshirt, Chino, schlichte Uhr','hug'),
('de','Tobias',22,'homme','DE','Schüler auf Abschlussreise','Konzert-T-Shirt, zerrissene Jeans, überbordende Energie','french_kiss'),
('de','Fabian',38,'homme','DE','Spitzenkoch im anonymen Urlaub','Freizeitkleidung, sichere Hände, feiner Gaumen','hug'),
('de','Niklas',31,'homme','DE','Sportjournalist auf Auslandsreise','Reporter-Weste, Notizblock, schneller Blick','hug'),
('de','Sven',29,'homme','DE','Grafiker auf Selbstständigkeit','Farbenfroh, Tasche mit Bleistiften, langes Haar','french_kiss'),
('de','Moritz',40,'homme','DE','Architekt auf der Suche nach Inspiration','Designerbrille, Zeichenmappe, neugieriger Schritt','hug'),
('de','Stefan',45,'homme','DE','Unternehmer, der wirklich abschalten möchte','Business-Casual, schöne Uhr, seltenes aber echtes Lächeln','hug'),
('de','Christian',26,'homme','DE','Straßenkünstler in Kunstresidenzen','Farbbespritzte Kleidung, Leinwand, kreative Aura','french_kiss'),
('de','Michael',48,'homme','DE','Manager, der endlich für sich selbst reist','Gepflegter Freizeitlook, Qualitätsuhr','hug'),
('de','Thomas',34,'homme','DE','Forscher auf Auslandskonferenz','Prallgefüllter Rucksack, akademische Jacke, zerstreuter Charme','hug'),
('de','Johannes',36,'homme','DE','Naturführer im paradoxen Urlaub','Trailschuhe, blaues Fleece, topografische Karten','french_kiss'),
('de','Peter',42,'homme','DE','Dokumentarfilmer immer unterwegs','Technische Weste, sichtbares Ansteckmikrofon, aufmerksamer Blick','hug'),
('de','David',27,'homme','DE','Kinematurge zwischen zwei Drehs','Wollmantel, Taschenbuch, charmantes Lächeln','french_kiss'),
('de','Kevin',29,'homme','DE','Steward auf Zwischenstopp, 4 Stunden Zeit','Uniform, Handgepäck, leicht übermüdet, aber sympathisch','hug'),
('de','Sebastian',44,'homme','DE','Alleinreisender Vater, der das Abenteuer wieder entdeckt','Outdoor-Jacke, funktionaler Rucksack, wohlwollender Blick','hug'),
('de','Ingo',53,'homme','DE','Rentner, der Europa per Zug erkundet','Reisehut, leichter Rucksack, sicherer Schritt','hug'),
('de','Werner',60,'homme','DE','Witwer, der das Leben mit 60 neu entdeckt','Gepflegte Jacke, schüchterner aber herzlicher Blick','hug'),
('de','Bernd',47,'homme','DE','Handwerksmeister auf Bildungsreise','Robuste Schuhe, Arbeitstasche, offenes Lächeln','hug'),
('de','Horst',55,'homme','DE','Ruheständler, der Freiheit wieder spürt','Helle Hose, bequeme Schuhe, Zeit ohne Ende','french_kiss'),
('de','Rainer',38,'homme','DE','Softwareentwickler zwischen zwei Projekten','Laptop-Rucksack, T-Shirt, entspannter Blick','hug'),
('de','Günther',50,'homme','DE','Kaufmann der endlich allein reist','Gepflegter Freizeitlook, Qualitätsuhr','hug'),
('de','Klaus',43,'homme','DE','Ingenieur auf Messe zwischen zwei Terminen','Namensbadge, praktischer Anzug, freundlicher Blick','french_kiss'),
('de','Helmut',57,'homme','DE','Pensionierter Beamter auf Weltreise','Reisehut, Karte, stoisches Lächeln','hug'),
('de','Walter',62,'homme','DE','Rentner der die Freiheit neu entdeckt','Bequeme Kleidung, Kamera, strahlende Augen','hug'),
('de','Kim',26,'non-binaire','DE','Kunstperformer zwischen Genres und Grenzen','Androgynes Outfit, ethnischer Schmuck, schelmisches Lächeln','hug'),
('de','Sam',24,'non-binaire','DE','Straßenperformer in Kunstresidenzen','Weite Hose, besticktes Jackett, bunte Haare','french_kiss'),
('de','Remy',31,'non-binaire','DE','Ganzheitlicher Therapeut auf innerer Reise','Weites, natürliches Gewand, Steine am Hals, Frieden in den Augen','hug'),
('de','Lou',28,'non-binaire','DE','Illustrator auf Durchreise, beobachtet alles','Skizzenbuch, oversized Jacke, dicke Brille','hug'),
('de','Robin',30,'non-binaire','DE','Kulturaktivist, immer in Bewegung','Umhängetasche, Anstecker, wacher Blick','french_kiss'),
('de','Lenn',27,'non-binaire','DE','Elektronischer Musiker auf Europatournée','Große Kopfhörer, Technojacke, ruhige Ausstrahlung','hug'),
('de','Ash',25,'non-binaire','DE','Zeitgenössischer Tänzer auf Tour','Immer in Bewegung, lockere Kleidung','french_kiss'),
('de','Fern',32,'non-binaire','DE','Drehbuchautor, beobachtet alles','Großer Mantel, Stift hinter dem Ohr, versponnenes Lächeln','hug'),
('de','Zola',34,'non-binaire','DE','Elektronischer Komponist zwischen Live-Sets','Studio-Kopfhörer, Technojacke, rhythmischer Schritt','french_kiss'),
('de','Marlo',28,'non-binaire','DE','Dokumentarischer Videofilmer','Technische Jacke, sichtbares Lavaliermikrofon, aufmerksamer Blick','hug');

-- ============================================================
-- Profils fictifs -- ES (301-400)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('es','Carmen',25,'femme','ES','Mochilera entre trenes, siempre en movimiento','Pelo negro, chaqueta roja, mochila verde','hug'),
('es','Lucía',28,'femme','ES','Fotógrafa freelance, siempre de paso','Pelo castaño, cámara al cuello, vaqueros','french_kiss'),
('es','Sofía',31,'femme','ES','Arquitecta en viaje de inspiración','Gafas de diseño, abrigo blanco, cuaderno','hug'),
('es','Isabel',24,'femme','ES','Estudiante Erasmus, descubriendo Europa','Pelo largo, mochila universitaria, zapatillas de colores','french_kiss'),
('es','Nuria',27,'femme','ES','Periodista buscando historias reales','Cuaderno amarillo, impermeable verde, rizado','hug'),
('es','Marta',33,'femme','ES','Médica en sus merecidas vacaciones','Look deportivo, mochila, sonrisa desahogada','hug'),
('es','Ana',29,'femme','ES','Diseñadora gráfica en modo nómada','Mac bajo el brazo, auriculares de colores, look mínimal','french_kiss'),
('es','Cristina',22,'femme','ES','Gap year tras la selectividad, descubrirlo todo','Mochila enorme, zapatillas desgastadas, energía infinita','hug'),
('es','Elena',36,'femme','ES','Traductora en conferencia internacional','Look profesional, acreditación al cuello, concentrada','hug'),
('es','Laura',30,'femme','ES','Bióloga marina en trasfondo de investigación','Jersey azul marino, prismáticos, pelo recogido','french_kiss'),
('es','Raquel',34,'femme','ES','Psicóloga en viaje de investigación','Cuaderno, mirada atenta, tono calmado','hug'),
('es','Pilar',38,'femme','ES','Bailaora flamenca de gira','Vestido de lunares, moño alto, porte elegante','hug'),
('es','Mercedes',41,'femme','ES','Directora RRHH que necesita desconectar','Traje relajado, trolley, sonrisa cansada pero sincera','french_kiss'),
('es','Rocío',23,'femme','ES','Después de la uni, el mundo entero','Mochila enorme, entusiasmo sin límites','hug'),
('es','Paula',29,'femme','ES','Estilista buscando inspiración en la calle','Look cuidado, ojo crítico pero amable, múltiples bolsos','hug'),
('es','Rosa',32,'femme','ES','Músico de jazz de festival en festival','Instrumento al hombro, aire bohemio, sonrisa fácil','french_kiss'),
('es','Inés',44,'femme','ES','Abogada en merecido descanso','Abrigo de calidad, bolso elegante, gafas de marca','hug'),
('es','María',37,'femme','ES','Investigadora universitaria en congreso','Bolsa llena de libros, mirada aguda, vaqueros','hug'),
('es','Silvia',25,'femme','ES','Fotógrafa de moda en trasfondo','Réflex al cuello, look editorial, pelo rubio oxigenado','french_kiss'),
('es','Noelia',31,'femme','ES','Farmacéutica en viaje botánico','Bolsa de campo, guantes de jardinero, aire sereno','hug'),
('es','Beatriz',28,'femme','ES','Actriz de teatro de gira de verano','Bufanda burdeos, botas, bolso de terciopelo','french_kiss'),
('es','Diana',24,'femme','ES','Community manager en workation','Portátil y móvil siempre a mano, café siempre listo','hug'),
('es','Adriana',35,'femme','ES','Sommelier en tour enogastronómico','Copa de cata en el bolso, aire competente','hug'),
('es','Rebeca',27,'femme','ES','Yoguini nómada, busca conexiones reales','Esterilla enrollada, ropa natural, serenidad contagiosa','french_kiss'),
('es','Consuelo',40,'femme','ES','Cocinera apasionada de viaje culinario','Delantal manchado, cuaderno de recetas, alforjas del mercado','hug'),
('es','Patricia',44,'femme','ES','Directora de escuela en visita pedagógica','Bolsa profesional, mirada benévola, ropa sobria','hug'),
('es','Francisca',58,'femme','ES','Jubilada dinámica, Europa en tren','Pelo corto elegante, impermeable práctico','hug'),
('es','Dolores',50,'femme','ES','Ama de casa que por fin viaja sola','Bolsa bordada, mirada asombrada por la libertad','hug'),
('es','Amparo',39,'femme','ES','Abogada que descubre el viaje lento','Bolso de calidad, look relajado inusual para ella','french_kiss'),
('es','Rosario',44,'femme','ES','Médico de cabecera en congreso internacional','Acreditación, maletín médico, mirada tranquilizadora','hug'),
('es','Encarnación',47,'femme','ES','Ceramista buscando nuevas arcillas','Manos sucias de arcilla, delantal, aura creativa','hug'),
('es','Esperanza',53,'femme','ES','Guía turística en día libre','Paso seguro, conocimiento total de la ciudad, relax visible','french_kiss'),
('es','Concepción',36,'femme','ES','Corredora amateur por maratones','Zapatillas de running, reloj GPS, físico entrenado','hug'),
('es','Virtudes',42,'femme','ES','Escritora de novelas históricas, busca atmósferas','Vestido vintage, cuaderno de notas, aire absorto','hug'),
('es','Remedios',31,'femme','ES','Fisioterapeuta en congreso profesional','Mochila técnica, chándal cómodo, manos seguras','french_kiss'),
('es','Asunción',26,'femme','ES','Artista visual en residencia internacional','Pelo azul, ropa sin manchas casi, mirada vivaz','hug'),
('es','Milagros',23,'femme','ES','Estudiante de idiomas, habla todo menos inglés','Libro de frases, sonrisa abierta, aire juguetón','hug'),
('es','Nieves',29,'femme','ES','Nutricionista recorriendo mercados locales','Bolsa de tela, lista de la compra, sonrisa saludable','french_kiss'),
('es','Socorro',45,'femme','ES','Directora de marketing tomando un respiro','Maletín relajado, teléfono casi apagado, sonrisa real','hug'),
('es','Visitación',33,'femme','ES','Bióloga marina en campo','Jersey azul, prismáticos, pelo recogido','hug'),
('es','Carlos',26,'homme','ES','Mochilero entre estaciones, libre','Jersillo marinero, vaqueros deshilachados, pelo revuelto','hug'),
('es','Pablo',30,'homme','ES','Desarrollador web en workation','Camiseta blanca, chaqueta ligera, mochila tech','french_kiss'),
('es','Javier',24,'homme','ES','Erasmus estudiante, primer viaje solo','Sudadera con capucha, vaqueros pitillo, zapatillas rojas','hug'),
('es','Alejandro',33,'homme','ES','Fotorreportero, siempre en tránsito','Chaqueta militar, cámara pesada, gafas de sol','french_kiss'),
('es','Sergio',28,'homme','ES','Músico rock entre conciertos','Guitarra al hombro, chupa de cuero, look vivido','hug'),
('es','Roberto',22,'homme','ES','Estudiante de bachillerato en road trip','Camiseta de concierto, vaqueros rotos, energía desbordante','hug'),
('es','Miguel',36,'homme','ES','Chef con estrella de vacaciones anónimas','Ropa casual, manos seguras, paladar refinado','french_kiss'),
('es','Rodrigo',31,'homme','ES','Periodista deportivo en trasfondo','Chaleco reportero, cuaderno, ojo rápido','hug'),
('es','Óscar',27,'homme','ES','Diseñador gráfico freelance','Chaqueta colorida, bolsa con lápices, pelo largo','french_kiss'),
('es','Enrique',40,'homme','ES','Arquitecto buscando inspiración urbana','Gafas de vista, carpeta de dibujos, paso curioso','hug'),
('es','Antonio',45,'homme','ES','Empresario queriendo de verdad desconectar','Look business-casual, reloj bonito, sonrisa poco frecuente pero verdadera','hug'),
('es','Ignacio',38,'homme','ES','Director de documentales siempre de camino','Chaleco técnico, micrófono de solapa, mirada atenta','french_kiss'),
('es','Nacho',29,'homme','ES','Entrenador personal en vacaciones merecidas','Físico atlético, ropa deportiva, energía positiva','hug'),
('es','Marcos',23,'homme','ES','Artista callejero en residencia','Ropa manchada de pintura, lienzo, aura creativa','french_kiss'),
('es','Iñaki',35,'homme','ES','Médico de cabecera recargando las pilas','Chándal cómodo, mirada tranquilizadora, paso sereno','hug'),
('es','Álvaro',43,'homme','ES','Director creativo entre dos campañas','Look cuidado pero relajado, portfolio bajo el brazo','hug'),
('es','David',26,'homme','ES','Marino en tierra firme unos días','Sudadera náutica, piel bronceada, manos fuertes','french_kiss'),
('es','Fernando',32,'homme','ES','Profesor universitario en congreso internacional','Chaqueta académica, bolsa de libros, aire distante pero agradable','hug'),
('es','Adrián',29,'homme','ES','Cocinero de street food, siempre en movimiento','Delantal de campo, bolsa de especias, buen rollo','french_kiss'),
('es','Guillermo',50,'homme','ES','Padre solo redescubriendo la libertad de viajar','Chaqueta práctica, sonrisa abierta, mirada serena','hug'),
('es','Ramón',48,'homme','ES','Piloto en escala de 8 horas','Uniforme desabrochado, maleta piloto, cansancio elegante','hug'),
('es','Francisco',55,'homme','ES','Jubilado dinámico, Europa en tren','Sombrero de viaje, mochila ligera, paso firme','hug'),
('es','Paco',41,'homme','ES','Ingeniero civil en inspección','Casco en la mochila, botas robustas, aire técnico','french_kiss'),
('es','Emilio',37,'homme','ES','Pastelero en ferias internacionales','Manos delicadas, maletín de herramientas, nariz fina','hug'),
('es','Salvador',46,'homme','ES','Pescador deportivo de excursión cultural','Botas de agua, aire sereno, ganas de hablar','hug'),
('es','Manuel',34,'homme','ES','Veterinario en conferencia científica','Mochila profesional, aire calmado, ama a todos los animales','french_kiss'),
('es','Jesús',29,'homme','ES','Bombero de guardia, tranquilo y reconfortante','Físico sólido, ropa sencilla, mirada serena','hug'),
('es','Pepe',43,'homme','ES','Director de marketing huyendo del comité','Traje relajado, teléfono apagado casi, sonrisa verdadera','hug'),
('es','Gonzalo',27,'homme','ES','Auxiliar de vuelo en escala improvisada','Uniforme, trolley de cabina, ligeramente jet-lagged','french_kiss'),
('es','Tomás',31,'homme','ES','Cocinero de comida callejera','Delantal de campo, bolsa de especias, entusiasmo culinario','hug'),
('es','Adolfo',60,'homme','ES','Viudo que redescubre la vida a los 60','Ropa limpia, mirada tímida pero cálida','hug'),
('es','Modesto',53,'homme','ES','Jubilado activo que recorre Europa en tren','Sombrero de andanzas, mochila ligera, paso seguro','hug'),
('es','Alex',27,'non-binaire','ES','Artista performativo entre géneros y fronteras','Ropa andrógina, joyas étnicas, sonrisa traviesa','hug'),
('es','Samu',24,'non-binaire','ES','Músico electrónico de gira europea','Auriculares grandes, chaqueta técnica, aire tranquilo','french_kiss'),
('es','Gabi',30,'non-binaire','ES','Terapeuta holístico en viaje interior','Ropa natural amplia, piedras en el cuello, calma irradiante','hug'),
('es','Camilo',26,'non-binaire','ES','Ilustrador·a en residencia artística','Cuaderno de bocetos, chaqueta oversize, gafas gruesas','hug'),
('es','Dani',28,'non-binaire','ES','Activista cultural siempre en marcha','Bolso bandolera, chapas militantes, mirada viva','french_kiss'),
('es','Lucas',26,'non-binaire','ES','Performer callejero en residencia artística','Pantalones anchos, chaqueta bordada, pelo de colores','french_kiss'),
('es','Toni',25,'non-binaire','ES','Bailarín·a contemporáneo·a de gira','Cuerpo siempre en movimiento, ropa amplia','hug'),
('es','Peri',31,'non-binaire','ES','Guionista, observa todo','Abrigo largo, pluma detrás de la oreja, sonrisa soñadora','hug'),
('es','Zef',33,'non-binaire','ES','Compositor·a electrónico·a entre directos','Auriculares de estudio, chaqueta técnica, paso rítmico','french_kiss'),
('es','Miró',27,'non-binaire','ES','Videomaker documentalista','Chaqueta técnica, micrófono de solapa visible, mirada atenta','hug');

-- ============================================================
-- Profils fictifs -- EN (401-500)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('en','Emma',26,'femme','GB','Solo traveller between projects, open to real connections','Brown hair, red jacket, hiking backpack','hug'),
('en','Olivia',29,'femme','GB','Freelance photographer always on the move','Camera around neck, jeans, curious eyes','french_kiss'),
('en','Ava',24,'femme','GB','Erasmus student discovering Europe solo','Blonde hair, uni hoodie, colourful trainers','hug'),
('en','Grace',32,'femme','GB','Architect seeking urban inspiration','Designer glasses, white coat, sketchbook','french_kiss'),
('en','Poppy',27,'femme','GB','Nurse on a well-deserved holiday','Sporty look, backpack, relaxed smile','hug'),
('en','Lily',31,'femme','GB','Journalist on the road for a story','Olive trench, yellow notebook, wavy hair','hug'),
('en','Mia',23,'femme','GB','Gap year after uni, exploring everything','Huge rucksack, worn-out shoes, pure energy','french_kiss'),
('en','Freya',28,'femme','GB','Graphic designer in workation mode','MacBook, colourful headphones, minimalist look','hug'),
('en','Isla',34,'femme','GB','Doctor on a research trip','Practical bag, attentive gaze, calm manner','hug'),
('en','Rosie',25,'femme','GB','Musician on tour','Instrument on her back, bohemian look, easy smile','french_kiss'),
('en','Chloe',30,'femme','GB','Marketing manager escaping spreadsheets','Loosened blazer, trolley case, genuine smile','hug'),
('en','Harriet',36,'femme','GB','Yoga teacher on a spiritual journey','Natural-toned clothes, yoga mat, serenity','hug'),
('en','Arabella',22,'femme','GB','Art history student, first solo adventure','Art book, vintage glasses, quiet wonder','french_kiss'),
('en','Isobel',29,'femme','GB','Therapist between seminars','Soft clothing, healing stones, gentle energy','hug'),
('en','Tilly',35,'femme','GB','Film director on location scouting','Technical vest, clipboard, sharp focus','french_kiss'),
('en','Felicity',40,'femme','GB','Consultant finally switching off','Crumpled blazer, suitcase, genuinely tired but warm','hug'),
('en','Phoebe',26,'femme','GB','Contemporary dancer on European tour','Always moving, wide trousers, high bun','hug'),
('en','Beatrice',33,'femme','GB','Biologist doing field research','Field gear, binoculars, hair in a ponytail','french_kiss'),
('en','Imogen',38,'femme','GB','Barrister on a proper holiday','Elegant but relaxed look, leather bag','hug'),
('en','Nell',27,'femme','GB','Aid worker between deployments','Functional clothing, bracelets from everywhere','hug'),
('en','Verity',44,'femme','GB','Secondary school teacher on a study trip','Knit jumper, notepad, sharp mind','french_kiss'),
('en','Margot',37,'femme','GB','Town planner scouting a new project','Technical map, pen behind ear, thoughtful look','hug'),
('en','Patricia',48,'femme','GB','Early retiree exploring Europe by train','Elegant grey hair, colourful raincoat, great mood','hug'),
('en','Sabine',52,'femme','GB','Writer gathering material','Oversized coat, pen always at hand, observant','french_kiss'),
('en','Miriam',45,'femme','GB','Head teacher on an educational visit','Professional bag, kind gaze, smart-casual outfit','hug'),
('en','Dorothy',58,'femme','GB','Active retiree seeing Europe alone at last','Short elegant grey hair, practical waterproof','hug'),
('en','Pamela',50,'femme','GB','Housewife finally travelling for herself','Embroidered bag, look of quiet wonder','hug'),
('en','Agnes',39,'femme','GB','Solicitor discovering slow travel','Quality handbag, unusually relaxed look','french_kiss'),
('en','Frances',44,'femme','GB','GP at an international conference','Conference badge, medical bag, reassuring smile','hug'),
('en','Edith',47,'femme','GB','Ceramicist hunting for new clay','Clay-stained hands, apron, creative aura','hug'),
('en','Maureen',53,'femme','GB','Retired tour guide enjoying a free day','Confident stride, total knowledge of the city, visible relief','french_kiss'),
('en','Beverley',36,'femme','GB','Amateur runner at city marathons','Running shoes, GPS watch, fit physique','hug'),
('en','Glenda',42,'femme','GB','Historical novelist seeking atmosphere','Vintage dress, notes notebook, dreamy air','hug'),
('en','Shirley',31,'femme','GB','Physiotherapist at a professional congress','Technical backpack, tracksuit, sure hands','french_kiss'),
('en','Tracey',26,'femme','GB','Visual artist at an international residency','Blue hair, mostly clean clothes, lively gaze','hug'),
('en','Wendy',23,'femme','GB','Language student who speaks everything except French','Phrasebook, open smile, playful air','hug'),
('en','Sandra',29,'femme','GB','Nutritionist touring local markets','Canvas tote, shopping list, healthy grin','french_kiss'),
('en','Brenda',45,'femme','GB','Marketing director taking a breather','Relaxed briefcase, phone almost off, real smile','hug'),
('en','Gillian',33,'femme','GB','Marine biologist in the field','Navy jumper, binoculars, hair tied back','hug'),
('en','Kerry',27,'femme','GB','Social media photographer, quieter than you''d think','Polished but approachable, phone always ready','hug'),
('en','Jack',27,'homme','GB','Backpacker between seasons, free as the wind','Navy jumper, frayed jeans, dishevelled hair','hug'),
('en','Oliver',30,'homme','GB','Software developer on workation','White tee, light jacket, tech backpack','french_kiss'),
('en','Harry',24,'homme','GB','Student on first solo trip','Hoodie, slim jeans, red trainers','hug'),
('en','George',33,'homme','GB','Photo journalist always in transit','Military jacket, heavy camera, sunglasses','french_kiss'),
('en','Alfie',28,'homme','GB','Musician between gigs, chasing energy','Grey beanie, acoustic guitar, denim jacket','hug'),
('en','Charlie',35,'homme','GB','Engineer on project holiday','Polo shirt, chinos, simple watch','hug'),
('en','Finn',22,'homme','GB','Sixth-former on first road trip','Concert tee, ripped jeans, boundless energy','french_kiss'),
('en','Rory',38,'homme','GB','Head chef on an anonymous break','Casual wear, confident hands, refined palate','hug'),
('en','Jamie',31,'homme','GB','Sports journalist abroad','Reporter vest, notepad, quick eye','hug'),
('en','Toby',27,'homme','GB','Freelance illustrator, drawing everywhere','Colourful jacket, bag of pencils, long hair','french_kiss'),
('en','Hugo',40,'homme','GB','Architect seeking urban inspiration','Designer glasses, drawing folder, curious stride','hug'),
('en','Rupert',45,'homme','GB','Entrepreneur genuinely trying to unwind','Business-casual, nice watch, rare but real smile','hug'),
('en','Alastair',38,'homme','GB','Documentary director always en route','Technical vest, lapel mic, attentive gaze','french_kiss'),
('en','Callum',29,'homme','GB','Personal trainer on a well-earned holiday','Athletic build, sportswear, positive energy','hug'),
('en','Liam',23,'homme','GB','Street artist in residence','Paint-splattered clothes, canvas, creative aura','french_kiss'),
('en','Dominic',35,'homme','GB','GP recharging his batteries','Comfortable hoodie, reassuring gaze, steady pace','hug'),
('en','Tristan',43,'homme','GB','Creative director between campaigns','Polished but relaxed look, portfolio under arm','hug'),
('en','Crispin',26,'homme','GB','Sailor on dry land for a few days','Sailing sweatshirt, tanned skin, strong hands','french_kiss'),
('en','Miles',32,'homme','GB','University lecturer at an international conference','Academic jacket, bag of books, distant-but-likeable air','hug'),
('en','Leo',29,'homme','GB','Street food cook, always on the move','Field apron, spice bag, infectious enthusiasm','french_kiss'),
('en','William',50,'homme','GB','Single dad rediscovering the freedom of travel','Practical jacket, open smile, serene eyes','hug'),
('en','Theo',54,'homme','GB','Airline pilot on an 8-hour layover','Unbuttoned uniform, pilot case, elegant fatigue','hug'),
('en','Derek',57,'homme','GB','Retired explorer, Europe by train','Travel hat, light rucksack, confident stride','hug'),
('en','Keith',42,'homme','GB','Civil engineer on site inspection','Helmet in bag, sturdy boots, technical air','french_kiss'),
('en','Nigel',39,'homme','GB','Pastry chef at international fairs','Delicate hands, tool case, fine nose','hug'),
('en','Rod',47,'homme','GB','Sport fisherman on a cultural day trip','Wellies, serene air, love of a good chat','hug'),
('en','Clive',35,'homme','GB','Vet at a scientific conference','Professional rucksack, calm air, loves every animal','french_kiss'),
('en','Stu',30,'homme','GB','Firefighter off duty, steady and reassuring','Solid build, simple jacket, composed gaze','hug'),
('en','Barry',44,'homme','GB','Marketing director fleeing the boardroom','Relaxed suit, phone almost off, genuine smile','hug'),
('en','Gary',28,'homme','GB','Flight attendant on an unplanned layover','Uniform, cabin trolley, slightly jet-lagged but friendly','french_kiss'),
('en','Leon',32,'homme','GB','Street food chef, always moving','Field apron, spice bag, culinary enthusiasm','hug'),
('en','Norman',60,'homme','GB','Widower rediscovering life at 60','Clean jacket, shy but warm gaze','hug'),
('en','Trevor',53,'homme','GB','Active retiree touring Europe by train','Travel hat, light rucksack, confident step','hug'),
('en','Quinn',27,'non-binaire','GB','Performance artist across genres and borders','Androgynous outfit, ethnic jewellery, mischievous smile','hug'),
('en','River',24,'non-binaire','GB','Electronic musician on European tour','Large headphones, technical jacket, calm air','french_kiss'),
('en','Sage',31,'non-binaire','GB','Holistic therapist on an inner journey','Wide natural clothing, stones at the neck, radiating calm','hug'),
('en','Blake',28,'non-binaire','GB','Illustrator passing through, observing everything','Sketchbook, oversized jacket, thick glasses','hug'),
('en','Remy',30,'non-binaire','GB','Cultural activist always in motion','Shoulder bag, activist pins, alert gaze','french_kiss'),
('en','Kai',27,'non-binaire','GB','Street performer in artistic residency','Wide trousers, embroidered jacket, colourful hair','french_kiss'),
('en','Ash',26,'non-binaire','GB','Contemporary dancer on tour','Always in motion, loose clothing','hug'),
('en','Fern',32,'non-binaire','GB','Screenwriter, observes everything','Oversized coat, pen behind ear, dreamy smile','hug'),
('en','Zola',34,'non-binaire','GB','Electronic composer between live sets','Studio headphones, technical jacket, rhythmic step','french_kiss'),
('en','Marlo',28,'non-binaire','GB','Documentary videomaker','Technical jacket, visible lapel mic, attentive look','hug');

-- ============================================================
-- Profils fictifs -- EE (501-600)
-- ============================================================
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('ee','Agnieszka',26,'femme','PL','Podróżuję sama między projektami, otwarta na prawdziwe spotkania','Brązowe włosy, czerwona kurtka, plecak turystyczny','hug'),
('ee','Karolina',29,'femme','PL','Fotografka na wyjeździe','Aparat na szyi, jeansy, ciekawy wzrok','french_kiss'),
('ee','Magda',24,'femme','PL','Studentka Erasmus, odkrywam Europę sama','Blond włosy, bluza z kapturem, kolorowe adidasy','hug'),
('ee','Ola',32,'femme','PL','Architektka szukająca inspiracji','Okulary od projektanta, biały płaszcz, szkicownik','french_kiss'),
('ee','Kasia',27,'femme','PL','Pielęgniarka na zasłużonych wakacjach','Sportowy look, plecak, rozluźniony uśmiech','hug'),
('ee','Zosia',31,'femme','PL','Dziennikarka szukająca historii','Zielony trencz, żółty notatnik, kręcone włosy','hug'),
('ee','Nina',23,'femme','PL','Przerwa rok po maturze, odkrywam wszystko','Ogromny plecak, znoszone buty, czysta energia','french_kiss'),
('ee','Marta',28,'femme','PL','Graficzka w trybie workation','MacBook, kolorowe słuchawki, minimalistyczny look','hug'),
('ee','Ewa',34,'femme','PL','Lekarka w podróży badawczej','Praktyczna torba, uważny wzrok, spokojny sposób bycia','hug'),
('ee','Hania',25,'femme','PL','Muzyczka w trasie','Instrument na plecach, look bohème, łatwy uśmiech','french_kiss'),
('ee','Beata',30,'femme','PL','Menadżerka marketingu uciekająca od tabelek','Rozluźniony blezer, walizka, prawdziwy uśmiech','hug'),
('ee','Dominika',36,'femme','PL','Nauczycielka jogi w podróży duchowej','Naturalne ubrania, matka do jogi, spokój','hug'),
('ee','Monika',22,'femme','PL','Studentka historii sztuki, pierwsza solowa przygoda','Książka o sztuce, okulary vintage, ciche zdziwienie','french_kiss'),
('ee','Aleksandra',29,'femme','PL','Terapeutka między seminariami','Miękkie ubrania, kamienie lecznicze, delikatna energia','hug'),
('ee','Weronika',35,'femme','PL','Reżyserka na zwiadzie lokacji','Kamizelka techniczna, clipboard, ostry wzrok','french_kiss'),
('ee','Basia',40,'femme','PL','Konsultantka wreszcie wyłączona','Zmięty blezer, walizka, naprawdę zmęczona ale ciepła','hug'),
('ee','Natalia',26,'femme','PL','Tancerka współczesna w tournée','Zawsze w ruchu, szerokie spodnie, kok','hug'),
('ee','Patrycja',33,'femme','PL','Biologka na badaniach terenowych','Wyposażenie terenowe, lornetka, włosy w kucyku','french_kiss'),
('ee','Roksana',38,'femme','PL','Prawniczka na prawdziwych wakacjach','Elegancki ale swobodny look, skórzana torebka','hug'),
('ee','Sylwia',27,'femme','PL','Pracownica humanitarna między misjami','Funkcjonalne ubrania, bransoletki z całego świata','hug'),
('ee','Kristýna',25,'femme','CZ','Cestuji sama, hledám opravdová setkání','Hnědé vlasy, červená bunda, turistický batoh','hug'),
('ee','Tereza',28,'femme','CZ','Fotografka na výletě','Foťák na krku, džíny, zvídavý pohled','french_kiss'),
('ee','Markéta',31,'femme','CZ','Architekta hledá inspiraci','Designové brýle, bílý kabát, skicák','hug'),
('ee','Lucie',24,'femme','CZ','Erasmus studentka v Evropě','Blond vlasy, mikina, barevné tenisky','french_kiss'),
('ee','Petra',29,'femme','CZ','Zdravotní sestra na zasloužené dovolené','Sportovní look, batoh, uvolněný úsměv','hug'),
('ee','Veronika',34,'femme','CZ','Terapeutka mezi semináři','Měkké oblečení, léčivé kameny, jemná energie','hug'),
('ee','Klára',22,'femme','CZ','Meziroční přestávka po maturitě','Obrovský batoh, opotřebované boty, čistá energie','french_kiss'),
('ee','Anežka',30,'femme','CZ','Hudebnice na turné','Nástroj na zádech, bohémský vzhled, snadný úsměv','hug'),
('ee','Šárka',26,'femme','CZ','Grafická designérka v pracovním módu','MacBook, barevná sluchátka, minimalistický vzhled','hug'),
('ee','Bára',35,'femme','CZ','Novinářka hledá příběh','Zelený plášť, žlutý zápisník, kudrnaté vlasy','french_kiss'),
('ee','Eszter',25,'femme','HU','Egyedül utazom projektek között','Barna haj, piros dzseki, túrahátizsák','hug'),
('ee','Réka',28,'femme','HU','Szabadúszó fotós, mindig úton','Kamera a nyakán, farmer, kíváncsi tekintet','french_kiss'),
('ee','Boglárka',31,'femme','HU','Építész inspirációt keres','Designer szemüveg, fehér kabát, vázlatfüzet','hug'),
('ee','Ágnes',24,'femme','HU','Erasmus hallgató Európában','Szőke haj, kapucnis pulóver, színes edzőcipő','french_kiss'),
('ee','Katalin',29,'femme','HU','Nővér megérdemelt szabadságon','Sportos megjelenés, hátizsák, lazított mosoly','hug'),
('ee','Nóra',34,'femme','HU','Terapeuta szemináriumok között','Puha ruha, gyógyító kövek, szelíd energia','hug'),
('ee','Zsuzsanna',22,'femme','HU','Érettségi utáni rés év, mindent felfedezek','Hatalmas hátizsák, elnyűtt cipő, tiszta energia','french_kiss'),
('ee','Viki',30,'femme','HU','Zenész turnén','Hangszer a háton, bohém stílus, könnyed mosoly','hug'),
('ee','Dóra',26,'femme','HU','Grafikai tervező workation módban','MacBook, színes fejhallgató, minimalista stílus','hug'),
('ee','Piroska',35,'femme','HU','Újságíró történetet keres','Zöld kabát, sárga notesz, göndör haj','french_kiss'),
('ee','Mária',29,'femme','HU','Orvos kutatóúton','Praktikus táska, figyelmes tekintet, nyugodt modor','hug'),
('ee','Zsófia',33,'femme','HU','Jóga oktató szellemi utazáson','Természetes ruha, jógaszőnyeg, derű','hug'),
('ee','Judit',40,'femme','HU','Üzleti tanácsadó aki végre kikapcsol','Gyűrött blézer, bőrönd, igazán fáradt de meleg','hug'),
('ee','Anna',27,'femme','HU','Segélymunkás bevetések között','Funkcionális ruha, karkötők mindenhonnan','hug'),
('ee','Erzsébet',44,'femme','HU','Középiskolai tanár tanulmányúton','Kötött pulóver, notesz, éles elme','french_kiss'),
('ee','Przemek',27,'homme','PL','Plecakarz między sezonami, wolny jak wiatr','Granatowy sweter, postrzępione jeansy, potargane włosy','hug'),
('ee','Bartek',30,'homme','PL','Programista w trybie workation','Biała koszulka, lekka kurtka, plecak tech','french_kiss'),
('ee','Michał',24,'homme','PL','Student na pierwszej solowej wyprawie','Bluza z kapturem, wąskie jeansy, czerwone adidasy','hug'),
('ee','Krzysztof',33,'homme','PL','Fotoreporter zawsze w drodze','Wojskowa kurtka, ciężki aparat, okulary słoneczne','french_kiss'),
('ee','Piotr',28,'homme','PL','Muzyk rockowy między koncertami','Gitara na ramieniu, skórzana kurtka, przeżyty look','hug'),
('ee','Adam',22,'homme','PL','Uczeń na wyjeździe po maturze','Koszulka z koncertu, podarte jeansy, pełno energii','hug'),
('ee','Grzegorz',36,'homme','PL','Kucharz gwiazdkowy na anonimowych wakacjach','Casualowe ubrania, pewne ręce, wyrafinowane podniebienie','french_kiss'),
('ee','Marcin',31,'homme','PL','Dziennikarz sportowy na wyjeździe','Kamizelka reporterska, notatnik, szybkie oko','hug'),
('ee','Tomek',27,'homme','PL','Grafik freelance, rysuje wszędzie','Kolorowa kurtka, torba z ołówkami, długie włosy','french_kiss'),
('ee','Jakub',40,'homme','PL','Architekt szukający miejskiej inspiracji','Okulary korekcyjne, teczka rysunków, ciekawy krok','hug'),
('ee','Marek',38,'homme','PL','Reżyser dokumentalny zawsze w drodze','Kamizelka techniczna, widoczny mikrofon, uważne spojrzenie','french_kiss'),
('ee','Paweł',29,'homme','PL','Osobisty trener na zasłużonych wakacjach','Atletyczna sylwetka, odzież sportowa, pozytywna energia','hug'),
('ee','Łukasz',23,'homme','PL','Artysta uliczny na rezydencji','Ubrania poplamione farbą, płótno, twórcza aura','french_kiss'),
('ee','Rafał',35,'homme','PL','Lekarz ogólny ładujący baterie','Wygodna bluza, uspokajające spojrzenie, spokojny krok','hug'),
('ee','Sławomir',43,'homme','PL','Dyrektor kreatywny między kampaniami','Zadbany ale swobodny look, portfolio pod pachą','hug'),
('ee','Lukáš',27,'homme','CZ','Batůžkář mezi sezónami','Námořnický svetr, roztřepené džíny, rozcuchané vlasy','hug'),
('ee','Marek',30,'homme','CZ','IT vývojář ve workation módu','Bílé tričko, lehká bunda, tech batoh','french_kiss'),
('ee','Ondřej',24,'homme','CZ','Student na první sólové cestě','Mikina, slim džíny, červené tenisky','hug'),
('ee','Tomáš',33,'homme','CZ','Fotoreportér vždy na cestách','Vojenská bunda, těžký foťák, sluneční brýle','french_kiss'),
('ee','Pavel',28,'homme','CZ','Rockový muzikant mezi koncerty','Kytara přes rameno, kožená bunda, prožitý vzhled','hug'),
('ee','Jiří',36,'homme','CZ','Šéfkuchař na anonymní dovolené','Casual oblečení, jisté ruce, vytříbené chutě','french_kiss'),
('ee','Radek',29,'homme','CZ','Sportovní novinář v zahraničí','Reportérská vesta, zápisník, rychlý pohled','hug'),
('ee','Vojta',27,'homme','CZ','Grafický designér na volné noze','Barevná bunda, taška s tužkami, dlouhé vlasy','french_kiss'),
('ee','Martin',40,'homme','CZ','Architekt hledá inspiraci','Designové brýle, složka s náčrty, zvídavý krok','hug'),
('ee','Petr',35,'homme','CZ','Lékař dobíjí baterie','Pohodlná mikina, uklidňující pohled, klidný krok','hug'),
('ee','Ádám',27,'homme','HU','Hátizsákos utazó szezonok között','Kék csíkos pulóver, kopott farmer, kócos haj','hug'),
('ee','Péter',30,'homme','HU','IT fejlesztő workation módban','Fehér póló, könnyű dzseki, tech hátizsák','french_kiss'),
('ee','Bálint',24,'homme','HU','Első szóló utazásán lévő hallgató','Kapucnis pulóver, szűk farmer, piros edzőcipő','hug'),
('ee','Gábor',33,'homme','HU','Fotóriporter mindig úton','Katonai dzseki, nehéz fényképezőgép, napszemüveg','french_kiss'),
('ee','Zoltán',28,'homme','HU','Rockzenész koncertek között','Gitár a vállán, bőrdzseki, megélt kinézet','hug'),
('ee','Tibor',36,'homme','HU','Séf névtelen vakáción','Casual ruha, biztos kezek, kifinomult ízlés','french_kiss'),
('ee','Attila',31,'homme','HU','Sportújságíró külföldön','Riporter mellény, notesz, gyors szem','hug'),
('ee','László',27,'homme','HU','Szabadúszó grafikus, mindenhol rajzol','Színes dzseki, ceruzás táska, hosszú haj','french_kiss'),
('ee','Sándor',40,'homme','HU','Építész városi inspirációt keres','Dizájn szemüveg, rajzmappa, kíváncsi lépések','hug'),
('ee','Balázs',29,'homme','HU','Személyi edző megérdemelt vakáción','Atlétikus alkat, sportruha, pozitív energia','hug'),
('ee','István',53,'homme','HU','Aktív nyugdíjas, Európa vonaton','Utazókalap, könnyű hátizsák, biztos lépés','hug'),
('ee','János',60,'homme','HU','Özvegy aki 60 évesen fedezi fel újra az életet','Tiszta kabát, félénk de meleg tekintet','hug'),
('ee','Kacper',26,'non-binaire','PL','Artysta performatywny między granicami','Androgyniczne ubrania, etnyczna biżuteria, figlarski uśmiech','hug'),
('ee','Remi',24,'non-binaire','PL','Muzyk elektroniczny w europejskim tournée','Duże słuchawki, techniczna kurtka, spokojny wygląd','french_kiss'),
('ee','Ren',30,'non-binaire','PL','Holistyczny terapeuta w wewnętrznej podróży','Szerokie naturalne ubrania, kamienie na szyi, promieniejący spokój','hug'),
('ee','Blanka',28,'non-binaire','PL','Ilustrator-ka w artystycznej rezydencji','Szkicownik, oversizowa kurtka, grube okulary','hug'),
('ee','Niko',31,'non-binaire','PL','Aktywista-ka kulturalny-a zawsze w ruchu','Torba na ramię, odznaki aktywistyczne, bystry wzrok','french_kiss'),
('ee','Zden',27,'non-binaire','CZ','Performativní umělec mezi žánry','Androgynní oblečení, etnické šperky, škodolibý úsměv','hug'),
('ee','Ríša',24,'non-binaire','CZ','Elektronický muzikant na turné','Velká sluchátka, technická bunda, klidný vzduch','french_kiss'),
('ee','Nela',30,'non-binaire','CZ','Holistický terapeut na vnitřní cestě','Volné přírodní oblečení, kameny na krku, vyzařující klid','hug'),
('ee','Sona',29,'non-binaire','CZ','Ilustrátor-ka v umělecké rezidenci','Skicák, oversized bunda, silné brýle','hug'),
('ee','Klim',31,'non-binaire','CZ','Kulturní aktivista-ka vždy v pohybu','Taška přes rameno, aktivistické odznaky, bystré oči','french_kiss'),
('ee','Rémi',27,'non-binaire','HU','Performatív művész műfajok és határok között','Androgün ruha, etnikus ékszerek, huncut mosoly','hug'),
('ee','Noel',24,'non-binaire','HU','Elektronikus zenész európai turnén','Nagy fejhallgató, technikai dzseki, nyugodt megjelenés','french_kiss'),
('ee','Ren',30,'non-binaire','HU','Holisztikus terapeuta belső utazáson','Széles természetes ruha, kövek a nyakban, kisugárzó nyugalom','hug'),
('ee','Soma',28,'non-binaire','HU','Illusztrátor-nő művészeti rezidencián','Vázlatfüzet, oversized dzseki, vastag szemüveg','hug'),
('ee','Niko',31,'non-binaire','HU','Kulturális aktivista-nő mindig mozgásban','Válltáska, aktivista kitűzők, éber tekintet','french_kiss');

-- FR supplement (13 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('fr','Éric',40,'homme','FR','Commercial tech qui voulait voir autre chose','Veste sport, sac à dos, sourire détendu','hug'),
('fr','Arnaud',35,'homme','FR','Véto en congès scientifique','Blouse rangée, regard calme, adore les bêtes','french_kiss'),
('fr','Xavier',29,'homme','FR','Ingénieur son entre deux festivals','Casque audio, veste technique, air focalisé','hug'),
('fr','Renaud',44,'homme','FR','Cuisinier de cantine, premier vrai voyage solo','Tablier dans le sac, regard émerveillé','hug'),
('fr','Serge',51,'homme','FR','Retraité anticipé qui redécouvre le monde','Chapeau de paille, guide de voyage, pas pressé','french_kiss'),
('fr','Yves',47,'homme','FR','Infirmier en congrès, enfin un peu de temps','Blouse pliée, sac pratique, regard bienveillant','hug'),
('fr','Thierry',39,'homme','FR','Technicien lumière entre deux spectacles','Veste noire, badge de scène, air nocturne','hug'),
('fr','Rémi',32,'homme','FR','Biologiste en déplacement terrain','Sac étanche, carnet de terrain, bottes robustes','french_kiss'),
('fr','Franck',37,'homme','FR','Chef de projet IT en workation surprise','Laptop, hoodie, air légèrement perdu','hug'),
('fr','Damien',26,'homme','FR','Apprenti cuisinier en stage à l''étranger','Tablier blanc, couteaux en sacoche, curiosité culinaire','hug'),
('fr','Bertrand',55,'homme','FR','Notaire qui prend sa retraite progressivement','Look classique décontracté, montre de qualité','french_kiss'),
('fr','Jean-Marc',48,'homme','FR','Douanier en vacances, voit le monde autrement','Physique robuste, look discret, humour décalé','hug'),
('fr','Luc',33,'homme','FR','Géomètre arpenteur, partout mais jamais touriste','Appareil de mesure, carnet, air concentré','hug');

-- IT supplement (5 femmes + 15 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('it','Aurora',32,'femme','IT','Designer di moda in cerca d''ispirazione','Look curato, occhio critico, borse multiple','hug'),
('it','Sveva',27,'femme','IT','Biologa marina tra due campagne scientifiche','Maglione navy, binocolo, capelli al vento','french_kiss'),
('it','Chiara',44,'femme','IT','Nutrizionista che esplora mercati locali','Borsa di tela, lista della spesa, sorriso sano','hug'),
('it','Noemi',23,'femme','IT','Studentessa di design, primo viaggio in solitaria','Sketchbook, matite colorate, aria curiosa','hug'),
('it','Vittoria',37,'femme','IT','Avvocata ambientale in convegno europeo','Tablet, look professionale rilassato, sguardo determinato','french_kiss'),
('it','Emilio',45,'homme','IT','Cuoco di bordo sbarcato per qualche giorno','Mani robuste, sorriso aperto, pelle abbronzata','hug'),
('it','Aldo',52,'homme','IT','Pensionato dinamico in tour europeo','Cappello da viaggio, zaino leggero, passo sicuro','hug'),
('it','Cesare',36,'homme','IT','Architetto paesaggista tra due incarichi','Schizzo in mano, stivali da campo, sguardo curioso','french_kiss'),
('it','Renato',47,'homme','IT','Ingegnere navale in trasferta','Caschetto in borsa, scarpe robuste, aria tecnica','hug'),
('it','Mario',58,'homme','IT','Ferroviere pensionato che esplora in treno','Cappello logoro, zaino pratico, storia da raccontare','hug'),
('it','Franco',41,'homme','IT','Veterinario tra due congressi','Borsa professionale, calma, ama tutti gli animali','french_kiss'),
('it','Giulio',30,'homme','IT','Pompiere in riposo, solido e rassicurante','Fisico atletico, look semplice, sguardo tranquillo','hug'),
('it','Virgilio',43,'homme','IT','Direttore marketing in fuga dal consiglio','Vestito rilassato, telefono quasi spento, sorriso vero','hug'),
('it','Guido',27,'homme','IT','Assistente di volo in scalo improvvisato','Uniforme, trolley cabina, leggermente jet-lagged','french_kiss'),
('it','Beppe',35,'homme','IT','Cuoco di strada, sempre in movimento','Grembiule da campo, borsa di spezie, entusiasmo','hug'),
('it','Ezio',49,'homme','IT','Pilota di linea in scalo di 6 ore','Uniforme sbottonata, valigia pilota, stanchezza elegante','hug'),
('it','Aldo',38,'homme','IT','Regista teatrale tra una produzione e l''altra','Berretto, sceneggiatura in mano, sguardo visionario','french_kiss'),
('it','Nereo',55,'homme','IT','Ex pescatore che scopre le città','Stivali nautici, pelle abbronzata, mani forti','hug'),
('it','Fausto',60,'homme','IT','Vedovo che riscopre la vita a 60 anni','Giacca ordinata, sguardo timido ma caldo','hug'),
('it','Orfeo',31,'homme','IT','Musicista classico in tournée','Violino in spalla, cravatta allentata, sensibilità palese','french_kiss');

-- DE supplement (4 femmes + 16 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('de','Ursula',43,'femme','DE','Sozialarbeiterin gönnt sich endlich Urlaub','Bequeme Kleidung, warmes Lächeln, ruhige Präsenz','hug'),
('de','Elfriede',57,'femme','DE','Pensionierte Buchhalterin auf Entdeckungsreise','Korrekte Kleidung, Stadtplan, glücklich verloren','hug'),
('de','Irmgard',48,'femme','DE','Krankenhausärztin zwischen zwei Konferenzen','Notizblock, praktische Kleidung, besänftigender Blick','french_kiss'),
('de','Walburga',35,'femme','DE','Landschaftsgärtnerin, Natur immer im Blick','Feldstiefel, Skizzenheft, Lupe in der Tasche','hug'),
('de','Friedrich',29,'homme','DE','Reisejournalist zwischen zwei Recherchen','Khaki-Weste, immer ein Notizblock, neugieriger Schritt','hug'),
('de','Ernst',44,'homme','DE','Polizeibeamter im Urlaub, entspannt und freundlich','Zivile Kleidung, ruhige Ausstrahlung','hug'),
('de','Gerhard',52,'homme','DE','Pensionierter Lehrer auf Weltreise','Wanderhut, Reiseführer, unendliche Neugier','french_kiss'),
('de','Hans',55,'homme','DE','Rentner der die Freiheit genießt','Bequeme Hose, leichtes Hemd, freier Schritt','hug'),
('de','Manfred',48,'homme','DE','Buchhalter endlich im Abenteuer-Modus','Konservative Kleidung, lockerer Kragen, verstecktes Lächeln','hug'),
('de','Norbert',60,'homme','DE','Witwer der das Leben neu entdeckt','Gepflegte Jacke, schüchterner aber herzlicher Blick','hug'),
('de','Wolfgang',41,'homme','DE','Ingenieur auf Messe zwischen zwei Terminen','Namensschild, praktischer Anzug, freundlicher Blick','french_kiss'),
('de','Dieter',37,'homme','DE','Konditor auf internationalen Messen','Zarte Hände, Werkzeugkoffer, feines Näschen','hug'),
('de','Erich',46,'homme','DE','Sportangler auf Kulturausflug','Gummistiefel, gelassene Ausstrahlung, Gesprächsbereitschaft','hug'),
('de','Rudolf',38,'homme','DE','Tierarzt auf Wissenschaftskongress','Profirucksack, ruhige Art, liebt alle Tiere','french_kiss'),
('de','Hartmut',32,'homme','DE','Feuerwehrmann im Ruhestand, stark und beruhigend','Kräftiger Körperbau, einfache Jacke, gefasster Blick','hug'),
('de','Heinz',43,'homme','DE','Marketingleiter flüchtet aus dem Vorstand','Lockerer Anzug, Telefon fast aus, echtes Lächeln','hug'),
('de','Karl',28,'homme','DE','Linienflugbegleiter bei ungeplantem Stopover','Uniform, Kabinentrolley, leicht übermüdet aber nett','french_kiss'),
('de','Georg',50,'homme','DE','Alleinerziehender Vater entdeckt Freiheit wieder','Praktische Jacke, offenes Lächeln, ruhige Augen','hug'),
('de','Dietrich',35,'homme','DE','Straßenköche immer unterwegs','Feldschürze, Gewürztasche, kulinarische Begeisterung','hug'),
('de','Ulrich',27,'homme','DE','Marinemann für ein paar Tage an Land','Marinepulli, gebräunte Haut, starke Hände','french_kiss');

-- ES supplement (5 femmes + 13 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('es','Soledad',37,'femme','ES','Diseñadora textil buscando telas locales','Muestras de tela, ojo artístico, dedos creativos','hug'),
('es','Paz',29,'femme','ES','Enfermera de urgencias en vacaciones merecidas','Look deportivo, mochila, sonrisa desahogada','hug'),
('es','Blanca',33,'femme','ES','Sommelière en tour vinícola','Copa de cata, libreta elegante, olfato refinado','french_kiss'),
('es','Virtudes',23,'femme','ES','Estudiante de periodismo en prácticas','Cámara, libreta, curiosidad sin límites','hug'),
('es','Luz',44,'femme','ES','Farmacéutica en viaje botánico','Bolsa de campo, guantes de jardinero, aire sereno','french_kiss'),
('es','Mateo',32,'homme','ES','Ingeniero naval en traslado','Casco en bolsa, botas robustas, aire técnico','hug'),
('es','Arturo',47,'homme','ES','Jubilado activo que recorre Europa en tren','Sombrero, mochila ligera, paso seguro','hug'),
('es','Sebastián',38,'homme','ES','Veterinario en congreso científico','Mochila profesional, calma, ama todos los animales','french_kiss'),
('es','Hugo',30,'homme','ES','Bombero de guardia, tranquilo y reconfortante','Físico sólido, ropa sencilla, mirada serena','hug'),
('es','Bernardo',43,'homme','ES','Director marketing huyendo del consejo','Traje relajado, teléfono casi apagado, sonrisa real','hug'),
('es','Aurelio',27,'homme','ES','Auxiliar de vuelo en escala improvisada','Uniforme, trolley de cabina, ligeramente jet-lagged','french_kiss'),
('es','Rufino',55,'homme','ES','Ex marinero que descubre las ciudades','Botas náuticas, piel bronceada, manos fuertes','hug'),
('es','Cándido',60,'homme','ES','Viudo que redescubre la vida a los 60','Ropa limpia, mirada tímida pero cálida','hug'),
('es','Félix',35,'homme','ES','Músico de orquesta entre temporadas','Partitura en bolsa, postura erguida, sensibilidad evidente','french_kiss'),
('es','Isidro',41,'homme','ES','Pastelero en ferias internacionales','Manos delicadas, maletín de herramientas, nariz fina','hug'),
('es','Rogelio',29,'homme','ES','Fotógrafo de naturaleza en la ciudad','Teleobjetivo, ropa funcional, ojo entrenado','hug'),
('es','Victoriano',52,'homme','ES','Ingeniero jubilado que viaja en tren','Gorra de visera, mochila pequeña, paso tranquilo','french_kiss'),
('es','Amancio',44,'homme','ES','Médico rural en congreso nacional','Maletín médico, mirada tranquilizadora, paso seguro','hug');

-- EN supplement (5 femmes + 12 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('en','Ethel',54,'femme','GB','Retired GP finally travelling solo','Comfortable walking shoes, practical coat, warm smile','hug'),
('en','Mabel',47,'femme','GB','Head librarian on an unexpected adventure','Reading glasses, canvas bag full of books, wonder','hug'),
('en','Hattie',33,'femme','GB','Environmental engineer at a sustainability summit','Eco clothing, metal water bottle, green convictions','french_kiss'),
('en','Clarice',26,'femme','GB','Pastry chef at international culinary fairs','Delicate hands, tool case, discerning nose','hug'),
('en','Muriel',39,'femme','GB','Nutritionist touring farmers markets','Canvas tote, shopping list, healthy enthusiast','french_kiss'),
('en','Reg',44,'homme','GB','Civil servant finally on holiday mode','Sensible clothing, relieved expression, open smile','hug'),
('en','Alistair',52,'homme','GB','Retired banker discovering slow travel','Quality watch, relaxed look new to him','hug'),
('en','Clem',38,'homme','GB','Theatre director between productions','Beret, script in hand, visionary gaze','french_kiss'),
('en','Ned',31,'homme','GB','Marine biologist ashore for a few days','Wet suit bag, tanned skin, strong hands','hug'),
('en','Barnaby',55,'homme','GB','Retired fisherman discovering cities','Sea boots, weathered face, fond of chatting','hug'),
('en','Albie',27,'homme','GB','Sound engineer between music festivals','Monitor headphones, technical jacket, focused air','french_kiss'),
('en','Piers',43,'homme','GB','Consultant photographer scouting locations','Heavy camera, technical vest, sharp eye','hug'),
('en','Sid',33,'homme','GB','Landscape gardener far from his garden','Field boots, sketching notebook, magnifying glass','hug'),
('en','Monty',48,'homme','GB','Customs officer genuinely relaxing for once','Robust build, quiet humour, discreet look','french_kiss'),
('en','Geoff',60,'homme','GB','Widower rediscovering life at 60','Clean jacket, shy but heartfelt gaze','hug'),
('en','Wilf',36,'homme','GB','Structural engineer between site visits','Technical drawings in bag, hard-hat hair, curious','hug'),
('en','Rudy',29,'homme','GB','Nature photographer visiting an urban jungle','Telephoto lens, functional clothing, trained eye','french_kiss');

-- EE supplement (8 hommes)
insert into public.demo_pins (country,name,age,gender,nationality,bio,appearance,looking_for) values
('ee','Władysław',50,'homme','PL','Strażak na urlopie, spokojny i uspokajający','Atletyczna sylwetka, zwykła kurtka, spokojne spojrzenie','hug'),
('ee','Zygmunt',43,'homme','PL','Dyrektor marketingu uciekający z zarządu','Swobodny garnitur, telefon prawie wyłączony, prawdziwy uśmiech','hug'),
('ee','Zbyszek',27,'homme','PL','Steward lotniczy na nieplanowanym postoju','Mundur, walizka kabinowa, lekko jet-lagged','french_kiss'),
('ee','Kazimierz',60,'homme','PL','Wdowiec odkrywający życie po 60-tce','Czysta kurtka, nieśmiałe ale ciepłe spojrzenie','hug'),
('ee','Vladimír',33,'homme','CZ','Záchranář na dovolené, klidný a uklidňující','Atletická postava, jednoduchá bunda, vyrovnaný pohled','hug'),
('ee','Zdeněk',47,'homme','CZ','Pensionista prozkoumávající Evropu vlakem','Cestovní klobouk, lehký batoh, jistý krok','hug'),
('ee','Miroslav',38,'homme','CZ','Veterinář na vědecké konferenci','Profesionální batoh, klid, miluje všechna zvířata','french_kiss'),
('ee','Vladimír',55,'homme','HU','Nyugdíjas tanár felfedező úton','Kényelmes cipő, városterek, korlátlan kíváncsiság','hug');
