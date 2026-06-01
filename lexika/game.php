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

$isMyTurn = ((int)$game['current_turn'] === $uid);

$initialState = [
    'gameId'      => $gameId,
    'myUserId'    => $uid,
    'p1'          => ['id' => $p1Id, 'prenom' => $p1Prenom, 'score' => $p1Score],
    'p2'          => ['id' => $p2Id, 'prenom' => $p2Prenom, 'score' => $p2Score],
    'board'       => $board,
    'myRack'      => $myRack,
    'bagCount'    => $bagCount,
    'currentTurn' => (int)$game['current_turn'],
    'status'      => $game['status'],
    'winnerId'    => $game['winner_id'],
    'lastMove'    => $lastMove ?: null,
    'isMyTurn'    => $isMyTurn,
];

$bonusSquaresJson = json_encode(BONUS_SQUARES);
$initialStateJson = json_encode($initialState);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Lexika – Partie #<?= $gameId ?></title>
    <link rel="stylesheet" href="style.css">
</head>
<body class="game-body">

    <!-- Score Header -->
    <header class="game-header">
        <a href="index.php" class="home-link" title="Accueil">&#8962;</a>
        <div class="game-scores">
            <div class="player-score <?= ($uid === $p1Id) ? 'player-score-me' : '' ?>" id="score-p1">
                <span class="player-name"><?= htmlspecialchars($p1Prenom) ?></span>
                <span class="player-pts" id="pts-p1"><?= $p1Score ?></span>
            </div>
            <div class="score-divider">vs</div>
            <div class="player-score <?= ($uid === $p2Id) ? 'player-score-me' : '' ?>" id="score-p2">
                <span class="player-name"><?= htmlspecialchars($p2Prenom) ?></span>
                <span class="player-pts" id="pts-p2"><?= $p2Score ?></span>
            </div>
        </div>
        <div class="bag-count">
            <span id="bag-count-display"><?= $bagCount ?></span>
            <small>lettres</small>
        </div>
    </header>

    <!-- Not my turn banner -->
    <?php $oppPrenom = ($uid === $p1Id) ? $p2Prenom : $p1Prenom; ?>
    <div id="wait-banner" class="wait-banner" style="display:<?= $isMyTurn ? 'none' : 'flex' ?>">
        <div class="wait-spinner-sm"></div>
        <span>En attente de <?= htmlspecialchars($oppPrenom) ?>…</span>
    </div>

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
                            <div class="tile tile-placed" data-row="<?= $r ?>" data-col="<?= $c ?>">
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
            <!-- Empty slots for visual alignment -->
            <?php for ($i = count($myRack); $i < 7; $i++): ?>
                <div class="tile-slot" id="rack-slot-<?= $i ?>"></div>
            <?php endfor; ?>
        </div>
    </div>

    <!-- Preview score -->
    <div class="preview-area" id="preview-area" style="display:none">
        <span class="preview-label">Score estimé :</span>
        <span class="preview-score" id="preview-score">0</span>
        <span class="preview-words" id="preview-words"></span>
    </div>

    <!-- Action buttons -->
    <div class="actions-area">
        <button class="btn btn-primary" id="btn-play" onclick="sendPlay()" disabled>Valider</button>
        <button class="btn btn-secondary" id="btn-recall" onclick="recallTiles()" disabled>Rappeler</button>
        <button class="btn btn-secondary" id="btn-exchange" onclick="openExchangeModal()">Changer</button>
        <button class="btn btn-secondary" id="btn-pass" onclick="sendPass()">Passer</button>
        <button class="btn btn-danger" id="btn-abandon" onclick="sendAbandon()">Abandonner</button>
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

    <!-- Game over modal -->
    <div id="gameover-modal" class="modal" style="display:none">
        <div class="modal-content">
            <h3 id="gameover-title">Partie terminée</h3>
            <p id="gameover-body"></p>
            <a href="index.php" class="btn btn-primary">Retour à l'accueil</a>
        </div>
    </div>

    <!-- Toast notifications -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Embed game data -->
    <script>
        const GAME_ID      = <?= $gameId ?>;
        const MY_USER_ID   = <?= $uid ?>;
        const BONUS_SQUARES = <?= $bonusSquaresJson ?>;
        const INITIAL_STATE = <?= $initialStateJson ?>;
    </script>

    <script src="drag.js"></script>
    <script src="game.js"></script>
</body>
</html>
