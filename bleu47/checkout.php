<?php
$pageTitle = 'Finaliser ma commande';
$pageDesc  = 'Finalisez votre commande — Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/stripe.php';

// Panier vide → retour catalogue
if (empty(panier_get())) {
    redirect(BASE . '/catalogue.php');
}

$errors = [];
$vals   = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $honeypot = $_POST['website'] ?? '';
    if ($honeypot) {
        // Bot silencieux — on simule un succès
        panier_vider();
        redirect(BASE . '/catalogue.php');
    }

    // Lecture champs
    $vals['prenom']       = trim($_POST['prenom']       ?? '');
    $vals['nom']          = trim($_POST['nom']          ?? '');
    $vals['email']        = trim($_POST['email']        ?? '');
    $vals['email_confirm']= trim($_POST['email_confirm']?? '');
    $vals['adresse']      = trim($_POST['adresse']      ?? '');
    $vals['code_postal']  = trim($_POST['code_postal']  ?? '');
    $vals['ville']        = trim($_POST['ville']        ?? '');
    $vals['pays']         = trim($_POST['pays']         ?? 'France');
    $vals['cgv']          = !empty($_POST['cgv']);
    $vals['type_client']    = in_array($_POST['type_client'] ?? '', ['particulier', 'professionnel'], true)
                              ? $_POST['type_client'] : 'particulier';
    $vals['raison_sociale'] = trim($_POST['raison_sociale'] ?? '');
    $vals['siret']          = trim($_POST['siret']          ?? '');

    // Validations
    if (!$vals['prenom'])  $errors['prenom'] = 'Prénom requis.';
    if (!$vals['nom'])     $errors['nom']    = 'Nom requis.';
    if (!filter_var($vals['email'], FILTER_VALIDATE_EMAIL))
                           $errors['email']  = 'Email invalide.';
    if ($vals['email'] !== $vals['email_confirm'])
                           $errors['email_confirm'] = 'Les emails ne correspondent pas.';
    if (!$vals['cgv'])     $errors['cgv'] = 'Vous devez accepter les CGV.';

    if (panier_has_papier()) {
        if (!$vals['adresse'])     $errors['adresse']     = 'Adresse requise.';
        if (!$vals['code_postal']) $errors['code_postal'] = 'Code postal requis.';
        if (!$vals['ville'])       $errors['ville']       = 'Ville requise.';
    }

    if ($vals['type_client'] === 'professionnel') {
        if (!$vals['raison_sociale']) $errors['raison_sociale'] = 'Raison sociale requise.';
        if (!$vals['siret'])          $errors['siret']          = 'SIRET requis.';
    }

    if (!$errors) {
        $poids     = panier_poids_total();
        $fraisPort = get_frais_port($pdo, $poids);
        if ($fraisPort === null) {
            $errors['_global'] = 'Poids hors tranche de livraison. Veuillez nous contacter.';
        }
    }

    if (!$errors) {
        $panier    = panier_get();
        $sousTotal = panier_sous_total();
        $tvaRate   = 0.055; // 5,5 %
        $montantHT = round($sousTotal / (1 + $tvaRate), 2);
        $montantTVA= round($sousTotal - $montantHT, 2);

        // Génère la référence
        $reference = generate_reference($pdo);

        // Insère la commande (en_attente)
        $stmt = $pdo->prepare(
            'INSERT INTO commandes
             (reference, email, nom, prenom, adresse, code_postal, ville, pays,
              montant_ht, montant_tva, montant_ttc, frais_port, statut,
              type_commande, type_client, raison_sociale, siret)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,\'en_attente\',?,?,?,?)'
        );
        $stmt->execute([
            $reference,
            $vals['email'],
            $vals['nom'],
            $vals['prenom'],
            panier_has_papier() ? $vals['adresse']     : null,
            panier_has_papier() ? $vals['code_postal'] : null,
            panier_has_papier() ? $vals['ville']       : null,
            panier_has_papier() ? $vals['pays']        : null,
            $montantHT,
            $montantTVA,
            $sousTotal,
            $fraisPort,
            panier_type_commande(),
            $vals['type_client'],
            $vals['raison_sociale'] ?: null,
            $vals['siret']          ?: null,
        ]);
        $commandeId = (int)$pdo->lastInsertId();

        // Insère les lignes de commande
        $stmtLigne = $pdo->prepare(
            'INSERT INTO lignes_commande
             (commande_id, livre_id, type_article, titre, auteur, prix_unitaire, quantite, sous_total)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        foreach ($panier as $item) {
            $stmtLigne->execute([
                $commandeId,
                $item['livre_id'],
                $item['type'],
                $item['titre'],
                $item['auteur'],
                $item['prix'],
                $item['quantite'],
                round($item['prix'] * $item['quantite'], 2),
            ]);
        }

        // Crée la session Stripe Checkout
        $commande = [
            'id'        => $commandeId,
            'reference' => $reference,
            'email'     => $vals['email'],
            'frais_port'=> $fraisPort,
        ];
        $session = stripe_create_checkout($commande, $panier);

        if (!empty($session['url'])) {
            // Sauvegarde l'ID session Stripe
            $pdo->prepare('UPDATE commandes SET stripe_session_id = ? WHERE id = ?')
                ->execute([$session['id'], $commandeId]);
            redirect($session['url']);
        } else {
            // Rollback manuel si Stripe échoue
            $pdo->prepare('UPDATE commandes SET statut = \'annulee\' WHERE id = ?')
                ->execute([$commandeId]);
            $errors['_global'] = 'Erreur de connexion à la plateforme de paiement. Veuillez réessayer.';
        }
    }
}

$poids    = panier_poids_total();
$fraisPort = get_frais_port($pdo, $poids);
$sousTotal = panier_sous_total();
$totalTTC  = $sousTotal + (float)($fraisPort ?? 0);
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item"><a href="<?= BASE ?>/panier.php">Panier</a></li>
      <li class="breadcrumb-item active">Finaliser</li>
    </ol>
  </nav>

  <h1 class="section-title mb-4">Finaliser ma commande</h1>

  <?php if (!empty($errors['_global'])): ?>
  <div class="alert alert-danger"><?= e($errors['_global']) ?></div>
  <?php endif; ?>

  <div class="row g-5">

    <!-- Formulaire -->
    <div class="col-lg-7">
      <form method="post" action="<?= BASE ?>/checkout.php" novalidate>
        <?= csrf_field() ?>
        <input type="text" name="website" class="visually-hidden" tabindex="-1" autocomplete="off">

        <h2 class="h5 mb-3" style="font-family:'Playfair Display',serif">Type de client</h2>
        <div class="mb-4">
          <div class="d-flex gap-4">
            <div class="form-check">
              <input class="form-check-input" type="radio" name="type_client" id="tc_particulier"
                     value="particulier" <?= ($vals['type_client'] ?? 'particulier') === 'particulier' ? 'checked' : '' ?>>
              <label class="form-check-label" for="tc_particulier">Particulier</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="type_client" id="tc_professionnel"
                     value="professionnel" <?= ($vals['type_client'] ?? '') === 'professionnel' ? 'checked' : '' ?>>
              <label class="form-check-label" for="tc_professionnel">Professionnel</label>
            </div>
          </div>
          <div id="pro-fields" class="row g-3 mt-2"
               style="display:<?= ($vals['type_client'] ?? '') === 'professionnel' ? 'flex' : 'none' ?>">
            <div class="col-12">
              <label for="raison_sociale" class="form-label">Raison sociale <span class="text-danger">*</span></label>
              <input type="text" id="raison_sociale" name="raison_sociale"
                     class="form-control <?= isset($errors['raison_sociale']) ? 'is-invalid' : '' ?>"
                     value="<?= e($vals['raison_sociale'] ?? '') ?>">
              <?php if (isset($errors['raison_sociale'])): ?>
                <div class="invalid-feedback"><?= e($errors['raison_sociale']) ?></div>
              <?php endif; ?>
            </div>
            <div class="col-sm-6">
              <label for="siret" class="form-label">SIRET <span class="text-danger">*</span></label>
              <input type="text" id="siret" name="siret"
                     class="form-control <?= isset($errors['siret']) ? 'is-invalid' : '' ?>"
                     value="<?= e($vals['siret'] ?? '') ?>" placeholder="531 634 285 00021">
              <?php if (isset($errors['siret'])): ?>
                <div class="invalid-feedback"><?= e($errors['siret']) ?></div>
              <?php endif; ?>
            </div>
          </div>
        </div>

        <h2 class="h5 mb-3" style="font-family:'Playfair Display',serif">Vos coordonnées</h2>
        <div class="row g-3 mb-4">
          <div class="col-sm-6">
            <label for="prenom" class="form-label">Prénom <span class="text-danger">*</span></label>
            <input type="text" id="prenom" name="prenom"
                   class="form-control <?= isset($errors['prenom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['prenom'] ?? '') ?>" required autocomplete="given-name">
            <?php if (isset($errors['prenom'])): ?>
              <div class="invalid-feedback"><?= e($errors['prenom']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-6">
            <label for="nom" class="form-label">Nom <span class="text-danger">*</span></label>
            <input type="text" id="nom" name="nom"
                   class="form-control <?= isset($errors['nom']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['nom'] ?? '') ?>" required autocomplete="family-name">
            <?php if (isset($errors['nom'])): ?>
              <div class="invalid-feedback"><?= e($errors['nom']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-6">
            <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
            <input type="email" id="email" name="email"
                   class="form-control <?= isset($errors['email']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['email'] ?? '') ?>" required autocomplete="email">
            <?php if (isset($errors['email'])): ?>
              <div class="invalid-feedback"><?= e($errors['email']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-6">
            <label for="email_confirm" class="form-label">Confirmer l'email <span class="text-danger">*</span></label>
            <input type="email" id="email_confirm" name="email_confirm"
                   class="form-control <?= isset($errors['email_confirm']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['email_confirm'] ?? '') ?>" required autocomplete="off">
            <?php if (isset($errors['email_confirm'])): ?>
              <div class="invalid-feedback"><?= e($errors['email_confirm']) ?></div>
            <?php endif; ?>
          </div>
        </div>

        <?php if (panier_has_papier()): ?>
        <h2 class="h5 mb-3" style="font-family:'Playfair Display',serif">Adresse de livraison</h2>
        <div class="row g-3 mb-4">
          <div class="col-12">
            <label for="adresse" class="form-label">Adresse <span class="text-danger">*</span></label>
            <input type="text" id="adresse" name="adresse"
                   class="form-control <?= isset($errors['adresse']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['adresse'] ?? '') ?>" required autocomplete="street-address">
            <?php if (isset($errors['adresse'])): ?>
              <div class="invalid-feedback"><?= e($errors['adresse']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-4">
            <label for="code_postal" class="form-label">Code postal <span class="text-danger">*</span></label>
            <input type="text" id="code_postal" name="code_postal"
                   class="form-control <?= isset($errors['code_postal']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['code_postal'] ?? '') ?>" required autocomplete="postal-code">
            <?php if (isset($errors['code_postal'])): ?>
              <div class="invalid-feedback"><?= e($errors['code_postal']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-5">
            <label for="ville" class="form-label">Ville <span class="text-danger">*</span></label>
            <input type="text" id="ville" name="ville"
                   class="form-control <?= isset($errors['ville']) ? 'is-invalid' : '' ?>"
                   value="<?= e($vals['ville'] ?? '') ?>" required autocomplete="address-level2">
            <?php if (isset($errors['ville'])): ?>
              <div class="invalid-feedback"><?= e($errors['ville']) ?></div>
            <?php endif; ?>
          </div>
          <div class="col-sm-3">
            <label for="pays" class="form-label">Pays</label>
            <input type="text" id="pays" name="pays"
                   class="form-control"
                   value="<?= e($vals['pays'] ?? 'France') ?>" autocomplete="country-name">
          </div>
        </div>
        <?php endif; ?>

        <div class="mb-4">
          <div class="form-check">
            <input class="form-check-input <?= isset($errors['cgv']) ? 'is-invalid' : '' ?>"
                   type="checkbox" id="cgv" name="cgv" value="1"
                   <?= !empty($vals['cgv']) ? 'checked' : '' ?> required>
            <label class="form-check-label" for="cgv" style="font-size:.9rem">
              J'accepte les <a href="<?= BASE ?>/mentions-legales.php#cgv" class="text-blue47" target="_blank">Conditions Générales de Vente</a>
              <span class="text-danger">*</span>
            </label>
            <?php if (isset($errors['cgv'])): ?>
              <div class="invalid-feedback"><?= e($errors['cgv']) ?></div>
            <?php endif; ?>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg px-5">
          Procéder au paiement →
        </button>
        <p class="mt-2 mb-0" style="font-size:.78rem;color:var(--text-muted)">
          Vous serez redirigé vers la plateforme sécurisée Stripe.
        </p>
      </form>
    </div>

    <!-- Récapitulatif commande -->
    <div class="col-lg-5">
      <div class="card border" style="border-radius:var(--radius-md);position:sticky;top:90px">
        <div class="card-body p-4">
          <h2 class="h5 mb-3" style="font-family:'Playfair Display',serif">Votre commande</h2>
          <?php foreach (panier_get() as $item): ?>
          <div class="d-flex justify-content-between mb-2" style="font-size:.9rem">
            <span>
              <?= e($item['titre']) ?>
              <span class="badge <?= $item['type'] === 'numerique' ? 'bg-info text-dark' : 'bg-secondary' ?>"
                    style="font-size:.65rem;vertical-align:middle">
                <?= $item['type'] === 'numerique' ? 'Num.' : 'Papier' ?>
              </span>
            </span>
            <span class="fw-500"><?= number_format($item['prix'], 2, ',', '') ?> €</span>
          </div>
          <?php endforeach; ?>
          <hr>
          <div class="d-flex justify-content-between mb-2" style="font-size:.9rem">
            <span class="text-secondary">Sous-total</span>
            <span><?= number_format($sousTotal, 2, ',', '') ?> €</span>
          </div>
          <?php if (panier_has_papier()): ?>
          <div class="d-flex justify-content-between mb-2" style="font-size:.9rem">
            <span class="text-secondary">Frais de port</span>
            <?php if ($fraisPort === null): ?>
              <span class="text-danger" style="font-size:.85rem">À calculer</span>
            <?php else: ?>
              <span><?= number_format($fraisPort, 2, ',', '') ?> €</span>
            <?php endif; ?>
          </div>
          <?php endif; ?>
          <?php
          $tvaRate    = 0.055;
          $livresHT   = round($sousTotal / (1 + $tvaRate), 2);
          $livreTVA   = round($sousTotal - $livresHT, 2);
          ?>
          <div class="d-flex justify-content-between mb-2" style="font-size:.85rem;color:var(--text-secondary)">
            <span>Total HT</span>
            <span><?= number_format($livresHT, 2, ',', '') ?> €</span>
          </div>
          <div class="d-flex justify-content-between mb-2" style="font-size:.85rem;color:var(--text-secondary)">
            <span>TVA 5,5 %</span>
            <span><?= number_format($livreTVA, 2, ',', '') ?> €</span>
          </div>
          <?php if (panier_has_papier() && $fraisPort !== null && $fraisPort > 0): ?>
          <div class="d-flex justify-content-between mb-2" style="font-size:.8rem;color:var(--text-muted)">
            <span>Frais de port (exo. TVA)</span>
            <span><?= number_format($fraisPort, 2, ',', '') ?> €</span>
          </div>
          <?php endif; ?>
          <hr>
          <div class="d-flex justify-content-between fw-bold" style="font-size:1.05rem">
            <span>Total TTC</span>
            <span><?= number_format($totalTTC, 2, ',', '') ?> €</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<script>
(function () {
  document.querySelectorAll('[name="type_client"]').forEach(function (r) {
    r.addEventListener('change', function () {
      document.getElementById('pro-fields').style.display =
        this.value === 'professionnel' ? 'flex' : 'none';
    });
  });
})();
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
