<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';
requireLogin();

$user = currentUser();
$pdo  = getDB();
$uid  = (int)$user['id'];

// ── Handle new game POST ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'new_game') {
    $p2id = (int)($_POST['player2_id'] ?? 0);
    $newGameError = null;
    if ($p2id > 0 && $p2id !== $uid) {
        try {
            $st = $pdo->prepare('SELECT id FROM lxk_users WHERE id = ?');
            $st->execute([$p2id]);
            if ($st->fetch()) {
                $ins = $pdo->prepare(
                    'INSERT INTO lxk_games (player1_id, player2_id, board, bag, status, current_turn) VALUES (?,?,?,?,\'invited\',?)'
                );
                $ins->execute([$uid, $p2id, json_encode((object)[]), json_encode([]), $uid]);
                header('Location: ' . BASE_URL . '/index.php');
                exit;
            }
        } catch (Throwable $e) {
            error_log('[Lexika] new_game error: ' . $e->getMessage() . ' | ' . $e->getFile() . ':' . $e->getLine());
            $newGameError = 'Erreur lors de la création de la partie : ' . htmlspecialchars($e->getMessage());
        }
    }
}

// ── Fetch in-progress games ───────────────────────────────────────────────────
$stPlaying = $pdo->prepare(
    'SELECT g.id, g.current_turn, g.created_at,
            DATEDIFF(NOW(), g.created_at) AS days_elapsed,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     JOIN lxk_users u2 ON u2.id = g.player2_id
     JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'playing\' AND (g.player1_id = :uid1 OR g.player2_id = :uid2)
     ORDER BY g.id DESC'
);
$stPlaying->execute([':uid1' => $uid, ':uid2' => $uid]);
$playingGames = $stPlaying->fetchAll();

// ── Last move per in-progress game (for sub-info display) ─────────────────────
$stLastMovePerGame = $pdo->prepare(
    'SELECT user_id, created_at FROM lxk_game_moves WHERE game_id = ? ORDER BY id DESC LIMIT 1'
);
$lastMoveByGame = [];
foreach ($playingGames as $pg) {
    $stLastMovePerGame->execute([$pg['id']]);
    $lastMoveByGame[$pg['id']] = $stLastMovePerGame->fetch();
}

// ── Finished games (last 20) ─────────────────────────────────────────────────
$stFinished = $pdo->prepare(
    'SELECT g.id, g.finished_at, g.winner_id,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     JOIN lxk_users u2 ON u2.id = g.player2_id
     JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'finished\' AND (g.player1_id = :uid1 OR g.player2_id = :uid2)
     ORDER BY g.finished_at DESC
    LIMIT 100'
);
$stFinished->execute([':uid1' => $uid, ':uid2' => $uid]);
$finishedGames = $stFinished->fetchAll();

// ── Games pending review (adversaire du dernier coup) ─────────────────────────
$stPending = $pdo->prepare(
    'SELECT g.id, g.winner_id,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     JOIN lxk_users u2 ON u2.id = g.player2_id
     JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'pending_review\'
       AND (g.player1_id = :uid1 OR g.player2_id = :uid2)
       AND g.current_turn = :uid3
     ORDER BY g.id DESC'
);
$stPending->execute([':uid1' => $uid, ':uid2' => $uid, ':uid3' => $uid]);
$pendingGames = $stPending->fetchAll();

// ── Games pending review (moi-même ayant terminé la partie) ───────────────────
$stPendingMine = $pdo->prepare(
    'SELECT g.id, g.winner_id,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     JOIN lxk_users u2 ON u2.id = g.player2_id
     JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'pending_review\'
       AND (g.player1_id = :uid1 OR g.player2_id = :uid2)
       AND g.current_turn != :uid3
     ORDER BY g.id DESC'
);
$stPendingMine->execute([':uid1' => $uid, ':uid2' => $uid, ':uid3' => $uid]);
$pendingGamesMine = $stPendingMine->fetchAll();

// ── Personal stats ────────────────────────────────────────────────────────────
$stStats = $pdo->prepare(
    'SELECT
        COUNT(*) AS played,
        SUM(CASE WHEN winner_id = :uid1 THEN 1 ELSE 0 END) AS won,
        SUM(CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END)  AS drawn
     FROM lxk_games
     WHERE status = \'finished\' AND (player1_id = :uid2 OR player2_id = :uid3)'
);
$stStats->execute([':uid1' => $uid, ':uid2' => $uid, ':uid3' => $uid]);
$stats  = $stStats->fetch();
$played = (int)($stats['played'] ?? 0);
$won    = (int)($stats['won']    ?? 0);
$drawn  = (int)($stats['drawn']  ?? 0);
$lost   = $played - $won - $drawn;
$wonPct   = $played > 0 ? round($won   / $played * 100) : null;
$lostPct  = $played > 0 ? round($lost  / $played * 100) : null;
$drawnPct = $played > 0 ? round($drawn / $played * 100) : null;

// Lexika count
$stLex = $pdo->prepare(
    'SELECT COUNT(*)
     FROM lxk_lexika lx
     JOIN lxk_games g ON g.id = lx.game_id
     WHERE lx.user_id = ? AND g.status = \'finished\''
);
$stLex->execute([$uid]);
$lexikaCount = (int)$stLex->fetchColumn();

// Average score
$stAvg = $pdo->prepare(
    'SELECT AVG(gp.score) AS avg_score
     FROM lxk_game_players gp
     JOIN lxk_games g ON g.id = gp.game_id
     WHERE gp.user_id = ? AND g.status = \'finished\''
);
$stAvg->execute([$uid]);
$avgRow   = $stAvg->fetch();
$avgScore = $avgRow ? round((float)($avgRow['avg_score'] ?? 0)) : 0;

// Best single move (highest scoring play)
$stBest = $pdo->prepare(
    'SELECT word, score FROM lxk_game_moves WHERE user_id = ? AND move_type = \'play\' ORDER BY score DESC LIMIT 1'
);
$stBest->execute([$uid]);
$bestMove = $stBest->fetch();

// ── Opponents stats ──────────────────────────────────────────────────────────
$stOppStats = $pdo->prepare('
    SELECT
        opp.id     AS opp_id,
        opp.prenom AS opp_prenom,
        COUNT(*)   AS played,
        SUM(CASE WHEN g.winner_id = :uid1  THEN 1 ELSE 0 END) AS won,
        SUM(CASE WHEN g.winner_id = opp.id THEN 1 ELSE 0 END) AS lost,
        ROUND(AVG(my_gp.score))  AS my_avg_vs,
        ROUND(AVG(opp_gp.score)) AS opp_avg_vs,
        ROUND((
            SELECT AVG(gp2.score)
            FROM lxk_game_players gp2
            JOIN lxk_games g2 ON g2.id = gp2.game_id
            WHERE gp2.user_id = opp.id AND g2.status = \'finished\'
        )) AS opp_avg_all
    FROM lxk_games g
    JOIN lxk_users opp ON opp.id = CASE WHEN g.player1_id = :uid2 THEN g.player2_id ELSE g.player1_id END
    JOIN lxk_game_players my_gp  ON my_gp.game_id  = g.id AND my_gp.user_id  = :uid3
    JOIN lxk_game_players opp_gp ON opp_gp.game_id = g.id AND opp_gp.user_id = opp.id
    WHERE g.status = \'finished\' AND (g.player1_id = :uid4 OR g.player2_id = :uid5)
    GROUP BY opp.id, opp.prenom
    ORDER BY played DESC
');
$stOppStats->execute([':uid1'=>$uid,':uid2'=>$uid,':uid3'=>$uid,':uid4'=>$uid,':uid5'=>$uid]);
$oppStats = $stOppStats->fetchAll(PDO::FETCH_ASSOC);

// Best Lexika per opponent
$stBestLex = $pdo->prepare('
    SELECT
        CASE WHEN g.player1_id = ? THEN g.player2_id ELSE g.player1_id END AS opp_id,
        MAX(lx.score) AS best_lexika
    FROM lxk_lexika lx
    JOIN lxk_games g ON g.id = lx.game_id
    WHERE lx.user_id = ?
      AND (g.player1_id = ? OR g.player2_id = ?)
    GROUP BY opp_id
');
$stBestLex->execute([$uid, $uid, $uid, $uid]);
$bestLexikaByOpp = [];
foreach ($stBestLex->fetchAll() as $row) {
    $bestLexikaByOpp[(int)$row['opp_id']] = (int)$row['best_lexika'];
}

// ── SI map (Score Individuel = total_points / total_moves, arrondi) ───────────
$stSI = $pdo->query('SELECT id, total_points, total_moves FROM lxk_users');
$siMap = [];
foreach ($stSI->fetchAll() as $row) {
    $moves = (int)$row['total_moves'];
    $siMap[(int)$row['id']] = $moves > 0 ? (int)round((int)$row['total_points'] / $moves) : null;
}

// ── Opponents list ────────────────────────────────────────────────────────────
$stOpponents = $pdo->prepare('SELECT id, login, prenom FROM lxk_users WHERE id != ? AND role != \'admin\' ORDER BY prenom, login');
$stOpponents->execute([$uid]);
$opponents = $stOpponents->fetchAll();

// ── Received invitations (I am player2) ──────────────────────────────────────
$stRecv = $pdo->prepare(
    'SELECT g.id, g.created_at, u1.prenom AS p1_prenom, u1.login AS p1_login
     FROM lxk_games g
     JOIN lxk_users u1 ON u1.id = g.player1_id
     WHERE g.status = \'invited\' AND g.player2_id = ?
     ORDER BY g.id DESC'
);
$stRecv->execute([$uid]);
$receivedInvites = $stRecv->fetchAll();

// ── Sent invitations (I am player1) ──────────────────────────────────────────
$stSent = $pdo->prepare(
    'SELECT g.id, g.created_at, u2.prenom AS p2_prenom, u2.login AS p2_login
     FROM lxk_games g
     JOIN lxk_users u2 ON u2.id = g.player2_id
     WHERE g.status = \'invited\' AND g.player1_id = ?
     ORDER BY g.id DESC'
);
$stSent->execute([$uid]);
$sentInvites = $stSent->fetchAll();

// ── Last move id for polling ──────────────────────────────────────────────────
$stLastMove = $pdo->prepare(
    'SELECT COALESCE(MAX(m.id), 0) AS last_move_id
     FROM lxk_game_moves m
     JOIN lxk_games g ON g.id = m.game_id
     WHERE g.player1_id = ? OR g.player2_id = ?'
);
$stLastMove->execute([$uid, $uid]);
$initialLastMoveId = (int)$stLastMove->fetchColumn();

// ── Top 10 Lexika (tous joueurs, parties terminées) ────────────────────────────
$topLexikaHome = $pdo->query(
    'SELECT lx.word, lx.score,
            u.prenom  AS player_prenom,
            u2.prenom AS opp_prenom,
            lx.game_id
     FROM lxk_lexika lx
     JOIN lxk_games g       ON g.id          = lx.game_id
     JOIN lxk_users u       ON u.id           = lx.user_id
     JOIN lxk_game_players gp_opp
                            ON gp_opp.game_id = lx.game_id
                           AND gp_opp.user_id != lx.user_id
     JOIN lxk_users u2      ON u2.id          = gp_opp.user_id
     WHERE g.status IN (\'finished\', \'abandoned\')
     ORDER BY lx.score DESC
     LIMIT 10'
)->fetchAll();

// ── Top 10 meilleurs scores de partie (tous joueurs) ────────────────────────────
$topGameScores = $pdo->query(
    'SELECT u.prenom, gp.score, g.id, u2.prenom AS adversaire
     FROM lxk_game_players gp
     JOIN lxk_games g ON g.id = gp.game_id
     JOIN lxk_users u ON u.id = gp.user_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id != gp.user_id
     JOIN lxk_users u2 ON u2.id = gp2.user_id
     WHERE g.status IN (\'finished\', \'abandoned\')
     ORDER BY gp.score DESC
     LIMIT 10'
)->fetchAll();

// ── Top 10 scores globaux de partie (score cumulé des deux joueurs) ────────────
$topGlobalScores = $pdo->query(
    'SELECT g.id, g.finished_at, g.winner_id,
            gp1.user_id AS p1_id, gp1.score AS p1_score, u1.prenom AS p1_prenom,
            gp2.user_id AS p2_id, gp2.score AS p2_score, u2.prenom AS p2_prenom,
            (gp1.score + gp2.score) AS total_score
     FROM lxk_games g
     JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     JOIN lxk_users u1 ON u1.id = gp1.user_id
     JOIN lxk_users u2 ON u2.id = gp2.user_id
     WHERE g.status = \'finished\'
     ORDER BY total_score DESC
     LIMIT 10'
)->fetchAll();

// ── Moyenne de Lexika par partie (tous joueurs, parties terminées) ─────────────
$avgLexikaPerGame = $pdo->query(
    'SELECT u.id, u.prenom,
            CASE WHEN u.total_moves > 0 THEN ROUND(u.total_points / u.total_moves) ELSE NULL END AS si,
            gp_stats.games_played AS games_played,
            COALESCE(lex_stats.lexika_count, 0) AS lexika_count,
            ROUND(COALESCE(lex_stats.lexika_count, 0) / gp_stats.games_played, 2) AS avg_lexika
     FROM lxk_users u
     JOIN (
         SELECT gp.user_id, COUNT(*) AS games_played
         FROM lxk_game_players gp
         JOIN lxk_games g ON g.id = gp.game_id
         WHERE g.status = \'finished\'
         GROUP BY gp.user_id
     ) gp_stats ON gp_stats.user_id = u.id
     LEFT JOIN (
         SELECT lx.user_id, COUNT(*) AS lexika_count
         FROM lxk_lexika lx
         JOIN lxk_games g ON g.id = lx.game_id
         WHERE g.status = \'finished\'
         GROUP BY lx.user_id
     ) lex_stats ON lex_stats.user_id = u.id
     ORDER BY avg_lexika DESC'
)->fetchAll();

// ── French date formatter (e.g. "26 juin") ─────────────────────────────────────
function lxkFormatDateFr(string $datetime): string {
    static $mois = [1=>'janvier',2=>'février',3=>'mars',4=>'avril',5=>'mai',6=>'juin',
                     7=>'juillet',8=>'août',9=>'septembre',10=>'octobre',11=>'novembre',12=>'décembre'];
    $ts = strtotime($datetime);
    return (int)date('j', $ts) . ' ' . $mois[(int)date('n', $ts)];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Accueil</title>
    <link rel="stylesheet" href="style.css?v=<?= ASSET_VERSION ?>">
    <link rel="manifest" href="/lexika/manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Lexika">
    <link rel="apple-touch-icon" href="/lexika/icons/icon-180.png">
    <meta name="theme-color" content="#1a3a5c">
    <meta name="mobile-web-app-capable" content="yes">
</head>
<body>
    <header class="site-header">
        <div class="header-inner">
            <div class="lx-logo">
                <div class="lx-tile lx-L">L<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-E">E<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-X">X<span class="lx-pts">10</span></div>
                <div class="lx-tile lx-I">I<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-K">K<span class="lx-pts">10</span></div>
                <div class="lx-tile lx-A">A<span class="lx-pts">1</span></div>
            </div>
            <nav class="header-nav">
                <span class="greeting">Bonjour, <?= htmlspecialchars($user['prenom'] ?: $user['login']) ?></span>
                <?php if ($user['role'] === 'admin'): ?>
                    <a href="admin.php" class="nav-link">Admin</a>
                <?php endif; ?>
                <a href="logout.php" class="nav-link">Déconnexion</a>
            </nav>
        </div>
    </header>

    <main class="main-content">

        <!-- New Game -->
        <section class="card">
            <h2 class="card-title">Nouvelle partie</h2>
            <?php if (!empty($newGameError)): ?>
                <p class="text-danger" style="margin-bottom:0.5rem"><?= $newGameError ?></p>
            <?php endif; ?>
            <?php if (empty($opponents)): ?>
                <p class="text-secondary">Aucun autre joueur disponible.</p>
            <?php else: ?>
                <form method="post" action="index.php" class="new-game-form">
                    <input type="hidden" name="action" value="new_game">
                    <div class="form-row">
                        <label for="player2_id">Adversaire</label>
                        <select name="player2_id" id="player2_id" required>
                            <option value="">-- Choisir un joueur --</option>
                            <?php foreach ($opponents as $op):
                                $opSI = $siMap[(int)$op['id']] ?? null;
                                $siStr = $opSI !== null ? " SI:$opSI" : '';
                            ?>
                                <option value="<?= $op['id'] ?>">
                                    <?= htmlspecialchars($op['prenom'] ?: $op['login']) ?>
                                    (<?= htmlspecialchars($op['login']) ?><?= $siStr ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="btn btn-primary">Inviter</button>
                    </div>
                </form>
            <?php endif; ?>
        </section>

        <!-- Received Invitations -->
        <?php if (!empty($receivedInvites)): ?>
        <section class="card">
            <h2 class="card-title">Invitations reçues (<?= count($receivedInvites) ?>)</h2>
            <div class="game-list">
                <?php foreach ($receivedInvites as $g):
                    $oppName = $g['p1_prenom'] ?: $g['p1_login'];
                ?>
                <div class="game-row invite-row">
                    <div class="game-row-opponent"><?= htmlspecialchars($oppName) ?></div>
                    <div class="game-row-status">
                        <span class="badge badge-wait">Invitation en attente</span>
                    </div>
                    <div class="invite-actions">
                        <button class="btn btn-sm btn-primary"
                                onclick="handleInvite('accept_game', <?= $g['id'] ?>)">Accepter</button>
                        <button class="btn btn-sm btn-danger"
                                onclick="handleInvite('refuse_game', <?= $g['id'] ?>)">Refuser</button>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- Sent Invitations -->
        <?php if (!empty($sentInvites)): ?>
        <section class="card">
            <h2 class="card-title">Invitations envoyées (<?= count($sentInvites) ?>)</h2>
            <div class="game-list">
                <?php foreach ($sentInvites as $g):
                    $oppName = $g['p2_prenom'] ?: $g['p2_login'];
                ?>
                <div class="game-row invite-row">
                    <div class="game-row-opponent"><?= htmlspecialchars($oppName) ?></div>
                    <div class="game-row-status">
                        <span class="badge badge-wait">En attente d'acceptation de <?= htmlspecialchars($oppName) ?></span>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- In-Progress Games -->
        <section class="card card-playing">
            <h2 class="card-title">Parties en cours</h2>
            <?php
                $myTurnGames  = [];
                $waitingGames = [];
                foreach ($playingGames as $g) {
                    if ((int)$g['current_turn'] === $uid) $myTurnGames[]  = $g;
                    else                                   $waitingGames[] = $g;
                }
            ?>
            <?php if (empty($myTurnGames) && empty($waitingGames)): ?>
                <p class="text-secondary">Aucune partie en cours.</p>
            <?php else: ?>
                <?php if (!empty($myTurnGames)): ?>
                    <h3 class="subsection-title">À toi de jouer</h3>
                    <div class="game-list">
                        <?php foreach ($myTurnGames as $g):
                            $oppId     = ($g['p1_id'] == $uid) ? (int)$g['p2_id'] : (int)$g['p1_id'];
                            $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                            $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                            $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                            $oppSI     = $siMap[$oppId] ?? null;
                            $gStartInfo = 'Commencée le ' . lxkFormatDateFr($g['created_at'])
                                        . ' · ' . (int)$g['days_elapsed'] . ' jour' . ((int)$g['days_elapsed'] > 1 ? 's' : '');
                            $gLastMove  = $lastMoveByGame[$g['id']] ?? null;
                            if ($gLastMove) {
                                $gLastMovePrenom = ((int)$gLastMove['user_id'] === (int)$g['p1_id']) ? $g['p1_prenom'] : $g['p2_prenom'];
                                $gStartInfo .= ' · Dernier coup : ' . $gLastMovePrenom . ' le ' . lxkFormatDateFr($gLastMove['created_at']);
                            }
                        ?>
                        <a href="game.php?id=<?= $g['id'] ?>" class="game-row">
                            <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?><span class="player-si"><?= $oppSI !== null ? " ($oppSI)" : ' (—)' ?></span>
                                <div class="player-si"><?= htmlspecialchars($gStartInfo) ?></div>
                            </div>
                            <div class="game-row-scores">
                                <span class="score-mine"><?= $myScore ?></span>
                                <span class="score-sep">–</span>
                                <span class="score-opp"><?= $oppScore ?></span>
                            </div>
                            <div class="game-row-status">
                                <span class="badge badge-turn">À toi de jouer</span>
                            </div>
                        </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
                <?php if (!empty($waitingGames)): ?>
                    <h3 class="subsection-title">En attente</h3>
                    <div class="game-list">
                        <?php foreach ($waitingGames as $g):
                            $oppId     = ($g['p1_id'] == $uid) ? (int)$g['p2_id'] : (int)$g['p1_id'];
                            $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                            $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                            $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                            $oppSI     = $siMap[$oppId] ?? null;
                            $gStartInfo = 'Commencée le ' . lxkFormatDateFr($g['created_at'])
                                        . ' · ' . (int)$g['days_elapsed'] . ' jour' . ((int)$g['days_elapsed'] > 1 ? 's' : '');
                            $gLastMove  = $lastMoveByGame[$g['id']] ?? null;
                            if ($gLastMove) {
                                $gLastMovePrenom = ((int)$gLastMove['user_id'] === (int)$g['p1_id']) ? $g['p1_prenom'] : $g['p2_prenom'];
                                $gStartInfo .= ' · Dernier coup : ' . $gLastMovePrenom . ' le ' . lxkFormatDateFr($gLastMove['created_at']);
                            }
                        ?>
                        <a href="game.php?id=<?= $g['id'] ?>" class="game-row">
                            <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?><span class="player-si"><?= $oppSI !== null ? " ($oppSI)" : ' (—)' ?></span>
                                <div class="player-si"><?= htmlspecialchars($gStartInfo) ?></div>
                            </div>
                            <div class="game-row-scores">
                                <span class="score-mine"><?= $myScore ?></span>
                                <span class="score-sep">–</span>
                                <span class="score-opp"><?= $oppScore ?></span>
                            </div>
                            <div class="game-row-status">
                                <span class="badge badge-wait">En attente</span>
                            </div>
                        </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </section>

        <!-- Pending Review Games -->
        <?php if (!empty($pendingGames)): ?>
        <section class="card">
            <h2 class="card-title">À terminer (<?= count($pendingGames) ?>)</h2>
            <div class="game-list">
                <?php foreach ($pendingGames as $g):
                    $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                    $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                    $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                    $iWon      = ((int)$g['winner_id'] === $uid);
                    $isDraw    = ($g['winner_id'] === null);
                ?>
                <a href="game.php?id=<?= $g['id'] ?>" class="game-row">
                    <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?></div>
                    <div class="game-row-scores">
                        <span class="score-mine"><?= $myScore ?></span>
                        <span class="score-sep">–</span>
                        <span class="score-opp"><?= $oppScore ?></span>
                    </div>
                    <div class="game-row-status">
                        <?php if ($isDraw): ?>
                            <span class="badge badge-wait">Nul – à confirmer</span>
                        <?php elseif ($iWon): ?>
                            <span class="badge badge-turn">Victoire – à confirmer</span>
                        <?php else: ?>
                            <span class="badge badge-loss">Défaite – à confirmer</span>
                        <?php endif; ?>
                    </div>
                </a>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- Pending Review Games (moi ayant terminé la partie) -->
        <?php if (!empty($pendingGamesMine)): ?>
        <section class="card">
            <h2 class="card-title">Partie terminée, en attente de validation par l'adversaire (<?= count($pendingGamesMine) ?>)</h2>
            <div class="game-list">
                <?php foreach ($pendingGamesMine as $g):
                    $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                    $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                    $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                    $iWon      = ((int)$g['winner_id'] === $uid);
                    $isDraw    = ($g['winner_id'] === null);
                ?>
                <div class="game-row">
                    <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?></div>
                    <div class="game-row-scores">
                        <span class="score-mine"><?= $myScore ?></span>
                        <span class="score-sep">–</span>
                        <span class="score-opp"><?= $oppScore ?></span>
                    </div>
                    <div class="game-row-status">
                        <?php if ($isDraw): ?>
                            <span class="badge badge-wait">Match nul</span>
                        <?php elseif ($iWon): ?>
                            <span class="badge badge-win">Victoire</span>
                        <?php else: ?>
                            <span class="badge badge-loss">Défaite</span>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- Finished Games (collapsible) -->
        <section class="card">
            <h2 class="card-title card-title-toggle" id="finished-toggle" onclick="toggleFinished()">
                Parties terminées
                <span class="toggle-icon" id="finished-icon">▶</span>
            </h2>
            <div id="finished-content" style="display:none">
                <?php if (empty($finishedGames)): ?>
                    <p class="text-secondary">Aucune partie terminée.</p>
                <?php else: ?>
                    <div class="game-list finished-list">
                        <?php foreach ($finishedGames as $g):
                            $oppId     = ($g['p1_id'] == $uid) ? (int)$g['p2_id'] : (int)$g['p1_id'];
                            $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                            $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                            $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                            $iWon      = ((int)$g['winner_id'] === $uid);
                            $dateStr   = $g['finished_at'] ? date('d/m/Y', strtotime($g['finished_at'])) : '–';
                            $oppSI     = $siMap[$oppId] ?? null;
                        ?>
                        <div class="game-row finished-row">
                            <div class="game-row-date"><?= $dateStr ?></div>
                            <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?><span class="player-si"><?= $oppSI !== null ? " ($oppSI)" : ' (—)' ?></span></div>
                            <div class="game-row-scores">
                                <span class="score-mine"><?= $myScore ?></span>
                                <span class="score-sep">–</span>
                                <span class="score-opp"><?= $oppScore ?></span>
                            </div>
                            <div class="game-row-status">
                                <?php if ($iWon): ?>
                                    <span class="badge badge-win">Victoire</span>
                                <?php else: ?>
                                    <span class="badge badge-loss">Défaite</span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </section>

        <!-- Personal Stats -->
        <section class="card">
            <h2 class="card-title">Mes statistiques</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value"><?= $played ?></div>
                    <div class="stat-label">Parties jouées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $won ?><?php if ($wonPct !== null): ?> <span class="player-si">(<?= $wonPct ?>%)</span><?php endif; ?></div>
                    <div class="stat-label">Gagnées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $lost ?><?php if ($lostPct !== null): ?> <span class="player-si">(<?= $lostPct ?>%)</span><?php endif; ?></div>
                    <div class="stat-label">Perdues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $drawn ?><?php if ($drawnPct !== null): ?> <span class="player-si">(<?= $drawnPct ?>%)</span><?php endif; ?></div>
                    <div class="stat-label">Nuls</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $avgScore ?></div>
                    <div class="stat-label">Score moyen</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $siMap[$uid] !== null ? $siMap[$uid] : '—' ?></div>
                    <div class="stat-label">Score individuel</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $lexikaCount ?></div>
                    <div class="stat-label">Lexika</div>
                </div>
                <div class="stat-card stat-card-wide">
                    <div class="stat-label">Meilleur mot</div>
                    <?php if ($bestMove):
                        $allWords    = array_map('trim', explode(',', $bestMove['word']));
                        usort($allWords, fn($a, $b) => strlen($b) - strlen($a));
                        $displayWord = strtoupper($allWords[0]);
                    ?>
                        <div class="stat-value stat-word"><?= htmlspecialchars($displayWord) ?></div>
                        <div class="stat-word-score"><?= $bestMove['score'] ?> pts</div>
                    <?php else: ?>
                        <div class="stat-value">–</div>
                    <?php endif; ?>
                </div>
            </div>
        </section>

        <!-- Opponents Stats -->
        <section class="card">
            <h2 class="card-title">Mes adversaires</h2>
            <?php if (empty($oppStats)): ?>
                <p class="text-secondary">Aucune partie terminée.</p>
            <?php else: ?>
                <div class="opp-list">
                    <?php foreach ($oppStats as $o):
                        $oppId    = (int)$o['opp_id'];
                        $oppDrawn = (int)$o['played'] - (int)$o['won'] - (int)$o['lost'];
                        $bestLex  = $bestLexikaByOpp[$oppId] ?? null;
                        $oppSI    = $siMap[$oppId] ?? null;
                    ?>
                    <div class="opp-block">
                        <div class="opp-name-row" onclick="toggleOppDetail('opp-<?= $oppId ?>')">
                            <span class="opp-name"><?= htmlspecialchars($o['opp_prenom']) ?><span class="player-si"><?= $oppSI !== null ? " ($oppSI)" : ' (—)' ?></span></span>
                            <span class="opp-toggle" id="arrow-opp-<?= $oppId ?>">▶</span>
                        </div>
                        <div class="stats-grid opp-stats-grid">
                            <div class="stat-card">
                                <div class="stat-value"><?= $o['played'] ?></div>
                                <div class="stat-label">Parties jouées</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value stat-green"><?= $o['won'] ?></div>
                                <div class="stat-label">Gagnées</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value"><?= $o['lost'] ?></div>
                                <div class="stat-label">Perdues</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value stat-gray"><?= $oppDrawn ?></div>
                                <div class="stat-label">Nulles</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value"><?= $bestLex ?? '—' ?></div>
                                <div class="stat-label">Meilleur Lexika</div>
                            </div>
                        </div>
                        <div class="opp-detail" id="opp-<?= $oppId ?>" style="display:none">
                            <div class="stats-grid opp-stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value"><?= $o['my_avg_vs'] ?? '—' ?></div>
                                    <div class="stat-label">Mon score moy. contre lui</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value"><?= $avgScore ?></div>
                                    <div class="stat-label">Mon score moy. général</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value"><?= $o['opp_avg_vs'] ?? '—' ?></div>
                                    <div class="stat-label">Son score moy. contre moi</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value"><?= $o['opp_avg_all'] ?? '—' ?></div>
                                    <div class="stat-label">Son score moy. général</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>

        <!-- Top Scores -->
        <section class="card">
            <h2 class="card-title">Meilleurs scores</h2>
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <div>
                    <h3 class="subsection-title">Top 10 Lexika</h3>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Joueur</th>
                                    <th>Mot</th>
                                    <th>Points</th>
                                    <th>Adversaire</th>
                                    <th>Partie</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($topLexikaHome)): ?>
                                <tr>
                                    <td colspan="6" style="text-align:center;color:#888">Aucun Lexika enregistré.</td>
                                </tr>
                                <?php else: ?>
                                <?php foreach ($topLexikaHome as $i => $lx): ?>
                                <tr>
                                    <td><?= $i + 1 ?></td>
                                    <td><?= htmlspecialchars($lx['player_prenom']) ?></td>
                                    <td><strong><?= htmlspecialchars(strtoupper($lx['word'])) ?></strong></td>
                                    <td><?= (int)$lx['score'] ?></td>
                                    <td><?= htmlspecialchars($lx['opp_prenom']) ?></td>
                                    <td><a href="game.php?id=<?= $lx['game_id'] ?>">#<?= $lx['game_id'] ?></a></td>
                                </tr>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="subsection-title">Top 10 scores de partie</h3>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Joueur</th>
                                    <th>Score</th>
                                    <th>Adversaire</th>
                                    <th>Partie</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($topGameScores)): ?>
                                <tr>
                                    <td colspan="5" style="text-align:center;color:#888">Aucun score enregistré.</td>
                                </tr>
                                <?php else: ?>
                                <?php foreach ($topGameScores as $i => $sc): ?>
                                <tr>
                                    <td><?= $i + 1 ?></td>
                                    <td><?= htmlspecialchars($sc['prenom']) ?></td>
                                    <td><strong><?= (int)$sc['score'] ?></strong></td>
                                    <td><?= htmlspecialchars($sc['adversaire']) ?></td>
                                    <td><a href="game.php?id=<?= $sc['id'] ?>">#<?= $sc['id'] ?></a></td>
                                </tr>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="subsection-title">Top 10 des scores globaux de partie</h3>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>Vainqueur</th>
                                    <th>Score</th>
                                    <th>Adversaire</th>
                                    <th>Score</th>
                                    <th>Score cumulé</th>
                                    <th>Partie</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($topGlobalScores)): ?>
                                <tr>
                                    <td colspan="8" style="text-align:center;color:#888">Aucune partie terminée.</td>
                                </tr>
                                <?php else: ?>
                                <?php foreach ($topGlobalScores as $i => $gg):
                                    $isDraw = ($gg['winner_id'] === null);
                                    if ($isDraw) {
                                        $winnerLabel = 'Match nul';
                                        $winnerScore = null;
                                        $loserLabel  = htmlspecialchars($gg['p1_prenom']) . ' &amp; ' . htmlspecialchars($gg['p2_prenom']);
                                        $loserScore  = (int)$gg['p1_score'];
                                    } else {
                                        $winnerIsP1  = ((int)$gg['winner_id'] === (int)$gg['p1_id']);
                                        $winnerLabel = htmlspecialchars($winnerIsP1 ? $gg['p1_prenom'] : $gg['p2_prenom']);
                                        $winnerScore = $winnerIsP1 ? (int)$gg['p1_score'] : (int)$gg['p2_score'];
                                        $loserLabel  = htmlspecialchars($winnerIsP1 ? $gg['p2_prenom'] : $gg['p1_prenom']);
                                        $loserScore  = $winnerIsP1 ? (int)$gg['p2_score'] : (int)$gg['p1_score'];
                                    }
                                ?>
                                <tr>
                                    <td><?= $i + 1 ?></td>
                                    <td><?= lxkFormatDateFr($gg['finished_at']) ?></td>
                                    <td><?= $winnerLabel ?></td>
                                    <td><?= $winnerScore !== null ? '<strong>' . $winnerScore . '</strong>' : '—' ?></td>
                                    <td><?= $loserLabel ?></td>
                                    <td><?= (int)$loserScore ?></td>
                                    <td><strong><?= (int)$gg['total_score'] ?></strong></td>
                                    <td><a href="game.php?id=<?= $gg['id'] ?>">#<?= $gg['id'] ?></a></td>
                                </tr>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="subsection-title">Moyenne de Lexika par partie</h3>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Joueur</th>
                                    <th>Lexika</th>
                                    <th>Parties terminées</th>
                                    <th>Moyenne</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($avgLexikaPerGame)): ?>
                                <tr>
                                    <td colspan="5" style="text-align:center;color:#888">Aucune partie terminée.</td>
                                </tr>
                                <?php else: ?>
                                <?php foreach ($avgLexikaPerGame as $i => $al): ?>
                                <tr>
                                    <td><?= $i + 1 ?></td>
                                    <td><?= htmlspecialchars($al['prenom']) ?> (<?= $al['si'] !== null ? (int)$al['si'] : '—' ?>)</td>
                                    <td><?= (int)$al['lexika_count'] ?></td>
                                    <td><?= (int)$al['games_played'] ?></td>
                                    <td><strong><?= number_format((float)$al['avg_lexika'], 2, ',', '') ?></strong></td>
                                </tr>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <script>
    function toggleOppDetail(id) {
        var detail = document.getElementById(id);
        var arrow  = document.getElementById('arrow-' + id);
        if (detail.style.display === 'none') {
            detail.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(90deg)';
        } else {
            detail.style.display = 'none';
            if (arrow) arrow.style.transform = '';
        }
    }

    function toggleFinished() {
        var content = document.getElementById('finished-content');
        var icon    = document.getElementById('finished-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }

    async function handleInvite(action, gameId) {
        var fd = new FormData();
        fd.append('action', action);
        fd.append('game_id', gameId);
        var r = await fetch('api.php', { method: 'POST', body: fd });
        var d = await r.json();
        if (d.success) {
            if (action === 'accept_game') {
                window.location.href = 'game.php?id=' + gameId;
            } else {
                window.location.reload();
            }
        }
    }

    (function() {
        var lastMoveId = <?= $initialLastMoveId ?>;
        setInterval(async function() {
            try {
                var r = await fetch('api.php?action=check_updates');
                var d = await r.json();
                if (d.success && d.last_move_id !== lastMoveId) {
                    window.location.reload();
                }
            } catch (e) {}
        }, 5000);
    })();
</script>
<script>window.LEXIKA_VERSION = "<?= ASSET_VERSION ?>";</script>
<script src="version-check.js?v=<?= ASSET_VERSION ?>"></script>
</body>
</html>
