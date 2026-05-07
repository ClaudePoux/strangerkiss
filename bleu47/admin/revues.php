<?php
$adminTitle = 'Revues de presse';
require_once __DIR__ . '/../includes/admin-header.php';

$revues = $pdo->query(
    "SELECT r.*, l.titre AS livre_titre
     FROM revues_presse r
     LEFT JOIN livres l ON l.id = r.livre_id
     ORDER BY r.date_revue DESC"
)->fetchAll();
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Revues de presse</h1>
  <a href="<?= BASE ?>/admin/revue-nouvelle.php" class="admin-btn admin-btn-primary">+ Nouvelle revue</a>
</div>

<div class="admin-card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Source</th>
        <th>Type</th>
        <th>Livre lié</th>
        <th>Citation</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($revues as $r): ?>
      <tr>
        <td style="white-space:nowrap;font-size:.875rem"><?= date('d/m/Y', strtotime($r['date_revue'])) ?></td>
        <td><strong style="font-size:.875rem"><?= e($r['source']) ?></strong>
          <?php if ($r['titre_article']): ?>
            <div style="font-size:.75rem;color:var(--admin-muted)"><?= e($r['titre_article']) ?></div>
          <?php endif; ?>
        </td>
        <td><span style="font-size:.75rem;color:var(--admin-muted)"><?= e($r['type']) ?></span></td>
        <td style="font-size:.8rem;color:var(--admin-muted)"><?= $r['livre_titre'] ? e($r['livre_titre']) : '—' ?></td>
        <td style="font-size:.8rem;color:var(--admin-muted);max-width:200px">
          <?= $r['citation'] ? mb_substr(e($r['citation']), 0, 80) . '…' : '—' ?>
        </td>
        <td>
          <div class="admin-actions">
            <a href="<?= BASE ?>/admin/revue-edit.php?id=<?= $r['id'] ?>" class="admin-btn admin-btn-edit">Modifier</a>
            <form method="post" action="<?= BASE ?>/admin/revue-delete.php" style="display:inline">
              <input type="hidden" name="id" value="<?= $r['id'] ?>">
              <?= csrf_field() ?>
              <button type="submit" class="admin-btn admin-btn-delete"
                      data-confirm="Supprimer cette revue ?">Supprimer</button>
            </form>
          </div>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
