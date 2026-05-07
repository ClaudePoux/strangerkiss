<?php
$adminTitle = 'Dashboard';
require_once __DIR__ . '/../includes/admin-header.php';

// Stats
$stats = [
    'auteurs'      => (int)$pdo->query("SELECT COUNT(*) FROM auteurs WHERE statut = 'actif'")->fetchColumn(),
    'publie'       => (int)$pdo->query("SELECT COUNT(*) FROM livres WHERE statut = 'publie'")->fetchColumn(),
    'a_paraitre'   => (int)$pdo->query("SELECT COUNT(*) FROM livres WHERE statut = 'a_paraitre'")->fetchColumn(),
    'brouillons'   => (int)$pdo->query("SELECT COUNT(*) FROM livres WHERE statut = 'brouillon'")->fetchColumn(),
    'actus'        => (int)$pdo->query("SELECT COUNT(*) FROM actus WHERE statut = 'publie'")->fetchColumn(),
    'revues'       => (int)$pdo->query("SELECT COUNT(*) FROM revues_presse")->fetchColumn(),
];

// Dernières actus
$actus = $pdo->query("SELECT * FROM actus ORDER BY created_at DESC LIMIT 5")->fetchAll();

// Derniers livres ajoutés
$livres = $pdo->query(
    "SELECT l.titre, l.slug, l.statut, a.prenom, a.nom
     FROM livres l JOIN auteurs a ON a.id = l.auteur_id
     ORDER BY l.created_at DESC LIMIT 5"
)->fetchAll();
?>

<!-- En-tête page -->
<div class="admin-page-header">
  <h1 class="admin-page-title">Dashboard</h1>
  <span style="font-size:.85rem;color:var(--admin-muted)">
    <?= date('l d F Y') ?>
  </span>
</div>

<!-- Stats -->
<div class="row g-3 mb-4">
  <?php
  $statCards = [
    ['val' => $stats['publie'],     'label' => 'Livres publiés',  'link' => 'livres.php?statut=publie',    'color' => '#16a34a'],
    ['val' => $stats['a_paraitre'], 'label' => 'À paraître',      'link' => 'livres.php?statut=a_paraitre','color' => '#d97706'],
    ['val' => $stats['brouillons'], 'label' => 'Brouillons',      'link' => 'livres.php?statut=brouillon', 'color' => '#6b7280'],
    ['val' => $stats['auteurs'],    'label' => 'Auteurs actifs',  'link' => 'auteurs.php',                 'color' => '#1a4a8a'],
    ['val' => $stats['actus'],      'label' => 'Actus publiées',  'link' => 'actus.php',                   'color' => '#7c3aed'],
    ['val' => $stats['revues'],     'label' => 'Revues de presse','link' => 'revues.php',                  'color' => '#0891b2'],
  ];
  foreach ($statCards as $s): ?>
  <div class="col-6 col-md-4 col-lg-2">
    <a href="<?= BASE ?>/admin/<?= $s['link'] ?>" class="text-decoration-none">
      <div class="stat-card">
        <div class="stat-value" style="color:<?= $s['color'] ?>"><?= $s['val'] ?></div>
        <div class="stat-label"><?= $s['label'] ?></div>
      </div>
    </a>
  </div>
  <?php endforeach; ?>
</div>

<!-- Raccourcis -->
<div class="d-flex flex-wrap gap-2 mb-5">
  <a href="<?= BASE ?>/admin/livre-nouveau.php" class="admin-btn admin-btn-primary">+ Nouveau livre</a>
  <a href="<?= BASE ?>/admin/auteur-nouveau.php" class="admin-btn admin-btn-primary">+ Nouvel auteur</a>
  <a href="<?= BASE ?>/admin/actu-nouvelle.php" class="admin-btn admin-btn-primary">+ Nouvelle actu</a>
  <a href="<?= BASE ?>/admin/revue-nouvelle.php" class="admin-btn admin-btn-primary">+ Nouvelle revue</a>
</div>

<!-- Derniers contenus -->
<div class="row g-4">

  <!-- Derniers livres -->
  <div class="col-lg-6">
    <div class="admin-card">
      <div class="admin-card-header d-flex justify-content-between align-items-center">
        <span>Derniers livres ajoutés</span>
        <a href="<?= BASE ?>/admin/livres.php" style="font-size:.8rem;color:var(--admin-accent)">Tout voir →</a>
      </div>
      <table class="admin-table">
        <tbody>
          <?php foreach ($livres as $l): ?>
          <tr>
            <td>
              <div style="font-weight:500;font-size:.875rem"><?= e($l['titre']) ?></div>
              <div style="font-size:.78rem;color:var(--admin-muted)"><?= e($l['prenom'] . ' ' . $l['nom']) ?></div>
            </td>
            <td>
              <?php
              $bc = match($l['statut']) {
                'publie'     => 'badge-publie',
                'a_paraitre' => 'badge-a-paraitre',
                'epuise'     => 'badge-epuise',
                default      => 'badge-brouillon',
              };
              ?>
              <span class="<?= $bc ?>"><?= e($l['statut']) ?></span>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Dernières actus -->
  <div class="col-lg-6">
    <div class="admin-card">
      <div class="admin-card-header d-flex justify-content-between align-items-center">
        <span>Dernières actualités</span>
        <a href="<?= BASE ?>/admin/actus.php" style="font-size:.8rem;color:var(--admin-accent)">Tout voir →</a>
      </div>
      <table class="admin-table">
        <tbody>
          <?php foreach ($actus as $a): ?>
          <tr>
            <td>
              <div style="font-weight:500;font-size:.875rem"><?= e($a['titre']) ?></div>
              <div style="font-size:.78rem;color:var(--admin-muted)">
                <?= e($a['categorie']) ?> · <?= date('d/m/Y', strtotime($a['date_actu'])) ?>
              </div>
            </td>
            <td>
              <span class="<?= $a['statut'] === 'publie' ? 'badge-publie' : 'badge-brouillon' ?>">
                <?= e($a['statut']) ?>
              </span>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

</div>

<!-- Liens externes -->
<div class="mt-4 p-3 rounded border" style="background:#f8f9fb;font-size:.875rem">
  <span style="color:var(--admin-muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">Services externes</span>
  <div class="d-flex flex-wrap gap-3 mt-2">
    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" class="text-blue47">Stripe →</a>
    <a href="https://www.ovhcloud.com/fr/sms/" target="_blank" rel="noopener" class="text-blue47">OVH SMS →</a>
    <a href="https://supabase.com" target="_blank" rel="noopener" class="text-blue47">Supabase →</a>
    <a href="<?= BASE ?>/admin/collections.php" class="text-blue47">Collections →</a>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
