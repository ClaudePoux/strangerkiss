-- ============================================================
-- install.sql — Éditions Bleu 47
-- Schéma complet + données initiales
-- Exécuter une seule fois sur la base MySQL OVH
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;


-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `collections` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `nom`         VARCHAR(100)   NOT NULL,
  `slug`        VARCHAR(100)   NOT NULL,
  `description` TEXT,
  `couleur`     VARCHAR(7)     NOT NULL DEFAULT '#1a4a8a',
  `couverture`  VARCHAR(255)   DEFAULT NULL,
  `ordre`       INT            NOT NULL DEFAULT 0,
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `auteurs` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `nom`         VARCHAR(100)   NOT NULL,
  `prenom`      VARCHAR(100)   NOT NULL,
  `slug`        VARCHAR(255)   NOT NULL,
  `photo`       VARCHAR(255)   DEFAULT NULL,
  `bio`         TEXT,
  `site_web`    VARCHAR(500)   DEFAULT NULL,
  `statut`      ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  `ordre`       INT            NOT NULL DEFAULT 0,
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `livres` (
  `id`                   INT            NOT NULL AUTO_INCREMENT,
  `titre`                VARCHAR(255)   NOT NULL,
  `slug`                 VARCHAR(255)   NOT NULL,
  `auteur_id`            INT            NOT NULL,
  `collection_id`        INT            NOT NULL,
  `isbn_papier`          VARCHAR(20)    DEFAULT NULL,
  `isbn_numerique`       VARCHAR(20)    DEFAULT NULL,
  `annee`                YEAR           DEFAULT NULL,
  `nb_pages`             INT            DEFAULT NULL,
  `couverture`           VARCHAR(255)   DEFAULT NULL,
  `quatrieme`            TEXT,
  `extrait`              TEXT,
  `prix_papier`          DECIMAL(6,2)   DEFAULT NULL,
  `prix_numerique`       DECIMAL(6,2)   DEFAULT NULL,
  `disponible_papier`    TINYINT(1)     NOT NULL DEFAULT 1,
  `disponible_numerique` TINYINT(1)     NOT NULL DEFAULT 0,
  `statut`               ENUM('publie','a_paraitre','epuise','brouillon') NOT NULL DEFAULT 'brouillon',
  `date_parution`        DATE           DEFAULT NULL,
  `ordre`                INT            NOT NULL DEFAULT 0,
  `created_at`           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  CONSTRAINT `fk_livres_auteur`     FOREIGN KEY (`auteur_id`)     REFERENCES `auteurs`(`id`),
  CONSTRAINT `fk_livres_collection` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `actus` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `titre`       VARCHAR(255)   NOT NULL,
  `date_actu`   DATE           NOT NULL,
  `categorie`   ENUM('Actualité','Dédicace','Salon du livre','Parution') NOT NULL DEFAULT 'Actualité',
  `contenu`     TEXT           NOT NULL,
  `livre_id`    INT            DEFAULT NULL,
  `statut`      ENUM('publie','brouillon') NOT NULL DEFAULT 'publie',
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_actus_livre` FOREIGN KEY (`livre_id`) REFERENCES `livres`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `revues_presse` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `source`        VARCHAR(255)   NOT NULL,
  `date_revue`    DATE           NOT NULL,
  `livre_id`      INT            DEFAULT NULL,
  `type`          ENUM('Revue','Critique','Interview','Article') NOT NULL DEFAULT 'Revue',
  `titre_article` VARCHAR(255)   DEFAULT NULL,
  `citation`      TEXT,
  `url`           VARCHAR(500)   DEFAULT NULL,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_revues_livre` FOREIGN KEY (`livre_id`) REFERENCES `livres`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── DONNÉES INITIALES ───────────────────────────────────────────────────────

INSERT INTO `collections` (`nom`, `slug`, `description`, `couleur`, `ordre`) VALUES
(
  'Adrénaline',
  'adrenaline',
  'Polars, thrillers et romans noirs qui vous tiennent en haleine jusqu''à la dernière page.',
  '#cc2200',
  1
),
(
  'Fictions',
  'fictions',
  'Romans, récits et littérature contemporaine qui explorent la condition humaine.',
  '#1a4a8a',
  2
),
(
  'BD / Romans graphiques',
  'bd',
  'Bande dessinée et romans graphiques : quand le texte et l''image se répondent.',
  '#e8670a',
  3
);


INSERT INTO `auteurs` (`nom`, `prenom`, `slug`, `bio`, `statut`, `ordre`) VALUES
(
  'Poux',
  'Claude',
  'claude-poux',
  '<p>Claude Poux est un auteur bourguignon dont l''œuvre explore avec finesse les zones d''ombre de la nature humaine. Né en Bourgogne-Franche-Comté, il publie son premier roman en 2020 aux Éditions Bleu 47 et ne s''est pas arrêté depuis.</p><p>Ses polars, ancrés dans des territoires ruraux français, mêlent tension psychologique et critique sociale. Ses romans de la collection Fictions témoignent d''une sensibilité plus introspective, attentive aux silences et aux petits riens du quotidien.</p>',
  'actif',
  1
);


-- Romans de Claude Poux (auteur_id = 1, collections : 1=Adrénaline, 2=Fictions, 3=BD)
INSERT INTO `livres`
  (`titre`, `slug`, `auteur_id`, `collection_id`, `isbn_papier`, `annee`, `nb_pages`,
   `quatrieme`, `prix_papier`, `prix_numerique`, `disponible_papier`, `disponible_numerique`,
   `statut`, `date_parution`, `ordre`)
VALUES
(
  'La Nuit des Corbeaux',
  'la-nuit-des-corbeaux',
  1, 1,
  '978-2-XXXXXXX-00-0',
  2020, 312,
  '<p>En plein hiver bourguignon, le corps d''un notaire est retrouvé dans les vignes, les yeux arrachés. Le commandant Irène Salis, revenue dans son village natal après dix ans d''absence, se retrouve plongée dans une enquête où personne ne dit toute la vérité.</p><p>Un polar rural haletant, où la beauté des paysages contraste avec la noirceur des hommes.</p>',
  18.00, 8.99, 1, 1,
  'publie', '2020-09-15', 1
),
(
  'L''Écho du Silence',
  'l-echo-du-silence',
  1, 2,
  '978-2-XXXXXXX-01-7',
  2021, 248,
  '<p>Thomas n''a pas parlé depuis trois ans. Pas depuis l''accident. Réfugié dans la maison familiale en Franche-Comté, il reçoit un soir la visite d''une femme qu''il croyait morte. Ce qu''elle lui apporte va le forcer à rouvrir les yeux, et peut-être la bouche.</p><p>Un roman sur le deuil, la culpabilité et la résilience. Poignant et lumineux.</p>',
  17.00, 7.99, 1, 1,
  'publie', '2021-03-10', 2
),
(
  'Territoire Maudit',
  'territoire-maudit',
  1, 1,
  '978-2-XXXXXXX-02-4',
  2022, 336,
  '<p>Une série de disparitions dans les Hautes-Chaumes du Jura. Des témoins qui se rétractent. Un maire qui protège quelque chose — ou quelqu''un. Le commandant Salis est de retour, plus déterminée que jamais.</p><p>La suite de <em>La Nuit des Corbeaux</em>, encore plus sombre, encore plus addictive.</p>',
  19.00, 8.99, 1, 1,
  'publie', '2022-09-22', 3
),
(
  'Les Âmes Grises',
  'les-ames-grises',
  1, 3,
  '978-2-XXXXXXX-03-1',
  2023, 128,
  '<p>Dans une ville ouvrière des années 1980 qui se meurt, trois enfants découvrent le corps d''un inconnu dans la friche industrielle. Ce secret va les lier pour la vie.</p><p>Un roman graphique sur l''enfance, la fidélité et les silences qu''on emporte dans l''âge adulte. Dessin en bichromie, atmosphère mélancolique et précise.</p>',
  22.00, 9.99, 1, 1,
  'publie', '2023-04-06', 4
);


INSERT INTO `actus` (`titre`, `date_actu`, `categorie`, `contenu`, `livre_id`, `statut`) VALUES
(
  'Bienvenue sur le nouveau site des Éditions Bleu 47',
  '2024-01-15',
  'Actualité',
  '<p>Nous sommes heureux de vous accueillir sur le tout nouveau site des Éditions Bleu 47. Retrouvez notre catalogue complet, les actualités de la maison et les pages de nos auteurs.</p>',
  NULL,
  'publie'
),
(
  'Parution de « Les Âmes Grises » de Claude Poux',
  '2023-04-06',
  'Parution',
  '<p>Le nouveau roman graphique de Claude Poux est disponible ! <em>Les Âmes Grises</em> marque l''entrée de l''auteur dans notre collection BD et c''est une vraie réussite. En librairie dès maintenant.</p>',
  4,
  'publie'
),
(
  'Claude Poux en dédicace à la librairie La Page — Dijon',
  '2023-05-20',
  'Dédicace',
  '<p>Claude Poux sera présent à la librairie <strong>La Page</strong> à Dijon le samedi 20 mai de 14h à 18h pour dédicacer <em>Les Âmes Grises</em> et l''ensemble de sa bibliographie. Venez nombreux !</p>',
  4,
  'publie'
);


SET foreign_key_checks = 1;
