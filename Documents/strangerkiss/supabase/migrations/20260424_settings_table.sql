-- Table de configuration globale (clé/valeur)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : lecture publique, écriture service role uniquement
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON settings FOR SELECT USING (true);
CREATE POLICY "service role write" ON settings FOR ALL USING (false) WITH CHECK (false);

-- Valeur initiale : date de lancement
INSERT INTO settings (key, value)
VALUES ('launch_date', '2026-05-26T00:00:00Z')
ON CONFLICT (key) DO NOTHING;
