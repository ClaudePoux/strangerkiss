-- Table ambassadeurs
CREATE TABLE IF NOT EXISTS ambassadors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  brand          TEXT,
  website        TEXT,
  social_links   JSONB DEFAULT '{}'::jsonb,
  description    TEXT NOT NULL DEFAULT '',
  why_support    TEXT NOT NULL DEFAULT '',
  photo_url      TEXT,
  referral_code  TEXT UNIQUE,
  category       TEXT NOT NULL DEFAULT 'Lifestyle',
  display_order  INTEGER NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  partner_since  DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : lecture publique, écriture service role uniquement
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON ambassadors FOR SELECT USING (true);
CREATE POLICY "service role write" ON ambassadors
  FOR ALL USING (false) WITH CHECK (false);

-- Index pour les filtres courants
CREATE INDEX IF NOT EXISTS ambassadors_active_order ON ambassadors (active, display_order);
CREATE INDEX IF NOT EXISTS ambassadors_category ON ambassadors (category);
