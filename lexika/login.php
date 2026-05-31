<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

sessionStart();

// Already logged in
if (!empty($_SESSION['user_id'])) {
    header('Location: ' . BASE_URL . '/index.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login    = trim($_POST['login']    ?? '');
    $password = trim($_POST['password'] ?? '');

    if ($login === '' || $password === '') {
        $error = 'Veuillez remplir tous les champs.';
    } else {
        try {
            $pdo  = getDB();
            $stmt = $pdo->prepare('SELECT id, login, prenom, password, role FROM lxk_users WHERE login = ? LIMIT 1');
            $stmt->execute([$login]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password'])) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['login']   = $user['login'];
                $_SESSION['prenom']  = $user['prenom'];
                $_SESSION['role']    = $user['role'];
                if ($_SESSION['role'] === 'admin') {
                    header('Location: ' . BASE_URL . '/admin.php');
                } else {
                    header('Location: ' . BASE_URL . '/index.php');
                }
                exit;
            } else {
                $error = 'Identifiant ou mot de passe incorrect.';
            }
        } catch (PDOException $e) {
            $error = 'Erreur de base de données. Veuillez réessayer.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Connexion</title>
    <link rel="stylesheet" href="style.css">
</head>
<body class="login-body">
    <div class="login-container">
        <div class="login-card">
            <div class="login-logo">
                <span class="logo-tile">L</span>
                <span class="logo-tile">E</span>
                <span class="logo-tile">X</span>
                <span class="logo-tile">I</span>
                <span class="logo-tile">K</span>
                <span class="logo-tile">A</span>
            </div>
            <h1 class="login-title">Connexion</h1>

            <?php if ($error): ?>
                <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <form method="post" action="login.php" class="login-form" novalidate>
                <div class="form-group">
                    <label for="login">Identifiant</label>
                    <input
                        type="text"
                        id="login"
                        name="login"
                        value="<?= htmlspecialchars($_POST['login'] ?? '') ?>"
                        autocomplete="username"
                        required
                        autofocus
                    >
                </div>
                <div class="form-group">
                    <label for="password">Mot de passe</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        autocomplete="current-password"
                        required
                    >
                </div>
                <button type="submit" class="btn btn-primary btn-full">Se connecter</button>
            </form>
        </div>
    </div>
</body>
</html>
