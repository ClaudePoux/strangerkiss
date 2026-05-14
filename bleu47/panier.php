<?php
// ─── Diagnostic temporaire ────────────────────────────────────────
ini_set('log_errors', 1);
$_logDir = __DIR__ . '/logs/';
if (!is_dir($_logDir)) { mkdir($_logDir, 0755, true); }
ini_set('error_log', $_logDir . 'panier.log');
error_reporting(E_ALL);
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        $msg = date('Y-m-d H:i:s') . ' [FATAL] ' . $e['message'] . ' in ' . $e['file'] . ':' . $e['line'] . PHP_EOL;
        file_put_contents(__DIR__ . '/logs/panier.log', $msg, FILE_APPEND | LOCK_EX);
        if (!headers_sent()) { http_response_code(500); }
        echo '<pre style="color:red;padding:1rem">[FATAL] ' . htmlspecialchars($e['message'])
           . "\nin " . htmlspecialchars($e['file']) . ':' . $e['line'] . '</pre>';
    }
});
// ─────────────────────────────────────────────────────────────────

$pageTitle = 'Mon panier';
$pageDesc  = 'Votre panier — Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';

// ─── Actions panier ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $action = trim($_POST['action'] ?? '');

    if ($action === 'ajouter') {
        $livreId = (int)($_POST['livre_id'] ?? 0);
        $type    = in_array($_POST['type'] ?? '', ['papier', 'numerique'], true)
                   ? $_POST['type'] : null;

        if ($livreId && $type) {
            $stmt = $pdo->prepare(
                'SELECT l.id, l.titre, l.couverture, l.prix_papier, l.prix_numerique,
                        l.poids_grammes, l.disponible_papier, l.disponible_numerique,
                        l.epub_fichier, l.statut,
                        a.prenom, a.nom AS nom_auteur
                 FROM livres l
                 JOIN auteurs a ON a.id = l.auteur_id
                 WHERE l.id = ?'
            );
            $stmt->execute([$livreId]);
            $livre = $stmt->fetch();

            $ok = false;
            if ($livre && $livre['statut'] !== 'epuise') {
                if ($type === 'papier' && $livre['disponible_papier'] && $livre['prix_papier']) {
                    $ok = true;
                    $prix  = (float)$livre['prix_papier'];
                    $poids = (int)($livre['poids_grammes'] ?? 0);
                }
                if ($type === 'numerique' && $livre['disponible_numerique'] && $livre['prix_numerique'] && $livre['epub_fichier']) {
                    $ok = true;
                    $prix  = (float)$livre['prix_numerique'];
                    $poids = 0;
                }
            }

            if ($ok) {
                panier_ajouter([
                    'livre_id'   => $livre['id'],
                    'type'       => $type,
                    'titre'      => $livre['titre'],
                    'auteur'     => $livre['prenom'] . ' ' . $livre['nom_auteur'],
                    'prix'       => $prix,
                    'poids_g'    => $poids,
                    'couverture' => $livre['couverture'] ?? '',
                ]);
                flash('success', '«&nbsp;' . htmlspecialchars($livre['titre']) . '&nbsp;» ajouté au panier.');
            }
        }
        redirect(BASE . '/panier.php');
    }

    if ($action === 'quantite') {
        $index = (int)($_POST['index'] ?? -1);
        $delta = (int)($_POST['delta'] ?? 0);
        if (isset($_SESSION['panier'][$index]) && ($delta === 1 || $delta === -1)) {
            $newQty = (int)$_SESSION['panier'][$index]['quantite'] + $delta;
            $_SESSION['panier'][$index]['quantite'] = max(1, min(9, $newQty));
        }
        redirect(BASE . '/panier.php');
    }

    if ($action === 'supprimer') {
        $index = (int)($_POST['index'] ?? -1);
        panier_supprimer($index);
        redirect(BASE . '/panier.php');
    }

    if ($action === 'vider') {
        panier_vider();
        redirect(BASE . '/panier.php');
    }

    redirect(BASE . '/panier.php');
}

// ─── Affichage ────────────────────────────────────────────────────
$panier      = panier_get();
$sousTotal   = panier_sous_total();
$poidsTotal  = panier_poids_total();
$fraisPort   = get_frais_port($pdo, $poidsTotal);
$totalTTC    = $sousTotal + (float)($fraisPort ?? 0);
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Mon panier</li>
    </ol>
  </nav>

  <h1 class="section-title mb-4">Mon panier</h1>

  <?php $flash = get_flash(); if ($flash): ?>
  <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?> alert-dismissible fade show">
    <?= $flash['message'] ?>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  </div>
  <?php endif; ?>

  <?php if (empty($panier)): ?>
  <div class="text-center py-5">
    <p style="font-size:3rem">🛒</p>
    <p class="text-secondary mb-4">Votre panier est vide.</p>
    <a href="<?= BASE ?>/catalogue.php" class="btn btn-primary">Découvrir le catalogue →</a>
  </div>
  <?php else: ?>

  <div class="row g-5">
    <div class="col-lg-8">

      <!-- Tableau articles -->
      <div class="table-responsive">
        <table class="table align-middle" id="panier-table">
          <thead>
            <tr style="font-size:.82rem;color:var(--text-secondary)">
              <th>Article</th>
              <th>Type</th>
              <th class="text-end">Prix unitaire TTC</th>
              <th class="text-center">Quantité</th>
              <th class="text-end">Montant TTC</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($panier as $i => $item):
              $montant = round($item['prix'] * $item['quantite'], 2);
            ?>
            <tr data-prix="<?= $item['prix'] ?>"
                data-poids="<?= $item['poids_g'] ?>"
                data-qty="<?= (int)$item['quantite'] ?>">
              <td>
                <div class="d-flex align-items-center gap-3">
                  <?php if ($item['couverture']): ?>
                  <img src="<?= BASE ?>/assets/img/<?= e($item['couverture']) ?>"
                       alt="" style="width:40px;height:60px;object-fit:cover;border-radius:3px;flex-shrink:0">
                  <?php endif; ?>
                  <div>
                    <div class="fw-500" style="font-size:.9rem"><?= e($item['titre']) ?></div>
                    <div style="font-size:.82rem;color:var(--text-secondary)"><?= e($item['auteur']) ?></div>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge <?= $item['type'] === 'numerique' ? 'bg-info text-dark' : 'bg-secondary' ?>"
                      style="font-size:.68rem">
                  <?= $item['type'] === 'numerique' ? 'Numérique' : 'Papier' ?>
                </span>
              </td>
              <td class="text-end" style="white-space:nowrap">
                <?= number_format($item['prix'], 2, ',', '') ?> €
              </td>
              <td class="text-center">
                <div class="d-flex align-items-center justify-content-center gap-1">
                  <!-- Bouton moins -->
                  <form method="post" action="<?= BASE ?>/panier.php" style="margin:0">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="quantite">
                    <input type="hidden" name="index"  value="<?= $i ?>">
                    <input type="hidden" name="delta"  value="-1">
                    <button type="submit"
                            class="btn btn-sm btn-outline-secondary qty-btn"
                            style="width:28px;height:28px;padding:0;line-height:1"
                            <?= $item['quantite'] <= 1 ? 'disabled' : '' ?>>−</button>
                  </form>
                  <span class="qty-value fw-500" style="min-width:1.5rem;text-align:center">
                    <?= (int)$item['quantite'] ?>
                  </span>
                  <!-- Bouton plus -->
                  <form method="post" action="<?= BASE ?>/panier.php" style="margin:0">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="quantite">
                    <input type="hidden" name="index"  value="<?= $i ?>">
                    <input type="hidden" name="delta"  value="+1">
                    <button type="submit"
                            class="btn btn-sm btn-outline-secondary qty-btn"
                            style="width:28px;height:28px;padding:0;line-height:1"
                            <?= $item['quantite'] >= 9 ? 'disabled' : '' ?>>+</button>
                  </form>
                </div>
              </td>
              <td class="text-end fw-500 montant-cell" style="white-space:nowrap">
                <?= number_format($montant, 2, ',', '') ?> €
              </td>
              <td class="text-end">
                <form method="post" action="<?= BASE ?>/panier.php" style="margin:0">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="supprimer">
                  <input type="hidden" name="index"  value="<?= $i ?>">
                  <button type="submit" class="btn btn-sm btn-outline-danger" title="Retirer"
                          onclick="return confirm('Retirer cet article ?')">✕</button>
                </form>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <div class="d-flex justify-content-between align-items-center mt-2">
        <a href="<?= BASE ?>/catalogue.php" class="btn btn-outline-secondary btn-sm">← Continuer mes achats</a>
        <form method="post" action="<?= BASE ?>/panier.php">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="vider">
          <button type="submit" class="btn btn-outline-danger btn-sm"
                  onclick="return confirm('Vider le panier ?')">Vider le panier</button>
        </form>
      </div>
    </div>

    <!-- Récapitulatif -->
    <div class="col-lg-4">
      <?php
      // Tranches de frais de port encodées pour le JS
      $tranchesJS = $pdo->query(
          'SELECT poids_min_g, poids_max_g, tarif FROM frais_port WHERE actif = 1 ORDER BY poids_min_g ASC'
      )->fetchAll(PDO::FETCH_ASSOC);
      ?>
      <div class="card border" style="border-radius:var(--radius-md);position:sticky;top:90px"
           id="recap-card"
           data-tranches="<?= e(json_encode($tranchesJS)) ?>"
           data-has-papier="<?= panier_has_papier() ? '1' : '0' ?>">
        <div class="card-body p-4">
          <h2 class="h5 mb-3" style="font-family:'Playfair Display',serif">Récapitulatif</h2>
          <?php
          $tvaRate   = 0.055;
          $ht        = round($sousTotal / (1 + $tvaRate), 2);
          $tva       = round($sousTotal - $ht, 2);
          ?>
          <div class="d-flex justify-content-between mb-2" style="font-size:.88rem;color:var(--text-secondary)">
            <span>Total HT</span>
            <span id="recap-ht"><?= number_format($ht, 2, ',', '') ?> €</span>
          </div>
          <div class="d-flex justify-content-between mb-2" style="font-size:.88rem;color:var(--text-secondary)">
            <span>TVA 5,5 %</span>
            <span id="recap-tva"><?= number_format($tva, 2, ',', '') ?> €</span>
          </div>
          <?php if (panier_has_papier()): ?>
          <div class="d-flex justify-content-between mb-1" style="font-size:.8rem;color:var(--text-muted)">
            <span>Frais de port (exo. TVA)</span>
            <span id="recap-port-ht">
              <?php if ($fraisPort === null): ?>
              <span class="text-danger">Nous contacter</span>
              <?php elseif ($fraisPort == 0): ?>
              <span class="text-success">Offerts</span>
              <?php else: ?>
              <?= number_format($fraisPort, 2, ',', '') ?> €
              <?php endif; ?>
            </span>
          </div>
          <?php endif; ?>
          <hr>
          <div class="d-flex justify-content-between fw-bold mb-4" style="font-size:1.05rem">
            <span class="fw-bold">Total TTC</span>
            <span id="recap-total"><?= number_format($totalTTC, 2, ',', '') ?> €</span>
          </div>
          <div id="recap-cta">
            <?php if ($fraisPort !== null): ?>
            <a href="<?= BASE ?>/checkout.php" class="btn btn-primary w-100">
              Commander →
            </a>
            <?php else: ?>
            <p class="text-center text-danger mb-0" style="font-size:.85rem">
              Poids hors tranche — veuillez nous <a href="<?= BASE ?>/contact.php">contacter</a>
              pour les frais de port.
            </p>
            <?php endif; ?>
          </div>
          <p class="text-center mt-3 mb-0" style="font-size:.75rem;color:var(--text-muted)">
            Paiement sécurisé par Stripe
          </p>
        </div>
      </div>
    </div>
  </div>

  <?php endif; ?>
</div>

<script>
(function () {
  // Récupère les tranches de frais de port depuis le data-attribute
  const recap    = document.getElementById('recap-card');
  if (!recap) return;

  const tranches  = JSON.parse(recap.dataset.tranches || '[]');
  const hasPapier = recap.dataset.hasPapier === '1';

  function fmt(val) {
    return val.toFixed(2).replace('.', ',') + ' \u20ac';
  }

  function getFreight(poidsTotal) {
    if (!hasPapier || poidsTotal === 0) return 0;
    for (const t of tranches) {
      if (poidsTotal >= t.poids_min_g && poidsTotal <= t.poids_max_g) {
        return parseFloat(t.tarif);
      }
    }
    return null; // hors tranche
  }

  function recalc() {
    let sousTotal  = 0;
    let poidsTotal = 0;

    document.querySelectorAll('#panier-table tbody tr').forEach(function (row) {
      const prix  = parseFloat(row.dataset.prix)  || 0;
      const poids = parseInt(row.dataset.poids, 10) || 0;
      const qty   = parseInt(row.dataset.qty,   10) || 1;

      sousTotal  += prix * qty;
      poidsTotal += poids * qty;

      const montantCell = row.querySelector('.montant-cell');
      if (montantCell) montantCell.textContent = fmt(prix * qty);
    });

    const fraisPort = getFreight(poidsTotal);
    const total     = sousTotal + (fraisPort ?? 0);

    const tvaRate  = 0.055;
    const ht       = Math.round(sousTotal / (1 + tvaRate) * 100) / 100;
    const tva      = Math.round((sousTotal - ht) * 100) / 100;

    document.getElementById('recap-ht').textContent  = fmt(ht);
    document.getElementById('recap-tva').textContent = fmt(tva);

    const portHtEl = document.getElementById('recap-port-ht');
    if (portHtEl) {
      if (fraisPort === null) {
        portHtEl.innerHTML = '<span class="text-danger">Nous contacter</span>';
      } else if (fraisPort === 0) {
        portHtEl.innerHTML = '<span class="text-success">Offerts</span>';
      } else {
        portHtEl.textContent = fmt(fraisPort);
      }
    }

    document.getElementById('recap-total').textContent = fmt(total);
  }

  // Écoute les clics sur les boutons +/−
  document.querySelectorAll('#panier-table .qty-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      // Met à jour data-qty sur la ligne avant soumission du formulaire
      const row   = btn.closest('tr');
      const delta = parseInt(btn.closest('form').querySelector('[name="delta"]').value, 10);
      const cur   = parseInt(row.dataset.qty, 10);
      const next  = Math.max(1, Math.min(9, cur + delta));
      row.dataset.qty = next;
      row.querySelector('.qty-value').textContent = next;
      recalc();
      // Le formulaire se soumet normalement pour mettre à jour la session
    });
  });
})();
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
