<?php
// login.php — Page d'authentification admin (pas de require_admin ici)
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/config.php';

// Déjà connecté → dashboard
if (!empty($_SESSION['admin_logged_in'])) {
    redirect(BASE . '/admin/dashboard.php');
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim($_POST['user'] ?? '');
    $pass = $_POST['pass'] ?? '';

    if (
        hash_equals(ADMIN_USER, $user) &&
        password_verify($pass, ADMIN_PASS)
    ) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        redirect(BASE . '/admin/dashboard.php');
    } else {
        // Temporisation anti-brute-force
        sleep(1);
        $error = 'Identifiants incorrects.';
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion — Bleu 47 Admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    body { background: #0f2d56; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; }
    .login-card { background: #fff; border-radius: 12px; padding: 2.5rem; width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    .login-brand { font-family: 'Playfair Display', Georgia, serif; font-size: 2rem; font-weight: 700; color: #1a4a8a; letter-spacing: -.02em; }
    .login-brand span { color: #2563c4; }
    .login-label { font-size: .68rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .35rem; display: block; }
    .form-control:focus { border-color: #1a4a8a; box-shadow: 0 0 0 .2rem rgba(26,74,138,.15); }
    .btn-login { background: #1a4a8a; border-color: #1a4a8a; font-weight: 600; }
    .btn-login:hover { background: #2563c4; border-color: #2563c4; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="text-center mb-4">
      <div class="login-brand">bleu<span>47</span></div>
      <p style="font-size:.75rem;color:#9ca3af;margin-top:.25rem;letter-spacing:.04em;text-transform:uppercase">
        Administration
      </p>
    </div>

    <?php if ($error): ?>
    <div class="alert alert-danger py-2 px-3 mb-3" style="font-size:.875rem">
      <?= e($error) ?>
    </div>
    <?php endif; ?>

    <form method="post" action="<?= BASE ?>/admin/login.php" autocomplete="off">
      <div class="mb-3">
        <label for="user" class="login-label">Identifiant</label>
        <input type="text" id="user" name="user" class="form-control"
               autocomplete="username" required autofocus>
      </div>
      <div class="mb-4">
        <label for="pass" class="login-label">Mot de passe</label>
        <input type="password" id="pass" name="pass" class="form-control"
               autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn-primary btn-login w-100">
        Se connecter
      </button>
    </form>

    <p class="text-center mt-3 mb-0">
      <a href="<?= BASE ?>/" style="font-size:.8rem;color:#9ca3af">← Retour au site</a>
    </p>
  </div>
</body>
</html>
