<?php
$pageTitle = 'Catalogue';
$pageDesc  = 'Tous les livres des Éditions Bleu 47 : polars, romans, bandes dessinées.';
require_once __DIR__ . '/includes/header.php';

// Filtres
$filtreCollection = trim($_GET['collection'] ?? '');
$filtreAuteur     = (int)($_GET['auteur'] ?? 0);

// Collections pour les tabs
$collections = $pdo->query("SELECT * FROM collections ORDER BY ordre")->fetchAll();

// Auteurs pour le select
$auteurs = $pdo->query("SELECT id, prenom, nom FROM auteurs WHERE statut = 'actif' ORDER BY nom")->fetchAll();

// Requête livres
$sql    = "SELECT l.*, a.prenom, a.nom AS nom_auteur, a.slug AS auteur_slug, c.nom AS collection_nom, c.slug AS collection_slug, c.couleur
           FROM livres l
           JOIN auteurs a ON a.id = l.auteur_id
           JOIN collections c ON c.id = l.collection_id
           WHERE l.statut IN ('publie','a_paraitre')";
$params = [];

if ($filtreCollection) {
    $sql .= " AND c.slug = ?";
    $params[] = $filtreCollection;
}
if ($filtreAuteur) {
    $sql .= " AND l.auteur_id = ?";
    $params[] = $filtreAuteur;
}
$sql .= " ORDER BY l.date_parution DESC, l.titre";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$livres = $stmt->fetchAll();
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Catalogue</li>
    </ol>
  </nav>

  <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
    <div>
      <h1 class="section-title mb-1">Catalogue</h1>
      <p class="text-secondary mb-0"><?= count($livres) ?> titre<?= count($livres) > 1 ? 's' : '' ?></p>
    </div>

    <!-- Filtre auteur -->
    <?php if (count($auteurs) > 1): ?>
    <form method="get" class="d-flex gap-2 align-items-center">
      <?php if ($filtreCollection): ?>
        <input type="hidden" name="collection" value="<?= e($filtreCollection) ?>">
      <?php endif; ?>
      <select name="auteur" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
        <option value="">Tous les auteurs</option>
        <?php foreach ($auteurs as $a): ?>
          <option value="<?= $a['id'] ?>" <?= $filtreAuteur === $a['id'] ? 'selected' : '' ?>>
            <?= e($a['prenom'] . ' ' . $a['nom']) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </form>
    <?php endif; ?>
  </div>

  <!-- Tabs collections -->
  <ul class="nav nav-tabs mb-4">
    <li class="nav-item">
      <a class="nav-link <?= !$filtreCollection ? 'active' : '' ?>"
         href="<?= BASE ?>/catalogue.php<?= $filtreAuteur ? '?auteur=' . $filtreAuteur : '' ?>">
        Tout
      </a>
    </li>
    <?php foreach ($collections as $col): ?>
    <li class="nav-item">
      <a class="nav-link <?= $filtreCollection === $col['slug'] ? 'active' : '' ?>"
         href="<?= BASE ?>/catalogue.php?collection=<?= e($col['slug']) ?><?= $filtreAuteur ? '&auteur=' . $filtreAuteur : '' ?>"
         style="<?= $filtreCollection === $col['slug'] ? 'border-bottom-color:' . e($col['couleur']) . ';color:' . e($col['couleur']) : '' ?>">
        <?= e($col['nom']) ?>
      </a>
    </li>
    <?php endforeach; ?>
  </ul>

  <!-- Grille livres -->
  <?php if ($livres): ?>
  <div class="row g-4">
    <?php foreach ($livres as $livre): ?>
    <div class="col-6 col-md-4 col-lg-3">
      <a href="<?= BASE ?>/livre.php?slug=<?= e($livre['slug']) ?>" class="text-decoration-none">
        <div class="book-card h-100">
          <div class="book-card-cover">
            <?php if ($livre['couverture']): ?>
              <img src="<?= BASE ?>/assets/img/<?= e($livre['couverture']) ?>"
                   alt="<?= e($livre['titre']) ?>">
            <?php else: ?>
              <div class="book-card-cover-placeholder"><?= e($livre['titre']) ?></div>
            <?php endif; ?>
          </div>
          <div class="book-card-body">
            <span class="badge-collection" style="background:<?= e($livre['couleur']) ?>;font-size:.65rem">
              <?= e($livre['collection_nom']) ?>
            </span>
            <?php if ($livre['statut'] === 'a_paraitre'): ?>
              <span class="badge-a-paraitre ms-1">À paraître</span>
            <?php endif; ?>
            <h3 class="book-card-title"><?= e($livre['titre']) ?></h3>
            <p class="book-card-author">
              <?= e($livre['prenom'] . ' ' . $livre['nom_auteur']) ?>
              <?php if ($livre['annee']): ?> · <?= e($livre['annee']) ?><?php endif; ?>
            </p>
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
  <div class="py-5 text-center text-secondary">
    <p>Aucun titre trouvé pour ces critères.</p>
    <a href="<?= BASE ?>/catalogue.php" class="btn btn-outline-primary btn-sm">Réinitialiser</a>
  </div>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
