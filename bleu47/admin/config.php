<?php
// ============================================================
// admin/config.php — Éditions Bleu 47
// Protégé par admin/.htaccess — NE PAS exposer publiquement
// ============================================================

// ─── Authentification admin ───────────────────────────────────────
define('ADMIN_USER', 'bleu47');
define('ADMIN_PASS', password_hash('MOT_DE_PASSE_ICI', PASSWORD_BCRYPT));

// ─── Base de données ──────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'bleu47');
define('DB_USER', 'root');
define('DB_PASS', '');

// ─── Email ────────────────────────────────────────────────────────
define('MAIL_TO',   'editeur@bleu47.fr');
define('MAIL_FROM', 'noreply@bleu47.fr');
define('MAIL_NAME', 'Éditions Bleu 47');

// ─── Upload ───────────────────────────────────────────────────────
// Chemin absolu vers assets/img/ (relatif à admin/config.php)
define('UPLOAD_DIR', __DIR__ . '/../assets/img/');
define('UPLOAD_MAX_WIDTH', 400);
