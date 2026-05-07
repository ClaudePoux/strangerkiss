<?php
$adminTitle = 'Collections';
require_once __DIR__ . '/../includes/admin-header.php';

$collections = $pdo->query(
    "SELECT c.*, (SELECT COUNT(*) FROM livres WHERE collection_id = c.id) AS nb_livres
     FROM collections c ORDER BY c.ordre"
)->fetchAll();
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Collections</h1>
  <a href="<?= BASE ?>/admin/collection-nouvelle.php" class="admin-btn admin-btn-primary">+ Nouvelle collection</a>
</div>

<div class="admin-card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>Ordre</th>
        <th>Couleur</th>
        <th>Nom</th>
        <th>Slug</th>
        <th>Livres</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($collections as $col): ?>
      <tr>
        <td><?= e($col['ordre']) ?></td>
        <td>
          <span class="color-dot" style="background:<?= e($col['couleur']) ?>"></span>
          <code style="font-size:.75rem"><?= e($col['couleur']) ?></code>
        </td>
        <td><strong><?= e($col['nom']) ?></strong></td>
        <td><code style="font-size:.75rem"><?= e($col['slug']) ?></code></td>
        <td><?= $col['nb_livres'] ?></td>
        <td>
          <div class="admin-actions">
            <a href="<?= BASE ?>/admin/collection-edit.php?id=<?= $col['id'] ?>"
               class="admin-btn admin-btn-edit">Modifier</a>
            <?php if ($col['nb_livres'] == 0): ?>
            <form method="post" action="<?= BASE ?>/admin/collection-delete.php" style="display:inline">
              <input type="hidden" name="id" value="<?= $col['id'] ?>">
              <?= csrf_field() ?>
              <button type="submit" class="admin-btn admin-btn-delete"
                      data-confirm="Supprimer la collection « <?= e($col['nom']) ?> » ?">
                Supprimer
              </button>
            </form>
            <?php else: ?>
            <span class="admin-btn" style="opacity:.4;cursor:not-allowed" title="Impossible : des livres sont liés">Supprimer</span>
            <?php endif; ?>
          </div>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
