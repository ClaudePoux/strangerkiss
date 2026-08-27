-- Lexika – traçage des pioches de lettres pour le calcul du Tirage Pondéré Moyen (TPM)
-- Ajout uniquement, ne touche à aucune table existante. À exécuter une fois sur OVH.

CREATE TABLE lxk_draws (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  draw_type   ENUM('initial','play','exchange') NOT NULL,
  tiles       JSON NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lxk_draws_game (game_id),
  KEY idx_lxk_draws_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
