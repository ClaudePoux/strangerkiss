-- Migration : ajout type_client, raison_sociale, siret dans commandes
-- À exécuter dans phpMyAdmin ou via mysql CLI
ALTER TABLE commandes
  ADD COLUMN type_client    ENUM('particulier','professionnel') NOT NULL DEFAULT 'particulier' AFTER type_commande,
  ADD COLUMN raison_sociale VARCHAR(255)  NULL AFTER type_client,
  ADD COLUMN siret          VARCHAR(25)   NULL AFTER raison_sociale;
