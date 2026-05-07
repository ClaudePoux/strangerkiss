<?php
$adminTitle = 'Nouvelle actualité';
require_once __DIR__ . '/../includes/admin-header.php';

$livres = $pdo->query("SELECT id, titre FROM livres WHERE statut IN ('publie','a_paraitre') ORDER BY titre")->fetchAll();
$categories = ['Actualité', 'Dédicace', 'Salon du livre', 'Parution'];

$errors = [];
$vals   = ['titre' => '', 'date_actu' => date('Y-m-d'), 'categorie' => 'Actualité', 'contenu' => '', 'livre_id' => '', 'statut' => 'publie'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['titre']    = trim($_POST['titre']    ?? '');
    $vals['date_actu']= trim($_POST['date_actu']?? '');
    $vals['categorie']= trim($_POST['categorie']?? '');
    $vals['contenu']  = trim($_POST['contenu']  ?? '');
    $vals['livre_id'] = (int)($_POST['livre_id']?? 0) ?: null;
    $vals['statut']   = trim($_POST['statut']   ?? 'publie');

    if (!$vals['titre'])                                          $errors['titre']    = 'Titre requis.';
    if (!$vals['date_actu'])                                      $errors['date_actu']= 'Date requise.';
    if (!in_array($vals['categorie'], $categories, true))         $errors['categorie']= 'Catégorie invalide.';
    if (strlen($vals['contenu']) < 5)                             $errors['contenu']  = 'Contenu trop court.';

    if (!$errors) {
        $stmt = $pdo->prepare(
            "INSERT INTO actus (titre, date_actu, categorie, contenu, livre_id, statut) VALUES (?,?,?,?,?,?)"
        );
        $stmt->execute([$vals['titre'], $vals['date_actu'], $vals['categorie'], $vals['contenu'], $vals['livre_id'], $vals['statut']]);
        flash('success', 'Actualité « ' . $vals['titre'] . ' » créée.');
        redirect(BASE . '/admin/actus.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Nouvelle actualité</h1>
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
            <label for="date_actu">Date <span class="text-danger">*</span></label>
            <input type="date" id="date_actu" name="date_actu" class="form-control <?= isset($errors['date_actu']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['date_actu']) ?>" required>
            <?php if (isset($errors['date_actu'])): ?><div class="invalid-feedback"><?= e($errors['date_actu']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="categorie">Catégorie <span class="text-danger">*</span></label>
            <select id="categorie" name="categorie" class="form-select <?= isset($errors['categorie']) ? 'is-invalid' : '' ?>">
              <?php foreach ($categories as $c): ?>
                <option value="<?= e($c) ?>" <?= $vals['categorie'] === $c ? 'selected' : '' ?>><?= e($c) ?></option>
              <?php endforeach; ?>
            </select>
            <?php if (isset($errors['categorie'])): ?><div class="invalid-feedback"><?= e($errors['categorie']) ?></div><?php endif; ?>
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
            <label for="livre_id">Livre associé <span style="font-weight:400;color:var(--admin-muted)">(optionnel)</span></label>
            <select id="livre_id" name="livre_id" class="form-select">
              <option value="">— Aucun —</option>
              <?php foreach ($livres as $l): ?>
                <option value="<?= $l['id'] ?>" <?= $vals['livre_id'] == $l['id'] ? 'selected' : '' ?>>
                  <?= e($l['titre']) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="contenu">Contenu <span class="text-danger">*</span> <span style="font-weight:400;color:var(--admin-muted)">(HTML basique accepté)</span></label>
            <textarea id="contenu" name="contenu" rows="8" class="form-control <?= isset($errors['contenu']) ? 'is-invalid' : '' ?>"><?= e($vals['contenu']) ?></textarea>
            <?php if (isset($errors['contenu'])): ?><div class="invalid-feedback"><?= e($errors['contenu']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Créer l'actualité</button>
          <a href="<?= BASE ?>/admin/actus.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
