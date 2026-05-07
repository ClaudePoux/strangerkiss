<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/db.php';

$slug = trim($_GET['slug'] ?? '');
if (!$slug) {
    header('Location: ' . BASE . '/auteurs.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM auteurs WHERE slug = ?");
$stmt->execute([$slug]);
$auteur = $stmt->fetch();

if (!$auteur) {
    http_response_code(404);
    $pageTitle = 'Auteur introuvable';
    require_once __DIR__ . '/includes/header.php';
    echo '<div class="container py-5 text-center"><h1>Auteur introuvable</h1><a href="' . BASE . '/auteurs.php" class="btn btn-primary mt-3">Voir tous les auteurs</a></div>';
    require_once __DIR__ . '/includes/footer.php';
    exit;
}

// Livres de l'auteur
$stmtLivres = $pdo->prepare(
    "SELECT l.*, c.nom AS collection_nom, c.slug AS collection_slug, c.couleur
     FROM livres l
     JOIN collections c ON c.id = l.collection_id
     WHERE l.auteur_id = ? AND l.statut IN ('publie','a_paraitre')
     ORDER BY l.date_parution DESC"
);
$stmtLivres->execute([$auteur['id']]);
$livres = $stmtLivres->fetchAll();

$pageTitle = e($auteur['prenom'] . ' ' . $auteur['nom']);
$pageDesc  = $auteur['bio'] ? mb_substr(strip_tags($auteur['bio']), 0, 160) : '';
require_once __DIR__ . '/includes/header.php';
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item"><a href="<?= BASE ?>/auteurs.php">Auteurs</a></li>
      <li class="breadcrumb-item active"><?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?></li>
    </ol>
  </nav>

  <!-- En-tête auteur -->
  <div class="row g-5 mb-5 align-items-start">
    <div class="col-md-3 col-lg-2 text-center text-md-start">
      <?php if ($auteur['photo']): ?>
        <img src="<?= BASE ?>/assets/img/<?= e($auteur['photo']) ?>"
             alt="<?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?>"
             class="rounded-circle border"
             style="width:140px;height:140px;object-fit:cover;border-width:3px!important;border-color:var(--border)!important">
      <?php else: ?>
        <div style="width:140px;height:140px;border-radius:50%;background:var(--bg-secondary);margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:3rem">
          ✍
        </div>
      <?php endif; ?>
    </div>

    <div class="col-md-9 col-lg-10">
      <h1 class="mb-1"><?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?></h1>
      <p style="font-size:.875rem;color:var(--text-muted)">
        <?= count($livres) ?> titre<?= count($livres) > 1 ? 's' : '' ?> publié<?= count($livres) > 1 ? 's' : '' ?> chez Bleu 47
      </p>

      <?php if ($auteur['bio']): ?>
      <div class="mt-3" style="font-size:1rem;line-height:1.8;max-width:680px">
        <?= $auteur['bio'] ?>
      </div>
      <?php endif; ?>

      <?php if ($auteur['site_web']): ?>
      <p class="mt-3 mb-0">
        <a href="<?= e($auteur['site_web']) ?>" target="_blank" rel="noopener"
           class="text-blue47" style="font-size:.9rem">
          🌐 Site personnel →
        </a>
      </p>
      <?php endif; ?>
    </div>
  </div>

  <!-- Livres de l'auteur -->
  <?php if ($livres): ?>
  <h2 class="section-title mb-4" style="font-size:1.4rem">
    Bibliographie chez Bleu 47
  </h2>
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
            <?php if ($livre['annee']): ?>
              <p class="book-card-author"><?= e($livre['annee']) ?></p>
            <?php endif; ?>
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
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
