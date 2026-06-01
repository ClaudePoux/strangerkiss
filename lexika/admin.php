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

    // Delete user
    if ($postAction === 'delete_user') {
        $delId = (int)($_POST['del_id'] ?? 0);
        if ($delId > 0) {
            $pdo->prepare('DELETE FROM lxk_users WHERE id=?')->execute([$delId]);
            $success = 'Joueur supprimé.';
        }
    }
}

// ── Load data ─────────────────────────────────────────────────────────────
$users = $pdo->query(
    'SELECT id, login, prenom, role, created_at FROM lxk_users ORDER BY created_at DESC'
)->fetchAll();

$statusFilter = $_GET['status'] ?? 'all';
$gameSql = 'SELECT g.id, g.status, g.created_at, g.finished_at,
                   u1.prenom AS p1_prenom, u2.prenom AS p2_prenom,
                   gp1.score AS p1_score, gp2.score AS p2_score,
                   uw.prenom AS winner_prenom
            FROM lxk_games g
            JOIN lxk_users u1 ON u1.id = g.player1_id
            JOIN lxk_users u2 ON u2.id = g.player2_id
            JOIN lxk_game_players gp1 ON gp1.game_id = g.id AND gp1.user_id = g.player1_id
            JOIN lxk_game_players gp2 ON gp2.game_id = g.id AND gp2.user_id = g.player2_id
            LEFT JOIN lxk_users uw ON uw.id = g.winner_id';
if ($statusFilter !== 'all') {
    $gameSql .= ' WHERE g.status = ' . $pdo->quote($statusFilter);
}
$gameSql .= ' ORDER BY g.id DESC LIMIT 100';
$games = $pdo->query($gameSql)->fetchAll();

$logs = $pdo->query(
    'SELECT gm.id, gm.game_id, u.prenom AS player, gm.move_type, gm.word, gm.score, gm.created_at
     FROM lxk_game_moves gm
     JOIN lxk_users u ON u.id = gm.user_id
     ORDER BY gm.id DESC
     LIMIT 50'
)->fetchAll();

$activeTab = $_GET['tab'] ?? 'users';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Administration</title>
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
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
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

    </main>

    <script>
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
