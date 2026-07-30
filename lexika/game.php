<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';
requireLogin();

$user = currentUser();
$uid  = (int)$user['id'];
$pdo  = getDB();

$gameId = (int)($_GET['id'] ?? 0);
if ($gameId <= 0) {
    header('Location: ' . BASE_URL . '/index.php');
    exit;
}

// Load game
$stGame = $pdo->prepare(
    'SELECT g.*, u1.prenom AS p1_prenom, u2.prenom AS p2_prenom
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     JOIN lxk_users u2 ON u2.id = g.player2_id
     WHERE g.id = ?'
);
$stGame->execute([$gameId]);
$game = $stGame->fetch();

if (!$game) {
    header('Location: ' . BASE_URL . '/index.php');
    exit;
}

// Verify current user is a player
if ($game['player1_id'] != $uid && $game['player2_id'] != $uid) {
    header('Location: ' . BASE_URL . '/index.php');
    exit;
}

// Load racks and scores
$stGP = $pdo->prepare('SELECT user_id, rack, score FROM lxk_game_players WHERE game_id = ?');
$stGP->execute([$gameId]);
$gpRows = $stGP->fetchAll();
$gpMap  = [];
foreach ($gpRows as $gp) {
    $gpMap[$gp['user_id']] = $gp;
}

$stLxk = $pdo->prepare(
    'SELECT user_id, COUNT(*) AS cnt FROM lxk_lexika WHERE game_id = ? GROUP BY user_id'
);
$stLxk->execute([$gameId]);
$initLexikaCounts = [];
foreach ($stLxk->fetchAll() as $lx) {
    $initLexikaCounts[(int)$lx['user_id']] = (int)$lx['cnt'];
}

$p1Id     = (int)$game['player1_id'];
$p2Id     = (int)$game['player2_id'];
$p1Prenom = $game['p1_prenom'];
$p2Prenom = $game['p2_prenom'];
$p1Score  = (int)($gpMap[$p1Id]['score'] ?? 0);
$p2Score  = (int)($gpMap[$p2Id]['score'] ?? 0);
$myRack   = json_decode($gpMap[$uid]['rack'] ?? '[]', true) ?: [];
$board    = json_decode($game['board'] ?? '{}', true) ?: [];
$bag      = json_decode($game['bag']   ?? '[]', true) ?: [];
$bagCount = count($bag);

// Last move
$stLast = $pdo->prepare(
    'SELECT * FROM lxk_game_moves WHERE game_id = ? ORDER BY id DESC LIMIT 1'
);
$stLast->execute([$gameId]);
$lastMove = $stLast->fetch();

// Last opponent move (for initial display)
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

$isMyTurn = ((int)$game['current_turn'] === $uid);

$oppId = ($uid === $p1Id) ? $p2Id : $p1Id;
$oppRackCount = null;
if ($bagCount === 0 && isset($gpMap[$oppId])) {
    $oppRackCount = count(json_decode($gpMap[$oppId]['rack'] ?? '[]', true) ?: []);
}

// Build moves history for initial page load (same logic as api.php poll)
$stMovesInit = $pdo->prepare(
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
$stMovesInit->execute([$gameId]);
$initMovesHistory  = [];
$initRunningScores = [$p1Id => 0, $p2Id => 0];
$initMoveNum       = 0;
foreach ($stMovesInit->fetchAll() as $mv) {
    $initMoveNum++;
    $pid = (int)$mv['user_id'];
    $initRunningScores[$pid] += (int)$mv['score'];
    $tileData = json_decode($mv['tiles'] ?? '{}', true);
    $initMovesHistory[] = [
        'move_number'    => $initMoveNum,
        'prenom'         => $mv['prenom'],
        'move_type'      => $mv['move_type'],
        'word'           => $mv['word'],
        'score'          => (int)$mv['score'],
        'score_p1_after' => $initRunningScores[$p1Id],
        'score_p2_after' => $initRunningScores[$p2Id],
        'exchange_count' => $mv['move_type'] === 'exchange' ? (int)($tileData['count'] ?? 0) : null,
        'is_lexika'      => (bool)$mv['is_lexika'],
    ];
}

$initialState = [
    'gameId'           => $gameId,
    'myUserId'         => $uid,
    'p1'               => ['id' => $p1Id, 'prenom' => $p1Prenom, 'score' => $p1Score, 'lexika_count' => $initLexikaCounts[$p1Id] ?? 0],
    'p2'               => ['id' => $p2Id, 'prenom' => $p2Prenom, 'score' => $p2Score, 'lexika_count' => $initLexikaCounts[$p2Id] ?? 0],
    'board'            => $board,
    'myRack'           => $myRack,
    'bagCount'         => $bagCount,
    'currentTurn'      => (int)$game['current_turn'],
    'status'           => $game['status'],
    'winnerId'         => $game['winner_id'],
    'lastMove'         => $lastMove ?: null,
    'isMyTurn'         => $isMyTurn,
    'lastOpponentMove' => $lastOppMove,
    'moves_history'    => $initMovesHistory,
    'opp_rack_count'   => $oppRackCount,
];

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

$bonusSquaresJson = json_encode(BONUS_SQUARES);
$initialState['definitionMarkers'] = getBoardDefinitions($board);
$initialStateJson = json_encode($initialState);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lexika – Partie #<?= $gameId ?></title>
    <link rel="stylesheet" href="style.css">
    <style>
        .def-dot {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 8px;
            height: 8px;
            background: #e53935;
            border-radius: 50%;
            pointer-events: none;
            flex-shrink: 0;
        }
        #definition-modal .modal-content { max-width: 320px; }
        .def-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
        .def-modal-word { font-size: 1.1rem; font-weight: 700; color: #1a3a5c; letter-spacing: 0.04em; }
        .def-modal-body { font-size: 0.9rem; color: #444; line-height: 1.5; }
        .def-modal-body p { margin-top: 0.5rem; }
        .def-modal-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #888; padding: 0; line-height: 1; }
        .def-modal-close:hover { color: #333; }
        .last-move { box-shadow: inset 0 0 0 3px #e53935; }
        .lexika-row td { color: #e53935; font-weight: bold; }
        .player-lexika { font-size: 0.65rem; color: #f9a825; min-height: 1em; display: block; line-height: 1; margin-top: 1px; }
    </style>
    <link rel="manifest" href="/lexika/manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Lexika">
    <link rel="apple-touch-icon" href="/lexika/icons/icon-180.png">
    <meta name="theme-color" content="#1a3a5c">
    <meta name="mobile-web-app-capable" content="yes">
</head>
<body class="game-body">

    <!-- Score Header -->
    <header class="game-header">
        <a href="index.php" class="home-link" title="Accueil"><img src="/lexika/icons/icon-192.png" alt="Accueil" height="36"></a>
        <div class="game-scores">
            <div class="player-score <?= ($uid === $p1Id) ? 'player-score-me' : '' ?>" id="score-p1" data-uid="<?= $p1Id ?>">
                <div class="player-name-row">
                    <span class="player-name" style="position:relative;display:inline-block"><?= htmlspecialchars($p1Prenom) ?><span class="player-si" id="rack-count-p1" style="position:absolute;right:calc(100% + 12px);left:auto;top:50%;transform:translateY(-50%);white-space:nowrap;padding-right:4px"></span></span>
                    <span class="turn-dot" id="dot-p1" style="display:<?= ((int)$game['current_turn'] === $p1Id) ? 'inline' : 'none' ?>">●</span>
                </div>
                <span class="player-pts" id="pts-p1"><?= $p1Score ?></span>
                <span class="player-lexika" id="lexika-p1"><?= ($initLexikaCounts[$p1Id] ?? 0) > 0 ? '⭐' . ($initLexikaCounts[$p1Id] ?? 0) : '' ?></span>
            </div>
            <div class="score-divider">vs</div>
            <div class="player-score <?= ($uid === $p2Id) ? 'player-score-me' : '' ?>" id="score-p2" data-uid="<?= $p2Id ?>">
                <div class="player-name-row">
                    <span class="player-name" style="position:relative;display:inline-block"><?= htmlspecialchars($p2Prenom) ?><span class="player-si" id="rack-count-p2" style="position:absolute;left:calc(100% + 12px);top:50%;transform:translateY(-50%);white-space:nowrap;padding-left:4px"></span></span>
                    <span class="turn-dot" id="dot-p2" style="display:<?= ((int)$game['current_turn'] === $p2Id) ? 'inline' : 'none' ?>">●</span>
                </div>
                <span class="player-pts" id="pts-p2"><?= $p2Score ?></span>
                <span class="player-lexika" id="lexika-p2"><?= ($initLexikaCounts[$p2Id] ?? 0) > 0 ? '⭐' . ($initLexikaCounts[$p2Id] ?? 0) : '' ?></span>
            </div>
        </div>
        <div class="bag-count">
            <span id="bag-count-display"><?= $bagCount ?></span>
            <small>lettres</small>
        </div>
    </header>


    <!-- Board -->
    <div class="board-wrapper">
        <div class="board" id="board">
            <?php for ($r = 0; $r < 15; $r++): ?>
                <?php for ($c = 0; $c < 15; $c++): ?>
                    <?php
                        $key      = $r . ',' . $c;
                        $bonus    = BONUS_SQUARES[$key] ?? '';
                        $bonusCls = '';
                        $bonusLbl = '';
                        if ($bonus === '3M') { $bonusCls = 'bonus-3m'; $bonusLbl = '3M'; }
                        elseif ($bonus === '2M' && $key !== '7,7') { $bonusCls = 'bonus-2m'; $bonusLbl = '2M'; }
                        elseif ($key === '7,7') { $bonusCls = 'bonus-star'; $bonusLbl = '★'; }
                        elseif ($bonus === '3L') { $bonusCls = 'bonus-3l'; $bonusLbl = '3L'; }
                        elseif ($bonus === '2L') { $bonusCls = 'bonus-2l'; $bonusLbl = '2L'; }

                        $tileData = $board[$key] ?? null;
                    ?>
                    <div class="cell <?= $bonusCls ?>"
                         id="cell-<?= $r ?>-<?= $c ?>"
                         data-row="<?= $r ?>"
                         data-col="<?= $c ?>">
                        <?php if ($tileData): ?>
                            <div class="tile tile-placed<?= !empty($tileData['is_joker']) ? ' tile-joker' : '' ?>" data-row="<?= $r ?>" data-col="<?= $c ?>">
                                <span class="tile-letter"><?= htmlspecialchars($tileData['letter']) ?></span>
                                <span class="tile-value"><?= (int)$tileData['value'] ?></span>
                            </div>
                        <?php elseif ($bonusLbl): ?>
                            <span class="bonus-label"><?= $bonusLbl ?></span>
                        <?php endif; ?>
                    </div>
                <?php endfor; ?>
            <?php endfor; ?>
        </div>
    </div>

    <!-- Rack -->
    <div class="rack-area">
        <div class="rack" id="rack">
            <?php foreach ($myRack as $i => $tile): ?>
                <div class="tile tile-rack"
                     id="rack-tile-<?= $i ?>"
                     data-rack-index="<?= $i ?>"
                     data-letter="<?= htmlspecialchars($tile['letter']) ?>"
                     data-value="<?= (int)$tile['value'] ?>"
                     data-is-joker="<?= $tile['is_joker'] ? '1' : '0' ?>"
                     draggable="false">
                    <span class="tile-letter"><?= htmlspecialchars($tile['is_joker'] ? '?' : $tile['letter']) ?></span>
                    <span class="tile-value"><?= (int)$tile['value'] ?></span>
                </div>
            <?php endforeach; ?>
            <?php for ($i = count($myRack); $i < 7; $i++): ?>
                <div class="tile-slot" id="rack-slot-<?= $i ?>"></div>
            <?php endfor; ?>
        </div>
        <div class="rack-controls">
            <button class="btn-rack-ctrl" id="btn-recall" onclick="recallTiles()">Rappeler</button>
            <button class="btn-rack-ctrl" id="btn-shuffle" onclick="shuffleRack()">Mélanger</button>
            <button class="btn-history" id="btn-history" onclick="openHistoryModal()" title="Historique">📋</button>
        </div>
    </div>

    <!-- Preview score -->
    <div class="preview-area" id="preview-area" style="display:none">
        <span class="preview-label">Score estimé :</span>
        <span class="preview-score" id="preview-score">0</span>
        <span class="preview-words" id="preview-words"></span>
    </div>

    <!-- Jouer button -->
    <div class="play-area">
        <button class="btn btn-primary btn-play-main" id="btn-play" onclick="sendPlay()" disabled>Jouer</button>
    </div>

    <!-- Burger button (bottom-left, fixed) -->
    <button class="burger-btn" id="btn-burger" onclick="openBurgerMenu()">☰</button>

    <!-- Burger menu -->
    <div id="burger-menu" class="burger-menu" style="display:none" onclick="closeBurgerMenu()">
        <div class="burger-sheet" onclick="event.stopPropagation()">
            <button class="burger-option" id="btn-burger-exchange" <?= $bagCount < 7 ? 'disabled' : '' ?> onclick="closeBurgerMenu(); openExchangeModal()">Changer mes lettres</button>
            <button class="burger-option" onclick="closeBurgerMenu(); sendPass()">Passer mon tour</button>
            <button class="burger-option burger-option-danger" onclick="closeBurgerMenu(); sendAbandon()">Abandonner la partie</button>
            <button class="burger-option burger-option-cancel" onclick="closeBurgerMenu()">Annuler</button>
        </div>
    </div>

    <!-- Joker modal -->
    <div id="joker-modal" class="modal" style="display:none">
        <div class="modal-content">
            <h3>Choisir une lettre pour le joker</h3>
            <div class="joker-grid" id="joker-grid">
                <?php foreach (range('A','Z') as $letter): ?>
                    <button class="joker-btn" onclick="selectJokerLetter('<?= $letter ?>')"><?= $letter ?></button>
                <?php endforeach; ?>
            </div>
            <button class="btn btn-secondary" onclick="cancelJoker()">Annuler</button>
        </div>
    </div>

    <!-- Exchange modal -->
    <div id="exchange-modal" class="modal" style="display:none">
        <div class="modal-content">
            <h3>Choisir les tuiles à échanger</h3>
            <div class="exchange-rack" id="exchange-rack"></div>
            <div class="modal-actions">
                <button class="btn btn-primary" id="btn-exchange-confirm" onclick="sendExchange()">Échanger</button>
                <button class="btn btn-secondary" onclick="closeExchangeModal()">Annuler</button>
            </div>
        </div>
    </div>

    <!-- Lexika modal -->
    <div id="lexika-modal" class="modal" style="display:none">
        <div class="modal-content">
            <h3>Bravo, vous avez réussi un Lexika&nbsp;!</h3>
            <button class="btn btn-primary" onclick="closeLexikaModal()">Fermer</button>
        </div>
    </div>

    <!-- Game over modal -->
    <div id="gameover-modal" class="modal" style="display:none">
        <div class="modal-content">
            <h3 id="gameover-title">Partie terminée</h3>
            <p id="gameover-body"></p>
            <a href="index.php" class="btn btn-primary">Retour à l'accueil</a>
        </div>
    </div>

    <!-- Pending review banner (adversaire du dernier coup — bandeau bas, sans overlay) -->
    <?php if ($game['status'] === 'pending_review' && $isMyTurn):
        $prWinnerId = (int)($game['winner_id'] ?? 0);
        $myScore    = ($uid === $p1Id) ? $p1Score : $p2Score;
        $oppScore   = ($uid === $p1Id) ? $p2Score : $p1Score;
        $oppPrenom  = ($uid === $p1Id) ? $p2Prenom : $p1Prenom;
        if ($prWinnerId === $uid) {
            $prTitle = 'Victoire&nbsp;!';
            $prBody  = 'Vous avez remporté la partie ' . $myScore . '&nbsp;–&nbsp;' . $oppScore
                     . ' contre ' . htmlspecialchars($oppPrenom) . '.';
        } elseif ($prWinnerId) {
            $prTitle = 'Défaite';
            $prBody  = 'Vous avez perdu ' . $myScore . '&nbsp;–&nbsp;' . $oppScore
                     . ' contre ' . htmlspecialchars($oppPrenom) . '.';
        } else {
            $prTitle = 'Match nul';
            $prBody  = 'La partie s\'est terminée sur un match nul '
                     . $myScore . '&nbsp;–&nbsp;' . $oppScore . '.';
        }
    ?>
    <div id="pending-review-banner" style="position:fixed;bottom:0;left:0;right:0;z-index:9000;background:#fff;border-top:3px solid #1a3a5c;padding:0.85rem 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;box-shadow:0 -4px 20px rgba(0,0,0,0.18);">
        <div>
            <div style="font-size:1rem;font-weight:700;color:#1a3a5c;"><?= $prTitle ?></div>
            <div style="font-size:0.85rem;color:#555;margin-top:0.2rem;"><?= $prBody ?></div>
        </div>
        <button class="btn btn-primary" id="btn-acknowledge" style="flex-shrink:0;white-space:nowrap;">OK</button>
    </div>
    <script>
    document.getElementById('btn-acknowledge').addEventListener('click', function() {
        this.disabled = true;
        fetch('api.php', {
            method: 'POST',
            body: new URLSearchParams({ action: 'acknowledge_game', game_id: <?= $gameId ?> }),
        })
        .then(function(r) { return r.json(); })
        .finally(function() { window.location.href = 'index.php'; });
    });
    </script>
    <?php endif; ?>

    <!-- Toast notifications -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Embed game data -->
    <script>
        const GAME_ID      = <?= $gameId ?>;
        const MY_USER_ID   = <?= $uid ?>;
        const BONUS_SQUARES = <?= $bonusSquaresJson ?>;
        const INITIAL_STATE = <?= $initialStateJson ?>;
    </script>

    <?php if ($game['status'] === 'pending_review' && !$isMyTurn): ?>
    <script>
        /* Empêche game.js de démarrer le polling — initGame verra status='finished' */
        INITIAL_STATE.status = 'finished';
    </script>
    <?php endif; ?>
    <script src="drag.js"></script>
    <script src="game.js"></script>
    <?php if ($game['status'] === 'pending_review' && !$isMyTurn):
        /* Résultat calculé côté PHP pour éviter la confusion winnerId/winner_id */
        $goWinnerId = (int)($game['winner_id'] ?? 0);
        if ($goWinnerId === $uid) {
            $goTitle = 'Victoire&nbsp;!';
            $goBody  = 'Félicitations, vous avez gagné cette partie.';
        } elseif ($goWinnerId) {
            $goTitle = 'Défaite';
            $goBody  = 'Votre adversaire a remporté la partie.';
        } else {
            $goTitle = 'Match nul';
            $goBody  = 'La partie s\'est terminée sur un match nul.';
        }
    ?>
    <script>
        /* Ce handler s'enregistre après game.js → s'exécute après initGame/showGameOver
           et écrase le contenu de la modale avec les valeurs PHP correctes */
        document.addEventListener('DOMContentLoaded', function () {
            var t = document.getElementById('gameover-title');
            var b = document.getElementById('gameover-body');
            var m = document.getElementById('gameover-modal');
            if (!m) return;
            if (t) t.innerHTML   = <?= json_encode($goTitle) ?>;
            if (b) b.textContent = <?= json_encode($goBody) ?>;
            m.style.display = 'flex';
        });
    </script>
    <?php endif; ?>

    <!-- Definition modal -->
    <div id="definition-modal" class="modal" style="display:none" onclick="closeDefinitionModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="def-modal-header">
                <span class="def-modal-word" id="def-modal-word"></span>
                <button class="def-modal-close" onclick="closeDefinitionModal()">✕</button>
            </div>
            <div class="def-modal-body" id="def-modal-body"></div>
        </div>
    </div>

    <!-- History modal (en dernier pour échapper aux overflow/stacking des parents) -->
    <div id="history-modal" class="modal" style="display:none" onclick="closeHistoryModal()">
        <div class="modal-content history-modal-content" onclick="event.stopPropagation()">
            <h3>Historique de la partie</h3>
            <div class="history-table-wrapper">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Joueur</th>
                            <th>Mot</th>
                            <th>Pts</th>
                            <th><?= htmlspecialchars($p1Prenom) ?></th>
                            <th><?= htmlspecialchars($p2Prenom) ?></th>
                        </tr>
                    </thead>
                    <tbody id="history-tbody"></tbody>
                </table>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeHistoryModal()">Fermer</button>
            </div>
        </div>
    </div>
</body>
</html>
