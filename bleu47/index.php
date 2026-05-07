<?php
$pageTitle = 'Accueil';
$pageDesc  = 'Maison d\'édition indépendante basée en Bourgogne-Franche-Comté. Collections Adrénaline, Fictions et BD / Romans graphiques.';
require_once __DIR__ . '/includes/header.php';

// Dernière parution
$stmt = $pdo->query("SELECT l.*, a.prenom, a.nom, a.slug AS auteur_slug, c.nom AS collection_nom, c.slug AS collection_slug
    FROM livres l
    JOIN auteurs a ON a.id = l.auteur_id
    JOIN collections c ON c.id = l.collection_id
    WHERE l.statut = 'publie'
    ORDER BY l.date_parution DESC, l.id DESC
    LIMIT 1");
$dernierLivre = $stmt->fetch();

// Collections
$collections = $pdo->query("SELECT *, (SELECT COUNT(*) FROM livres WHERE collection_id = collections.id AND statut IN ('publie','a_paraitre')) AS nb_livres FROM collections ORDER BY ordre")->fetchAll();

// Auteurs actifs
$auteurs = $pdo->query("SELECT a.*, (SELECT COUNT(*) FROM livres WHERE auteur_id = a.id AND statut = 'publie') AS nb_livres FROM auteurs a WHERE a.statut = 'actif' ORDER BY a.ordre, a.nom")->fetchAll();

// 3 dernières actus
$actus = $pdo->query("SELECT * FROM actus WHERE statut = 'publie' ORDER BY date_actu DESC LIMIT 3")->fetchAll();

// Mapping slug collection -> classe CSS badge
function badge_class(string $slug): string
{
    return match($slug) {
        'adrenaline' => 'badge-adrenaline',
        'fictions'   => 'badge-fictions',
        'bd'         => 'badge-bd',
        default      => 'badge-fictions',
    };
}
?>

<!-- ─── Hero ──────────────────────────────────────────────────── -->
<section class="hero">
  <div class="container">
    <div class="hero-brand-logo" aria-hidden="true">
      <span style="font-family:'Playfair Display',Georgia,serif;font-size:4rem;font-weight:700;color:#fff;letter-spacing:-.02em">
        bleu<span style="color:#2563c4">47</span>
      </span>
    </div>
    <h1 class="hero-title mt-3">Éditions Bleu 47</h1>
    <p class="hero-tagline">Maison d'édition indépendante en Bourgogne-Franche-Comté</p>
    <a href="<?= BASE ?>/catalogue.php" class="btn btn-light btn-lg px-4">
      Découvrir le catalogue →
    </a>
  </div>
</section>

<!-- ─── Dernière parution ─────────────────────────────────────── -->
<?php if ($dernierLivre): ?>
<section class="section">
  <div class="container">
    <div class="row align-items-center g-5">
      <div class="col-md-4 col-lg-3 text-center">
        <?php if ($dernierLivre['couverture']): ?>
          <img src="<?= BASE ?>/assets/img/<?= e($dernierLivre['couverture']) ?>"
               alt="Couverture de <?= e($dernierLivre['titre']) ?>"
               class="img-fluid rounded shadow-lg"
               style="max-height:420px">
        <?php else: ?>
          <div class="book-card-cover-placeholder rounded" style="height:320px;width:220px;margin:auto">
            Couverture à venir
          </div>
        <?php endif; ?>
      </div>
      <div class="col-md-8 col-lg-9">
        <p class="text-blue47 fw-600 mb-2" style="font-size:.85rem;text-transform:uppercase;letter-spacing:.08em">
          Dernière parution
        </p>
        <span class="badge-collection <?= badge_class($dernierLivre['collection_slug']) ?> mb-2">
          <?= e($dernierLivre['collection_nom']) ?>
        </span>
        <h2 class="mt-2 mb-1">
          <a href="<?= BASE ?>/livre.php?slug=<?= e($dernierLivre['slug']) ?>" class="text-decoration-none text-dark">
            <?= e($dernierLivre['titre']) ?>
          </a>
        </h2>
        <p class="text-secondary mb-3">
          <a href="<?= BASE ?>/auteur.php?slug=<?= e($dernierLivre['auteur_slug']) ?>" class="text-blue47">
            <?= e($dernierLivre['prenom'] . ' ' . $dernierLivre['nom']) ?>
          </a>
          <?php if ($dernierLivre['annee']): ?> · <?= e($dernierLivre['annee']) ?><?php endif; ?>
          <?php if ($dernierLivre['nb_pages']): ?> · <?= e($dernierLivre['nb_pages']) ?> pages<?php endif; ?>
        </p>
        <?php if ($dernierLivre['quatrieme']): ?>
          <div class="mb-4" style="max-width:600px">
            <?= $dernierLivre['quatrieme'] ?>
          </div>
        <?php endif; ?>
        <a href="<?= BASE ?>/livre.php?slug=<?= e($dernierLivre['slug']) ?>" class="btn btn-primary">
          Voir la fiche →
        </a>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- ─── Collections ───────────────────────────────────────────── -->
<section class="section section-alt">
  <div class="container">
    <h2 class="section-title text-center">Nos collections</h2>
    <p class="section-subtitle text-center">Trois univers éditoriaux, une même exigence</p>
    <div class="row g-4">
      <?php foreach ($collections as $col): ?>
      <div class="col-md-4">
        <a href="<?= BASE ?>/collection.php?slug=<?= e($col['slug']) ?>" class="collection-card">
          <div class="collection-card-bar" style="background:<?= e($col['couleur']) ?>"></div>
          <div class="collection-card-body">
            <h3 class="collection-card-name"><?= e($col['nom']) ?></h3>
            <p class="text-secondary mb-2" style="font-size:.9rem"><?= e($col['description']) ?></p>
            <p class="mb-0" style="font-size:.8rem;color:var(--text-muted)">
              <?= $col['nb_livres'] ?> titre<?= $col['nb_livres'] > 1 ? 's' : '' ?>
            </p>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ─── Auteurs ───────────────────────────────────────────────── -->
<?php if ($auteurs): ?>
<section class="section">
  <div class="container">
    <h2 class="section-title text-center">Nos auteurs</h2>
    <p class="section-subtitle text-center">Les voix de Bleu 47</p>
    <div class="row g-4 justify-content-center">
      <?php foreach ($auteurs as $auteur): ?>
      <div class="col-6 col-md-4 col-lg-3">
        <a href="<?= BASE ?>/auteur.php?slug=<?= e($auteur['slug']) ?>" class="text-decoration-none">
          <div class="author-card">
            <?php if ($auteur['photo']): ?>
              <img src="<?= BASE ?>/assets/img/<?= e($auteur['photo']) ?>"
                   alt="<?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?>"
                   class="author-avatar">
            <?php else: ?>
              <div class="author-avatar-placeholder">✍</div>
            <?php endif; ?>
            <h3 style="font-size:1rem;margin:.25rem 0"><?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?></h3>
            <p class="text-secondary mb-0" style="font-size:.8rem">
              <?= $auteur['nb_livres'] ?> titre<?= $auteur['nb_livres'] > 1 ? 's' : '' ?>
            </p>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- ─── Dernières actus ───────────────────────────────────────── -->
<?php if ($actus): ?>
<section class="section section-alt">
  <div class="container">
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h2 class="section-title mb-0">Actualités</h2>
      </div>
      <a href="<?= BASE ?>/actus.php" class="btn btn-outline-primary btn-sm">Toutes les actus →</a>
    </div>
    <div class="row g-4">
      <?php foreach ($actus as $actu): ?>
      <div class="col-md-4">
        <article class="admin-card h-100 p-3">
          <p class="mb-1" style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">
            <?= e($actu['categorie']) ?> · <?= date('d/m/Y', strtotime($actu['date_actu'])) ?>
          </p>
          <h3 style="font-size:1rem;font-family:'Playfair Display',Georgia,serif;margin:.25rem 0 .5rem">
            <?= e($actu['titre']) ?>
          </h3>
          <div style="font-size:.875rem;color:var(--text-secondary)">
            <?= mb_substr(strip_tags($actu['contenu']), 0, 140) ?>…
          </div>
        </article>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- ─── Bandeau manuscrit ─────────────────────────────────────── -->
<section class="section">
  <div class="container">
    <div class="manuscrit-banner">
      <h3 class="mb-2">Vous êtes auteur ?</h3>
      <p class="mb-3" style="color:rgba(255,255,255,.8)">
        Bleu 47 est une maison d'édition indépendante ouverte aux nouvelles voix.<br>
        Soumettez votre manuscrit — nous lisons toutes les propositions.
      </p>
      <a href="<?= BASE ?>/manuscrit.php" class="btn btn-light btn-lg">
        Soumettre un manuscrit →
      </a>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
