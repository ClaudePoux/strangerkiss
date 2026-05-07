<?php
// ============================================================
// includes/header.php — En-tête HTML du site public
// Définir $pageTitle et $pageDesc avant l'include
// ============================================================

require_once __DIR__ . '/functions.php';
require_once __DIR__ . '/db.php';

$currentPage = basename($_SERVER['PHP_SELF'], '.php');

function nav_active(string $page): string
{
    global $currentPage;
    return ($currentPage === $page) ? ' active' : '';
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($pageTitle ?? 'Éditions Bleu 47') ?> — Bleu 47</title>
  <meta name="description" content="<?= e($pageDesc ?? 'Maison d\'édition indépendante en Bourgogne-Franche-Comté. Collections Adrénaline, Fictions et BD / Romans graphiques.') ?>">
  <meta name="robots" content="index, follow">
  <!-- Bootstrap 5 -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <!-- Style personnalisé -->
  <link rel="stylesheet" href="<?= BASE ?>/assets/css/style.css">
</head>
<body>

<header class="site-header" id="site-header">
  <nav class="navbar navbar-expand-lg">
    <div class="container">
      <a class="navbar-brand" href="<?= BASE ?>/">
        <span class="brand-logo">bleu<span class="brand-num">47</span></span>
        <span class="brand-tagline">Couleur primaire, nombre premier</span>
      </a>
      <button class="navbar-toggler" type="button"
              data-bs-toggle="collapse" data-bs-target="#mainNav"
              aria-controls="mainNav" aria-expanded="false" aria-label="Menu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="mainNav">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li class="nav-item"><a class="nav-link<?= nav_active('index') ?>" href="<?= BASE ?>/">Accueil</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('la-maison') ?>" href="<?= BASE ?>/la-maison.php">La maison</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('collections') ?>" href="<?= BASE ?>/collections.php">Collections</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('catalogue') ?>" href="<?= BASE ?>/catalogue.php">Catalogue</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('auteurs') ?>" href="<?= BASE ?>/auteurs.php">Auteurs</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('actus') ?>" href="<?= BASE ?>/actus.php">Actus</a></li>
          <li class="nav-item"><a class="nav-link<?= nav_active('contact') ?>" href="<?= BASE ?>/contact.php">Contact</a></li>
          <li class="nav-item ms-lg-2">
            <span class="btn btn-outline-primary btn-sm disabled" title="Boutique bientôt disponible" aria-disabled="true">Commander →</span>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</header>
