<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/db.php';

$slug = trim($_GET['slug'] ?? '');
if (!$slug) {
    header('Location: ' . BASE . '/collections.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM collections WHERE slug = ?");
$stmt->execute([$slug]);
$col = $stmt->fetch();

if (!$col) {
    http_response_code(404);
    $pageTitle = 'Collection introuvable';
    require_once __DIR__ . '/includes/header.php';
    echo '<div class="container py-5 text-center"><h1>Collection introuvable</h1><a href="' . BASE . '/collections.php" class="btn btn-primary mt-3">Voir toutes les collections</a></div>';
    require_once __DIR__ . '/includes/footer.php';
    exit;
}

// Livres de la collection
$stmt = $pdo->prepare(
    "SELECT l.*, a.prenom, a.nom, a.slug AS auteur_slug
     FROM livres l
     JOIN auteurs a ON a.id = l.auteur_id
     WHERE l.collection_id = ? AND l.statut IN ('publie','a_paraitre')
     ORDER BY l.date_parution DESC, l.ordre"
);
$stmt->execute([$col['id']]);
$livres = $stmt->fetchAll();

$pageTitle = e($col['nom']);
$pageDesc  = e($col['description']);
require_once __DIR__ . '/includes/header.php';
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item"><a href="<?= BASE ?>/collections.php">Collections</a></li>
      <li class="breadcrumb-item active"><?= e($col['nom']) ?></li>
    </ol>
  </nav>

  <!-- En-tête collection -->
  <div class="mb-5">
    <div class="d-flex align-items-center gap-3 mb-2">
      <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:<?= e($col['couleur']) ?>"></span>
      <h1 class="mb-0" style="color:<?= e($col['couleur']) ?>"><?= e($col['nom']) ?></h1>
    </div>
    <p class="text-secondary" style="font-size:1.05rem;max-width:640px"><?= e($col['description']) ?></p>
    <p style="font-size:.875rem;color:var(--text-muted)">
      <?= count($livres) ?> titre<?= count($livres) > 1 ? 's' : '' ?> dans cette collection
    </p>
  </div>

  <!-- Grille livres -->
  <?php if ($livres): ?>
  <div class="row g-4">
    <?php foreach ($livres as $livre): ?>
    <div class="col-6 col-md-4 col-lg-3">
      <a href="<?= BASE ?>/livre.php?slug=<?= e($livre['slug']) ?>" class="text-decoration-none">
        <div class="book-card">
          <div class="book-card-cover">
            <?php if ($livre['couverture']): ?>
              <img src="<?= BASE ?>/assets/img/<?= e($livre['couverture']) ?>"
                   alt="<?= e($livre['titre']) ?>">
            <?php else: ?>
              <div class="book-card-cover-placeholder">
                <?= e($livre['titre']) ?>
              </div>
            <?php endif; ?>
          </div>
          <div class="book-card-body">
            <?php if ($livre['statut'] === 'a_paraitre'): ?>
              <span class="badge-a-paraitre">À paraître</span>
            <?php endif; ?>
            <h3 class="book-card-title"><?= e($livre['titre']) ?></h3>
            <p class="book-card-author"><?= e($livre['prenom'] . ' ' . $livre['nom']) ?></p>
            <?php if ($livre['prix_papier']): ?>
              <p class="mb-0" style="font-size:.85rem;font-weight:600;color:var(--blue47)">
                <?= number_format($livre['prix_papier'], 2, ',', '') ?> €
              </p>
            <?php endif; ?>
          </div>
        </div>
      </a>
    </div>
    <?php endforeach; ?>
  </div>
  <?php else: ?>
  <p class="text-secondary">Aucun titre disponible pour l'instant dans cette collection.</p>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
