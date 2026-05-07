<?php
$pageTitle = 'Revue de presse';
$pageDesc  = 'Ce que la presse dit des livres des Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';

// Filtres
$filtreType      = trim($_GET['type'] ?? '');
$filtreAuteur    = (int)($_GET['auteur'] ?? 0);
$filtreCollection = trim($_GET['collection'] ?? '');

$types = ['Revue de presse', 'Critique'];

// Auteurs et collections pour les filtres
$auteurs     = $pdo->query("SELECT id, prenom, nom FROM auteurs WHERE statut = 'actif' ORDER BY nom")->fetchAll();
$collections = $pdo->query("SELECT id, nom, slug FROM collections ORDER BY ordre")->fetchAll();

// Requête
$sql    = "SELECT r.*, l.titre AS livre_titre, l.slug AS livre_slug,
                  a.prenom, a.nom AS nom_auteur,
                  c.nom AS collection_nom, c.slug AS collection_slug, c.couleur
           FROM revues_presse r
           LEFT JOIN livres l ON l.id = r.livre_id
           LEFT JOIN auteurs a ON a.id = l.auteur_id
           LEFT JOIN collections c ON c.id = l.collection_id
           WHERE 1";
$params = [];

if ($filtreType && in_array($filtreType, $types, true)) {
    $sql .= " AND r.type = ?";
    $params[] = $filtreType;
}
if ($filtreAuteur) {
    $sql .= " AND l.auteur_id = ?";
    $params[] = $filtreAuteur;
}
if ($filtreCollection) {
    $sql .= " AND c.slug = ?";
    $params[] = $filtreCollection;
}
$sql .= " ORDER BY r.date_revue DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$revues = $stmt->fetchAll();
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Revue de presse</li>
    </ol>
  </nav>

  <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
    <div>
      <h1 class="section-title mb-1">Revue de presse</h1>
      <p class="text-secondary mb-0"><?= count($revues) ?> article<?= count($revues) > 1 ? 's' : '' ?></p>
    </div>

    <!-- Filtres -->
    <form method="get" class="d-flex flex-wrap gap-2 align-items-center">
      <select name="type" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
        <option value="">Tous les types</option>
        <?php foreach ($types as $t): ?>
          <option value="<?= e($t) ?>" <?= $filtreType === $t ? 'selected' : '' ?>><?= e($t) ?></option>
        <?php endforeach; ?>
      </select>

      <?php if (count($auteurs) > 1): ?>
      <select name="auteur" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
        <option value="">Tous les auteurs</option>
        <?php foreach ($auteurs as $a): ?>
          <option value="<?= $a['id'] ?>" <?= $filtreAuteur === $a['id'] ? 'selected' : '' ?>>
            <?= e($a['prenom'] . ' ' . $a['nom']) ?>
          </option>
        <?php endforeach; ?>
      </select>
      <?php endif; ?>

      <select name="collection" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
        <option value="">Toutes les collections</option>
        <?php foreach ($collections as $col): ?>
          <option value="<?= e($col['slug']) ?>" <?= $filtreCollection === $col['slug'] ? 'selected' : '' ?>>
            <?= e($col['nom']) ?>
          </option>
        <?php endforeach; ?>
      </select>

      <?php if ($filtreType || $filtreAuteur || $filtreCollection): ?>
      <a href="<?= BASE ?>/revue-de-presse.php" class="btn btn-outline-secondary btn-sm">Réinitialiser</a>
      <?php endif; ?>
    </form>
  </div>

  <!-- Liste des revues -->
  <?php if ($revues): ?>
  <div class="row g-4">
    <?php foreach ($revues as $revue): ?>
    <div class="col-md-6">
      <div class="press-quote h-100" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <!-- Type badge -->
          <span class="d-inline-block mb-2 px-2 py-1 rounded"
                style="font-size:.7rem;font-weight:600;<?= $revue['type'] === 'Critique' ? 'background:#fef3c7;color:#d97706' : 'background:#eff6ff;color:#1d4ed8' ?>">
            <?= e($revue['type']) ?>
          </span>

          <?php if ($revue['titre_article']): ?>
            <p class="mb-1" style="font-size:.85rem;font-weight:600;color:var(--text-primary)">
              <?= e($revue['titre_article']) ?>
            </p>
          <?php endif; ?>

          <?php if ($revue['citation']): ?>
            <p class="mb-2" style="line-height:1.7">
              &laquo;&nbsp;<?= e($revue['citation']) ?>&nbsp;&raquo;
            </p>
          <?php endif; ?>
        </div>

        <footer style="font-size:.8rem;color:var(--text-muted)">
          <strong style="color:var(--text-primary)"><?= e($revue['source']) ?></strong>
          &mdash; <?= date('d/m/Y', strtotime($revue['date_revue'])) ?>
          <?php if ($revue['livre_titre']): ?>
            &mdash; à propos de
            <a href="<?= BASE ?>/livre.php?slug=<?= e($revue['livre_slug']) ?>" class="text-blue47">
              <?= e($revue['livre_titre']) ?>
            </a>
            <?php if ($revue['prenom']): ?>
              (<?= e($revue['prenom'] . ' ' . $revue['nom_auteur']) ?>)
            <?php endif; ?>
          <?php endif; ?>
          <?php if ($revue['url']): ?>
            &mdash; <a href="<?= e($revue['url']) ?>" target="_blank" rel="noopener">Lire l'article →</a>
          <?php endif; ?>
        </footer>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php else: ?>
  <p class="text-secondary">Aucune revue de presse pour l'instant.</p>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
