<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

adminSessionStart();

// Déjà connecté en tant qu'admin
if (!empty($_SESSION['admin_auth'])) {
    header('Location: ' . BASE_URL . '/admin.php');
    exit;
}

// Déconnexion
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: ' . BASE_URL . '/admin_login.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login    = trim($_POST['login']    ?? '');
    $password = trim($_POST['password'] ?? '');

    if ($login === ADMIN_LOGIN && password_verify($password, ADMIN_PASSWORD_HASH)) {
        session_regenerate_id(true);
        $_SESSION['admin_auth'] = true;
        header('Location: ' . BASE_URL . '/admin.php');
        exit;
    }

    $error = 'Identifiant ou mot de passe incorrect.';
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexika – Admin</title>
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
            <h1 class="login-title">Administration</h1>

            <?php if ($error): ?>
                <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <form method="post" action="admin_login.php" class="login-form" novalidate>
                <div class="form-group">
                    <label for="login">Identifiant admin</label>
                    <input
                        type="text"
                        id="login"
                        name="login"
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
                <button type="submit" class="btn btn-primary btn-full">Accéder</button>
            </form>
        </div>
    </div>
</body>
</html>
