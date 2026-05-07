<?php
$adminTitle = 'Livres';
require_once __DIR__ . '/../includes/admin-header.php';

$filtreStatut     = trim($_GET['statut']     ?? '');
$filtreCollection = (int)($_GET['collection'] ?? 0);

$statuts     = ['publie', 'a_paraitre', 'epuise', 'brouillon'];
$collections = $pdo->query("SELECT id, nom FROM collections ORDER BY ordre")->fetchAll();

$sql    = "SELECT l.*, a.prenom, a.nom AS nom_auteur, c.nom AS collection_nom, c.couleur
           FROM livres l
           JOIN auteurs a ON a.id = l.auteur_id
           JOIN collections c ON c.id = l.collection_id
           WHERE 1";
$params = [];

if ($filtreStatut && in_array($filtreStatut, $statuts, true)) {
    $sql .= " AND l.statut = ?";
    $params[] = $filtreStatut;
}
if ($filtreCollection) {
    $sql .= " AND l.collection_id = ?";
    $params[] = $filtreCollection;
}
$sql .= " ORDER BY l.date_parution DESC, l.titre";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$livres = $stmt->fetchAll();
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Livres <span style="font-size:.9rem;color:var(--admin-muted)">(<?= count($livres) ?>)</span></h1>
  <a href="<?= BASE ?>/admin/livre-nouveau.php" class="admin-btn admin-btn-primary">+ Nouveau livre</a>
</div>

<!-- Filtres -->
<form method="get" class="d-flex flex-wrap gap-2 mb-4">
  <select name="statut" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
    <option value="">Tous les statuts</option>
    <?php foreach ($statuts as $s): ?>
      <option value="<?= $s ?>" <?= $filtreStatut === $s ? 'selected' : '' ?>><?= e($s) ?></option>
    <?php endforeach; ?>
  </select>
  <select name="collection" class="form-select form-select-sm" style="width:auto" onchange="this.form.submit()">
    <option value="">Toutes les collections</option>
    <?php foreach ($collections as $c): ?>
      <option value="<?= $c['id'] ?>" <?= $filtreCollection === $c['id'] ? 'selected' : '' ?>><?= e($c['nom']) ?></option>
    <?php endforeach; ?>
  </select>
  <?php if ($filtreStatut || $filtreCollection): ?>
    <a href="<?= BASE ?>/admin/livres.php" class="admin-btn">Réinitialiser</a>
  <?php endif; ?>
</form>

<div class="admin-card">
  <table class="admin-table">
    <thead>
      <tr>
        <th>Couverture</th>
        <th>Titre</th>
        <th>Auteur</th>
        <th>Collection</th>
        <th>Parution</th>
        <th>Statut</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($livres as $l): ?>
      <tr>
        <td>
          <?php if ($l['couverture']): ?>
            <img src="<?= BASE ?>/assets/img/<?= e($l['couverture']) ?>" alt="" class="admin-thumb">
          <?php else: ?>
            <div class="admin-thumb-placeholder">–</div>
          <?php endif; ?>
        </td>
        <td>
          <strong><?= e($l['titre']) ?></strong>
          <?php if ($l['isbn_papier']): ?>
            <div style="font-size:.72rem;color:var(--admin-muted)">ISBN: <?= e($l['isbn_papier']) ?></div>
          <?php endif; ?>
        </td>
        <td style="font-size:.875rem"><?= e($l['prenom'] . ' ' . $l['nom_auteur']) ?></td>
        <td>
          <span class="badge-collection" style="background:<?= e($l['couleur']) ?>;font-size:.68rem">
            <?= e($l['collection_nom']) ?>
          </span>
        </td>
        <td style="font-size:.875rem"><?= $l['date_parution'] ? date('d/m/Y', strtotime($l['date_parution'])) : '—' ?></td>
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
        <td>
          <div class="admin-actions">
            <a href="<?= BASE ?>/admin/livre-edit.php?id=<?= $l['id'] ?>"
               class="admin-btn admin-btn-edit">Modifier</a>
            <form method="post" action="<?= BASE ?>/admin/livre-delete.php" style="display:inline">
              <input type="hidden" name="id" value="<?= $l['id'] ?>">
              <?= csrf_field() ?>
              <button type="submit" class="admin-btn admin-btn-delete"
                      data-confirm="Supprimer « <?= e($l['titre']) ?> » ?">
                Supprimer
              </button>
            </form>
          </div>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
