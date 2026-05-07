<?php
$pageTitle = 'Accueil';
$pageDesc  = 'Maison d\'édition indépendante basée en Bourgogne-Franche-Comté. Collections Adrénaline, Fictions et BD / Romans graphiques.';
require_once __DIR__ . '/includes/header.php';

// Dernière parution (hero)
$stmt = $pdo->query("SELECT l.*, a.prenom, a.nom, a.slug AS auteur_slug,
    c.nom AS collection_nom, c.slug AS collection_slug
    FROM livres l
    JOIN auteurs a ON a.id = l.auteur_id
    JOIN collections c ON c.id = l.collection_id
    WHERE l.statut = 'publie'
    ORDER BY l.date_parution DESC, l.id DESC
    LIMIT 1");
$dernierLivre = $stmt->fetch();

// 4 dernières parutions (grille)
$dernieresParutions = $pdo->query("SELECT l.*, a.prenom, a.nom, a.slug AS auteur_slug,
    c.nom AS collection_nom, c.slug AS collection_slug
    FROM livres l
    JOIN auteurs a ON a.id = l.auteur_id
    JOIN collections c ON c.id = l.collection_id
    WHERE l.statut IN ('publie','a_paraitre')
    ORDER BY l.date_parution DESC, l.id DESC
    LIMIT 4")->fetchAll();

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
<?php if ($dernierLivre): ?>
<section class="hero">
  <div class="container hero-content">
    <div class="row align-items-center g-4 g-lg-5 flex-md-row flex-column-reverse">

      <!-- Texte — gauche (60%) -->
      <div class="col-md-7">
        <p class="hero-book-label hero-animate">Dernière parution</p>
        <div class="hero-animate" style="animation-delay:.1s">
          <span class="badge-collection <?= badge_class($dernierLivre['collection_slug']) ?>">
            <?= e($dernierLivre['collection_nom']) ?>
          </span>
        </div>
        <h1 class="hero-book-title hero-animate" style="animation-delay:.2s">
          <?= e($dernierLivre['titre']) ?>
        </h1>
        <p class="hero-book-author hero-animate" style="animation-delay:.28s">
          <a href="<?= BASE ?>/auteur.php?slug=<?= e($dernierLivre['auteur_slug']) ?>">
            <?= e($dernierLivre['prenom'] . ' ' . $dernierLivre['nom']) ?>
          </a>
          <?php if ($dernierLivre['annee']): ?>
            <span class="hero-book-meta-sep">·</span><?= e($dernierLivre['annee']) ?>
          <?php endif; ?>
          <?php if ($dernierLivre['nb_pages']): ?>
            <span class="hero-book-meta-sep">·</span><?= e($dernierLivre['nb_pages']) ?> pages
          <?php endif; ?>
        </p>
        <?php if ($dernierLivre['quatrieme']): ?>
        <p class="hero-book-quatrieme hero-animate" style="animation-delay:.36s">
          <?= e(mb_substr(strip_tags($dernierLivre['quatrieme']), 0, 200)) ?>…
        </p>
        <?php endif; ?>
        <div class="hero-animate" style="animation-delay:.46s">
          <a href="<?= BASE ?>/livre.php?slug=<?= e($dernierLivre['slug']) ?>"
             class="btn btn-dark btn-lg px-4">
            Voir la fiche →
          </a>
        </div>
      </div>

      <!-- Couverture — droite (40%) -->
      <div class="col-md-5 d-flex justify-content-center hero-animate" style="animation-delay:.18s">
        <div class="hero-book-cover">
          <?php if ($dernierLivre['statut'] === 'a_paraitre'): ?>
            <span class="hero-book-badge hero-book-badge--deparaitre">À paraître</span>
          <?php else: ?>
            <span class="hero-book-badge">Nouveauté</span>
          <?php endif; ?>
          <?php if ($dernierLivre['couverture']): ?>
            <img src="<?= BASE ?>/assets/img/<?= e($dernierLivre['couverture']) ?>"
                 alt="Couverture — <?= e($dernierLivre['titre']) ?>">
          <?php else: ?>
            <div class="hero-book-placeholder">
              <?= e($dernierLivre['titre']) ?>
            </div>
          <?php endif; ?>
        </div>
      </div>

    </div>
  </div>
</section>
<?php else: ?>
<section class="hero">
  <div class="container hero-content text-center">
    <div class="hero-animate">
      <span class="hero-brand-mark">bleu<span>47</span></span>
    </div>
    <p class="hero-title hero-animate">Éditions Bleu 47</p>
    <p class="hero-tagline hero-animate">Maison d'édition indépendante · Bourgogne-Franche-Comté</p>
    <div class="hero-animate">
      <a href="<?= BASE ?>/catalogue.php" class="btn btn-dark btn-lg px-4">
        Découvrir le catalogue →
      </a>
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
        <a href="<?= BASE ?>/collection.php?slug=<?= e($col['slug']) ?>"
           class="collection-card"
           style="background-color:<?= e($col['couleur']) ?>">
          <?php if ($col['couverture']): ?>
          <div class="collection-card-bg"
               style="background-image:url('<?= BASE ?>/assets/img/<?= e($col['couverture']) ?>')"></div>
          <?php endif; ?>
          <div class="collection-card-overlay"></div>
          <div class="collection-card-content">
            <h3 class="collection-card-name"><?= e($col['nom']) ?></h3>
            <p class="collection-card-desc"><?= e($col['description']) ?></p>
            <span class="collection-card-badge">
              <?= $col['nb_livres'] ?> titre<?= $col['nb_livres'] > 1 ? 's' : '' ?>
            </span>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ─── Dernières parutions ───────────────────────────────────── -->
<?php if ($dernieresParutions): ?>
<section class="section">
  <div class="container">
    <div class="d-flex align-items-end justify-content-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="section-title mb-1">Dernières parutions</h2>
        <p class="section-subtitle mb-0">Nos titres les plus récents</p>
      </div>
      <a href="<?= BASE ?>/catalogue.php" class="btn btn-outline-primary btn-sm">
        Voir tout le catalogue →
      </a>
    </div>
    <div class="row g-4">
      <?php foreach ($dernieresParutions as $livre): ?>
      <div class="col-6 col-md-3">
        <a href="<?= BASE ?>/livre.php?slug=<?= e($livre['slug']) ?>" class="text-decoration-none">
          <div class="book-card">
            <div class="book-card-cover">
              <?php if ($livre['couverture']): ?>
                <img src="<?= BASE ?>/assets/img/<?= e($livre['couverture']) ?>"
                     alt="Couverture — <?= e($livre['titre']) ?>">
              <?php else: ?>
                <div class="book-card-cover-placeholder">Couverture à venir</div>
              <?php endif; ?>
            </div>
            <div class="book-card-body">
              <span class="badge-collection <?= badge_class($livre['collection_slug']) ?>">
                <?= e($livre['collection_nom']) ?>
              </span>
              <?php if ($livre['statut'] === 'a_paraitre'): ?>
                <span class="badge-a-paraitre ms-1">À paraître</span>
              <?php endif; ?>
              <h3 class="book-card-title"><?= e($livre['titre']) ?></h3>
              <p class="book-card-author">
                <?= e($livre['prenom'] . ' ' . $livre['nom']) ?>
              </p>
            </div>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

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
        <article class="actu-card">
          <p class="label-overline mb-2">
            <?= e($actu['categorie']) ?> · <?= date('d/m/Y', strtotime($actu['date_actu'])) ?>
          </p>
          <h3 style="font-size:1.05rem;font-family:'Playfair Display',Georgia,serif;margin:.2rem 0 .6rem;line-height:1.3">
            <?= e($actu['titre']) ?>
          </h3>
          <div style="font-size:.875rem;color:var(--text-secondary);line-height:1.6">
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
