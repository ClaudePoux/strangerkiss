<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';

sessionStart();

// Already logged in (session active ou cookie remember-me valide)
if (!empty($_SESSION['user_id']) || checkRememberToken()) {
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
                setRememberToken((int)$user['id']);
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
    <link rel="stylesheet" href="style.css?v=<?= ASSET_VERSION ?>">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <style>
    .lx-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin-bottom: 24px;
    }
    .lx-tile {
        position: relative;
        width: 46px;
        height: 50px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
        flex-shrink: 0;
        box-shadow: 0 3px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.28);
    }
    .lx-pts {
        position: absolute;
        bottom: 3px;
        right: 4px;
        font-family: system-ui, sans-serif;
        font-size: 8px;
        font-weight: 700;
        opacity: 0.55;
        line-height: 1;
    }
    .lx-L { background: #f5ead8; color: #2b1f10; transform: rotate(-4deg); }
    .lx-E { background: #cc2200; color: #fff;    transform: rotate( 3deg); }
    .lx-X { background: #f5ead8; color: #2b1f10; transform: rotate(-5deg); }
    .lx-I { background: #1a3a6b; color: #fff;    transform: rotate( 4deg); }
    .lx-K { background: #cc2200; color: #fff;    transform: rotate(-3deg); }
    .lx-A { background: #e8770d; color: #fff;    transform: rotate( 5deg); }
    .lx-L .lx-pts, .lx-X .lx-pts { color: #2b1f10; }
    </style>
    <link rel="manifest" href="/lexika/manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Lexika">
    <link rel="apple-touch-icon" href="/lexika/icons/icon-180.png">
    <meta name="theme-color" content="#1a3a5c">
    <meta name="mobile-web-app-capable" content="yes">
</head>
<body class="login-body">
    <div class="login-container">
        <div class="login-card">
            <div class="lx-logo">
                <div class="lx-tile lx-L">L<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-E">E<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-X">X<span class="lx-pts">10</span></div>
                <div class="lx-tile lx-I">I<span class="lx-pts">1</span></div>
                <div class="lx-tile lx-K">K<span class="lx-pts">10</span></div>
                <div class="lx-tile lx-A">A<span class="lx-pts">1</span></div>
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
<script>window.LEXIKA_VERSION = "<?= ASSET_VERSION ?>";</script>
<script src="version-check.js?v=<?= ASSET_VERSION ?>"></script>
</body>
</html>
