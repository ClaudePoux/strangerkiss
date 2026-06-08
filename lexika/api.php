<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

sessionStart();
header('Content-Type: application/json; charset=utf-8');

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
    return true;
}

function finishGame(PDO $pdo, int $gameId, int $winnerId): void {
    $st = $pdo->prepare(
        'UPDATE lxk_games SET status=\'finished\', winner_id=?, finished_at=NOW() WHERE id=?'
    );
    $st->execute([$winnerId, $gameId]);
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
        $scores = [];
        $myRack = [];
        foreach ($gpRows as $gp) {
            $scores[$gp['user_id']] = ['id' => $gp['user_id'], 'prenom' => $gp['prenom'], 'score' => (int)$gp['score']];
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
            } elseif ($oppRow['move_type'] === 'exchange') {
                $td = json_decode($oppRow['tiles'] ?? '{}', true);
                $lastOppMove['count'] = (int)($td['count'] ?? 0);
            }
        }

        $bag      = json_decode($game['bag'], true) ?: [];
        $bagCount = count($bag);

        jsonOk([
            'board'               => json_decode($game['board'], true) ?: (object)[],
            'rack'                => $myRack,
            'scores'              => $scores,
            'current_turn'        => (int)$game['current_turn'],
            'bag_count'           => $bagCount,
            'status'              => $game['status'],
            'winner_id'           => $game['winner_id'],
            'last_move'           => $lastMove,
            'last_opponent_move'  => $lastOppMove,
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

        $logFile = __DIR__ . '/debug_play.log';
        file_put_contents($logFile, date('H:i:s') . ' RACK AVANT : ' . json_encode($rack) . "\n", FILE_APPEND);
        file_put_contents($logFile, date('H:i:s') . ' TUILES JOUEES : ' . json_encode($tiles) . "\n", FILE_APPEND);

        // Remove played tiles from rack by content (is_joker + letter), not by index.
        // Each splice removes the matched tile from $remainingRack immediately, so a second
        // played tile with the same letter can only match the next distinct copy in the rack.
        $remainingRack = array_values($rack);
        foreach ($tiles as $t) {
            $isJoker   = (bool)($t['is_joker'] ?? false);
            $srcLetter = $isJoker ? '' : ($t['source_letter'] ?? '');
            file_put_contents($logFile, 'MATCH CHERCHE : letter=' . $srcLetter . ' is_joker=' . ($isJoker ? 'true' : 'false') . "\n", FILE_APPEND);
            file_put_contents($logFile, 'RACK DISPONIBLE : ' . json_encode($remainingRack) . "\n", FILE_APPEND);
            foreach ($remainingRack as $i => $rackTile) {
                if ((bool)($rackTile['is_joker'] ?? false) === $isJoker
                    && ($rackTile['letter'] ?? '') === $srcLetter) {
                    array_splice($remainingRack, $i, 1);
                    break;
                }
            }
        }

        file_put_contents($logFile, date('H:i:s') . ' REMAINING RACK : ' . json_encode($remainingRack) . "\n", FILE_APPEND);

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

        file_put_contents($logFile, date('H:i:s') . ' DRAWN : ' . json_encode($drawn) . "\n", FILE_APPEND);
        file_put_contents($logFile, date('H:i:s') . ' NEW RACK : ' . json_encode($newRack) . "\n---\n", FILE_APPEND);

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

        if ($gameOver) {
            $winnerId = determineWinner($pdo, $gameId, (int)$game['player1_id'], (int)$game['player2_id']);
            finishGame($pdo, $gameId, $winnerId);
        }

        jsonOk([
            'score'     => $score,
            'words'     => $result['words'],
            'new_rack'  => $newRack,
            'bag_count' => $bagCount,
            'game_over' => $gameOver,
            'is_bingo'  => count($tiles) === 7,
        ]);
    }

    // ── exchange ─────────────────────────────────────────────────────────────
    case 'exchange': {
        $gameId      = (int)($_POST['game_id'] ?? 0);
        $game        = loadGame($pdo, $gameId, $uid, true);

        if ($game['status'] !== 'playing') jsonErr('La partie est terminée');

        $indicesRaw = $_POST['tile_indices'] ?? '[]';
        $indices    = json_decode($indicesRaw, true);
        if (!is_array($indices) || empty($indices)) jsonErr('Aucune tuile sélectionnée');

        $stRack = $pdo->prepare('SELECT rack FROM lxk_game_players WHERE game_id=? AND user_id=?');
        $stRack->execute([$gameId, $uid]);
        $rackRow = $stRack->fetch();
        $rack    = json_decode($rackRow['rack'] ?? '[]', true) ?: [];

        $bag = json_decode($game['bag'], true) ?: [];
        if (count($bag) < count($indices)) jsonErr('Pas assez de tuiles dans le sac');

        // Extract tiles to exchange
        $toExchange = [];
        $remaining  = [];
        foreach ($rack as $i => $tile) {
            if (in_array($i, $indices, false)) {
                $toExchange[] = $tile;
            } else {
                $remaining[] = $tile;
            }
        }

        // Put back in bag, shuffle, draw
        $bag = array_merge($bag, $toExchange);
        shuffle($bag);
        $drawn   = drawTiles($bag, count($toExchange));
        $newRack = array_merge($remaining, $drawn);

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

        jsonOk(['winner_id' => $oppId]);
    }

    default:
        jsonErr('Action inconnue', 400);
}
