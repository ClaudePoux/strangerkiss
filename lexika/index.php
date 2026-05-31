<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
requireLogin();

$user = currentUser();
$pdo  = getDB();
$uid  = (int)$user['id'];

// ── Handle new game POST ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'new_game') {
    $p2id = (int)($_POST['player2_id'] ?? 0);
    if ($p2id > 0 && $p2id !== $uid) {
        // Verify opponent exists
        $st = $pdo->prepare('SELECT id FROM users WHERE id = ?');
        $st->execute([$p2id]);
        if ($st->fetch()) {
            $bag = makeBag();
            $p1Rack = drawTiles($bag, 7);
            $p2Rack = drawTiles($bag, 7);

            $pdo->beginTransaction();
            try {
                $ins = $pdo->prepare(
                    'INSERT INTO games (player1_id, player2_id, board, bag, status, current_turn) VALUES (?,?,?,?,\'playing\',?)'
                );
                $ins->execute([$uid, $p2id, json_encode((object)[]), json_encode($bag), $uid]);
                $gid = (int)$pdo->lastInsertId();

                $gp = $pdo->prepare('INSERT INTO game_players (game_id, user_id, rack, score) VALUES (?,?,?,0)');
                $gp->execute([$gid, $uid, json_encode($p1Rack)]);
                $gp->execute([$gid, $p2id, json_encode($p2Rack)]);

                $pdo->commit();
                header('Location: game.php?id=' . $gid);
                exit;
            } catch (Exception $e) {
                $pdo->rollBack();
            }
        }
    }
}

// ── Fetch in-progress games ───────────────────────────────────────────────────
$stPlaying = $pdo->prepare(
    'SELECT g.id, g.current_turn,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM games g
     JOIN users u1 ON u1.id = g.player1_id
     JOIN users u2 ON u2.id = g.player2_id
     JOIN game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'playing\' AND (g.player1_id = :uid OR g.player2_id = :uid)
     ORDER BY g.id DESC'
);
$stPlaying->execute([':uid' => $uid]);
$playingGames = $stPlaying->fetchAll();

// ── Finished games (last 20) ─────────────────────────────────────────────────
$stFinished = $pdo->prepare(
    'SELECT g.id, g.finished_at, g.winner_id,
            u1.id AS p1_id, u1.prenom AS p1_prenom,
            u2.id AS p2_id, u2.prenom AS p2_prenom,
            gp1.score AS p1_score, gp2.score AS p2_score
     FROM games g
     JOIN users u1 ON u1.id = g.player1_id
     JOIN users u2 ON u2.id = g.player2_id
     JOIN game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
     JOIN game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
     WHERE g.status = \'finished\' AND (g.player1_id = :uid OR g.player2_id = :uid)
     ORDER BY g.finished_at DESC
     LIMIT 20'
);
$stFinished->execute([':uid' => $uid]);
$finishedGames = $stFinished->fetchAll();

// ── Personal stats ────────────────────────────────────────────────────────────
$stStats = $pdo->prepare(
    'SELECT
        COUNT(*) AS played,
        SUM(CASE WHEN winner_id = :uid THEN 1 ELSE 0 END) AS won
     FROM games
     WHERE status = \'finished\' AND (player1_id = :uid OR player2_id = :uid)'
);
$stStats->execute([':uid' => $uid]);
$stats = $stStats->fetch();
$played = (int)($stats['played'] ?? 0);
$won    = (int)($stats['won']    ?? 0);
$lost   = $played - $won;

// Average score
$stAvg = $pdo->prepare(
    'SELECT AVG(gp.score) AS avg_score
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.user_id = ? AND g.status = \'finished\''
);
$stAvg->execute([$uid]);
$avgRow   = $stAvg->fetch();
$avgScore = $avgRow ? round((float)($avgRow['avg_score'] ?? 0)) : 0;

// Best single move (highest scoring play)
$stBest = $pdo->prepare(
    'SELECT word, score FROM game_moves WHERE user_id = ? AND move_type = \'play\' ORDER BY score DESC LIMIT 1'
);
$stBest->execute([$uid]);
$bestMove = $stBest->fetch();

// ── Opponents list ────────────────────────────────────────────────────────────
$stOpponents = $pdo->prepare('SELECT id, login, prenom FROM users WHERE id != ? ORDER BY prenom, login');
$stOpponents->execute([$uid]);
$opponents = $stOpponents->fetchAll();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Accueil</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="site-header">
        <div class="header-inner">
            <h1 class="site-logo">
                <span class="logo-tile sm">L</span>
                <span class="logo-tile sm">E</span>
                <span class="logo-tile sm">X</span>
                <span class="logo-tile sm">I</span>
                <span class="logo-tile sm">K</span>
                <span class="logo-tile sm">A</span>
            </h1>
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
            <?php if (empty($opponents)): ?>
                <p class="text-secondary">Aucun autre joueur disponible.</p>
            <?php else: ?>
                <form method="post" action="index.php" class="new-game-form">
                    <input type="hidden" name="action" value="new_game">
                    <div class="form-row">
                        <label for="player2_id">Adversaire</label>
                        <select name="player2_id" id="player2_id" required>
                            <option value="">-- Choisir un joueur --</option>
                            <?php foreach ($opponents as $op): ?>
                                <option value="<?= $op['id'] ?>">
                                    <?= htmlspecialchars($op['prenom'] ?: $op['login']) ?>
                                    (<?= htmlspecialchars($op['login']) ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="btn btn-primary">Jouer</button>
                    </div>
                </form>
            <?php endif; ?>
        </section>

        <!-- In-Progress Games -->
        <section class="card">
            <h2 class="card-title">Parties en cours</h2>
            <?php if (empty($playingGames)): ?>
                <p class="text-secondary">Aucune partie en cours.</p>
            <?php else: ?>
                <div class="game-list">
                    <?php foreach ($playingGames as $g):
                        $isMyTurn  = ((int)$g['current_turn'] === $uid);
                        $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                        $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                        $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                    ?>
                    <a href="game.php?id=<?= $g['id'] ?>" class="game-row">
                        <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?></div>
                        <div class="game-row-scores">
                            <span class="score-mine"><?= $myScore ?></span>
                            <span class="score-sep">–</span>
                            <span class="score-opp"><?= $oppScore ?></span>
                        </div>
                        <div class="game-row-status">
                            <?php if ($isMyTurn): ?>
                                <span class="badge badge-turn">À toi de jouer</span>
                            <?php else: ?>
                                <span class="badge badge-wait">En attente</span>
                            <?php endif; ?>
                        </div>
                    </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>

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
                            $oppPrenom = ($g['p1_id'] == $uid) ? $g['p2_prenom'] : $g['p1_prenom'];
                            $myScore   = ($g['p1_id'] == $uid) ? $g['p1_score'] : $g['p2_score'];
                            $oppScore  = ($g['p1_id'] == $uid) ? $g['p2_score'] : $g['p1_score'];
                            $iWon      = ((int)$g['winner_id'] === $uid);
                            $dateStr   = $g['finished_at'] ? date('d/m/Y', strtotime($g['finished_at'])) : '–';
                        ?>
                        <div class="game-row finished-row">
                            <div class="game-row-date"><?= $dateStr ?></div>
                            <div class="game-row-opponent"><?= htmlspecialchars($oppPrenom) ?></div>
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
                    <div class="stat-value"><?= $won ?></div>
                    <div class="stat-label">Gagnées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $lost ?></div>
                    <div class="stat-label">Perdues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><?= $avgScore ?></div>
                    <div class="stat-label">Score moyen</div>
                </div>
                <div class="stat-card stat-card-wide">
                    <div class="stat-value">
                        <?php if ($bestMove): ?>
                            <?= htmlspecialchars(strtoupper($bestMove['word'])) ?>
                            <span class="stat-sub">(<?= $bestMove['score'] ?> pts)</span>
                        <?php else: ?>
                            –
                        <?php endif; ?>
                    </div>
                    <div class="stat-label">Meilleur mot</div>
                </div>
            </div>
        </section>

    </main>

    <script>
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
    </script>
</body>
</html>
