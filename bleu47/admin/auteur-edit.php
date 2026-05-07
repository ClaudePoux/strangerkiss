<?php
$adminTitle = 'Modifier auteur';
require_once __DIR__ . '/../includes/admin-header.php';

$id   = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM auteurs WHERE id = ?");
$stmt->execute([$id]);
$auteur = $stmt->fetch();

if (!$auteur) {
    flash('error', 'Auteur introuvable.');
    redirect(BASE . '/admin/auteurs.php');
}

$errors = [];
$vals   = $auteur;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['prenom']   = trim($_POST['prenom']   ?? '');
    $vals['nom']      = trim($_POST['nom']       ?? '');
    $vals['slug']     = trim($_POST['slug']      ?? '');
    $vals['bio']      = trim($_POST['bio']       ?? '');
    $vals['site_web'] = trim($_POST['site_web']  ?? '');
    $vals['statut']   = in_array($_POST['statut'] ?? '', ['actif','inactif']) ? $_POST['statut'] : 'actif';
    $vals['ordre']    = (int)($_POST['ordre']    ?? 0);

    if (!$vals['prenom']) $errors['prenom'] = 'Prénom requis.';
    if (!$vals['nom'])    $errors['nom']    = 'Nom requis.';
    if (!$vals['slug'])   $vals['slug']     = slugify($vals['prenom'] . ' ' . $vals['nom']);

    $chk = $pdo->prepare("SELECT id FROM auteurs WHERE slug = ? AND id != ?");
    $chk->execute([$vals['slug'], $id]);
    if ($chk->fetch()) $errors['slug'] = 'Ce slug est déjà utilisé.';

    $photo = $auteur['photo'];
    if (!empty($_FILES['photo']['name'])) {
        $result = upload_image($_FILES['photo'], 'auteurs', 400);
        if ($result === false) {
            $errors['photo'] = 'Format invalide.';
        } else {
            if ($photo && file_exists(UPLOAD_DIR . $photo)) @unlink(UPLOAD_DIR . $photo);
            $photo = $result;
        }
    }
    if (!empty($_POST['delete_photo']) && $photo) {
        if (file_exists(UPLOAD_DIR . $photo)) @unlink(UPLOAD_DIR . $photo);
        $photo = null;
    }

    if (!$errors) {
        $stmt = $pdo->prepare(
            "UPDATE auteurs SET prenom=?, nom=?, slug=?, photo=?, bio=?, site_web=?, statut=?, ordre=? WHERE id=?"
        );
        $stmt->execute([$vals['prenom'], $vals['nom'], $vals['slug'], $photo,
                        $vals['bio'], $vals['site_web'], $vals['statut'], $vals['ordre'], $id]);
        flash('success', 'Auteur « ' . $vals['prenom'] . ' ' . $vals['nom'] . ' » mis à jour.');
        redirect(BASE . '/admin/auteurs.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Modifier : <?= e($auteur['prenom'] . ' ' . $auteur['nom']) ?></h1>
  <div class="d-flex gap-2">
    <a href="<?= BASE ?>/auteur.php?slug=<?= e($auteur['slug']) ?>" target="_blank" class="admin-btn" style="font-size:.8rem">Voir sur le site →</a>
    <a href="<?= BASE ?>/admin/auteurs.php" class="admin-btn">← Retour</a>
  </div>
</div>

<div class="admin-card" style="max-width:720px">
  <div class="admin-card-body">
    <form method="post" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <div class="row g-3">
        <div class="col-sm-6">
          <div class="admin-form-group">
            <label for="prenom">Prénom <span class="text-danger">*</span></label>
            <input type="text" id="prenom" name="prenom" class="form-control <?= isset($errors['prenom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['prenom']) ?>" required>
            <?php if (isset($errors['prenom'])): ?><div class="invalid-feedback"><?= e($errors['prenom']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="admin-form-group">
            <label for="nom">Nom <span class="text-danger">*</span></label>
            <input type="text" id="nom" name="nom" class="form-control <?= isset($errors['nom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['nom']) ?>" required>
            <?php if (isset($errors['nom'])): ?><div class="invalid-feedback"><?= e($errors['nom']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-8">
          <div class="admin-form-group">
            <label for="slug">Slug</label>
            <input type="text" id="slug" name="slug" class="form-control <?= isset($errors['slug']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['slug']) ?>">
            <?php if (isset($errors['slug'])): ?><div class="invalid-feedback"><?= e($errors['slug']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="ordre">Ordre</label>
            <input type="number" id="ordre" name="ordre" class="form-control" value="<?= e($vals['ordre']) ?>" min="0">
          </div>
        </div>
        <div class="col-sm-8">
          <div class="admin-form-group">
            <label for="site_web">Site web personnel</label>
            <input type="url" id="site_web" name="site_web" class="form-control"
                   value="<?= e($vals['site_web']) ?>" placeholder="https://...">
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="statut">Statut</label>
            <select id="statut" name="statut" class="form-select">
              <option value="actif"   <?= $vals['statut'] === 'actif'   ? 'selected' : '' ?>>Actif</option>
              <option value="inactif" <?= $vals['statut'] === 'inactif' ? 'selected' : '' ?>>Inactif</option>
            </select>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label>Photo</label>
            <?php if ($auteur['photo']): ?>
            <div class="mb-2 d-flex align-items-center gap-3">
              <img src="<?= BASE ?>/assets/img/<?= e($auteur['photo']) ?>" alt=""
                   style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #e0e4ef">
              <label class="d-flex align-items-center gap-1" style="font-size:.85rem;font-weight:400;cursor:pointer">
                <input type="checkbox" name="delete_photo" value="1"> Supprimer la photo
              </label>
            </div>
            <?php endif; ?>
            <input type="file" id="image-upload" name="photo" class="form-control <?= isset($errors['photo']) ? 'is-invalid' : '' ?>"
                   accept="image/jpeg,image/png,image/webp">
            <?php if (isset($errors['photo'])): ?><div class="invalid-feedback"><?= e($errors['photo']) ?></div><?php endif; ?>
            <img id="image-preview" src="" alt="" style="display:none;margin-top:.5rem;height:80px;border-radius:50%;object-fit:cover;border:2px solid #e0e4ef">
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="bio">Biographie <span style="font-weight:400;color:var(--admin-muted)">(HTML basique accepté)</span></label>
            <textarea id="bio" name="bio" rows="6" class="form-control"><?= e($vals['bio']) ?></textarea>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Enregistrer</button>
          <a href="<?= BASE ?>/admin/auteurs.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
