<?php
$pageTitle = 'Contact';
$pageDesc  = 'Contactez les Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';

$success = false;
$errors  = [];
$vals    = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $vals['nom']     = trim($_POST['nom']     ?? '');
    $vals['prenom']  = trim($_POST['prenom']  ?? '');
    $vals['email']   = trim($_POST['email']   ?? '');
    $vals['sujet']   = trim($_POST['sujet']   ?? '');
    $vals['message'] = trim($_POST['message'] ?? '');
    $honeypot = $_POST['website'] ?? '';

    if ($honeypot) {
        $success = true;
    } else {
        // Vérification hCaptcha
        $hcaptchaToken = $_POST['h-captcha-response'] ?? '';
        if (!hcaptcha_verify($hcaptchaToken)) {
            $errors['captcha'] = 'Vérification de sécurité échouée. Merci de recommencer.';
        }

        if (!$vals['nom'])     $errors['nom']     = 'Nom requis.';
        if (!$vals['prenom'])  $errors['prenom']  = 'Prénom requis.';
        if (!filter_var($vals['email'], FILTER_VALIDATE_EMAIL))
                               $errors['email']   = 'Email invalide.';
        if (!$vals['sujet'])   $errors['sujet']   = 'Sujet requis.';
        if (strlen($vals['message']) < 10)
                               $errors['message'] = 'Message trop court.';

        if (!$errors) {
            $sujet = '[Contact Bleu 47] ' . $vals['sujet'];
            $corps = "Prénom : {$vals['prenom']}\n"
                   . "Nom : {$vals['nom']}\n"
                   . "Email : {$vals['email']}\n\n"
                   . "Message :\n{$vals['message']}";

            $headers  = "From: " . MAIL_NAME . " <" . MAIL_FROM . ">\r\n";
            $headers .= "Reply-To: {$vals['email']}\r\n";
            $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

            mail(MAIL_TO, $sujet, $corps, $headers);

            $success = true;
            $vals    = [];
        }
    }
}
?>

<script src="https://js.hcaptcha.com/1/api.js" async defer></script>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Contact</li>
    </ol>
  </nav>

  <div class="row g-5">
    <div class="col-lg-4">
      <h1 class="section-title mb-3">Nous contacter</h1>
      <div class="d-flex flex-column gap-3">
        <div>
          <p class="mb-1 fw-500">Email</p>
          <a href="mailto:editeur@bleu47.fr" class="text-blue47">editeur@bleu47.fr</a>
        </div>
        <div>
          <p class="mb-1 fw-500">Adresse</p>
          <address style="font-style:normal;color:var(--text-secondary);font-size:.9rem">
            Éditions Bleu 47<br>
            24 rue de la Banque<br>
            71100 Chalon-sur-Saône
          </address>
        </div>
        <div>
          <p class="mb-1 fw-500">Pour soumettre un manuscrit</p>
          <a href="<?= BASE ?>/manuscrit.php" class="text-blue47 btn btn-outline-primary btn-sm">
            Formulaire manuscrit →
          </a>
        </div>
      </div>
    </div>

    <div class="col-lg-8">
      <?php if ($success): ?>
      <div class="alert alert-success p-4 rounded">
        <h3 class="h5 mb-2">Message envoyé !</h3>
        <p class="mb-0">Merci pour votre message. Nous vous répondrons dans les meilleurs délais.</p>
      </div>
      <?php else: ?>
      <form method="post" action="<?= BASE ?>/contact.php" novalidate>
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
          <div class="col-12">
            <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
            <input type="email" id="email" name="email" class="form-control <?= isset($errors['email']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['email'] ?? '') ?>" required>
            <?php if (isset($errors['email'])): ?>
              <div class="invalid-feedback"><?= e($errors['email']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <label for="sujet" class="form-label">Sujet <span class="text-danger">*</span></label>
            <input type="text" id="sujet" name="sujet" class="form-control <?= isset($errors['sujet']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['sujet'] ?? '') ?>" required>
            <?php if (isset($errors['sujet'])): ?>
              <div class="invalid-feedback"><?= e($errors['sujet']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <label for="message" class="form-label">Message <span class="text-danger">*</span></label>
            <textarea id="message" name="message" rows="6" class="form-control <?= isset($errors['message']) ? 'is-invalid' : '' ?>"
                      required><?= e($vals['message'] ?? '') ?></textarea>
            <?php if (isset($errors['message'])): ?>
              <div class="invalid-feedback"><?= e($errors['message']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <div class="h-captcha" data-sitekey="<?= HCAPTCHA_SITE_KEY ?>"></div>
            <?php if (isset($errors['captcha'])): ?>
              <div class="text-danger mt-1" style="font-size:.875rem"><?= e($errors['captcha']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-12">
            <button type="submit" class="btn btn-primary px-4">Envoyer →</button>
          </div>
        </div>
      </form>
      <?php endif; ?>
    </div>
  </div>

</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
