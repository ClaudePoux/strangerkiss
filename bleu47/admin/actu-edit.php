<?php
$adminTitle = 'Modifier actualité';
require_once __DIR__ . '/../includes/admin-header.php';

$id   = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM actus WHERE id = ?");
$stmt->execute([$id]);
$actu = $stmt->fetch();

if (!$actu) {
    flash('error', 'Actualité introuvable.');
    redirect(BASE . '/admin/actus.php');
}

$livres     = $pdo->query("SELECT id, titre FROM livres WHERE statut IN ('publie','a_paraitre') ORDER BY titre")->fetchAll();
$categories = ['Actualité', 'Dédicace', 'Salon du livre', 'Parution'];

$errors = [];
$vals   = $actu;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['titre']    = trim($_POST['titre']    ?? '');
    $vals['date_actu']= trim($_POST['date_actu']?? '');
    $vals['categorie']= trim($_POST['categorie']?? '');
    $vals['contenu']  = trim($_POST['contenu']  ?? '');
    $vals['livre_id'] = (int)($_POST['livre_id']?? 0) ?: null;
    $vals['statut']   = trim($_POST['statut']   ?? 'publie');

    if (!$vals['titre'])                                  $errors['titre']    = 'Titre requis.';
    if (!$vals['date_actu'])                              $errors['date_actu']= 'Date requise.';
    if (!in_array($vals['categorie'], $categories, true)) $errors['categorie']= 'Catégorie invalide.';
    if (strlen($vals['contenu']) < 5)                     $errors['contenu']  = 'Contenu trop court.';

    if (!$errors) {
        $stmt = $pdo->prepare(
            "UPDATE actus SET titre=?, date_actu=?, categorie=?, contenu=?, livre_id=?, statut=? WHERE id=?"
        );
        $stmt->execute([$vals['titre'], $vals['date_actu'], $vals['categorie'], $vals['contenu'], $vals['livre_id'], $vals['statut'], $id]);
        flash('success', 'Actualité mise à jour.');
        redirect(BASE . '/admin/actus.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Modifier : <?= e($actu['titre']) ?></h1>
  <a href="<?= BASE ?>/admin/actus.php" class="admin-btn">← Retour</a>
</div>

<div class="admin-card" style="max-width:760px">
  <div class="admin-card-body">
    <form method="post">
      <?= csrf_field() ?>
      <div class="row g-3">
        <div class="col-12">
          <div class="admin-form-group">
            <label for="titre">Titre <span class="text-danger">*</span></label>
            <input type="text" id="titre" name="titre" class="form-control <?= isset($errors['titre']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['titre']) ?>" required>
            <?php if (isset($errors['titre'])): ?><div class="invalid-feedback"><?= e($errors['titre']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="date_actu">Date</label>
            <input type="date" id="date_actu" name="date_actu" class="form-control"
                   value="<?= e($vals['date_actu']) ?>">
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="categorie">Catégorie</label>
            <select id="categorie" name="categorie" class="form-select">
              <?php foreach ($categories as $c): ?>
                <option value="<?= e($c) ?>" <?= $vals['categorie'] === $c ? 'selected' : '' ?>><?= e($c) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="statut">Statut</label>
            <select id="statut" name="statut" class="form-select">
              <option value="publie"    <?= $vals['statut'] === 'publie'    ? 'selected' : '' ?>>Publié</option>
              <option value="brouillon" <?= $vals['statut'] === 'brouillon' ? 'selected' : '' ?>>Brouillon</option>
            </select>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="livre_id">Livre associé</label>
            <select id="livre_id" name="livre_id" class="form-select">
              <option value="">— Aucun —</option>
              <?php foreach ($livres as $l): ?>
                <option value="<?= $l['id'] ?>" <?= $vals['livre_id'] == $l['id'] ? 'selected' : '' ?>><?= e($l['titre']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="contenu">Contenu <span style="font-weight:400;color:var(--admin-muted)">(HTML basique accepté)</span></label>
            <textarea id="contenu" name="contenu" rows="8" class="form-control <?= isset($errors['contenu']) ? 'is-invalid' : '' ?>"><?= e($vals['contenu']) ?></textarea>
            <?php if (isset($errors['contenu'])): ?><div class="invalid-feedback"><?= e($errors['contenu']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Enregistrer</button>
          <a href="<?= BASE ?>/admin/actus.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
