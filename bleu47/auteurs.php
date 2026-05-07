<?php
$pageTitle = 'Auteurs';
$pageDesc  = 'Découvrez les auteurs des Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';

$auteurs = $pdo->query(
    "SELECT a.*,
        (SELECT COUNT(*) FROM livres WHERE auteur_id = a.id AND statut = 'publie') AS nb_publie
     FROM auteurs a
     WHERE a.statut = 'actif'
     ORDER BY a.ordre, a.nom"
)->fetchAll();
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Auteurs</li>
    </ol>
  </nav>

  <h1 class="section-title mb-2">Auteurs</h1>
  <p class="section-subtitle">Les voix des Éditions Bleu 47.</p>

  <?php if ($auteurs): ?>
  <div class="row g-4">
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

          <h2 style="font-size:1rem;font-family:'Playfair Display',Georgia,serif;margin:.25rem 0 .15rem">
            <?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?>
          </h2>
          <p class="text-secondary mb-2" style="font-size:.8rem">
            <?= $auteur['nb_publie'] ?> titre<?= $auteur['nb_publie'] > 1 ? 's' : '' ?> publié<?= $auteur['nb_publie'] > 1 ? 's' : '' ?>
          </p>
          <span class="btn btn-outline-primary btn-sm" style="font-size:.75rem">
            Voir l'auteur →
          </span>
        </div>
      </a>
    </div>
    <?php endforeach; ?>
  </div>
  <?php else: ?>
  <p class="text-secondary">Aucun auteur pour l'instant.</p>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
