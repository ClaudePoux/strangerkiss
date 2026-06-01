-- Lexika – Scrabble-like word game
-- MySQL schema, indices, foreign keys, default admin user
-- Run once to set up the database

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table: lxk_users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lxk_users` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `login`      VARCHAR(50)  NOT NULL,
  `prenom`     VARCHAR(50)  NOT NULL DEFAULT '',
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('admin','player') NOT NULL DEFAULT 'player',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lxk_users_login` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: lxk_games
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lxk_games` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `player1_id`   INT UNSIGNED NOT NULL,
  `player2_id`   INT UNSIGNED NOT NULL,
  `board`        JSON         NOT NULL,
  `bag`          JSON         NOT NULL,
  `status`       ENUM('waiting','invited','playing','finished') NOT NULL DEFAULT 'invited',
  `current_turn` INT UNSIGNED NOT NULL,
  `winner_id`    INT UNSIGNED NULL DEFAULT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at`  TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lxk_games_player1` (`player1_id`),
  KEY `idx_lxk_games_player2` (`player2_id`),
  KEY `idx_lxk_games_status`  (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: lxk_game_players
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lxk_game_players` (
  `game_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `rack`    JSON         NOT NULL,
  `score`   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`game_id`, `user_id`),
  KEY `idx_lxk_gp_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: lxk_game_moves
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lxk_game_moves` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_id`    INT UNSIGNED NOT NULL,
  `user_id`    INT UNSIGNED NOT NULL,
  `move_type`  ENUM('play','exchange','pass','abandon') NOT NULL,
  `word`       VARCHAR(100) NULL DEFAULT NULL,
  `tiles`      JSON         NULL DEFAULT NULL,
  `score`      INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lxk_moves_game`    (`game_id`),
  KEY `idx_lxk_moves_user`    (`user_id`),
  KEY `idx_lxk_moves_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Foreign keys
-- --------------------------------------------------------
ALTER TABLE `lxk_games`
  ADD CONSTRAINT `fk_lxk_games_player1` FOREIGN KEY (`player1_id`) REFERENCES `lxk_users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lxk_games_player2` FOREIGN KEY (`player2_id`) REFERENCES `lxk_users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lxk_games_winner`  FOREIGN KEY (`winner_id`)  REFERENCES `lxk_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_lxk_games_turn`    FOREIGN KEY (`current_turn`) REFERENCES `lxk_users` (`id`) ON DELETE CASCADE;

ALTER TABLE `lxk_game_players`
  ADD CONSTRAINT `fk_lxk_gp_game` FOREIGN KEY (`game_id`) REFERENCES `lxk_games` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lxk_gp_user` FOREIGN KEY (`user_id`) REFERENCES `lxk_users` (`id`) ON DELETE CASCADE;

ALTER TABLE `lxk_game_moves`
  ADD CONSTRAINT `fk_lxk_moves_game` FOREIGN KEY (`game_id`) REFERENCES `lxk_games` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lxk_moves_user` FOREIGN KEY (`user_id`) REFERENCES `lxk_users` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------
-- Default admin user  (password: admin123, bcrypt)
-- --------------------------------------------------------
INSERT INTO `lxk_users` (`login`, `prenom`, `password`, `role`)
VALUES ('admin', 'Admin', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE `role` = 'admin';
-- Note: the hash above is bcrypt of "admin123" with cost 12.
-- If you need to regenerate: php -r "echo password_hash('admin123', PASSWORD_BCRYPT, ['cost'=>12]);"
