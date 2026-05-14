<?php
$adminTitle = 'Détail commande';
require_once __DIR__ . '/../includes/admin-header.php';
require_once __DIR__ . '/../includes/mailer.php';

$id = (int)($_GET['id'] ?? 0);
if (!$id) redirect(BASE . '/admin/commandes.php');

$stmt = $pdo->prepare('SELECT * FROM commandes WHERE id = ?');
$stmt->execute([$id]);
$commande = $stmt->fetch();
if (!$commande) redirect(BASE . '/admin/commandes.php');

$stmtLignes = $pdo->prepare('SELECT * FROM lignes_commande WHERE commande_id = ?');
$stmtLignes->execute([$id]);
$lignes = $stmtLignes->fetchAll();

// ─── Actions ──────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    if ($action === 'expedier' && $commande['statut'] === 'payee') {
        $pdo->prepare("UPDATE commandes SET statut = 'expediee', updated_at = NOW() WHERE id = ?")
            ->execute([$id]);
        try {
            mail_expedition($commande);
        } catch (Throwable $e) { /* log silencieux */ }
        flash('success', 'Commande marquée comme expédiée et email envoyé au client.');
        redirect(BASE . '/admin/commande-detail.php?id=' . $id);
    }

    if ($action === 'annuler' && in_array($commande['statut'], ['en_attente','payee'], true)) {
        $pdo->prepare("UPDATE commandes SET statut = 'annulee', updated_at = NOW() WHERE id = ?")
            ->execute([$id]);
        flash('success', 'Commande annulée.');
        redirect(BASE . '/admin/commande-detail.php?id=' . $id);
    }
}

// Recharge après action
$stmt->execute([$id]);
$commande = $stmt->fetch();

$statutBadge = [
    'en_attente' => 'badge bg-warning text-dark',
    'payee'      => 'badge bg-success',
    'expediee'   => 'badge bg-primary',
    'annulee'    => 'badge bg-secondary',
];
$statutLabel = [
    'en_attente' => 'En attente',
    'payee'      => 'Payée',
    'expediee'   => 'Expédiée',
    'annulee'    => 'Annulée',
];
?>

<div class="admin-page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
  <div>
    <h1 class="admin-page-title mb-1">
      Commande <code>#<?= e($commande['reference']) ?></code>
    </h1>
    <span class="<?= $statutBadge[$commande['statut']] ?? 'badge bg-secondary' ?>">
      <?= $statutLabel[$commande['statut']] ?? e($commande['statut']) ?>
    </span>
  </div>
  <a href="<?= BASE ?>/admin/commandes.php" class="admin-btn">← Retour</a>
</div>

<div class="row g-4">

  <!-- Infos client + commande -->
  <div class="col-lg-6">
    <div class="admin-card mb-4">
      <div class="admin-card-header">Informations client</div>
      <div class="p-3" style="font-size:.9rem">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:var(--admin-muted);width:130px;padding:4px 0">Nom</td>
              <td><strong><?= e($commande['prenom'] . ' ' . $commande['nom']) ?></strong></td></tr>
          <tr><td style="color:var(--admin-muted);padding:4px 0">Email</td>
              <td><a href="mailto:<?= e($commande['email']) ?>"><?= e($commande['email']) ?></a></td></tr>
          <tr><td style="color:var(--admin-muted);padding:4px 0">Date</td>
              <td><?= date('d/m/Y à H:i', strtotime($commande['created_at'])) ?></td></tr>
          <tr><td style="color:var(--admin-muted);padding:4px 0">Type</td>
              <td><?= e($commande['type_commande']) ?></td></tr>
          <?php if (!empty($commande['type_client']) && $commande['type_client'] === 'professionnel'): ?>
          <tr><td style="color:var(--admin-muted);padding:4px 0">Raison sociale</td>
              <td><strong><?= e($commande['raison_sociale'] ?? '') ?></strong></td></tr>
          <tr><td style="color:var(--admin-muted);padding:4px 0">SIRET</td>
              <td><?= e($commande['siret'] ?? '') ?></td></tr>
          <?php endif; ?>
          <?php if ($commande['stripe_session_id']): ?>
          <tr><td style="color:var(--admin-muted);padding:4px 0">Session Stripe</td>
              <td><code style="font-size:.8rem"><?= e(substr($commande['stripe_session_id'], 0, 30)) ?>…</code></td></tr>
          <?php endif; ?>
        </table>
      </div>
    </div>

    <?php if ($commande['adresse']): ?>
    <div class="admin-card mb-4">
      <div class="admin-card-header">Adresse de livraison</div>
      <div class="p-3" style="font-size:.9rem">
        <?= e($commande['prenom'] . ' ' . $commande['nom']) ?><br>
        <?= nl2br(e($commande['adresse'])) ?><br>
        <?= e($commande['code_postal'] . ' ' . $commande['ville']) ?><br>
        <?= e($commande['pays']) ?>
      </div>
    </div>
    <?php endif; ?>
  </div>

  <!-- Articles -->
  <div class="col-lg-6">
    <div class="admin-card mb-4">
      <div class="admin-card-header">Articles commandés</div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Type</th>
            <th class="text-end">Montant</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($lignes as $l): ?>
          <tr>
            <td>
              <div style="font-weight:500;font-size:.875rem"><?= e($l['titre']) ?></div>
              <div style="font-size:.78rem;color:var(--admin-muted)"><?= e($l['auteur']) ?></div>
            </td>
            <td><span class="badge <?= $l['type_article'] === 'numerique' ? 'bg-info text-dark' : 'bg-secondary' ?>"
                      style="font-size:.65rem">
              <?= $l['type_article'] === 'numerique' ? 'Numérique' : 'Papier' ?>
            </span></td>
            <td class="text-end" style="font-size:.875rem"><?= number_format($l['sous_total'], 2, ',', '') ?> €</td>
          </tr>
          <?php endforeach; ?>
          <?php if ((float)$commande['frais_port'] > 0): ?>
          <tr>
            <td colspan="2" style="color:var(--admin-muted);font-size:.875rem">Frais de port</td>
            <td class="text-end" style="font-size:.875rem"><?= number_format($commande['frais_port'], 2, ',', '') ?> €</td>
          </tr>
          <?php endif; ?>
          <tr style="background:#f7f8fb;font-weight:700">
            <td colspan="2">Total TTC</td>
            <td class="text-end"><?= number_format($commande['montant_ttc'] + $commande['frais_port'], 2, ',', '') ?> €</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Actions -->
    <div class="admin-card">
      <div class="admin-card-header">Actions</div>
      <div class="p-3 d-flex flex-wrap gap-3">
        <?php if ($commande['statut'] === 'payee'): ?>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="expedier">
          <button type="submit" class="admin-btn admin-btn-primary"
                  onclick="return confirm('Marquer comme expédiée et envoyer l\'email au client ?')">
            ✅ Marquer expédiée + email client
          </button>
        </form>
        <?php endif; ?>
        <?php if (in_array($commande['statut'], ['en_attente','payee'], true)): ?>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="annuler">
          <button type="submit" class="admin-btn"
                  style="color:#dc3545;border-color:#dc3545"
                  onclick="return confirm('Annuler cette commande ?')">
            Annuler la commande
          </button>
        </form>
        <?php endif; ?>
        <?php if (in_array($commande['statut'], ['expediee','annulee'], true)): ?>
        <p style="color:var(--admin-muted);font-size:.875rem;margin:0">Aucune action disponible.</p>
        <?php endif; ?>
      </div>
    </div>
  </div>

</div>

<?php require_once __DIR__ . '/../includes/admin-footer.php'; ?>
