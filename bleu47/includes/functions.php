<?php
// ============================================================
// includes/functions.php — Fonctions utilitaires globales
// ============================================================

// ─── Base URL ─────────────────────────────────────────────────────
if (!defined('BASE')) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    // Déduit le sous-chemin en comparant DOCUMENT_ROOT avec le dossier racine du projet
    // functions.php est dans <racine>/includes/ → dirname(__DIR__) = <racine>
    $docRoot  = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    $projRoot = rtrim(str_replace('\\', '/', dirname(__DIR__)), '/');
    $subPath  = $docRoot !== '' ? substr($projRoot, strlen($docRoot)) : '';
    define('BASE', rtrim($protocol . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $subPath, '/'));
}

// ─── Session sécurisée ───────────────────────────────────────────
$sessionPath = dirname(__DIR__) . '/tmp/sessions';
if (!is_dir($sessionPath)) {
    mkdir($sessionPath, 0755, true);
}
$realPath = realpath($sessionPath);
if ($realPath) {
    session_save_path($realPath);
}
session_start();

// ─── Authentification admin ──────────────────────────────────────
function require_admin(): void
{
    if (empty($_SESSION['admin'])) {
        header('Location: ' . BASE . '/admin/login.php');
        exit;
    }
}

// ─── CSRF ─────────────────────────────────────────────────────────
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    if (
        empty($_POST['csrf_token']) ||
        !hash_equals((string) csrf_token(), (string) $_POST['csrf_token'])
    ) {
        http_response_code(403);
        exit('Requête invalide (CSRF).');
    }
}

// ─── Échappement HTML ─────────────────────────────────────────────
function e(mixed $v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ─── Slug ─────────────────────────────────────────────────────────
function slugify(string $text): string
{
    $text = mb_strtolower(trim($text), 'UTF-8');
    $map  = [
        'à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ã'=>'a','å'=>'a',
        'è'=>'e','é'=>'e','ê'=>'e','ë'=>'e',
        'ì'=>'i','î'=>'i','ï'=>'i','í'=>'i',
        'ò'=>'o','ô'=>'o','ö'=>'o','ó'=>'o','õ'=>'o',
        'ù'=>'u','û'=>'u','ü'=>'u','ú'=>'u',
        'ç'=>'c','ñ'=>'n','ý'=>'y','ÿ'=>'y','œ'=>'oe','æ'=>'ae',
    ];
    $text = strtr($text, $map);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return trim($text, '-');
}

// ─── Upload image avec redimensionnement GD ──────────────────────
function upload_image(array $file, string $subdir, int $maxWidth = 400): string|false
{
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return false;
    }

    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $extMap  = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);

    if (!in_array($mimeType, $allowed, true)) {
        return false;
    }

    $ext      = $extMap[$mimeType];
    $filename = uniqid('img_', true) . '.' . $ext;
    $destDir  = rtrim(UPLOAD_DIR, '/') . '/' . trim($subdir, '/') . '/';
    $destPath = $destDir . $filename;

    if (!is_dir($destDir) && !mkdir($destDir, 0755, true)) {
        return false;
    }

    [$origW, $origH] = getimagesize($file['tmp_name']);

    if ($origW > $maxWidth) {
        $ratio = $maxWidth / $origW;
        $newW  = $maxWidth;
        $newH  = (int) round($origH * $ratio);

        $src = match ($mimeType) {
            'image/jpeg' => imagecreatefromjpeg($file['tmp_name']),
            'image/png'  => imagecreatefrompng($file['tmp_name']),
            'image/webp' => imagecreatefromwebp($file['tmp_name']),
            'image/gif'  => imagecreatefromgif($file['tmp_name']),
        };
        $dst = imagecreatetruecolor($newW, $newH);

        if (in_array($mimeType, ['image/png', 'image/webp', 'image/gif'], true)) {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
        }

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

        match ($mimeType) {
            'image/jpeg' => imagejpeg($dst, $destPath, 90),
            'image/png'  => imagepng($dst, $destPath, 6),
            'image/webp' => imagewebp($dst, $destPath, 90),
            'image/gif'  => imagegif($dst, $destPath),
        };

        imagedestroy($src);
        imagedestroy($dst);
    } else {
        move_uploaded_file($file['tmp_name'], $destPath);
    }

    return trim($subdir, '/') . '/' . $filename;
}

// ─── Pagination ───────────────────────────────────────────────────
function paginate(int $total, int $perPage, int $current): array
{
    $pages   = max(1, (int) ceil($total / $perPage));
    $current = max(1, min($current, $pages));

    return [
        'total'   => $total,
        'pages'   => $pages,
        'current' => $current,
        'offset'  => ($current - 1) * $perPage,
        'perPage' => $perPage,
    ];
}

// ─── Messages flash ───────────────────────────────────────────────
function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function get_flash(): ?array
{
    if (!empty($_SESSION['flash'])) {
        $flash = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $flash;
    }
    return null;
}

// ─── Redirection propre ───────────────────────────────────────────
function redirect(string $url): never
{
    header('Location: ' . $url);
    exit;
}

// ─── Valeur GET/POST sécurisée ────────────────────────────────────
function input(string $key, string $from = 'post', mixed $default = ''): mixed
{
    $source = $from === 'get' ? $_GET : $_POST;
    return $source[$key] ?? $default;
}

// ============================================================
// ─── Phase 2 : Panier ────────────────────────────────────────
// ============================================================

/**
 * Retourne le contenu du panier depuis la session.
 * @return array<int, array{livre_id:int,type:string,titre:string,auteur:string,prix:float,poids_g:int,couverture:string,quantite:int}>
 */
function panier_get(): array
{
    return $_SESSION['panier'] ?? [];
}

/**
 * Ajoute un article au panier ou incrémente sa quantité s'il est déjà présent.
 */
function panier_ajouter(array $article): void
{
    if (!isset($_SESSION['panier'])) {
        $_SESSION['panier'] = [];
    }
    // Cherche un article identique (même livre_id + même type)
    foreach ($_SESSION['panier'] as &$item) {
        if ($item['livre_id'] === $article['livre_id'] && $item['type'] === $article['type']) {
            $item['quantite']++;
            return;
        }
    }
    unset($item);
    $article['quantite'] = 1;
    $_SESSION['panier'][] = $article;
}

/**
 * Supprime l'article à l'index donné du panier.
 */
function panier_supprimer(int $index): void
{
    if (isset($_SESSION['panier'][$index])) {
        array_splice($_SESSION['panier'], $index, 1);
    }
}

/**
 * Vide entièrement le panier.
 */
function panier_vider(): void
{
    $_SESSION['panier'] = [];
}

/**
 * Retourne le nombre total d'articles dans le panier (somme des quantités).
 */
function panier_count(): int
{
    $total = 0;
    foreach (panier_get() as $item) {
        $total += (int)$item['quantite'];
    }
    return $total;
}

/**
 * Retourne le poids total (grammes) des articles papier du panier.
 */
function panier_poids_total(): int
{
    $poids = 0;
    foreach (panier_get() as $item) {
        if ($item['type'] === 'papier') {
            $poids += (int)$item['poids_g'] * (int)$item['quantite'];
        }
    }
    return $poids;
}

/**
 * Retourne le sous-total articles TTC (sans frais de port).
 */
function panier_sous_total(): float
{
    $total = 0.0;
    foreach (panier_get() as $item) {
        $total += (float)$item['prix'] * (int)$item['quantite'];
    }
    return round($total, 2);
}

/**
 * Retourne le tarif de frais de port pour un poids donné (grammes),
 * ou null si aucune tranche ne correspond (message "nous contacter").
 */
function get_frais_port(PDO $pdo, int $poids): ?float
{
    if ($poids === 0) {
        return 0.0; // Commande 100% numérique
    }
    $stmt = $pdo->prepare(
        'SELECT tarif FROM frais_port WHERE poids_min_g <= :pmin AND poids_max_g >= :pmax AND actif = 1 LIMIT 1'
    );
    $stmt->execute([':pmin' => $poids, ':pmax' => $poids]);
    $row = $stmt->fetch();
    return $row ? (float)$row['tarif'] : null;
}

/**
 * Génère une référence de commande unique au format BL47-YYYYMMDD-XXXX.
 */
function generate_reference(PDO $pdo): string
{
    $date = date('Ymd');
    // Compte les commandes du jour pour obtenir le prochain numéro séquentiel
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM commandes WHERE reference LIKE :pattern"
    );
    $stmt->execute([':pattern' => 'BL47-' . $date . '-%']);
    $count = (int)$stmt->fetchColumn();
    return 'BL47-' . $date . '-' . str_pad((string)($count + 1), 4, '0', STR_PAD_LEFT);
}

/**
 * Détermine le type de commande (papier / numerique / mixte) selon le panier.
 */
function panier_type_commande(): string
{
    $hasPapier    = false;
    $hasNumerique = false;
    foreach (panier_get() as $item) {
        if ($item['type'] === 'papier')    $hasPapier    = true;
        if ($item['type'] === 'numerique') $hasNumerique = true;
    }
    if ($hasPapier && $hasNumerique) return 'mixte';
    if ($hasPapier)                  return 'papier';
    return 'numerique';
}

/**
 * Retourne true si le panier contient au moins un article papier.
 */
function panier_has_papier(): bool
{
    foreach (panier_get() as $item) {
        if ($item['type'] === 'papier') return true;
    }
    return false;
}

/**
 * Valide un token hCaptcha côté serveur.
 */
function hcaptcha_verify(string $token): bool
{
    if (empty($token)) return false;
    $data = http_build_query([
        'secret'   => HCAPTCHA_SECRET_KEY,
        'response' => $token,
    ]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $data,
        'timeout' => 5,
    ]]);
    $result = @file_get_contents('https://hcaptcha.com/siteverify', false, $ctx);
    if (!$result) return false;
    $json = json_decode($result, true);
    return !empty($json['success']);
}
