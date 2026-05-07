<?php
// ============================================================
// includes/admin-header.php — En-tête HTML de l'espace admin
// Définir $adminTitle avant l'include
// ============================================================

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/db.php';
require_admin();

$currentAdminPage = basename($_SERVER['PHP_SELF'], '.php');

function admin_nav_active(string $prefix): string
{
    global $currentAdminPage;
    return str_starts_with($currentAdminPage, $prefix) ? 'active' : '';
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($adminTitle ?? 'Administration') ?> — Bleu 47 Admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= BASE ?>/assets/css/admin.css">
</head>
<body class="admin-body">

<!-- Barre supérieure -->
<nav class="admin-topbar">
  <div class="admin-topbar-inner">
    <a href="<?= BASE ?>/admin/dashboard.php" class="admin-brand">
      <span class="brand-logo-sm">bleu<span>47</span></span>
      <span class="admin-label">Admin</span>
    </a>
    <div class="admin-topbar-actions">
      <a href="<?= BASE ?>/" class="admin-site-link" target="_blank" rel="noopener">← Voir le site</a>
      <a href="<?= BASE ?>/admin/logout.php" class="admin-logout-btn">Déconnexion</a>
    </div>
  </div>
</nav>

<!-- Layout principal -->
<div class="admin-layout">

  <!-- Sidebar -->
  <aside class="admin-sidebar">
    <nav class="admin-sidenav">
      <ul>
        <li>
          <a href="<?= BASE ?>/admin/dashboard.php" class="<?= admin_nav_active('dashboard') ?>">
            <span class="nav-icon">◈</span> Dashboard
          </a>
        </li>
        <li class="nav-section-label">Catalogue</li>
        <li>
          <a href="<?= BASE ?>/admin/livres.php" class="<?= admin_nav_active('livre') ?>">
            <span class="nav-icon">📚</span> Livres
          </a>
        </li>
        <li>
          <a href="<?= BASE ?>/admin/auteurs.php" class="<?= admin_nav_active('auteur') ?>">
            <span class="nav-icon">✍</span> Auteurs
          </a>
        </li>
        <li>
          <a href="<?= BASE ?>/admin/collections.php" class="<?= admin_nav_active('collection') ?>">
            <span class="nav-icon">🗂</span> Collections
          </a>
        </li>
        <li class="nav-section-label">Contenu</li>
        <li>
          <a href="<?= BASE ?>/admin/actus.php" class="<?= admin_nav_active('actu') ?>">
            <span class="nav-icon">📰</span> Actualités
          </a>
        </li>
        <li>
          <a href="<?= BASE ?>/admin/revues.php" class="<?= admin_nav_active('revue') ?>">
            <span class="nav-icon">💬</span> Revues de presse
          </a>
        </li>
      </ul>
    </nav>
  </aside>

  <!-- Contenu principal -->
  <main class="admin-main">
    <?php
    $flash = get_flash();
    if ($flash):
        $alertClass = $flash['type'] === 'success' ? 'alert-success' : ($flash['type'] === 'error' ? 'alert-danger' : 'alert-info');
    ?>
    <div class="alert <?= $alertClass ?> alert-dismissible fade show mb-4" role="alert">
      <?= e($flash['message']) ?>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
    <?php endif; ?>
