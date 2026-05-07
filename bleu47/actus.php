<?php
$pageTitle = 'Actualités';
$pageDesc  = 'Toutes les actualités des Éditions Bleu 47 : parutions, dédicaces, salons du livre.';
require_once __DIR__ . '/includes/header.php';

// Filtres
$cat     = trim($_GET['cat'] ?? '');
$page    = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;

$categories = ['Actualité', 'Dédicace', 'Salon du livre', 'Parution'];

function strftime_month(int $n): string {
    return ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'][$n];
}

// Compte total
$sqlCount  = "SELECT COUNT(*) FROM actus WHERE statut = 'publie'";
$paramsC   = [];
if ($cat && in_array($cat, $categories, true)) {
    $sqlCount .= " AND categorie = ?";
    $paramsC[] = $cat;
}
$stmtC = $pdo->prepare($sqlCount);
$stmtC->execute($paramsC);
$total = (int)$stmtC->fetchColumn();

$pag = paginate($total, $perPage, $page);

// Actus
$sql    = "SELECT a.*, l.titre AS livre_titre, l.slug AS livre_slug
           FROM actus a
           LEFT JOIN livres l ON l.id = a.livre_id
           WHERE a.statut = 'publie'";
$params = [];
if ($cat && in_array($cat, $categories, true)) {
    $sql .= " AND a.categorie = ?";
    $params[] = $cat;
}
$sql .= " ORDER BY a.date_actu DESC LIMIT ? OFFSET ?";
$params[] = $perPage;
$params[] = $pag['offset'];

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$actus = $stmt->fetchAll();

function cat_badge(string $cat): string {
    return match($cat) {
        'Parution'       => 'background:#1a4a8a;color:#fff',
        'Dédicace'       => 'background:#16a34a;color:#fff',
        'Salon du livre' => 'background:#7c3aed;color:#fff',
        default          => 'background:#6b7280;color:#fff',
    };
}
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Actualités</li>
    </ol>
  </nav>

  <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
    <div>
      <h1 class="section-title mb-1">Actualités</h1>
      <p class="text-secondary mb-0"><?= $total ?> article<?= $total > 1 ? 's' : '' ?></p>
    </div>
  </div>

  <!-- Tabs catégories -->
  <ul class="nav nav-tabs mb-4">
    <li class="nav-item">
      <a class="nav-link <?= !$cat ? 'active' : '' ?>" href="<?= BASE ?>/actus.php">Tout</a>
    </li>
    <?php foreach ($categories as $c): ?>
    <li class="nav-item">
      <a class="nav-link <?= $cat === $c ? 'active' : '' ?>"
         href="<?= BASE ?>/actus.php?cat=<?= urlencode($c) ?>">
        <?= e($c) ?>
      </a>
    </li>
    <?php endforeach; ?>
  </ul>

  <!-- Liste actus -->
  <?php if ($actus): ?>
  <div class="d-flex flex-column gap-4">
    <?php foreach ($actus as $actu): ?>
    <article class="p-4 rounded border" style="background:#fff">
      <div class="d-flex align-items-start gap-3">
        <div class="flex-shrink-0 text-center" style="min-width:56px">
          <div style="font-size:1.4rem;font-weight:700;color:var(--blue47);line-height:1">
            <?= date('d', strtotime($actu['date_actu'])) ?>
          </div>
          <div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em">
            <?= strftime_month((int)date('n', strtotime($actu['date_actu']))) ?>
            <?= date('Y', strtotime($actu['date_actu'])) ?>
          </div>
        </div>
        <div class="flex-grow-1">
          <div class="mb-1">
            <span class="badge-collection" style="<?= cat_badge($actu['categorie']) ?>;font-size:.7rem">
              <?= e($actu['categorie']) ?>
            </span>
          </div>
          <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:1.1rem;margin:.25rem 0 .5rem">
            <?= e($actu['titre']) ?>
          </h2>
          <div style="font-size:.9rem;color:var(--text-secondary);line-height:1.7">
            <?= $actu['contenu'] ?>
          </div>
          <?php if ($actu['livre_titre']): ?>
          <p class="mt-2 mb-0" style="font-size:.85rem">
            📚 <a href="<?= BASE ?>/livre.php?slug=<?= e($actu['livre_slug']) ?>" class="text-blue47">
              <?= e($actu['livre_titre']) ?>
            </a>
          </p>
          <?php endif; ?>
        </div>
      </div>
    </article>
    <?php endforeach; ?>
  </div>

  <!-- Pagination -->
  <?php if ($pag['pages'] > 1): ?>
  <nav class="mt-5" aria-label="Pagination">
    <ul class="pagination justify-content-center">
      <?php if ($pag['current'] > 1): ?>
      <li class="page-item">
        <a class="page-link" href="?<?= http_build_query(array_filter(['cat' => $cat, 'page' => $pag['current'] - 1])) ?>">
          ← Précédent
        </a>
      </li>
      <?php endif; ?>
      <?php for ($i = 1; $i <= $pag['pages']; $i++): ?>
      <li class="page-item <?= $i === $pag['current'] ? 'active' : '' ?>">
        <a class="page-link" href="?<?= http_build_query(array_filter(['cat' => $cat, 'page' => $i])) ?>">
          <?= $i ?>
        </a>
      </li>
      <?php endfor; ?>
      <?php if ($pag['current'] < $pag['pages']): ?>
      <li class="page-item">
        <a class="page-link" href="?<?= http_build_query(array_filter(['cat' => $cat, 'page' => $pag['current'] + 1])) ?>">
          Suivant →
        </a>
      </li>
      <?php endif; ?>
    </ul>
  </nav>
  <?php endif; ?>

  <?php else: ?>
  <p class="text-secondary">Aucune actualité pour l'instant.</p>
  <?php endif; ?>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
