<?php
$adminTitle = 'Modifier livre';
require_once __DIR__ . '/../includes/admin-header.php';

$id   = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM livres WHERE id = ?");
$stmt->execute([$id]);
$livre = $stmt->fetch();

if (!$livre) {
    flash('error', 'Livre introuvable.');
    redirect(BASE . '/admin/livres.php');
}

$auteurs     = $pdo->query("SELECT id, prenom, nom FROM auteurs WHERE statut='actif' ORDER BY nom")->fetchAll();
$collections = $pdo->query("SELECT id, nom FROM collections ORDER BY ordre")->fetchAll();

$errors = [];
$vals   = $livre;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['titre']               = trim($_POST['titre']              ?? '');
    $vals['slug']                = trim($_POST['slug']               ?? '');
    $vals['auteur_id']           = (int)($_POST['auteur_id']         ?? 0);
    $vals['collection_id']       = (int)($_POST['collection_id']     ?? 0);
    $vals['isbn_papier']         = trim($_POST['isbn_papier']        ?? '');
    $vals['isbn_numerique']      = trim($_POST['isbn_numerique']     ?? '');
    $vals['annee']               = (int)($_POST['annee']             ?? 0) ?: null;
    $vals['nb_pages']            = (int)($_POST['nb_pages']          ?? 0) ?: null;
    $vals['quatrieme']           = trim($_POST['quatrieme']          ?? '');
    $vals['extrait']             = trim($_POST['extrait']            ?? '');
    $vals['prix_papier']         = str_replace(',', '.', trim($_POST['prix_papier']    ?? ''));
    $vals['prix_numerique']      = str_replace(',', '.', trim($_POST['prix_numerique'] ?? ''));
    $vals['disponible_papier']   = isset($_POST['disponible_papier'])   ? 1 : 0;
    $vals['disponible_numerique']= isset($_POST['disponible_numerique'])? 1 : 0;
    $vals['statut']              = trim($_POST['statut']             ?? 'brouillon');
    $vals['date_parution']       = trim($_POST['date_parution']      ?? '') ?: null;
    $vals['ordre']               = (int)($_POST['ordre']             ?? 0);

    if (!$vals['titre'])         $errors['titre']         = 'Titre requis.';
    if (!$vals['auteur_id'])     $errors['auteur_id']     = 'Auteur requis.';
    if (!$vals['collection_id']) $errors['collection_id'] = 'Collection requise.';
    if (!$vals['slug'])          $vals['slug']            = slugify($vals['titre']);

    $chk = $pdo->prepare("SELECT id FROM livres WHERE slug = ? AND id != ?");
    $chk->execute([$vals['slug'], $id]);
    if ($chk->fetch()) $errors['slug'] = 'Ce slug est déjà utilisé.';

    $prix_papier    = is_numeric($vals['prix_papier'])    ? (float)$vals['prix_papier']    : null;
    $prix_numerique = is_numeric($vals['prix_numerique']) ? (float)$vals['prix_numerique'] : null;

    // Upload couverture
    $couverture = $livre['couverture'];
    if (!empty($_FILES['couverture']['name'])) {
        $result = upload_image($_FILES['couverture'], 'couvertures', 400);
        if ($result === false) {
            $errors['couverture'] = 'Format invalide.';
        } else {
            if ($couverture && file_exists(UPLOAD_DIR . $couverture)) @unlink(UPLOAD_DIR . $couverture);
            $couverture = $result;
        }
    }
    if (!empty($_POST['delete_couverture']) && $couverture) {
        if (file_exists(UPLOAD_DIR . $couverture)) @unlink(UPLOAD_DIR . $couverture);
        $couverture = null;
    }

    if (!$errors) {
        $stmt = $pdo->prepare(
            "UPDATE livres SET titre=?, slug=?, auteur_id=?, collection_id=?, isbn_papier=?, isbn_numerique=?,
             annee=?, nb_pages=?, couverture=?, quatrieme=?, extrait=?, prix_papier=?, prix_numerique=?,
             disponible_papier=?, disponible_numerique=?, statut=?, date_parution=?, ordre=?
             WHERE id=?"
        );
        $stmt->execute([
            $vals['titre'], $vals['slug'], $vals['auteur_id'], $vals['collection_id'],
            $vals['isbn_papier'] ?: null, $vals['isbn_numerique'] ?: null,
            $vals['annee'], $vals['nb_pages'],
            $couverture, $vals['quatrieme'] ?: null, $vals['extrait'] ?: null,
            $prix_papier, $prix_numerique,
            $vals['disponible_papier'], $vals['disponible_numerique'],
            $vals['statut'], $vals['date_parution'], $vals['ordre'],
            $id,
        ]);
        flash('success', 'Livre « ' . $vals['titre'] . ' » mis à jour.');
        redirect(BASE . '/admin/livres.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Modifier : <?= e($livre['titre']) ?></h1>
  <div class="d-flex gap-2">
    <a href="<?= BASE ?>/livre.php?slug=<?= e($livre['slug']) ?>" target="_blank" class="admin-btn" style="font-size:.8rem">Voir →</a>
    <a href="<?= BASE ?>/admin/livres.php" class="admin-btn">← Retour</a>
  </div>
</div>

<form method="post" enctype="multipart/form-data">
<?= csrf_field() ?>
<div class="row g-4">

  <div class="col-lg-8">

    <div class="admin-card mb-4">
      <div class="admin-card-header">Informations principales</div>
      <div class="admin-card-body">
        <div class="row g-3">
          <div class="col-12">
            <div class="admin-form-group">
              <label for="titre">Titre <span class="text-danger">*</span></label>
              <input type="text" id="titre" name="titre" class="form-control <?= isset($errors['titre']) ? 'is-invalid' : '' ?>"
                     value="<?= e($vals['titre']) ?>" required>
              <?php if (isset($errors['titre'])): ?><div class="invalid-feedback"><?= e($errors['titre']) ?></div><?php endif; ?>
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
          <div class="col-sm-6">
            <div class="admin-form-group">
              <label for="auteur_id">Auteur <span class="text-danger">*</span></label>
              <select id="auteur_id" name="auteur_id" class="form-select <?= isset($errors['auteur_id']) ? 'is-invalid' : '' ?>" required>
                <option value="">— Choisir —</option>
                <?php foreach ($auteurs as $a): ?>
                  <option value="<?= $a['id'] ?>" <?= $vals['auteur_id'] == $a['id'] ? 'selected' : '' ?>>
                    <?= e($a['prenom'] . ' ' . $a['nom']) ?>
                  </option>
                <?php endforeach; ?>
              </select>
              <?php if (isset($errors['auteur_id'])): ?><div class="invalid-feedback"><?= e($errors['auteur_id']) ?></div><?php endif; ?>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="admin-form-group">
              <label for="collection_id">Collection <span class="text-danger">*</span></label>
              <select id="collection_id" name="collection_id" class="form-select <?= isset($errors['collection_id']) ? 'is-invalid' : '' ?>" required>
                <option value="">— Choisir —</option>
                <?php foreach ($collections as $c): ?>
                  <option value="<?= $c['id'] ?>" <?= $vals['collection_id'] == $c['id'] ? 'selected' : '' ?>>
                    <?= e($c['nom']) ?>
                  </option>
                <?php endforeach; ?>
              </select>
              <?php if (isset($errors['collection_id'])): ?><div class="invalid-feedback"><?= e($errors['collection_id']) ?></div><?php endif; ?>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card mb-4">
      <div class="admin-card-header">4ème de couverture</div>
      <div class="admin-card-body">
        <textarea id="quatrieme" name="quatrieme" rows="6" class="form-control"
                  placeholder="HTML basique accepté"><?= e($vals['quatrieme'] ?? '') ?></textarea>
      </div>
    </div>

    <div class="admin-card mb-4">
      <div class="admin-card-header">Extrait</div>
      <div class="admin-card-body">
        <textarea id="extrait" name="extrait" rows="5" class="form-control"><?= e($vals['extrait'] ?? '') ?></textarea>
      </div>
    </div>

  </div>

  <div class="col-lg-4">

    <div class="admin-card mb-4">
      <div class="admin-card-header">Publication</div>
      <div class="admin-card-body">
        <div class="admin-form-group">
          <label for="statut">Statut</label>
          <select id="statut" name="statut" class="form-select">
            <?php foreach (['brouillon','publie','a_paraitre','epuise'] as $s): ?>
              <option value="<?= $s ?>" <?= $vals['statut'] === $s ? 'selected' : '' ?>><?= e($s) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="admin-form-group">
          <label for="date_parution">Date de parution</label>
          <input type="date" id="date_parution" name="date_parution" class="form-control"
                 value="<?= e($vals['date_parution'] ?? '') ?>">
        </div>
        <div class="admin-form-group mb-0">
          <label for="ordre">Ordre</label>
          <input type="number" id="ordre" name="ordre" class="form-control" value="<?= e($vals['ordre']) ?>" min="0">
        </div>
      </div>
    </div>

    <div class="admin-card mb-4">
      <div class="admin-card-header">Couverture</div>
      <div class="admin-card-body">
        <?php if ($livre['couverture']): ?>
        <div class="mb-2">
          <img src="<?= BASE ?>/assets/img/<?= e($livre['couverture']) ?>" alt=""
               style="max-height:140px;border-radius:4px;border:1px solid #e0e4ef">
          <label class="d-flex align-items-center gap-1 mt-2" style="font-size:.85rem;font-weight:400;cursor:pointer">
            <input type="checkbox" name="delete_couverture" value="1"> Supprimer la couverture
          </label>
        </div>
        <?php endif; ?>
        <input type="file" id="image-upload" name="couverture"
               class="form-control <?= isset($errors['couverture']) ? 'is-invalid' : '' ?>"
               accept="image/jpeg,image/png,image/webp">
        <?php if (isset($errors['couverture'])): ?><div class="invalid-feedback"><?= e($errors['couverture']) ?></div><?php endif; ?>
        <img id="image-preview" src="" alt="" style="display:none;margin-top:.75rem;max-width:100%;border-radius:4px">
      </div>
    </div>

    <div class="admin-card mb-4">
      <div class="admin-card-header">Détails bibliographiques</div>
      <div class="admin-card-body">
        <div class="row g-2">
          <div class="col-6">
            <div class="admin-form-group">
              <label for="annee">Année</label>
              <input type="number" id="annee" name="annee" class="form-control"
                     value="<?= e($vals['annee'] ?? '') ?>" min="1900" max="2100">
            </div>
          </div>
          <div class="col-6">
            <div class="admin-form-group">
              <label for="nb_pages">Nb pages</label>
              <input type="number" id="nb_pages" name="nb_pages" class="form-control"
                     value="<?= e($vals['nb_pages'] ?? '') ?>" min="1">
            </div>
          </div>
          <div class="col-12">
            <div class="admin-form-group">
              <label for="isbn_papier">ISBN papier</label>
              <input type="text" id="isbn_papier" name="isbn_papier" class="form-control"
                     value="<?= e($vals['isbn_papier'] ?? '') ?>">
            </div>
          </div>
          <div class="col-12">
            <div class="admin-form-group mb-0">
              <label for="isbn_numerique">ISBN numérique</label>
              <input type="text" id="isbn_numerique" name="isbn_numerique" class="form-control"
                     value="<?= e($vals['isbn_numerique'] ?? '') ?>">
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card mb-4">
      <div class="admin-card-header">Prix et disponibilité</div>
      <div class="admin-card-body">
        <div class="row g-2">
          <div class="col-6">
            <div class="admin-form-group">
              <label for="prix_papier">Papier (€)</label>
              <input type="text" id="prix_papier" name="prix_papier" class="form-control"
                     value="<?= e($vals['prix_papier'] ?? '') ?>">
            </div>
          </div>
          <div class="col-6">
            <div class="admin-form-group">
              <label for="prix_numerique">Numérique (€)</label>
              <input type="text" id="prix_numerique" name="prix_numerique" class="form-control"
                     value="<?= e($vals['prix_numerique'] ?? '') ?>">
            </div>
          </div>
        </div>
        <div class="d-flex flex-column gap-2 mt-1">
          <label class="d-flex align-items-center gap-2" style="font-size:.875rem;font-weight:400;cursor:pointer">
            <input type="checkbox" name="disponible_papier" value="1" <?= $vals['disponible_papier'] ? 'checked' : '' ?>>
            Disponible en papier
          </label>
          <label class="d-flex align-items-center gap-2" style="font-size:.875rem;font-weight:400;cursor:pointer">
            <input type="checkbox" name="disponible_numerique" value="1" <?= $vals['disponible_numerique'] ? 'checked' : '' ?>>
            Disponible en numérique
          </label>
        </div>
      </div>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="admin-btn admin-btn-primary">Enregistrer</button>
      <a href="<?= BASE ?>/admin/livres.php" class="admin-btn">Annuler</a>
    </div>

  </div>
</div>
</form>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
