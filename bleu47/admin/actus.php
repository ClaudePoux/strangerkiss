<?php
$adminTitle = 'Actualités';
require_once __DIR__ . '/../includes/admin-header.php';

$actus = $pdo->query(
    "SELECT a.*, l.titre AS livre_titre
     FROM actus a
     LEFT JOIN livres l ON l.id = a.livre_id
     ORDER BY a.date_actu DESC"
)->fetchAll();
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Actualités</h1>
  <a href="<?= BASE ?>/admin/actu-nouvelle.php" class="admin-btn admin-btn-primary">+ Nouvelle actu</a>
</div>

<div class="admin-card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Titre</th>
        <th>Catégorie</th>
        <th>Livre lié</th>
        <th>Statut</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($actus as $a): ?>
      <tr>
        <td style="white-space:nowrap;font-size:.875rem"><?= date('d/m/Y', strtotime($a['date_actu'])) ?></td>
        <td><strong><?= e($a['titre']) ?></strong></td>
        <td><span style="font-size:.75rem;color:var(--admin-muted)"><?= e($a['categorie']) ?></span></td>
        <td style="font-size:.8rem;color:var(--admin-muted)"><?= $a['livre_titre'] ? e($a['livre_titre']) : '—' ?></td>
        <td><span class="<?= $a['statut'] === 'publie' ? 'badge-publie' : 'badge-brouillon' ?>"><?= e($a['statut']) ?></span></td>
        <td>
          <div class="admin-actions">
            <a href="<?= BASE ?>/admin/actu-edit.php?id=<?= $a['id'] ?>" class="admin-btn admin-btn-edit">Modifier</a>
            <form method="post" action="<?= BASE ?>/admin/actu-delete.php" style="display:inline">
              <input type="hidden" name="id" value="<?= $a['id'] ?>">
              <?= csrf_field() ?>
              <button type="submit" class="admin-btn admin-btn-delete"
                      data-confirm="Supprimer « <?= e($a['titre']) ?> » ?">Supprimer</button>
            </form>
          </div>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
