<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

// ── Debug scan (temporaire) ───────────────────────────────────────────────────
if (($_GET['action'] ?? '') === 'debug_scan' && ($_GET['secret'] ?? '') === 'lexdbg15') {
    $gameId = (int)($_GET['game_id'] ?? 0);
    $pdo    = getDB();
    $st     = $pdo->prepare('SELECT board FROM lxk_games WHERE id = ?');
    $st->execute([$gameId]);
    $row    = $st->fetch();
    $board  = $row ? (json_decode($row['board'], true) ?: []) : [];

    $defsPath         = __DIR__ . '/definitions_ods9.json';
    $defsPathResolved = realpath($defsPath);
    $defsExists       = file_exists($defsPath);
    $defsSize         = $defsExists ? filesize($defsPath) : null;
    $defs             = $defsExists ? (json_decode(file_get_contents($defsPath), true) ?: []) : [];

    $out = [
        'game_id'      => $gameId,
        'tile_count'   => count($board),
        'path_info'    => [
            '__DIR__'       => __DIR__,
            'defs_path_raw' => $defsPath,
            'defs_resolved' => $defsPathResolved ?: '(realpath failed — fichier introuvable)',
            'defs_exists'   => $defsExists,
            'defs_size'     => $defsSize,
        ],
        'defs_loaded'  => count($defs),
        'tiles'        => [], 'warnings' => [], 'h_words' => [], 'v_words' => [], 'markers' => [],
    ];

    ksort($board);
    foreach ($board as $key => $tile) {
        $letter = $tile['letter'] ?? '';
        $isJoker = !empty($tile['is_joker']);
        $warn = ($letter === '' && $isJoker) ? 'LETTRE VIDE SUR JOKER' : null;
        if ($warn) $out['warnings'][] = "$key: $warn";
        $out['tiles'][$key] = ['letter' => $letter, 'value' => $tile['value'], 'is_joker' => $isJoker];
    }

    $markers = [];
    // H
    for ($r = 0; $r < 15; $r++) {
        $c = 0;
        while ($c < 15) {
            if (!isset($board["$r,$c"])) { $c++; continue; }
            $s = $c; $w = '';
            while ($c < 15 && isset($board["$r,$c"])) {
                $l = $board["$r,$c"]['letter'] ?? '';
                if ($l === '' && !empty($board["$r,$c"]['is_joker'])) { $l = '?'; }
                $w .= $l; $c++;
            }
            if (strlen($w) >= 2) {
                $u = strtoupper($w);
                $out['h_words'][] = ['pos' => "$r,$s", 'word' => $u, 'has_def' => isset($defs[$u])];
                if (isset($defs[$u])) $markers["$r,$s"][] = ['word' => $u, 'definition' => $defs[$u]];
            }
        }
    }
    // V
    for ($c = 0; $c < 15; $c++) {
        $r = 0;
        while ($r < 15) {
            if (!isset($board["$r,$c"])) { $r++; continue; }
            $s = $r; $w = '';
            while ($r < 15 && isset($board["$r,$c"])) {
                $l = $board["$r,$c"]['letter'] ?? '';
                if ($l === '' && !empty($board["$r,$c"]['is_joker'])) { $l = '?'; }
                $w .= $l; $r++;
            }
            if (strlen($w) >= 2) {
                $u = strtoupper($w);
                $out['v_words'][] = ['pos' => "$s,$c", 'word' => $u, 'has_def' => isset($defs[$u])];
                if (isset($defs[$u])) $markers["$s,$c"][] = ['word' => $u, 'definition' => $defs[$u]];
            }
        }
    }
    $out['markers'] = $markers;
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// Auth check
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Non authentifié', 'success' => false]);
    exit;
}

$uid    = (int)$_SESSION['user_id'];
$pdo    = getDB();
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// ── Helper functions ─────────────────────────────────────────────────────────
function jsonErr(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

function jsonOk(array $data): void {
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

function loadGame(PDO $pdo, int $gameId, int $uid, bool $requireMyTurn = false): array {
    $st = $pdo->prepare('SELECT * FROM lxk_games WHERE id = ?');
    $st->execute([$gameId]);
    $game = $st->fetch();
    if (!$game) jsonErr('Partie introuvable', 404);
    if ($game['player1_id'] != $uid && $game['player2_id'] != $uid) jsonErr('Accès refusé', 403);
    if ($requireMyTurn && (int)$game['current_turn'] !== $uid) jsonErr('Ce n\'est pas votre tour', 403);
    return $game;
}

function getOpponentId(array $game, int $uid): int {
    return ($game['player1_id'] == $uid) ? (int)$game['player2_id'] : (int)$game['player1_id'];
}

function checkEndGame(PDO $pdo, array $game, int $gameId): bool {
    // Check if bag is empty and a player has empty rack
    $bag = json_decode($game['bag'], true) ?: [];
    if (count($bag) > 0) return false;

    $st = $pdo->prepare('SELECT user_id, rack FROM lxk_game_players WHERE game_id = ?');
    $st->execute([$gameId]);
    $gps = $st->fetchAll();
    foreach ($gps as $gp) {
        $rack = json_decode($gp['rack'], true) ?: [];
        if (empty($rack)) return true;
    }
    return false;
}

function checkConsecutivePasses(PDO $pdo, int $gameId): bool {
    // Check if last 2 moves (from different players) were both passes
    $st = $pdo->prepare(
        'SELECT user_id, move_type FROM lxk_game_moves WHERE game_id = ? ORDER BY id DESC LIMIT 2'
    );
    $st->execute([$gameId]);
    $moves = $st->fetchAll();
    if (count($moves) < 2) return false;
    if ($moves[0]['move_type'] !== 'pass' || $moves[1]['move_type'] !== 'pass') return false;
    if ($moves[0]['user_id'] === $moves[1]['user_id']) return false; // same player passed twice
    // Fin par passes seulement si le sac a moins de 7 tuiles
    $st = $pdo->prepare('SELECT bag FROM lxk_games WHERE id = ?');
    $st->execute([$gameId]);
    $row = $st->fetch();
    $bag = $row ? (json_decode($row['bag'], true) ?: []) : [];
    return count($bag) < 7;
}

function finishGame(PDO $pdo, int $gameId, int $winnerId): void {
    $st = $pdo->prepare(
        'UPDATE lxk_games SET status=\'pending_review\', winner_id=?, finished_at=NOW() WHERE id=?'
    );
    $st->execute([$winnerId, $gameId]);
}

function updateUsersStats(PDO $pdo, int $gameId): void {
    $stScores = $pdo->prepare('SELECT user_id, score FROM lxk_game_players WHERE game_id = ?');
    $stScores->execute([$gameId]);
    $stMoves = $pdo->prepare('SELECT user_id, COUNT(*) AS cnt FROM lxk_game_moves WHERE game_id = ? GROUP BY user_id');
    $stMoves->execute([$gameId]);
    $moveCounts = [];
    foreach ($stMoves->fetchAll() as $row) {
        $moveCounts[(int)$row['user_id']] = (int)$row['cnt'];
    }
    $upd = $pdo->prepare('UPDATE lxk_users SET total_points = total_points + ?, total_moves = total_moves + ? WHERE id = ?');
    foreach ($stScores->fetchAll() as $row) {
        $pid = (int)$row['user_id'];
        $upd->execute([(int)$row['score'], $moveCounts[$pid] ?? 0, $pid]);
    }
}

function determineWinner(PDO $pdo, int $gameId, int $p1Id, int $p2Id): int {
    $st = $pdo->prepare('SELECT user_id, score FROM lxk_game_players WHERE game_id = ?');
    $st->execute([$gameId]);
    $scores = [];
    foreach ($st->fetchAll() as $row) {
        $scores[$row['user_id']] = (int)$row['score'];
    }
    $s1 = $scores[$p1Id] ?? 0;
    $s2 = $scores[$p2Id] ?? 0;
    if ($s1 >= $s2) return $p1Id;
    return $p2Id;
}

function getBoardDefinitions(array $board): array {
    static $defs = null;
    if ($defs === null) {
        $path = __DIR__ . '/definitions_ods9.json';
        $defs = file_exists($path) ? (json_decode(file_get_contents($path), true) ?: []) : [];
    }
    $markers = [];
    for ($r = 0; $r < 15; $r++) {
        $c = 0;
        while ($c < 15) {
            if (!isset($board["$r,$c"])) { $c++; continue; }
            $s = $c; $w = '';
            while ($c < 15 && isset($board["$r,$c"])) { $w .= $board["$r,$c"]['letter']; $c++; }
            if (strlen($w) >= 2) { $u = strtoupper($w); if (isset($defs[$u])) $markers["$r,$s"][] = ['word' => $u, 'definition' => $defs[$u]]; }
        }
    }
    for ($c = 0; $c < 15; $c++) {
        $r = 0;
        while ($r < 15) {
            if (!isset($board["$r,$c"])) { $r++; continue; }
            $s = $r; $w = '';
            while ($r < 15 && isset($board["$r,$c"])) { $w .= $board["$r,$c"]['letter']; $r++; }
            if (strlen($w) >= 2) { $u = strtoupper($w); if (isset($defs[$u])) $markers["$s,$c"][] = ['word' => $u, 'definition' => $defs[$u]]; }
        }
    }
    return $markers;
}

// ── Actions ───────────────────────────────────────────────────────────────────
switch ($action) {

    // ── new_game ─────────────────────────────────────────────────────────────
    case 'new_game': {
        $p2id = (int)($_POST['player2_id'] ?? 0);
        if ($p2id <= 0 || $p2id === $uid) jsonErr('Adversaire invalide');

        $st = $pdo->prepare('SELECT id FROM lxk_users WHERE id = ?');
        $st->execute([$p2id]);
        if (!$st->fetch()) jsonErr('Adversaire introuvable', 404);

        $ins = $pdo->prepare(
            'INSERT INTO lxk_games (player1_id, player2_id, board, bag, status, current_turn) VALUES (?,?,?,?,\'invited\',?)'
        );
        $ins->execute([$uid, $p2id, json_encode((object)[]), json_encode([]), $uid]);
        $gid = (int)$pdo->lastInsertId();

        jsonOk(['game_id' => $gid]);
    }

    // ── accept_game ──────────────────────────────────────────────────────────
    case 'accept_game': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        if ($gameId <= 0) jsonErr('Partie invalide');

        $st = $pdo->prepare('SELECT * FROM lxk_games WHERE id = ? AND status = \'invited\'');
        $st->execute([$gameId]);
        $game = $st->fetch();
        if (!$game) jsonErr('Invitation introuvable', 404);
        if ((int)$game['player2_id'] !== $uid) jsonErr('Accès refusé', 403);

        $p1id   = (int)$game['player1_id'];
        $bag    = makeBag();
        $p1Rack = drawTiles($bag, 7);
        $p2Rack = drawTiles($bag, 7);

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare(
                'UPDATE lxk_games SET status=\'playing\', bag=?, current_turn=? WHERE id=?'
            );
            $st->execute([json_encode($bag), $p1id, $gameId]);

            $gp = $pdo->prepare('INSERT INTO lxk_game_players (game_id, user_id, rack, score) VALUES (?,?,?,0)');
            $gp->execute([$gameId, $p1id, json_encode($p1Rack)]);
            $gp->execute([$gameId, $uid,  json_encode($p2Rack)]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonErr('Erreur lors de l\'acceptation');
        }

        jsonOk(['game_id' => $gameId]);
    }

    // ── refuse_game ──────────────────────────────────────────────────────────
    case 'refuse_game': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        if ($gameId <= 0) jsonErr('Partie invalide');

        $st = $pdo->prepare('SELECT * FROM lxk_games WHERE id = ? AND status = \'invited\'');
        $st->execute([$gameId]);
        $game = $st->fetch();
        if (!$game) jsonErr('Invitation introuvable', 404);
        if ((int)$game['player2_id'] !== $uid) jsonErr('Accès refusé', 403);

        $pdo->prepare('DELETE FROM lxk_games WHERE id = ?')->execute([$gameId]);

        jsonOk([]);
    }

    // ── poll ─────────────────────────────────────────────────────────────────
    case 'poll': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid);

        $stGP = $pdo->prepare(
            'SELECT gp.user_id, gp.rack, gp.score, u.prenom
             FROM lxk_game_players gp JOIN lxk_users u ON u.id = gp.user_id
             WHERE gp.game_id = ?'
        );
        $stGP->execute([$gameId]);
        $gpRows = $stGP->fetchAll();

        $stLxk = $pdo->prepare(
            'SELECT user_id, COUNT(*) AS cnt FROM lxk_lexika WHERE game_id = ? GROUP BY user_id'
        );
        $stLxk->execute([$gameId]);
        $lexikaCounts = [];
        foreach ($stLxk->fetchAll() as $lx) {
            $lexikaCounts[(int)$lx['user_id']] = (int)$lx['cnt'];
        }

        $scores = [];
        $myRack = [];
        foreach ($gpRows as $gp) {
            $scores[$gp['user_id']] = [
                'id'           => $gp['user_id'],
                'prenom'       => $gp['prenom'],
                'score'        => (int)$gp['score'],
                'lexika_count' => $lexikaCounts[(int)$gp['user_id']] ?? 0,
            ];
            if ($gp['user_id'] == $uid) {
                $myRack = json_decode($gp['rack'], true) ?: [];
            }
        }

        $stLast = $pdo->prepare('SELECT * FROM lxk_game_moves WHERE game_id = ? ORDER BY id DESC LIMIT 1');
        $stLast->execute([$gameId]);
        $lastMove = $stLast->fetch() ?: null;

        $stOpp = $pdo->prepare(
            'SELECT m.move_type, m.word, m.score, m.tiles, u.prenom
             FROM lxk_game_moves m
             JOIN lxk_users u ON u.id = m.user_id
             WHERE m.game_id = ? AND m.user_id != ?
             ORDER BY m.id DESC LIMIT 1'
        );
        $stOpp->execute([$gameId, $uid]);
        $oppRow = $stOpp->fetch() ?: null;
        $lastOppMove = null;
        if ($oppRow) {
            $lastOppMove = ['type' => $oppRow['move_type'], 'prenom' => $oppRow['prenom']];
            if ($oppRow['move_type'] === 'play') {
                $lastOppMove['word']  = $oppRow['word'];
                $lastOppMove['score'] = (int)$oppRow['score'];
                $tileArr = json_decode($oppRow['tiles'] ?? '[]', true) ?: [];
                $positions = [];
                foreach ($tileArr as $t) {
                    if (isset($t['row']) && isset($t['col'])) {
                        $positions[] = [(int)$t['row'], (int)$t['col']];
                    }
                }
                $lastOppMove['positions'] = $positions;
            } elseif ($oppRow['move_type'] === 'exchange') {
                $td = json_decode($oppRow['tiles'] ?? '{}', true);
                $lastOppMove['count'] = (int)($td['count'] ?? 0);
            }
        }

        $bag      = json_decode($game['bag'], true) ?: [];
        $bagCount = count($bag);

        $oppRackCount = null;
        if ($bagCount === 0) {
            $oppId = getOpponentId($game, $uid);
            foreach ($gpRows as $gp) {
                if ($gp['user_id'] == $oppId) {
                    $oppRackCount = count(json_decode($gp['rack'], true) ?: []);
                    break;
                }
            }
        }

        // Build moves history with cumulative scores per player
        $p1Id = (int)$game['player1_id'];
        $p2Id = (int)$game['player2_id'];
        $stMoves = $pdo->prepare(
            'SELECT m.user_id, m.move_type, m.word, m.score, m.tiles, u.prenom,
                    (lx.id IS NOT NULL) AS is_lexika
             FROM lxk_game_moves m
             JOIN lxk_users u ON u.id = m.user_id
             LEFT JOIN lxk_lexika lx
                    ON lx.game_id = m.game_id
                   AND lx.user_id = m.user_id
                   AND lx.word COLLATE utf8mb4_unicode_ci <=> m.word
                   AND lx.score   = m.score
             WHERE m.game_id = ?
             ORDER BY m.id ASC'
        );
        $stMoves->execute([$gameId]);
        $movesHistory = [];
        $runningScores = [$p1Id => 0, $p2Id => 0];
        $moveNum = 0;
        foreach ($stMoves->fetchAll() as $mv) {
            $moveNum++;
            $pid = (int)$mv['user_id'];
            $runningScores[$pid] += (int)$mv['score'];
            $tileData = json_decode($mv['tiles'] ?? '{}', true);
            $movesHistory[] = [
                'move_number'    => $moveNum,
                'prenom'         => $mv['prenom'],
                'move_type'      => $mv['move_type'],
                'word'           => $mv['word'],
                'score'          => (int)$mv['score'],
                'score_p1_after' => $runningScores[$p1Id],
                'score_p2_after' => $runningScores[$p2Id],
                'exchange_count' => $mv['move_type'] === 'exchange' ? (int)($tileData['count'] ?? 0) : null,
                'is_lexika'      => (bool)$mv['is_lexika'],
            ];
        }

        $rawBoard = json_decode($game['board'], true) ?: [];
        jsonOk([
            'board'               => $rawBoard ?: (object)[],
            'rack'                => $myRack,
            'scores'              => $scores,
            'current_turn'        => (int)$game['current_turn'],
            'bag_count'           => $bagCount,
            'status'              => $game['status'],
            'winner_id'           => $game['winner_id'],
            'last_move'           => $lastMove,
            'last_opponent_move'  => $lastOppMove,
            'moves_history'       => $movesHistory,
            'definition_markers'  => getBoardDefinitions($rawBoard),
            'opp_rack_count'      => $oppRackCount,
        ]);
    }

    // ── validate ─────────────────────────────────────────────────────────────
    case 'validate': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid);

        $tilesRaw = $_POST['tiles'] ?? '[]';
        $tiles    = json_decode($tilesRaw, true);
        if (!is_array($tiles)) jsonErr('Tuiles invalides');

        $board       = json_decode($game['board'], true) ?: [];
        $isFirstMove = empty($board);

        $result = validateMove($board, $tiles, $isFirstMove);
        echo json_encode(array_merge(['success' => true], $result));
        exit;
    }

    // ── play ─────────────────────────────────────────────────────────────────
    case 'play': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid, true);

        if ($game['status'] !== 'playing') jsonErr('La partie est terminée');

        $tilesRaw = $_POST['tiles'] ?? '[]';
        $tiles    = json_decode($tilesRaw, true);
        if (!is_array($tiles)) jsonErr('Tuiles invalides');

        $board       = json_decode($game['board'], true) ?: [];
        $isFirstMove = empty($board);

        $result = validateMove($board, $tiles, $isFirstMove);
        if (!$result['valid']) {
            jsonErr($result['error']);
        }

        // Load current rack
        $stRack = $pdo->prepare('SELECT rack FROM lxk_game_players WHERE game_id = ? AND user_id = ?');
        $stRack->execute([$gameId, $uid]);
        $rackRow  = $stRack->fetch();
        $rack     = json_decode($rackRow['rack'] ?? '[]', true) ?: [];

        // Remove played tiles from rack by content (is_joker + letter), not by index.
        // Each splice removes the matched tile from $remainingRack immediately, so a second
        // played tile with the same letter can only match the next distinct copy in the rack.
        $remainingRack = array_values($rack);
        foreach ($tiles as $t) {
            $isJoker   = (bool)($t['is_joker'] ?? false);
            $srcLetter = $isJoker ? '' : ($t['source_letter'] ?? $t['letter'] ?? '');
            foreach ($remainingRack as $i => $rackTile) {
                if ((bool)($rackTile['is_joker'] ?? false) === $isJoker
                    && ($rackTile['letter'] ?? '') === $srcLetter) {
                    array_splice($remainingRack, $i, 1);
                    break;
                }
            }
        }

        // Update board
        foreach ($tiles as $t) {
            $board[$t['row'] . ',' . $t['col']] = [
                'letter'   => $t['letter'],
                'value'    => (int)$t['value'],
                'is_joker' => (bool)($t['is_joker'] ?? false),
            ];
        }

        // Draw new tiles to refill to 7
        $bag     = json_decode($game['bag'], true) ?: [];
        $drawn   = drawTiles($bag, min(7 - count($remainingRack), count($bag)));
        $newRack = array_merge($remainingRack, $drawn);
        $bagCount = count($bag);

        // Calculate score
        $score      = $result['score'];
        $bestWord   = !empty($result['words']) ? implode(', ', $result['words']) : null;

        $oppId = getOpponentId($game, $uid);

        $pdo->beginTransaction();
        try {
            // Update board and bag
            $st = $pdo->prepare('UPDATE lxk_games SET board=?, bag=?, current_turn=? WHERE id=?');
            $st->execute([json_encode($board), json_encode($bag), $oppId, $gameId]);

            // Update rack and score
            $st = $pdo->prepare('UPDATE lxk_game_players SET rack=?, score=score+? WHERE game_id=? AND user_id=?');
            $st->execute([json_encode($newRack), $score, $gameId, $uid]);

            // Insert move
            $st = $pdo->prepare(
                'INSERT INTO lxk_game_moves (game_id, user_id, move_type, word, tiles, score) VALUES (?,?,\'play\',?,?,?)'
            );
            $st->execute([$gameId, $uid, $bestWord, json_encode($tiles), $score]);

            if (count($tiles) === 7) {
                $pdo->prepare('INSERT INTO lxk_lexika (game_id, user_id, word, score) VALUES (?,?,?,?)')
                    ->execute([$gameId, $uid, $bestWord, $score]);
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonErr('Erreur lors de la mise à jour de la partie');
        }

        // Check end game
        $gameUpdated = $pdo->prepare('SELECT * FROM lxk_games WHERE id=?');
        $gameUpdated->execute([$gameId]);
        $updatedGame = $gameUpdated->fetch();
        $gameOver    = checkEndGame($pdo, $updatedGame, $gameId);

        $winnerId    = null;
        $finalScores = [];
        if ($gameOver) {
            // Règle officielle : la somme des tuiles restantes sur chaque chevalet
            // est retranchée au joueur concerné ET ajoutée au joueur qui a le rack vide.
            $stRacks = $pdo->prepare('SELECT user_id, rack FROM lxk_game_players WHERE game_id = ?');
            $stRacks->execute([$gameId]);
            $rackSums = [];
            foreach ($stRacks->fetchAll() as $row) {
                $r = json_decode($row['rack'], true) ?: [];
                $rackSums[(int)$row['user_id']] = array_sum(array_column($r, 'value'));
            }
            foreach ($rackSums as $pid => $sum) {
                if ($sum === 0) continue;
                $pdo->prepare('UPDATE lxk_game_players SET score=score-? WHERE game_id=? AND user_id=?')
                    ->execute([$sum, $gameId, $pid]);
                $pdo->prepare('UPDATE lxk_game_players SET score=score+? WHERE game_id=? AND user_id!=?')
                    ->execute([$sum, $gameId, $pid]);
            }

            $winnerId = determineWinner($pdo, $gameId, (int)$game['player1_id'], (int)$game['player2_id']);
            finishGame($pdo, $gameId, $winnerId);
            updateUsersStats($pdo, $gameId);

            $stFinal = $pdo->prepare('SELECT user_id, score FROM lxk_game_players WHERE game_id = ?');
            $stFinal->execute([$gameId]);
            foreach ($stFinal->fetchAll() as $row) {
                $finalScores[(int)$row['user_id']] = (int)$row['score'];
            }
        }

        jsonOk([
            'score'     => $score,
            'words'     => $result['words'],
            'new_rack'  => $newRack,
            'bag_count' => $bagCount,
            'game_over' => $gameOver,
            'is_bingo'  => count($tiles) === 7,
            'winner_id' => $winnerId,
            'score_p1'  => $gameOver ? ($finalScores[(int)$game['player1_id']] ?? 0) : null,
            'score_p2'  => $gameOver ? ($finalScores[(int)$game['player2_id']] ?? 0) : null,
        ]);
    }

    // ── exchange ─────────────────────────────────────────────────────────────
    case 'exchange': {
        $gameId      = (int)($_POST['game_id'] ?? 0);
        $game        = loadGame($pdo, $gameId, $uid, true);

        if ($game['status'] !== 'playing') jsonErr('La partie est terminée');

        $tilesRaw    = $_POST['tiles_to_exchange'] ?? '[]';
        $wantedTiles = json_decode($tilesRaw, true);
        if (!is_array($wantedTiles) || empty($wantedTiles)) jsonErr('Aucune tuile sélectionnée');

        $stRack = $pdo->prepare('SELECT rack FROM lxk_game_players WHERE game_id=? AND user_id=?');
        $stRack->execute([$gameId, $uid]);
        $rackRow = $stRack->fetch();
        $rack    = json_decode($rackRow['rack'] ?? '[]', true) ?: [];

        $bag = json_decode($game['bag'], true) ?: [];

        // Identifier les tuiles par lettre + valeur + is_joker, une occurrence à la fois
        $toExchange = [];
        $remaining  = array_values($rack);
        foreach ($wantedTiles as $want) {
            foreach ($remaining as $i => $rackTile) {
                if (($rackTile['letter']   ?? '')    === ($want['letter']   ?? '')
                 && (int)($rackTile['value']    ?? 0) === (int)($want['value']    ?? 0)
                 && (bool)($rackTile['is_joker'] ?? false) === (bool)($want['is_joker'] ?? false)) {
                    $toExchange[] = $rackTile;
                    array_splice($remaining, $i, 1);
                    break;
                }
            }
        }

        if (empty($toExchange)) jsonErr('Aucune tuile correspondante trouvée');
        if (count($bag) < 7) jsonErr('Pas assez de lettres dans le sac (minimum 7)');

        // Piocher d'abord, puis remettre les tuiles échangées dans le sac :
        // ainsi le joueur ne peut jamais récupérer une lettre qu'il vient d'échanger.
        $drawn   = drawTiles($bag, count($toExchange));
        $newRack = array_merge($remaining, $drawn);
        $bag     = array_merge($bag, $toExchange);
        shuffle($bag);

        $oppId = getOpponentId($game, $uid);

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('UPDATE lxk_games SET bag=?, current_turn=? WHERE id=?');
            $st->execute([json_encode($bag), $oppId, $gameId]);

            $st = $pdo->prepare('UPDATE lxk_game_players SET rack=? WHERE game_id=? AND user_id=?');
            $st->execute([json_encode($newRack), $gameId, $uid]);

            $st = $pdo->prepare(
                'INSERT INTO lxk_game_moves (game_id, user_id, move_type, tiles, score) VALUES (?,?,\'exchange\',?,0)'
            );
            $st->execute([$gameId, $uid, json_encode(['count' => count($toExchange)])]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonErr('Erreur lors de l\'échange');
        }

        jsonOk(['new_rack' => $newRack, 'bag_count' => count($bag)]);
    }

    // ── pass ─────────────────────────────────────────────────────────────────
    case 'pass': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid, true);

        if ($game['status'] !== 'playing') jsonErr('La partie est terminée');

        $oppId = getOpponentId($game, $uid);

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('UPDATE lxk_games SET current_turn=? WHERE id=?');
            $st->execute([$oppId, $gameId]);

            $st = $pdo->prepare(
                'INSERT INTO lxk_game_moves (game_id, user_id, move_type, score) VALUES (?,?,\'pass\',0)'
            );
            $st->execute([$gameId, $uid]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonErr('Erreur');
        }

        // Check consecutive passes
        $gameOver = checkConsecutivePasses($pdo, $gameId);
        if ($gameOver) {
            $winnerId = determineWinner($pdo, $gameId, (int)$game['player1_id'], (int)$game['player2_id']);
            finishGame($pdo, $gameId, $winnerId);
            updateUsersStats($pdo, $gameId);
        }

        jsonOk(['game_over' => $gameOver]);
    }

    // ── abandon ──────────────────────────────────────────────────────────────
    case 'abandon': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid);

        if ($game['status'] !== 'playing') jsonErr('La partie est déjà terminée');

        $oppId = getOpponentId($game, $uid);

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('UPDATE lxk_games SET status=\'finished\', winner_id=?, finished_at=NOW() WHERE id=?');
            $st->execute([$oppId, $gameId]);

            $st = $pdo->prepare(
                'INSERT INTO lxk_game_moves (game_id, user_id, move_type, score) VALUES (?,?,\'abandon\',0)'
            );
            $st->execute([$gameId, $uid]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonErr('Erreur');
        }

        updateUsersStats($pdo, $gameId);
        jsonOk(['winner_id' => $oppId]);
    }

    // ── check_updates ────────────────────────────────────────────────────────
    case 'check_updates': {
        $st = $pdo->prepare(
            'SELECT COALESCE(MAX(m.id), 0) AS last_move_id
             FROM lxk_game_moves m
             JOIN lxk_games g ON g.id = m.game_id
             WHERE g.player1_id = ? OR g.player2_id = ?'
        );
        $st->execute([$uid, $uid]);
        $row = $st->fetch();
        jsonOk(['last_move_id' => (int)$row['last_move_id']]);
    }

    // ── acknowledge_game ──────────────────────────────────────────────────────
    case 'acknowledge_game': {
        $gameId = (int)($_POST['game_id'] ?? 0);
        $game   = loadGame($pdo, $gameId, $uid);

        if ($game['status'] !== 'pending_review') jsonErr('La partie n\'est pas en attente de confirmation');
        if ((int)$game['current_turn'] !== $uid)  jsonErr('Vous n\'êtes pas l\'adversaire à confirmer');

        $pdo->prepare('UPDATE lxk_games SET status=\'finished\' WHERE id=?')->execute([$gameId]);

        jsonOk([]);
    }

    default:
        jsonErr('Action inconnue', 400);
}
