<?php
$pageTitle = 'Soumettre un manuscrit';
$pageDesc  = 'Vous êtes auteur ? Soumettez votre manuscrit aux Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';

$success = false;
$errors  = [];
$vals    = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    // Champs texte
    $vals['prenom']    = trim($_POST['prenom']    ?? '');
    $vals['nom']       = trim($_POST['nom']       ?? '');
    $vals['email']     = trim($_POST['email']     ?? '');
    $vals['telephone'] = trim($_POST['telephone'] ?? '');
    $vals['titre']     = trim($_POST['titre']     ?? '');
    $vals['genre']     = trim($_POST['genre']     ?? '');
    $vals['resume']    = trim($_POST['resume']    ?? '');
    $vals['extrait']   = trim($_POST['extrait']   ?? '');
    // Honeypot
    $honeypot = $_POST['website'] ?? '';

    if ($honeypot) {
        $success = true; // Silencieux
    } else {
        if (!$vals['prenom'])    $errors['prenom']  = 'Prénom requis.';
        if (!$vals['nom'])       $errors['nom']     = 'Nom requis.';
        if (!filter_var($vals['email'], FILTER_VALIDATE_EMAIL))
                                 $errors['email']   = 'Email invalide.';
        if (!$vals['titre'])     $errors['titre']   = 'Titre du manuscrit requis.';
        if (!$vals['genre'])     $errors['genre']   = 'Genre requis.';
        if (strlen($vals['resume']) < 50) $errors['resume'] = 'Le résumé doit faire au moins 50 caractères.';

        if (!$errors) {
            $sujet = 'Soumission manuscrit : ' . $vals['titre'] . ' — ' . $vals['prenom'] . ' ' . $vals['nom'];
            $corps = "Prénom : {$vals['prenom']}\n"
                   . "Nom : {$vals['nom']}\n"
                   . "Email : {$vals['email']}\n"
                   . "Téléphone : {$vals['telephone']}\n"
                   . "Titre : {$vals['titre']}\n"
                   . "Genre : {$vals['genre']}\n\n"
                   . "Résumé :\n{$vals['resume']}\n\n"
                   . "Extrait :\n{$vals['extrait']}";

            $headers  = "From: " . MAIL_NAME . " <" . MAIL_FROM . ">\r\n";
            $headers .= "Reply-To: {$vals['email']}\r\n";
            $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

            mail(MAIL_TO, $sujet, $corps, $headers);

            // Accusé de réception à l'auteur
            $acuse = "Bonjour {$vals['prenom']},\n\n"
                   . "Nous avons bien reçu votre soumission de manuscrit « {$vals['titre']} ».\n"
                   . "Nous lisons toutes les propositions et vous répondrons dans les meilleurs délais.\n\n"
                   . "Bien cordialement,\nLes Éditions Bleu 47";
            mail($vals['email'], 'Votre soumission de manuscrit — Bleu 47', $acuse, $headers);

            $success = true;
            $vals    = [];
        }
    }
}

$genres = ['Polar / Thriller', 'Roman / Fiction', 'Bande dessinée', 'Roman graphique', 'Autre'];
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Soumettre un manuscrit</li>
    </ol>
  </nav>

  <div class="row g-5">

    <!-- Colonne texte -->
    <div class="col-lg-5">
      <h1 class="section-title mb-3">Vous avez un manuscrit ?</h1>
      <p style="font-size:1rem;line-height:1.8;color:var(--text-secondary)">
        Les Éditions Bleu 47 sont une maison indépendante ouverte aux nouvelles voix. Nous publions dans trois collections :
      </p>
      <ul style="color:var(--text-secondary);line-height:2;padding-left:1.25rem">
        <li><strong style="color:var(--adrenaline)">Adrénaline</strong> — polars, thrillers, romans noirs</li>
        <li><strong style="color:var(--fictions)">Fictions</strong> — romans, récits contemporains</li>
        <li><strong style="color:var(--bd)">BD / Romans graphiques</strong> — bande dessinée, roman graphique</li>
      </ul>
      <p style="font-size:.95rem;color:var(--text-secondary);line-height:1.8">
        Nous lisons toutes les soumissions et répondons à chaque auteur. Si votre projet correspond à notre ligne éditoriale, nous vous recontacterons pour en discuter.
      </p>
      <div class="p-3 rounded" style="background:var(--bg-secondary);border:1px solid var(--border);font-size:.875rem">
        <p class="mb-1 fw-500">Ce que nous attendons :</p>
        <ul class="mb-0" style="color:var(--text-secondary);padding-left:1.25rem;line-height:1.9">
          <li>Un résumé clair de votre projet (genre, thème, cible)</li>
          <li>Un extrait représentatif (optionnel mais apprécié)</li>
          <li>Vos coordonnées complètes</li>
        </ul>
      </div>
    </div>

    <!-- Formulaire -->
    <div class="col-lg-7">
      <?php if ($success): ?>
      <div class="alert alert-success rounded p-4">
        <h3 class="h5 mb-2">Merci pour votre soumission !</h3>
        <p class="mb-0">Nous avons bien reçu votre manuscrit et vous répondrons dans les meilleurs délais. Un accusé de réception vous a été envoyé par email.</p>
      </div>
      <?php else: ?>

      <form method="post" action="<?= BASE ?>/manuscrit.php" novalidate>
        <?= csrf_field() ?>
        <!-- Honeypot -->
        <input type="text" name="website" class="visually-hidden" tabindex="-1" autocomplete="off">

        <div class="row g-3">
          <div class="col-sm-6">
            <label for="prenom" class="form-label">Prénom <span class="text-danger">*</span></label>
            <input type="text" id="prenom" name="prenom" class="form-control <?= isset($errors['prenom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['prenom'] ?? '') ?>" required>
            <?php if (isset($errors['prenom'])): ?>
              <div class="invalid-feedback"><?= e($errors['prenom']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-6">
            <label for="nom" class="form-label">Nom <span class="text-danger">*</span></label>
            <input type="text" id="nom" name="nom" class="form-control <?= isset($errors['nom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['nom'] ?? '') ?>" required>
            <?php if (isset($errors['nom'])): ?>
              <div class="invalid-feedback"><?= e($errors['nom']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-8">
            <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
            <input type="email" id="email" name="email" class="form-control <?= isset($errors['email']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['email'] ?? '') ?>" required>
            <?php if (isset($errors['email'])): ?>
              <div class="invalid-feedback"><?= e($errors['email']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-4">
            <label for="telephone" class="form-label">Téléphone</label>
            <input type="tel" id="telephone" name="telephone" class="form-control"
                   value="<?= e($vals['telephone'] ?? '') ?>">
          </div>
          <div class="col-sm-8">
            <label for="titre" class="form-label">Titre du manuscrit <span class="text-danger">*</span></label>
            <input type="text" id="titre" name="titre" class="form-control <?= isset($errors['titre']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['titre'] ?? '') ?>" required>
            <?php if (isset($errors['titre'])): ?>
              <div class="invalid-feedback"><?= e($errors['titre']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-4">
            <label for="genre" class="form-label">Genre <span class="text-danger">*</span></label>
            <select id="genre" name="genre" class="form-select <?= isset($errors['genre']) ? 'is-invalid' : '' ?>" required>
              <option value="">— Choisir —</option>
              <?php foreach ($genres as $g): ?>
                <option value="<?= e($g) ?>" <?= ($vals['genre'] ?? '') === $g ? 'selected' : '' ?>><?= e($g) ?></option>
              <?php endforeach; ?>
            </select>
            <?php if (isset($errors['genre'])): ?>
              <div class="invalid-feedback"><?= e($errors['genre']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <label for="resume" class="form-label">Résumé du projet <span class="text-danger">*</span></label>
            <textarea id="resume" name="resume" rows="5" class="form-control <?= isset($errors['resume']) ? 'is-invalid' : '' ?>"
                      placeholder="Genre, thème principal, nombre de pages, originalité du projet..."
                      required><?= e($vals['resume'] ?? '') ?></textarea>
            <?php if (isset($errors['resume'])): ?>
              <div class="invalid-feedback"><?= e($errors['resume']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <label for="extrait" class="form-label">Extrait <span class="text-secondary" style="font-weight:400">(optionnel)</span></label>
            <textarea id="extrait" name="extrait" rows="6" class="form-control"
                      placeholder="Collez ici quelques pages représentatives de votre style..."><?= e($vals['extrait'] ?? '') ?></textarea>
          </div>
          <div class="col-12">
            <button type="submit" class="btn btn-primary px-4">
              Envoyer ma soumission →
            </button>
            <p class="mt-2 mb-0" style="font-size:.8rem;color:var(--text-muted)">
              <span class="text-danger">*</span> Champs obligatoires
            </p>
          </div>
        </div>
      </form>
      <?php endif; ?>
    </div>

  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
