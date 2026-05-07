<?php
$adminTitle = 'Modifier revue de presse';
require_once __DIR__ . '/../includes/admin-header.php';

$id   = (int)($_GET['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM revues_presse WHERE id = ?");
$stmt->execute([$id]);
$revue = $stmt->fetch();

if (!$revue) {
    flash('error', 'Revue introuvable.');
    redirect(BASE . '/admin/revues.php');
}

$livres = $pdo->query("SELECT id, titre FROM livres WHERE statut IN ('publie','a_paraitre') ORDER BY titre")->fetchAll();
$types  = ['Revue', 'Critique', 'Interview', 'Article'];

$errors = [];
$vals   = $revue;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['source']        = trim($_POST['source']        ?? '');
    $vals['date_revue']    = trim($_POST['date_revue']    ?? '');
    $vals['livre_id']      = (int)($_POST['livre_id']     ?? 0) ?: null;
    $vals['type']          = trim($_POST['type']          ?? 'Revue');
    $vals['titre_article'] = trim($_POST['titre_article'] ?? '');
    $vals['citation']      = trim($_POST['citation']      ?? '');
    $vals['url']           = trim($_POST['url']           ?? '');

    if (!$vals['source'])                                $errors['source']     = 'Source requise.';
    if (!$vals['date_revue'])                            $errors['date_revue'] = 'Date requise.';
    if (!in_array($vals['type'], $types, true))          $errors['type']       = 'Type invalide.';
    if ($vals['url'] && !filter_var($vals['url'], FILTER_VALIDATE_URL)) $errors['url'] = 'URL invalide.';

    if (!$errors) {
        $stmt = $pdo->prepare(
            "UPDATE revues_presse SET source=?, date_revue=?, livre_id=?, type=?, titre_article=?, citation=?, url=? WHERE id=?"
        );
        $stmt->execute([
            $vals['source'], $vals['date_revue'], $vals['livre_id'],
            $vals['type'], $vals['titre_article'], $vals['citation'], $vals['url'], $id
        ]);
        flash('success', 'Revue de presse mise à jour.');
        redirect(BASE . '/admin/revues.php');
    }
}
?>

<div class="admin-page-header">
  <h1 class="admin-page-title">Modifier : <?= e($revue['source']) ?></h1>
  <a href="<?= BASE ?>/admin/revues.php" class="admin-btn">← Retour</a>
</div>

<div class="admin-card" style="max-width:760px">
  <div class="admin-card-body">
    <form method="post">
      <?= csrf_field() ?>
      <div class="row g-3">
        <div class="col-sm-8">
          <div class="admin-form-group">
            <label for="source">Source <span class="text-danger">*</span></label>
            <input type="text" id="source" name="source"
                   class="form-control <?= isset($errors['source']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['source']) ?>" required>
            <?php if (isset($errors['source'])): ?><div class="invalid-feedback"><?= e($errors['source']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="admin-form-group">
            <label for="date_revue">Date</label>
            <input type="date" id="date_revue" name="date_revue" class="form-control"
                   value="<?= e($vals['date_revue']) ?>">
          </div>
        </div>
        <div class="col-sm-6">
          <div class="admin-form-group">
            <label for="type">Type</label>
            <select id="type" name="type" class="form-select">
              <?php foreach ($types as $t): ?>
                <option value="<?= e($t) ?>" <?= $vals['type'] === $t ? 'selected' : '' ?>><?= e($t) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="col-sm-6">
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
            <label for="titre_article">Titre de l'article</label>
            <input type="text" id="titre_article" name="titre_article" class="form-control"
                   value="<?= e($vals['titre_article']) ?>">
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="url">URL de l'article</label>
            <input type="url" id="url" name="url"
                   class="form-control <?= isset($errors['url']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['url']) ?>" placeholder="https://…">
            <?php if (isset($errors['url'])): ?><div class="invalid-feedback"><?= e($errors['url']) ?></div><?php endif; ?>
          </div>
        </div>
        <div class="col-12">
          <div class="admin-form-group">
            <label for="citation">Citation / Extrait</label>
            <textarea id="citation" name="citation" rows="5" class="form-control"><?= e($vals['citation']) ?></textarea>
          </div>
        </div>
        <div class="col-12 d-flex gap-2">
          <button type="submit" class="admin-btn admin-btn-primary">Enregistrer</button>
          <a href="<?= BASE ?>/admin/revues.php" class="admin-btn">Annuler</a>
        </div>
      </div>
    </form>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
