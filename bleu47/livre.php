<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/db.php';

$slug = trim($_GET['slug'] ?? '');
if (!$slug) {
    header('Location: ' . BASE . '/catalogue.php');
    exit;
}

$stmt = $pdo->prepare(
    "SELECT l.*, a.prenom, a.nom AS nom_auteur, a.slug AS auteur_slug, a.bio AS auteur_bio,
            c.nom AS collection_nom, c.slug AS collection_slug, c.couleur
     FROM livres l
     JOIN auteurs a ON a.id = l.auteur_id
     JOIN collections c ON c.id = l.collection_id
     WHERE l.slug = ?"
);
$stmt->execute([$slug]);
$livre = $stmt->fetch();

if (!$livre) {
    http_response_code(404);
    $pageTitle = 'Livre introuvable';
    require_once __DIR__ . '/includes/header.php';
    echo '<div class="container py-5 text-center"><h1>Livre introuvable</h1><a href="' . BASE . '/catalogue.php" class="btn btn-primary mt-3">Retour au catalogue</a></div>';
    require_once __DIR__ . '/includes/footer.php';
    exit;
}

// Revues de presse liées
$stmtRevues = $pdo->prepare(
    "SELECT * FROM revues_presse WHERE livre_id = ? ORDER BY date_revue DESC"
);
$stmtRevues->execute([$livre['id']]);
$revues = $stmtRevues->fetchAll();

// Autres livres du même auteur
$stmtAutre = $pdo->prepare(
    "SELECT l.*, c.nom AS collection_nom, c.slug AS collection_slug, c.couleur
     FROM livres l
     JOIN collections c ON c.id = l.collection_id
     WHERE l.auteur_id = ? AND l.id != ? AND l.statut IN ('publie','a_paraitre')
     ORDER BY l.date_parution DESC
     LIMIT 4"
);
$stmtAutre->execute([$livre['auteur_id'], $livre['id']]);
$autresLivres = $stmtAutre->fetchAll();

$pageTitle = e($livre['titre']);
$pageDesc  = $livre['quatrieme'] ? mb_substr(strip_tags($livre['quatrieme']), 0, 160) : '';
require_once __DIR__ . '/includes/header.php';

$statutLabel = match($livre['statut']) {
    'publie'      => ['text' => 'Disponible',  'class' => 'text-success'],
    'a_paraitre'  => ['text' => 'À paraître',  'class' => 'text-warning'],
    'epuise'      => ['text' => 'Épuisé',      'class' => 'text-secondary'],
    default       => ['text' => '',            'class' => ''],
};
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item"><a href="<?= BASE ?>/catalogue.php">Catalogue</a></li>
      <li class="breadcrumb-item"><a href="<?= BASE ?>/collection.php?slug=<?= e($livre['collection_slug']) ?>"><?= e($livre['collection_nom']) ?></a></li>
      <li class="breadcrumb-item active"><?= e($livre['titre']) ?></li>
    </ol>
  </nav>

  <!-- Fiche principale -->
  <div class="row g-5 mb-5">

    <!-- Couverture -->
    <div class="col-md-4 col-lg-3">
      <div class="sticky-top" style="top:90px">
        <?php if ($livre['couverture']): ?>
          <img src="<?= BASE ?>/assets/img/<?= e($livre['couverture']) ?>"
               alt="Couverture : <?= e($livre['titre']) ?>"
               class="img-fluid rounded shadow-lg w-100">
        <?php else: ?>
          <div class="rounded bg-light d-flex align-items-center justify-content-center"
               style="aspect-ratio:2/3;border:1px solid var(--border)">
            <span class="text-muted small text-center px-3"><?= e($livre['titre']) ?></span>
          </div>
        <?php endif; ?>

        <!-- Prix + Commander -->
        <?php if ($livre['statut'] !== 'epuise'): ?>
        <div class="mt-3 p-3 rounded border" style="background:var(--bg-secondary)">
          <?php if ($livre['prix_papier']): ?>
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-secondary" style="font-size:.875rem">Papier</span>
            <strong><?= number_format($livre['prix_papier'], 2, ',', '') ?> €</strong>
          </div>
          <?php endif; ?>
          <?php if ($livre['prix_numerique'] && $livre['disponible_numerique']): ?>
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-secondary" style="font-size:.875rem">Numérique</span>
            <strong><?= number_format($livre['prix_numerique'], 2, ',', '') ?> €</strong>
          </div>
          <?php endif; ?>
          <button class="btn btn-primary w-100 mt-2 disabled" disabled
                  title="Boutique bientôt disponible">
            Commander →
          </button>
          <p class="text-center mt-1 mb-0" style="font-size:.7rem;color:var(--text-muted)">
            Boutique bientôt disponible
          </p>
        </div>
        <?php endif; ?>
      </div>
    </div>

    <!-- Détails -->
    <div class="col-md-8 col-lg-9">
      <span class="badge-collection" style="background:<?= e($livre['couleur']) ?>">
        <a href="<?= BASE ?>/collection.php?slug=<?= e($livre['collection_slug']) ?>"
           style="color:#fff;text-decoration:none"><?= e($livre['collection_nom']) ?></a>
      </span>

      <h1 class="mt-2 mb-1"><?= e($livre['titre']) ?></h1>

      <p class="text-secondary mb-3" style="font-size:1.05rem">
        <a href="<?= BASE ?>/auteur.php?slug=<?= e($livre['auteur_slug']) ?>" class="text-blue47 fw-500">
          <?= e($livre['prenom'] . ' ' . $livre['nom_auteur']) ?>
        </a>
      </p>

      <!-- Métadonnées -->
      <div class="d-flex flex-wrap gap-3 mb-4" style="font-size:.875rem;color:var(--text-secondary)">
        <?php if ($livre['annee']): ?>
          <span>📅 <?= e($livre['annee']) ?></span>
        <?php endif; ?>
        <?php if ($livre['nb_pages']): ?>
          <span>📄 <?= e($livre['nb_pages']) ?> pages</span>
        <?php endif; ?>
        <?php if ($livre['isbn_papier']): ?>
          <span>ISBN papier : <?= e($livre['isbn_papier']) ?></span>
        <?php endif; ?>
        <?php if ($livre['isbn_numerique']): ?>
          <span>ISBN num. : <?= e($livre['isbn_numerique']) ?></span>
        <?php endif; ?>
        <?php if ($statutLabel['text']): ?>
          <span class="fw-500 <?= $statutLabel['class'] ?>">● <?= $statutLabel['text'] ?></span>
        <?php endif; ?>
      </div>

      <!-- 4ème de couverture -->
      <?php if ($livre['quatrieme']): ?>
      <div class="mb-4" style="font-size:1rem;line-height:1.8;max-width:640px">
        <?= $livre['quatrieme'] ?>
      </div>
      <?php endif; ?>

      <!-- Extrait -->
      <?php if ($livre['extrait']): ?>
      <div class="mb-4">
        <h2 style="font-size:1.1rem;margin-bottom:.75rem">Extrait</h2>
        <div class="press-quote" style="font-style:normal">
          <?= $livre['extrait'] ?>
        </div>
      </div>
      <?php endif; ?>
    </div>
  </div>

  <!-- Revues de presse -->
  <?php if ($revues): ?>
  <section class="mb-5">
    <h2 class="section-title mb-4" style="font-size:1.4rem">La presse en parle</h2>
    <div class="row g-3">
      <?php foreach ($revues as $revue): ?>
      <div class="col-md-6">
        <div class="press-quote h-100">
          <?php if ($revue['citation']): ?>
            <p class="mb-2"><?= e($revue['citation']) ?></p>
          <?php endif; ?>
          <footer style="font-size:.8rem;font-style:normal;color:var(--text-muted)">
            <strong><?= e($revue['source']) ?></strong>
            <?php if ($revue['titre_article']): ?> — <?= e($revue['titre_article']) ?><?php endif; ?>
            · <?= date('d/m/Y', strtotime($revue['date_revue'])) ?>
            <?php if ($revue['url']): ?>
              · <a href="<?= e($revue['url']) ?>" target="_blank" rel="noopener">Lire l'article</a>
            <?php endif; ?>
          </footer>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <!-- Du même auteur -->
  <?php if ($autresLivres): ?>
  <section>
    <h2 class="section-title mb-4" style="font-size:1.4rem">
      Du même auteur
    </h2>
    <div class="row g-4">
      <?php foreach ($autresLivres as $autre): ?>
      <div class="col-6 col-md-3">
        <a href="<?= BASE ?>/livre.php?slug=<?= e($autre['slug']) ?>" class="text-decoration-none">
          <div class="book-card">
            <div class="book-card-cover">
              <?php if ($autre['couverture']): ?>
                <img src="<?= BASE ?>/assets/img/<?= e($autre['couverture']) ?>"
                     alt="<?= e($autre['titre']) ?>">
              <?php else: ?>
                <div class="book-card-cover-placeholder"><?= e($autre['titre']) ?></div>
              <?php endif; ?>
            </div>
            <div class="book-card-body">
              <span class="badge-collection" style="background:<?= e($autre['couleur']) ?>;font-size:.65rem">
                <?= e($autre['collection_nom']) ?>
              </span>
              <h3 class="book-card-title"><?= e($autre['titre']) ?></h3>
            </div>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
