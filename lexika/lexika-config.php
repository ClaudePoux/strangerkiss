<?php
declare(strict_types=1);
// ini_set('display_errors', '1');
// error_reporting(E_ALL);

// ── Base URL ─────────────────────────────────────────────────────────────────
define('BASE_URL', '/lexika');

// ── Version des assets (à incrémenter à chaque déploiement) ────────────────
define('ASSET_VERSION', '11');

// ── Database configuration ──────────────────────────────────────────────────
define('DB_HOST', 'nqmwgujcp.mysql.db');
define('DB_NAME', 'nqmwgujcp');
define('DB_USER', 'nqmwgujcp');
define('DB_PASS', 'jerkDerFF47zQlu');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}

// ── Admin credentials (hardcoded, independent of lxk_users) ─────────────────
define('ADMIN_LOGIN',         'admin');
define('ADMIN_PASSWORD_HASH', '$2y$12$BqmHiYrbaB5bkhch3AZHHe63fIUHvQyUnu918IAyVPFSyCqaDfSKy');
// Mot de passe par défaut : lexika2026!  — à changer via makehash.php

// ── Session helpers — joueurs ─────────────────────────────────────────────────
define('REMEMBER_COOKIE', 'lxk_remember');
define('REMEMBER_DAYS',   90);

function sessionStart(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name('lexika_session');
        session_start();
    }
}

function setRememberToken(int $userId): void {
    $token   = bin2hex(random_bytes(32)); // 64 hex chars, raw value stored in cookie
    $hashed  = hash('sha256', $token);    // only the hash goes in the DB
    $expires = date('Y-m-d H:i:s', time() + REMEMBER_DAYS * 86400);

    getDB()->prepare('UPDATE lxk_users SET remember_token = ?, remember_expires = ? WHERE id = ?')
           ->execute([$hashed, $expires, $userId]);

    setcookie(REMEMBER_COOKIE, $token, [
        'expires'  => time() + REMEMBER_DAYS * 86400,
        'path'     => BASE_URL . '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function checkRememberToken(): bool {
    $token = $_COOKIE[REMEMBER_COOKIE] ?? '';
    if ($token === '') return false;

    $hashed = hash('sha256', $token);
    $stmt   = getDB()->prepare(
        'SELECT id, login, prenom, role FROM lxk_users
          WHERE remember_token = ? AND remember_expires > NOW() LIMIT 1'
    );
    $stmt->execute([$hashed]);
    $user = $stmt->fetch();

    if (!$user) {
        // Cookie invalide ou expiré — on le supprime
        setcookie(REMEMBER_COOKIE, '', ['expires' => 1, 'path' => BASE_URL . '/', 'httponly' => true, 'samesite' => 'Lax']);
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['login']   = $user['login'];
    $_SESSION['prenom']  = $user['prenom'];
    $_SESSION['role']    = $user['role'];

    // Rotation du token à chaque reconnexion automatique
    setRememberToken((int)$user['id']);
    return true;
}

function requireLogin(): void {
    sessionStart();
    if (empty($_SESSION['user_id']) && !checkRememberToken()) {
        header('Location: ' . BASE_URL . '/login.php');
        exit;
    }
}

// ── Session helpers — admin (session séparée, indépendante) ──────────────────
function adminSessionStart(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    session_name('lexika_admin_session');
    session_start();
}

function requireAdminSession(): void {
    adminSessionStart();
    if (empty($_SESSION['admin_auth'])) {
        header('Location: ' . BASE_URL . '/admin_login.php');
        exit;
    }
}

// Conservé pour compatibilité éventuelle (non utilisé par admin.php)
function requireAdmin(): void {
    requireLogin();
    if (($_SESSION['role'] ?? '') !== 'admin') {
        header('Location: ' . BASE_URL . '/index.php');
        exit;
    }
}

function currentUser(): array {
    return [
        'id'     => $_SESSION['user_id'] ?? null,
        'login'  => $_SESSION['login']   ?? null,
        'prenom' => $_SESSION['prenom']  ?? null,
        'role'   => $_SESSION['role']    ?? null,
    ];
}

// ── Letter tiles (French ODS distribution) ───────────────────────────────────
// Each entry: ['count' => N, 'value' => V]
define('LETTER_TILES', [
    'A'     => ['count' =>  9, 'value' =>  1],
    'B'     => ['count' =>  2, 'value' =>  3],
    'C'     => ['count' =>  2, 'value' =>  3],
    'D'     => ['count' =>  3, 'value' =>  2],
    'E'     => ['count' => 15, 'value' =>  1],
    'F'     => ['count' =>  2, 'value' =>  4],
    'G'     => ['count' =>  2, 'value' =>  2],
    'H'     => ['count' =>  2, 'value' =>  4],
    'I'     => ['count' =>  8, 'value' =>  1],
    'J'     => ['count' =>  1, 'value' =>  8],
    'K'     => ['count' =>  1, 'value' => 10],
    'L'     => ['count' =>  5, 'value' =>  1],
    'M'     => ['count' =>  3, 'value' =>  2],
    'N'     => ['count' =>  6, 'value' =>  1],
    'O'     => ['count' =>  6, 'value' =>  1],
    'P'     => ['count' =>  2, 'value' =>  3],
    'Q'     => ['count' =>  1, 'value' =>  8],
    'R'     => ['count' =>  6, 'value' =>  1],
    'S'     => ['count' =>  6, 'value' =>  1],
    'T'     => ['count' =>  6, 'value' =>  1],
    'U'     => ['count' =>  6, 'value' =>  1],
    'V'     => ['count' =>  2, 'value' =>  4],
    'W'     => ['count' =>  1, 'value' => 10],
    'X'     => ['count' =>  1, 'value' => 10],
    'Y'     => ['count' =>  1, 'value' => 10],
    'Z'     => ['count' =>  1, 'value' => 10],
    'joker' => ['count' =>  2, 'value' =>  0],
]);

// ── Bonus squares ────────────────────────────────────────────────────────────
// Key: "row,col" (0-indexed), Value: "3M"|"2M"|"3L"|"2L"
define('BONUS_SQUARES', [
    // Triple Word Score (3M)
    '0,0'   => '3M', '0,7'   => '3M', '0,14'  => '3M',
    '7,0'   => '3M', '7,14'  => '3M',
    '14,0'  => '3M', '14,7'  => '3M', '14,14' => '3M',

    // Double Word Score (2M) + center star
    '1,1'   => '2M', '2,2'   => '2M', '3,3'   => '2M', '4,4'   => '2M',
    '1,13'  => '2M', '2,12'  => '2M', '3,11'  => '2M', '4,10'  => '2M',
    '10,4'  => '2M', '11,3'  => '2M', '12,2'  => '2M', '13,1'  => '2M',
    '10,10' => '2M', '11,11' => '2M', '12,12' => '2M', '13,13' => '2M',
    '7,7'   => '2M', // center star (also a double word)

    // Triple Letter Score (3L)
    '1,5'   => '3L', '1,9'   => '3L',
    '5,1'   => '3L', '5,5'   => '3L', '5,9'   => '3L', '5,13'  => '3L',
    '9,1'   => '3L', '9,5'   => '3L', '9,9'   => '3L', '9,13'  => '3L',
    '13,5'  => '3L', '13,9'  => '3L',

    // Double Letter Score (2L)
    '0,3'   => '2L', '0,11'  => '2L',
    '2,6'   => '2L', '2,8'   => '2L',
    '3,0'   => '2L', '3,7'   => '2L', '3,14'  => '2L',
    '6,2'   => '2L', '6,6'   => '2L', '6,8'   => '2L', '6,12'  => '2L',
    '7,3'   => '2L', '7,11'  => '2L',
    '8,2'   => '2L', '8,6'   => '2L', '8,8'   => '2L', '8,12'  => '2L',
    '11,0'  => '2L', '11,7'  => '2L', '11,14' => '2L',
    '12,6'  => '2L', '12,8'  => '2L',
    '14,3'  => '2L', '14,11' => '2L',
]);

// ── Tile bag ─────────────────────────────────────────────────────────────────
function makeBag(): array {
    $bag = [];
    foreach (LETTER_TILES as $letter => $info) {
        $isJoker = ($letter === 'joker');
        for ($i = 0; $i < $info['count']; $i++) {
            $bag[] = [
                'letter'   => $isJoker ? '' : $letter,
                'value'    => $info['value'],
                'is_joker' => $isJoker,
            ];
        }
    }
    shuffle($bag);
    return $bag;
}

function drawTiles(array &$bag, int $count): array {
    $drawn = [];
    for ($i = 0; $i < $count && !empty($bag); $i++) {
        $drawn[] = array_pop($bag);
    }
    return $drawn;
}

// ── Dictionary ───────────────────────────────────────────────────────────────
function loadDictionary(): array {
    static $dict = null;
    if ($dict === null) {
        $path = __DIR__ . '/ods.txt';
        if (!file_exists($path)) {
            $dict = [];
        } else {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $words = [];
            foreach ($lines as $line) {
                $words[] = strtoupper(trim($line));
            }
            $dict = array_flip($words);
        }
    }
    return $dict;
}

function isValidWord(string $word): bool {
    $dict = loadDictionary();
    return isset($dict[strtoupper($word)]);
}

// ── Move validation ───────────────────────────────────────────────────────────
/**
 * Validate a move and calculate its score.
 *
 * @param array $board      Current board state: {"row,col": {letter, value, is_joker}}
 * @param array $newTiles   Tiles being placed: [{row, col, letter, value, is_joker}]
 * @param bool  $isFirstMove Whether the board is currently empty
 * @return array {valid: bool, score: int, words: string[], error: string}
 */
function validateMove(array $board, array $newTiles, bool $isFirstMove): array {
    $err = fn(string $msg) => ['valid' => false, 'score' => 0, 'words' => [], 'error' => $msg];

    if (empty($newTiles)) {
        return $err('Aucune tuile posée.');
    }

    // Collect rows and cols of new tiles
    $rows = array_column($newTiles, 'row');
    $cols = array_column($newTiles, 'col');
    $minRow = min($rows); $maxRow = max($rows);
    $minCol = min($cols); $maxCol = max($cols);

    // All new tiles must be in same row or same column
    $sameRow = ($minRow === $maxRow);
    $sameCol = ($minCol === $maxCol);
    if (!$sameRow && !$sameCol) {
        return $err('Les tuiles doivent être sur la même ligne ou colonne.');
    }

    // Check for duplicate positions
    $posKeys = [];
    foreach ($newTiles as $t) {
        $k = $t['row'] . ',' . $t['col'];
        if (isset($posKeys[$k])) return $err('Deux tuiles sur la même case.');
        $posKeys[$k] = true;
        if (isset($board[$k])) return $err('Case déjà occupée : ' . $k);
    }

    // Build merged board (existing + new)
    $merged = $board; // existing tiles
    foreach ($newTiles as $t) {
        $merged[$t['row'] . ',' . $t['col']] = [
            'letter'   => $t['letter'],
            'value'    => $t['value'],
            'is_joker' => $t['is_joker'],
            'is_new'   => true,
        ];
    }

    // First move: must cover center (7,7)
    if ($isFirstMove) {
        if (!isset($merged['7,7'])) {
            return $err('Le premier mot doit passer par la case centrale.');
        }
    }

    // Check line continuity (no gaps)
    $horizontal = $sameRow;
    if ($horizontal) {
        $r = $minRow;
        for ($c = $minCol; $c <= $maxCol; $c++) {
            if (!isset($merged[$r . ',' . $c])) {
                return $err('Il y a un trou dans la ligne.');
            }
        }
    } else {
        $c = $minCol;
        for ($r = $minRow; $r <= $maxRow; $r++) {
            if (!isset($merged[$r . ',' . $c])) {
                return $err('Il y a un trou dans la colonne.');
            }
        }
    }

    // Non-first move: must be adjacent to at least one existing board tile
    if (!$isFirstMove) {
        $adjacent = false;
        $dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        foreach ($newTiles as $t) {
            foreach ($dirs as [$dr, $dc]) {
                $nr = $t['row'] + $dr;
                $nc = $t['col'] + $dc;
                $nk = $nr . ',' . $nc;
                if (isset($board[$nk])) { // existing (not new) tile
                    $adjacent = true;
                    break 2;
                }
            }
        }
        if (!$adjacent) {
            return $err('Le mot doit être adjacent à une tuile existante.');
        }
    }

    // Collect all formed words
    $bonus    = BONUS_SQUARES;
    $newPosSet = $posKeys; // positions of newly placed tiles

    /**
     * Extract a word along a direction starting from a position,
     * expanding to both ends.
     * Returns null if word is only 1 letter.
     */
    $extractWord = function(int $startR, int $startC, bool $horiz) use ($merged, $newPosSet, $bonus): ?array {
        // Find start of word
        $r = $startR; $c = $startC;
        if ($horiz) {
            while (isset($merged[$r . ',' . ($c - 1)])) $c--;
        } else {
            while (isset($merged[($r - 1) . ',' . $c])) $r--;
        }
        // Collect letters
        $letters = [];
        $wordStr = '';
        $cr = $r; $cc = $c;
        while (isset($merged[$cr . ',' . $cc])) {
            $tile = $merged[$cr . ',' . $cc];
            $letters[] = ['row' => $cr, 'col' => $cc, 'tile' => $tile];
            $wordStr .= $tile['letter'];
            if ($horiz) $cc++; else $cr++;
        }
        if (strlen($wordStr) < 2) return null;
        return ['word' => $wordStr, 'tiles' => $letters];
    };

    // Score a collected word
    $scoreWord = function(array $wordData) use ($newPosSet, $bonus): int {
        $letterSum  = 0;
        $wordMult   = 1;
        foreach ($wordData['tiles'] as $tinfo) {
            $key    = $tinfo['row'] . ',' . $tinfo['col'];
            $tile   = $tinfo['tile'];
            $lv     = (int)$tile['value'];
            $isNew  = isset($newPosSet[$key]);
            if ($isNew && isset($bonus[$key])) {
                $b = $bonus[$key];
                if ($b === '2L') $lv *= 2;
                elseif ($b === '3L') $lv *= 3;
                elseif ($b === '2M') $wordMult *= 2;
                elseif ($b === '3M') $wordMult *= 3;
            }
            $letterSum += $lv;
        }
        return $letterSum * $wordMult;
    };

    $formedWords = [];
    $totalScore  = 0;

    // Main word along primary direction
    $primaryAnchor = $newTiles[0];
    $mainWord = $extractWord($primaryAnchor['row'], $primaryAnchor['col'], $horizontal);
    if ($mainWord !== null) {
        $formedWords[] = $mainWord['word'];
        $totalScore   += $scoreWord($mainWord);
    }

    // Cross words (perpendicular)
    foreach ($newTiles as $t) {
        $cross = $extractWord($t['row'], $t['col'], !$horizontal);
        if ($cross !== null) {
            $formedWords[] = $cross['word'];
            $totalScore   += $scoreWord($cross);
        }
    }

    // Validate all formed words against dictionary
    $dict = loadDictionary();
    if (!empty($dict)) { // only validate if dictionary is loaded
        $invalidWords = [];
        foreach ($formedWords as $w) {
            if (!isset($dict[strtoupper($w)])) {
                $invalidWords[] = strtoupper($w);
            }
        }
        if (!empty($invalidWords)) {
            return array_merge(
                $err('Mot(s) invalide(s) : ' . implode(', ', $invalidWords)),
                ['invalid_words' => $invalidWords]
            );
        }
    }

    // Bingo bonus: all 7 tiles used
    if (count($newTiles) === 7) {
        $totalScore += 50;
    }

    return [
        'valid' => true,
        'score' => $totalScore,
        'words' => $formedWords,
        'error' => '',
    ];
}
