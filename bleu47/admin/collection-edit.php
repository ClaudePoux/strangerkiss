<?php
$adminTitle = 'Modifier collection';
require_once __DIR__ . '/../includes/admin-header.php';

$id  = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM collections WHERE id = ?");
$stmt->execute([$id]);
$col = $stmt->fetch();

if (!$col) {
    flash('error', 'Collection introuvable.');
    redirect(BASE . '/admin/collections.php');
}

$errors = [];
$vals   = $col;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['nom']         = trim($_POST['nom']         ?? '');
    $vals['slug']        = trim($_POST['slug']         ?? '');
    $vals['description'] = trim($_POST['description']  ?? '');
    $vals['couleur']     = trim($_POST['couleur']      ?? '#1a4a8a');
    $vals['ordre']       = (int)($_POST['ordre']       ?? 0);

    if (!$vals['nom'])  $errors['nom']  = 'Nom requis.';
    if (!$vals['slug']) $vals['slug']   = slugify($vals['nom']);

    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $vals['couleur'])) {
        $vals['couleur'] = $col['couleur'];
    }

    // Slug unique (hors soi-même)
    $chk = $pdo->prepare("SELECT id FROM collections WHERE slug = ? AND id != ?");
    $chk->execute([$vals['slug'], $id]);
    if ($chk->fetch()) $errors['slug'] = 'Ce slug est déjà utilisé.';

    // Upload nouvelle image
    $couverture = $col['couverture'];
    if (!empty($_FILES['couverture']['name'])) {
        $result = upload_image($_FILES['couverture'], 'couvertures', 600);
        if ($result === false) {
            $errors['couverture'] = 'Format invalide.';
        } else {
            // Supprime l'ancienne
            if ($couverture && file_exists(UPLOAD_DIR . $couverture)) {
                @unlink(UPLOAD_DIR . $couverture);
            }
            $couverture = $result;
        }
    }

    // Suppression image si case cochée
    if (!empty($_POST['delete_couverture']) && $couverture) {
        if (file_exists(UPLOAD_DIR . $couverture)) @unlink(UPLOAD_DIR . $couverture);
        $couverture = null;
    }

    if (!$errors) {
        $stmt = $pdo->prepare(
            "UPDATE collections SET nom=?, slug=?, description=?, couleur=?, couverture=?, ordre=? WHERE id=?"
        );
        $stmt->execute([$vals['nom'], $vals['slug'], $vals['description'], $vals['couleur'], $couverture, $vals['ordre'], $id]);
        flash('success', 'Collection « ' . $vals['nom'] . ' » mise à jour.');
        redirect(BASE . '/admin/collections.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Modifier : <?= e($col['nom']) ?></h1>
  <a href="<?= BASE ?>/admin/collections.php" class="admin-btn">← Retour</a>
</div>

<div class="admin-card" style="max-width:680px">
  <div class="admin-card-body">
    <form method="post" enctype="multipart/form-data">
      <?= csrf_field() ?>

      <div class="row g-3">
        <div class="col-md-8">
          <div class="admin-form-group">
            <label for="nom">Nom <span class="text-danger">*</span></label>
            <input type="text" id="nom" name="nom" class="form-control <?= isset($errors['nom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['nom']) ?>" required>
            <?php if (isset($errors['nom'])): ?><div class="invalid-feedback"><?= e($errors['nom']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-md-4">
          <div class="admin-form-group">
            <label for="ordre">Ordre</label>
            <input type="number" id="ordre" name="ordre" class="form-control" value="<?= e($vals['ordre']) ?>" min="0">
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="slug">Slug</label>
            <input type="text" id="slug" name="slug" class="form-control <?= isset($errors['slug']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['slug']) ?>">
            <?php if (isset($errors['slug'])): ?><div class="invalid-feedback"><?= e($errors['slug']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="3" class="form-control"><?= e($vals['description']) ?></textarea>
          </div>
        </div>
        <div class="col-md-4">
          <div class="admin-form-group">
            <label for="couleur">Couleur</label>
            <div class="d-flex gap-2 align-items-center">
              <input type="color" id="couleur" name="couleur" class="form-control form-control-color"
                     value="<?= e($vals['couleur']) ?>" style="width:50px;height:38px;padding:.2rem">
              <span id="couleur-preview" class="color-dot" style="background:<?= e($vals['couleur']) ?>;width:20px;height:20px"></span>
            </div>
          </div>
        </div>
        <div class="col-md-8">
          <div class="admin-form-group">
            <label>Image représentative</label>
            <?php if ($col['couverture']): ?>
            <div class="mb-2 d-flex align-items-center gap-3">
              <img src="<?= BASE ?>/assets/img/<?= e($col['couverture']) ?>" alt="" style="height:60px;border-radius:4px;border:1px solid #e0e4ef">
              <label class="d-flex align-items-center gap-1" style="font-size:.85rem;font-weight:400;cursor:pointer">
                <input type="checkbox" name="delete_couverture" value="1"> Supprimer l'image
              </label>
            </div>
            <?php endif; ?>
            <input type="file" id="couverture" name="couverture" class="form-control <?= isset($errors['couverture']) ? 'is-invalid' : '' ?>"
                   accept="image/jpeg,image/png,image/webp">
            <?php if (isset($errors['couverture'])): ?><div class="invalid-feedback"><?= e($errors['couverture']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Enregistrer</button>
          <a href="<?= BASE ?>/admin/collections.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<script>
document.getElementById('couleur').addEventListener('input', function() {
  document.getElementById('couleur-preview').style.background = this.value;
});
</script>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
