<?php
$adminTitle = 'Auteurs';
require_once __DIR__ . '/../includes/admin-header.php';

$auteurs = $pdo->query(
    "SELECT a.*, (SELECT COUNT(*) FROM livres WHERE auteur_id = a.id) AS nb_livres
     FROM auteurs a ORDER BY a.ordre, a.nom"
)->fetchAll();
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Auteurs</h1>
  <a href="<?= BASE ?>/admin/auteur-nouveau.php" class="admin-btn admin-btn-primary">+ Nouvel auteur</a>
</div>

<div class="admin-card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>Photo</th>
        <th>Nom</th>
        <th>Slug</th>
        <th>Livres</th>
        <th>Statut</th>
        <th>Ordre</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($auteurs as $a): ?>
      <tr>
        <td>
          <?php if ($a['photo']): ?>
            <img src="<?= BASE ?>/assets/img/<?= e($a['photo']) ?>"
                 alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid #e0e4ef">
          <?php else: ?>
            <div style="width:40px;height:40px;border-radius:50%;background:#f0f2f5;display:flex;align-items:center;justify-content:center;font-size:.9rem">✍</div>
          <?php endif; ?>
        </td>
        <td>
          <strong><?= e($a['prenom'] . ' ' . $a['nom']) ?></strong>
        </td>
        <td><code style="font-size:.75rem"><?= e($a['slug']) ?></code></td>
        <td><?= $a['nb_livres'] ?></td>
        <td>
          <span class="<?= $a['statut'] === 'actif' ? 'badge-publie' : 'badge-brouillon' ?>">
            <?= e($a['statut']) ?>
          </span>
        </td>
        <td><?= e($a['ordre']) ?></td>
        <td>
          <div class="admin-actions">
            <a href="<?= BASE ?>/admin/auteur-edit.php?id=<?= $a['id'] ?>"
               class="admin-btn admin-btn-edit">Modifier</a>
            <?php if ($a['nb_livres'] == 0): ?>
            <form method="post" action="<?= BASE ?>/admin/auteur-delete.php" style="display:inline">
              <input type="hidden" name="id" value="<?= $a['id'] ?>">
              <?= csrf_field() ?>
              <button type="submit" class="admin-btn admin-btn-delete"
                      data-confirm="Supprimer l'auteur « <?= e($a['prenom'] . ' ' . $a['nom']) ?> » ?">
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
