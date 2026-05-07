<?php
$adminTitle = 'Nouvelle collection';
require_once __DIR__ . '/../includes/admin-header.php';

$errors = [];
$vals   = ['nom' => '', 'slug' => '', 'description' => '', 'couleur' => '#1a4a8a', 'ordre' => 0];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['nom']         = trim($_POST['nom']         ?? '');
    $vals['slug']        = trim($_POST['slug']         ?? '');
    $vals['description'] = trim($_POST['description']  ?? '');
    $vals['couleur']     = trim($_POST['couleur']      ?? '#1a4a8a');
    $vals['ordre']       = (int)($_POST['ordre']       ?? 0);

    if (!$vals['nom'])  $errors['nom']  = 'Nom requis.';
    if (!$vals['slug']) $vals['slug']   = slugify($vals['nom']);

    // Slug unique
    if ($vals['slug']) {
        $chk = $pdo->prepare("SELECT id FROM collections WHERE slug = ?");
        $chk->execute([$vals['slug']]);
        if ($chk->fetch()) $errors['slug'] = 'Ce slug est déjà utilisé.';
    }

    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $vals['couleur'])) {
        $vals['couleur'] = '#1a4a8a';
    }

    // Upload image représentative
    $couverture = null;
    if (!empty($_FILES['couverture']['name'])) {
        $result = upload_image($_FILES['couverture'], 'couvertures', 600);
        if ($result === false) {
            $errors['couverture'] = 'Format invalide. JPG, PNG, WEBP acceptés.';
        } else {
            $couverture = $result;
        }
    }

    if (!$errors) {
        $stmt = $pdo->prepare(
            "INSERT INTO collections (nom, slug, description, couleur, couverture, ordre)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$vals['nom'], $vals['slug'], $vals['description'], $vals['couleur'], $couverture, $vals['ordre']]);
        flash('success', 'Collection « ' . $vals['nom'] . ' » créée.');
        redirect(BASE . '/admin/collections.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Nouvelle collection</h1>
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
            <label for="ordre">Ordre d'affichage</label>
            <input type="number" id="ordre" name="ordre" class="form-control"
                   value="<?= e($vals['ordre']) ?>" min="0">
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="slug">Slug (URL)</label>
            <input type="text" id="slug" name="slug" class="form-control <?= isset($errors['slug']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['slug']) ?>" placeholder="généré automatiquement">
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
            <label for="couleur">Couleur d'accentuation</label>
            <div class="d-flex gap-2 align-items-center">
              <input type="color" id="couleur" name="couleur" class="form-control form-control-color"
                     value="<?= e($vals['couleur']) ?>" style="width:50px;height:38px;padding:.2rem">
              <input type="text" id="couleur-preview-text" class="form-control form-control-sm"
                     value="<?= e($vals['couleur']) ?>" style="width:90px;font-family:monospace"
                     readonly>
              <span id="couleur-preview" class="color-dot" style="background:<?= e($vals['couleur']) ?>;width:20px;height:20px"></span>
            </div>
          </div>
        </div>
        <div class="col-md-8">
          <div class="admin-form-group">
            <label for="couverture">Image représentative (optionnel)</label>
            <input type="file" id="couverture" name="couverture" class="form-control <?= isset($errors['couverture']) ? 'is-invalid' : '' ?>"
                   accept="image/jpeg,image/png,image/webp">
            <?php if (isset($errors['couverture'])): ?><div class="invalid-feedback"><?= e($errors['couverture']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Créer la collection</button>
          <a href="<?= BASE ?>/admin/collections.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<script>
document.getElementById('couleur').addEventListener('input', function() {
  document.getElementById('couleur-preview').style.background = this.value;
  document.getElementById('couleur-preview-text').value = this.value;
});
document.getElementById('nom').addEventListener('input', function() {
  var slug = document.getElementById('slug');
  if (!slug.dataset.manual) {
    slug.value = this.value.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
  }
});
document.getElementById('slug').addEventListener('input', function() { this.dataset.manual = '1'; });
</script>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
