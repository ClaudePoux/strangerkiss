-- ============================================================
-- StrangerKiss — Migration MySQL OVH
-- Serveur : nqmwgujstrkiss.mysql.db
-- Base    : nqmwgujstrkiss
-- Exécuter dans phpMyAdmin ou via CLI mysql
-- Compatible MySQL 5.7+ et 8.0+
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- 1. Utilisateurs (auth SMS + crédits)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  credits     INT          NOT NULL DEFAULT 3,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Profils / pins sur la carte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_pins (
  id          VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  DEFAULT NULL,           -- FK vers users.id (null si non authentifié)
  name        VARCHAR(30)  NOT NULL,
  age         TINYINT      UNSIGNED NOT NULL,       -- >= 18 validé côté app
  gender      VARCHAR(20)  NOT NULL,               -- homme | femme | non-binaire | autre
  nationality VARCHAR(5)   NOT NULL DEFAULT '',
  bio         VARCHAR(120) NOT NULL DEFAULT '',
  appearance  VARCHAR(80)  NOT NULL DEFAULT '',
  looking_for VARCHAR(20)  NOT NULL,               -- hug | french_kiss
  lat         DOUBLE       NOT NULL,
  lng         DOUBLE       NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_location  (lat, lng),
  INDEX idx_created   (created_at),
  INDEX idx_user      (user_id),
  CONSTRAINT fk_pin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Messages du chat (texte + selfies base64 + marqueurs de consentement)
-- Marqueurs spéciaux stockés comme texte :
--   §MEETING_REQUEST§  — demande de rencontre
--   §MEETING_ACCEPTED§ — rencontre acceptée
--   §MEETING_REFUSED§  — rencontre refusée
-- Selfies : data:image/jpeg;base64,... (MEDIUMTEXT = 16 Mo max)
-- Note OVH : vérifier max_allowed_packet >= 4M dans phpMyAdmin
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(36)  NOT NULL,
  from_id     VARCHAR(36)  NOT NULL,               -- user_pins.id de l'émetteur
  to_id       VARCHAR(36)  NOT NULL,               -- user_pins.id du destinataire
  content     MEDIUMTEXT   NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),  -- précision ms pour le polling
  PRIMARY KEY (id),
  INDEX idx_conv     (from_id, to_id, created_at),
  INDEX idx_conv_rev (to_id, from_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Demandes de rencontre (consentement mutuel + déduction crédit)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_requests (
  id            VARCHAR(36) NOT NULL,
  requester_id  VARCHAR(36) NOT NULL,              -- user_pins.id du demandeur
  target_id     VARCHAR(36) NOT NULL,              -- user_pins.id du destinataire
  status        VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending | accepted | refused
  credit_spent  TINYINT(1)  NOT NULL DEFAULT 0,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match (requester_id, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Nettoyage automatique des pins > 24h (à planifier via cron OVH)
-- DELETE FROM user_pins WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);
-- ------------------------------------------------------------
