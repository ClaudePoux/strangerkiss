<?php
$pageTitle = 'Collections';
$pageDesc  = 'Découvrez les trois collections des Éditions Bleu 47 : Adrénaline, Fictions, BD / Romans graphiques.';
require_once __DIR__ . '/includes/header.php';

$collections = $pdo->query(
    "SELECT c.*,
        (SELECT COUNT(*) FROM livres WHERE collection_id = c.id AND statut IN ('publie','a_paraitre')) AS nb_livres,
        (SELECT couverture FROM livres WHERE collection_id = c.id AND statut = 'publie' AND couverture IS NOT NULL ORDER BY date_parution DESC LIMIT 1) AS derniere_couverture
     FROM collections c
     ORDER BY c.ordre"
)->fetchAll();
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Collections</li>
    </ol>
  </nav>

  <h1 class="section-title mb-2">Collections</h1>
  <p class="section-subtitle">Trois univers éditoriaux, une même exigence littéraire.</p>

  <div class="row g-5">
    <?php foreach ($collections as $col): ?>
    <div class="col-lg-4">
      <a href="<?= BASE ?>/collection.php?slug=<?= e($col['slug']) ?>" class="collection-card text-decoration-none">
        <!-- Bande couleur -->
        <div class="collection-card-bar" style="background:<?= e($col['couleur']) ?>"></div>

        <!-- Image représentative -->
        <?php if ($col['derniere_couverture']): ?>
        <div style="height:200px;overflow:hidden;background:var(--bg-secondary)">
          <img src="<?= BASE ?>/assets/img/<?= e($col['derniere_couverture']) ?>"
               alt="<?= e($col['nom']) ?>"
               style="width:100%;height:100%;object-fit:cover;transition:transform .4s ease"
               class="collection-cover-img">
        </div>
        <?php else: ?>
        <div style="height:200px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center">
          <span style="font-size:3rem;color:<?= e($col['couleur']) ?>">📚</span>
        </div>
        <?php endif; ?>

        <div class="collection-card-body">
          <h2 class="collection-card-name" style="color:<?= e($col['couleur']) ?>">
            <?= e($col['nom']) ?>
          </h2>
          <p style="color:var(--text-secondary);font-size:.95rem;margin-bottom:1rem">
            <?= e($col['description']) ?>
          </p>
          <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1.25rem">
            <?= $col['nb_livres'] ?> titre<?= $col['nb_livres'] > 1 ? 's' : '' ?>
          </p>
          <span class="btn btn-sm" style="background:<?= e($col['couleur']) ?>;color:#fff;border-color:<?= e($col['couleur']) ?>">
            Voir la collection →
          </span>
        </div>
      </a>
    </div>
    <?php endforeach; ?>
  </div>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
