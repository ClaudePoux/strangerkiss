<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

requireAdminSession(); // session lexika_admin_session, indépendante de la session joueur

$pdo   = getDB();
$error = '';
$success = '';

// ── Handle POST actions ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $postAction = $_POST['post_action'] ?? '';

    // Add new player
    if ($postAction === 'add_user') {
        $login    = trim($_POST['login']    ?? '');
        $prenom   = trim($_POST['prenom']   ?? '');
        $password = trim($_POST['password'] ?? '');
        $role     = ($_POST['role'] ?? 'player') === 'admin' ? 'admin' : 'player';

        if ($login === '' || $password === '') {
            $error = 'Identifiant et mot de passe obligatoires.';
        } else {
            try {
                $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $st   = $pdo->prepare(
                    'INSERT INTO lxk_users (login, prenom, password, role) VALUES (?,?,?,?)'
                );
                $st->execute([$login, $prenom, $hash, $role]);
                $success = 'Joueur créé avec succès.';
            } catch (PDOException $e) {
                $error = (str_contains($e->getMessage(), 'Duplicate'))
                    ? 'Cet identifiant est déjà utilisé.'
                    : 'Erreur lors de la création : ' . $e->getMessage();
            }
        }
    }

    // Edit user
    if ($postAction === 'edit_user') {
        $editId   = (int)($_POST['edit_id'] ?? 0);
        $prenom   = trim($_POST['prenom']   ?? '');
        $role     = ($_POST['role'] ?? 'player') === 'admin' ? 'admin' : 'player';
        $password = trim($_POST['password'] ?? '');

        if ($editId > 0) {
            if ($password !== '') {
                $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $st   = $pdo->prepare('UPDATE lxk_users SET prenom=?, role=?, password=? WHERE id=?');
                $st->execute([$prenom, $role, $hash, $editId]);
            } else {
                $st = $pdo->prepare('UPDATE lxk_users SET prenom=?, role=? WHERE id=?');
                $st->execute([$prenom, $role, $editId]);
            }
            $success = 'Joueur mis à jour.';
        }
    }

    // Change password
    if ($postAction === 'change_password') {
        $targetId = (int)($_POST['target_id'] ?? 0);
        $password = trim($_POST['new_password'] ?? '');
        if ($targetId > 0 && $password !== '') {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $pdo->prepare('UPDATE lxk_users SET password=? WHERE id=?')->execute([$hash, $targetId]);
            $success = 'Mot de passe mis à jour.';
        } else {
            $error = 'Mot de passe vide.';
        }
    }

    // Delete user
    if ($postAction === 'delete_user') {
        $delId = (int)($_POST['del_id'] ?? 0);
        if ($delId > 0) {
            $pdo->prepare('DELETE FROM lxk_users WHERE id=?')->execute([$delId]);
            $success = 'Joueur supprimé.';
        }
    }

    // Delete game
    if ($postAction === 'delete_game') {
        $delId = (int)($_POST['del_id'] ?? 0);
        if ($delId > 0) {
            $pdo->prepare('DELETE FROM lxk_game_moves   WHERE game_id=?')->execute([$delId]);
            $pdo->prepare('DELETE FROM lxk_game_players WHERE game_id=?')->execute([$delId]);
            $pdo->prepare('DELETE FROM lxk_games        WHERE id=?'     )->execute([$delId]);
            $success = 'Partie #' . $delId . ' supprimée.';
        }
    }

    // Validate game (force pending_review -> finished, bypass current_turn check)
    if ($postAction === 'validate_game') {
        $valId = (int)($_POST['game_id'] ?? 0);
        if ($valId > 0) {
            $stmt = $pdo->prepare("UPDATE lxk_games SET status='finished' WHERE id=? AND status='pending_review'");
            $stmt->execute([$valId]);
            if ($stmt->rowCount() > 0) {
                $success = 'Partie #' . $valId . ' validée et marquée comme terminée.';
            }
        }
    }
}

// ── Load data ─────────────────────────────────────────────────────────────
$users = $pdo->query(
    'SELECT id, login, prenom, role, created_at FROM lxk_users ORDER BY created_at DESC'
)->fetchAll();

$statusFilter = $_GET['status'] ?? 'all';
$gamesPerPage = 50;
$page         = max(1, (int)($_GET['page'] ?? 1));

$whereClause = '';
if ($statusFilter !== 'all') {
    $whereClause = ' WHERE g.status = ' . $pdo->quote($statusFilter);
}

// Total pour la pagination, sur le même filtre de statut
$totalGames = (int)$pdo->query('SELECT COUNT(*) FROM lxk_games g' . $whereClause)->fetchColumn();
$totalPages = max(1, (int)ceil($totalGames / $gamesPerPage));
$page       = min($page, $totalPages); // clamp si ?page= hors bornes
$offset     = ($page - 1) * $gamesPerPage;

$gameSql = 'SELECT g.id, g.status, g.created_at, g.finished_at,
                   u1.prenom AS p1_prenom, u2.prenom AS p2_prenom,
                   gp1.score AS p1_score, gp2.score AS p2_score,
                   uw.prenom AS winner_prenom
            FROM lxk_games g
            JOIN lxk_users u1 ON u1.id = g.player1_id
            JOIN lxk_users u2 ON u2.id = g.player2_id
            JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
            JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
            LEFT JOIN lxk_users uw ON uw.id = g.winner_id'
           . $whereClause
           . ' ORDER BY g.id DESC LIMIT ' . $gamesPerPage . ' OFFSET ' . $offset;
$games = $pdo->query($gameSql)->fetchAll();

$logs = $pdo->query(
    'SELECT gm.id, gm.game_id, u.prenom AS player, gm.move_type, gm.word, gm.score, gm.created_at
     FROM lxk_game_moves gm
     JOIN lxk_users u ON u.id = gm.user_id
     ORDER BY gm.id DESC
     LIMIT 50'
)->fetchAll();

$playerStats = $pdo->query(
    'SELECT u.prenom,
            COALESCE(s.games_played, 0) AS games_played,
            COALESCE(s.cumul_score,  0) AS cumul_score,
            u.total_moves,
            CASE WHEN u.total_moves > 0
                 THEN ROUND(u.total_points / u.total_moves)
                 ELSE NULL END AS score_indiv
     FROM lxk_users u
     LEFT JOIN (
         SELECT gp.user_id,
                COUNT(gp.game_id) AS games_played,
                SUM(gp.score)     AS cumul_score
         FROM lxk_game_players gp
         JOIN lxk_games g ON g.id = gp.game_id
         WHERE g.status IN (\'finished\', \'abandoned\')
         GROUP BY gp.user_id
     ) s ON s.user_id = u.id
     WHERE u.role != \'admin\'
     ORDER BY score_indiv DESC, games_played DESC'
)->fetchAll();

$topLexika = $pdo->query(
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

// ── TPM (Tirage Pondéré Moyen) ───────────────────────────────────────────────
// Pondération par lettre (pas la valeur Scrabble officielle). Joker exclu du calcul.
$tpmLetterWeights = [
    'A' => 6, 'E' => 6, 'S' => 6, 'T' => 6, 'R' => 6,
    'I' => 5, 'O' => 5,
    'D' => 4, 'B' => 4, 'C' => 4, 'N' => 4, 'L' => 4,
    'P' => 3, 'M' => 3, 'X' => 3, 'Z' => 3, 'H' => 3,
    'V' => 2, 'J' => 2, 'G' => 2, 'Q' => 2, 'U' => 2, 'F' => 2,
    'W' => 1, 'Y' => 1, 'K' => 1,
];

$drawRows = $pdo->query(
    'SELECT d.user_id, u.prenom, d.tiles
     FROM lxk_draws d
     JOIN lxk_users u ON u.id = d.user_id
     WHERE u.role != \'admin\''
)->fetchAll();

$tpmAgg = [];
foreach ($drawRows as $row) {
    $tiles = json_decode($row['tiles'], true) ?: [];
    $rowUid = (int)$row['user_id'];
    if (!isset($tpmAgg[$rowUid])) {
        $tpmAgg[$rowUid] = ['prenom' => $row['prenom'], 'sum' => 0, 'count' => 0];
    }
    foreach ($tiles as $t) {
        if (!empty($t['is_joker'])) continue;
        $letter = strtoupper($t['letter'] ?? '');
        if (!isset($tpmLetterWeights[$letter])) continue;
        $tpmAgg[$rowUid]['sum']   += $tpmLetterWeights[$letter];
        $tpmAgg[$rowUid]['count']++;
    }
}

$tpmStats = [];
foreach ($tpmAgg as $agg) {
    if ($agg['count'] === 0) continue;
    $tpmStats[] = [
        'prenom' => $agg['prenom'],
        'count'  => $agg['count'],
        'tpm'    => round($agg['sum'] / $agg['count'], 2),
    ];
}
usort($tpmStats, fn($a, $b) => $b['tpm'] <=> $a['tpm']);

$activeTab = $_GET['tab'] ?? 'users';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Administration</title>
    <link rel="stylesheet" href="style.css?v=<?= ASSET_VERSION ?>">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
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
                <span class="admin-badge">Admin</span>
            </h1>
            <nav class="header-nav">
                <a href="admin_login.php?logout" class="nav-link">Déconnexion</a>
            </nav>
        </div>
    </header>

    <main class="main-content">

        <?php if ($error): ?>
            <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <?php if ($success): ?>
            <div class="alert alert-success"><?= htmlspecialchars($success) ?></div>
        <?php endif; ?>

        <!-- Tabs -->
        <div class="tabs">
            <a href="admin.php?tab=users"  class="tab <?= $activeTab === 'users'  ? 'tab-active' : '' ?>">Joueurs</a>
            <a href="admin.php?tab=games"  class="tab <?= $activeTab === 'games'  ? 'tab-active' : '' ?>">Parties</a>
            <a href="admin.php?tab=logs"   class="tab <?= $activeTab === 'logs'   ? 'tab-active' : '' ?>">Journaux</a>
            <a href="admin.php?tab=stats"  class="tab <?= $activeTab === 'stats'  ? 'tab-active' : '' ?>">Statistiques joueurs</a>
            <a href="admin.php?tab=lexika" class="tab <?= $activeTab === 'lexika' ? 'tab-active' : '' ?>">Top 10 Lexika</a>
            <a href="admin.php?tab=tpm"    class="tab <?= $activeTab === 'tpm'    ? 'tab-active' : '' ?>">Tirage Pondéré Moyen</a>
        </div>

        <!-- USERS TAB -->
        <?php if ($activeTab === 'users'): ?>
        <section class="card">
            <h2 class="card-title">Joueurs (<?= count($users) ?>)</h2>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Identifiant</th>
                            <th>Prénom</th>
                            <th>Rôle</th>
                            <th>Créé le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $u): ?>
                        <tr>
                            <td><?= $u['id'] ?></td>
                            <td><?= htmlspecialchars($u['login']) ?></td>
                            <td><?= htmlspecialchars($u['prenom']) ?></td>
                            <td>
                                <span class="badge <?= $u['role'] === 'admin' ? 'badge-admin' : 'badge-player' ?>">
                                    <?= $u['role'] ?>
                                </span>
                            </td>
                            <td><?= date('d/m/Y', strtotime($u['created_at'])) ?></td>
                            <td class="actions-cell">
                                <button class="btn btn-sm btn-secondary"
                                    onclick="openEditModal(<?= $u['id'] ?>, '<?= htmlspecialchars(addslashes($u['prenom'])) ?>', '<?= $u['role'] ?>')">
                                    Éditer
                                </button>
                                <button class="btn btn-sm btn-secondary"
                                    onclick="openPwdModal(<?= $u['id'] ?>, '<?= htmlspecialchars(addslashes($u['prenom'])) ?>')">
                                    Mot de passe
                                </button>
                                <form method="post" style="display:inline"
                                      onsubmit="return confirm('Supprimer ce joueur ?')">
                                    <input type="hidden" name="post_action" value="delete_user">
                                    <input type="hidden" name="del_id" value="<?= $u['id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">Supprimer</button>
                                </form>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Add User Form -->
        <section class="card">
            <h2 class="card-title">Nouveau joueur</h2>
            <form method="post" action="admin.php?tab=users" class="admin-form">
                <input type="hidden" name="post_action" value="add_user">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Identifiant *</label>
                        <input type="text" name="login" required>
                    </div>
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" name="prenom">
                    </div>
                    <div class="form-group">
                        <label>Mot de passe *</label>
                        <input type="password" name="password" required>
                    </div>
                    <div class="form-group">
                        <label>Rôle</label>
                        <select name="role">
                            <option value="player">Joueur</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Créer</button>
            </form>
        </section>

        <!-- Change Password Modal -->
        <div id="pwd-modal" class="modal" style="display:none">
            <div class="modal-content">
                <h3>Changer le mot de passe — <span id="pwd-modal-name"></span></h3>
                <form method="post" action="admin.php?tab=users" class="admin-form">
                    <input type="hidden" name="post_action" value="change_password">
                    <input type="hidden" name="target_id" id="pwd-target-id">
                    <div class="form-group">
                        <label>Nouveau mot de passe *</label>
                        <input type="password" name="new_password" id="pwd-new-password" required>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Valider</button>
                        <button type="button" class="btn btn-secondary" onclick="closePwdModal()">Annuler</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Edit User Modal -->
        <div id="edit-user-modal" class="modal" style="display:none">
            <div class="modal-content">
                <h3>Modifier le joueur</h3>
                <form method="post" action="admin.php?tab=users" class="admin-form">
                    <input type="hidden" name="post_action" value="edit_user">
                    <input type="hidden" name="edit_id" id="edit-user-id">
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" name="prenom" id="edit-user-prenom">
                    </div>
                    <div class="form-group">
                        <label>Rôle</label>
                        <select name="role" id="edit-user-role">
                            <option value="player">Joueur</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
                        <input type="password" name="password">
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Enregistrer</button>
                        <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Annuler</button>
                    </div>
                </form>
            </div>
        </div>
        <?php endif; ?>

        <!-- GAMES TAB -->
        <?php if ($activeTab === 'games'): ?>
        <section class="card">
            <h2 class="card-title">Parties</h2>
            <div class="filter-bar">
                <strong>Filtrer :</strong>
                <a href="admin.php?tab=games&status=all"      class="btn btn-sm <?= $statusFilter==='all'      ? 'btn-primary':'btn-secondary' ?>">Toutes</a>
                <a href="admin.php?tab=games&status=playing"  class="btn btn-sm <?= $statusFilter==='playing'  ? 'btn-primary':'btn-secondary' ?>">En cours</a>
                <a href="admin.php?tab=games&status=finished" class="btn btn-sm <?= $statusFilter==='finished' ? 'btn-primary':'btn-secondary' ?>">Terminées</a>
                <a href="admin.php?tab=games&status=waiting"  class="btn btn-sm <?= $statusFilter==='waiting'  ? 'btn-primary':'btn-secondary' ?>">En attente</a>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Joueur 1</th>
                            <th>Joueur 2</th>
                            <th>Statut</th>
                            <th>Scores</th>
                            <th>Vainqueur</th>
                            <th>Créé le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($games as $g): ?>
                        <tr>
                            <td><?= $g['id'] ?></td>
                            <td><?= htmlspecialchars($g['p1_prenom']) ?></td>
                            <td><?= htmlspecialchars($g['p2_prenom']) ?></td>
                            <td>
                                <span class="badge badge-<?= $g['status'] ?>"><?= $g['status'] ?></span>
                            </td>
                            <td><?= $g['p1_score'] ?> – <?= $g['p2_score'] ?></td>
                            <td><?= $g['winner_prenom'] ? htmlspecialchars($g['winner_prenom']) : '–' ?></td>
                            <td><?= date('d/m/Y', strtotime($g['created_at'])) ?></td>
                            <td class="actions-cell">
                                <?php if ($g['status'] === 'pending_review'): ?>
                                <form method="post" style="display:inline"
                                      onsubmit="return confirm('Valider et terminer la partie #<?= $g['id'] ?> ?')">
                                    <input type="hidden" name="post_action" value="validate_game">
                                    <input type="hidden" name="game_id" value="<?= $g['id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-primary">Valider</button>
                                </form>
                                <?php endif; ?>
                                <form method="post" style="display:inline"
                                      onsubmit="return confirm('Supprimer la partie #<?= $g['id'] ?> et tous ses coups ?')">
                                    <input type="hidden" name="post_action" value="delete_game">
                                    <input type="hidden" name="del_id" value="<?= $g['id'] ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">Supprimer</button>
                                </form>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php if ($totalPages > 1): ?>
            <div class="filter-bar" style="margin-top:0.9rem;margin-bottom:0">
                <?php if ($page > 1): ?>
                <a href="admin.php?tab=games&status=<?= urlencode($statusFilter) ?>&page=<?= $page - 1 ?>" class="btn btn-sm btn-secondary">&laquo; Précédent</a>
                <?php else: ?>
                <span class="btn btn-sm btn-secondary" style="opacity:.45;pointer-events:none">&laquo; Précédent</span>
                <?php endif; ?>

                <span>Page <?= $page ?> / <?= $totalPages ?> (<?= $totalGames ?> parties)</span>

                <?php if ($page < $totalPages): ?>
                <a href="admin.php?tab=games&status=<?= urlencode($statusFilter) ?>&page=<?= $page + 1 ?>" class="btn btn-sm btn-secondary">Suivant &raquo;</a>
                <?php else: ?>
                <span class="btn btn-sm btn-secondary" style="opacity:.45;pointer-events:none">Suivant &raquo;</span>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </section>
        <?php endif; ?>

        <!-- LOGS TAB -->
        <?php if ($activeTab === 'logs'): ?>
        <section class="card">
            <h2 class="card-title">Derniers coups (50)</h2>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Partie</th>
                            <th>Joueur</th>
                            <th>Type</th>
                            <th>Mot</th>
                            <th>Points</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><a href="game.php?id=<?= $log['game_id'] ?>">#<?= $log['game_id'] ?></a></td>
                            <td><?= htmlspecialchars($log['player']) ?></td>
                            <td>
                                <span class="badge badge-movetype badge-<?= $log['move_type'] ?>"><?= $log['move_type'] ?></span>
                            </td>
                            <td><?= $log['word'] ? htmlspecialchars(strtoupper($log['word'])) : '–' ?></td>
                            <td><?= $log['score'] ?></td>
                            <td><?= date('d/m/Y H:i', strtotime($log['created_at'])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>
        <?php endif; ?>

        <!-- STATS TAB -->
        <?php if ($activeTab === 'stats'): ?>
        <section class="card">
            <h2 class="card-title">Statistiques joueurs</h2>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Prénom</th>
                            <th>Parties jouées</th>
                            <th>Points cumulés</th>
                            <th>Coups cumulés</th>
                            <th>Score Individuel</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($playerStats as $ps): ?>
                        <tr>
                            <td><?= htmlspecialchars($ps['prenom']) ?></td>
                            <td><?= (int)$ps['games_played'] ?></td>
                            <td><?= (int)$ps['cumul_score'] ?></td>
                            <td><?= (int)$ps['total_moves'] ?></td>
                            <td><?= $ps['score_indiv'] !== null ? (int)$ps['score_indiv'] : '&mdash;' ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>
        <?php endif; ?>

        <!-- TOP LEXIKA TAB -->
        <?php if ($activeTab === 'lexika'): ?>
        <section class="card">
            <h2 class="card-title">Top 10 Lexika</h2>
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
                        <?php if (empty($topLexika)): ?>
                        <tr>
                            <td colspan="6" style="text-align:center;color:#888">Aucun Lexika enregistré.</td>
                        </tr>
                        <?php else: ?>
                        <?php foreach ($topLexika as $i => $lx): ?>
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
        </section>
        <?php endif; ?>

        <!-- TPM TAB -->
        <?php if ($activeTab === 'tpm'): ?>
        <section class="card">
            <h2 class="card-title">Tirage Pondéré Moyen (TPM)</h2>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Joueur</th>
                            <th>Lettres piochées</th>
                            <th>TPM</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($tpmStats)): ?>
                        <tr>
                            <td colspan="3" style="text-align:center;color:#888">Aucune donnée de tirage enregistrée.</td>
                        </tr>
                        <?php else: ?>
                        <?php foreach ($tpmStats as $tp): ?>
                        <tr>
                            <td><?= htmlspecialchars($tp['prenom']) ?></td>
                            <td><?= (int)$tp['count'] ?></td>
                            <td><?= number_format($tp['tpm'], 2, ',', '') ?></td>
                        </tr>
                        <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </section>
        <?php endif; ?>

    </main>

    <script>
    function openPwdModal(id, prenom) {
        document.getElementById('pwd-target-id').value  = id;
        document.getElementById('pwd-modal-name').textContent = prenom;
        document.getElementById('pwd-new-password').value = '';
        document.getElementById('pwd-modal').style.display = 'flex';
    }
    function closePwdModal() {
        document.getElementById('pwd-modal').style.display = 'none';
    }
    document.getElementById('pwd-modal').addEventListener('click', function(e) {
        if (e.target === this) closePwdModal();
    });

    function openEditModal(id, prenom, role) {
        document.getElementById('edit-user-id').value    = id;
        document.getElementById('edit-user-prenom').value = prenom;
        document.getElementById('edit-user-role').value  = role;
        document.getElementById('edit-user-modal').style.display = 'flex';
    }
    function closeEditModal() {
        document.getElementById('edit-user-modal').style.display = 'none';
    }
    // Close modal on outside click
    document.getElementById('edit-user-modal').addEventListener('click', function(e) {
        if (e.target === this) closeEditModal();
    });
    </script>
</body>
</html>
