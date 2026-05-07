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
if (session_status() === PHP_SESSION_NONE) {
    $sessionPath = __DIR__ . '/../tmp/sessions';
    if (!is_dir($sessionPath)) {
        mkdir($sessionPath, 0700, true);
    }
    session_save_path($sessionPath);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ─── Authentification admin ──────────────────────────────────────
function require_admin(): void
{
    if (empty($_SESSION['admin_logged_in'])) {
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
