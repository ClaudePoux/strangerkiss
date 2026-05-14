<?php
// ============================================================
// includes/mailer.php — Emails transactionnels Bleu 47
// Envoi via mail() PHP
// ============================================================

/**
 * Envoie l'email de confirmation de commande au client (HTML).
 */
function mail_confirmation_commande(array $commande, array $lignes, ?string $pdfPath = null): bool
{
    $sujet = 'Confirmation de commande #' . $commande['reference'] . ' — Éditions Bleu 47';

    ob_start();
    _mailer_header('Merci pour votre commande !');
    ?>
<p style="font-size:16px;color:#333">Bonjour <?= htmlspecialchars($commande['prenom']) ?>,</p>
<p style="color:#555">Nous avons bien reçu votre commande <strong>#<?= htmlspecialchars($commande['reference']) ?></strong>
et votre paiement a été confirmé. Vous trouverez ci-dessous le récapitulatif.</p>

<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:20px 0;font-size:14px">
  <thead>
    <tr style="background:#1a4a8a;color:#fff">
      <th style="text-align:left;padding:10px">Article</th>
      <th style="text-align:left;padding:10px">Type</th>
      <th style="text-align:right;padding:10px">Prix</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($lignes as $l): ?>
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:10px"><strong><?= htmlspecialchars($l['titre']) ?></strong><br>
        <span style="color:#888;font-size:13px"><?= htmlspecialchars($l['auteur']) ?></span></td>
      <td style="padding:10px"><?= $l['type_article'] === 'numerique' ? 'Numérique (EPUB)' : 'Papier' ?></td>
      <td style="padding:10px;text-align:right"><?= number_format($l['sous_total'], 2, ',', '') ?> €</td>
    </tr>
    <?php endforeach; ?>
    <?php if ((float)$commande['frais_port'] > 0): ?>
    <tr style="border-bottom:1px solid #eee">
      <td colspan="2" style="padding:10px;color:#555">Frais de port</td>
      <td style="padding:10px;text-align:right"><?= number_format($commande['frais_port'], 2, ',', '') ?> €</td>
    </tr>
    <?php endif; ?>
    <tr style="background:#f7f8fa">
      <td colspan="2" style="padding:10px;font-weight:700">Total TTC</td>
      <td style="padding:10px;text-align:right;font-weight:700;font-size:16px"><?= number_format($commande['montant_ttc'] + $commande['frais_port'], 2, ',', '') ?> €</td>
    </tr>
  </tbody>
</table>

<?php if ($commande['adresse']): ?>
<p style="color:#555;margin-top:20px"><strong>Adresse de livraison :</strong><br>
  <?= htmlspecialchars($commande['prenom'] . ' ' . $commande['nom']) ?><br>
  <?= nl2br(htmlspecialchars($commande['adresse'])) ?><br>
  <?= htmlspecialchars($commande['code_postal'] . ' ' . $commande['ville']) ?><br>
  <?= htmlspecialchars($commande['pays']) ?>
</p>
<?php endif; ?>

<?php
$lignes_num = array_filter($lignes, fn($l) => $l['type_article'] === 'numerique' && !empty($l['download_token']));
if ($lignes_num):
?>
<div style="background:#eef3fb;border:1px solid #c3d4f0;border-radius:8px;padding:20px;margin:24px 0">
  <p style="font-weight:700;color:#1a4a8a;margin-top:0">Téléchargement de vos livres numériques</p>
  <p style="color:#555;font-size:14px">Vos liens de téléchargement sont valables <strong>48 heures</strong>
  et limités à 3 téléchargements par fichier.</p>
  <?php foreach ($lignes_num as $l): ?>
  <p style="margin:.5rem 0">
    <strong><?= htmlspecialchars($l['titre']) ?></strong><br>
    <a href="<?= BASE ?>/telechargement.php?token=<?= urlencode($l['download_token']) ?>"
       style="color:#1a4a8a;font-size:14px">
      Télécharger l'EPUB →
    </a>
  </p>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<p style="color:#555;font-size:14px">Pour toute question, contactez-nous à
  <a href="mailto:<?= MAIL_TO ?>" style="color:#1a4a8a"><?= MAIL_TO ?></a>.</p>
    <?php
    _mailer_footer();
    $body = ob_get_clean();

    return _send_html_mail($commande['email'], $sujet, $body, $pdfPath);
}

/**
 * Envoie la notification de nouvelle commande à l'admin.
 */
function mail_notification_admin(array $commande, array $lignes): bool
{
    $sujet = '[Bleu47] Nouvelle commande #' . $commande['reference'];

    ob_start();
    _mailer_header('Nouvelle commande reçue');
    ?>
<p style="font-size:16px;color:#333">Référence : <strong>#<?= htmlspecialchars($commande['reference']) ?></strong></p>

<table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
  <tr><td style="color:#888;width:140px">Client</td><td><strong><?= htmlspecialchars($commande['prenom'] . ' ' . $commande['nom']) ?></strong></td></tr>
  <tr><td style="color:#888">Email</td><td><?= htmlspecialchars($commande['email']) ?></td></tr>
  <tr><td style="color:#888">Type</td><td><?= htmlspecialchars($commande['type_commande']) ?></td></tr>
  <tr><td style="color:#888">Total TTC</td><td><strong><?= number_format($commande['montant_ttc'] + $commande['frais_port'], 2, ',', '') ?> €</strong></td></tr>
  <?php if ($commande['frais_port'] > 0): ?>
  <tr><td style="color:#888">Frais de port</td><td><?= number_format($commande['frais_port'], 2, ',', '') ?> €</td></tr>
  <?php endif; ?>
</table>

<?php if ($commande['adresse']): ?>
<p style="color:#555"><strong>Adresse de livraison :</strong><br>
  <?= htmlspecialchars($commande['adresse']) ?>, <?= htmlspecialchars($commande['code_postal'] . ' ' . $commande['ville']) ?>, <?= htmlspecialchars($commande['pays']) ?>
</p>
<?php endif; ?>

<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0">
  <thead>
    <tr style="background:#1a4a8a;color:#fff">
      <th style="text-align:left;padding:8px">Article</th>
      <th style="text-align:left;padding:8px">Type</th>
      <th style="text-align:right;padding:8px">Montant</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($lignes as $l): ?>
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:8px"><?= htmlspecialchars($l['titre']) ?> — <?= htmlspecialchars($l['auteur']) ?></td>
      <td style="padding:8px"><?= $l['type_article'] === 'numerique' ? 'Num.' : 'Papier' ?></td>
      <td style="padding:8px;text-align:right"><?= number_format($l['sous_total'], 2, ',', '') ?> €</td>
    </tr>
    <?php endforeach; ?>
  </tbody>
</table>

<p style="margin-top:20px">
  <a href="<?= BASE ?>/admin/commandes.php"
     style="background:#1a4a8a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
    Gérer les commandes →
  </a>
</p>
    <?php
    _mailer_footer();
    $body = ob_get_clean();

    return _send_html_mail(MAIL_TO, $sujet, $body);
}

/**
 * Envoie l'email d'expédition au client.
 */
function mail_expedition(array $commande): bool
{
    $sujet = 'Votre commande #' . $commande['reference'] . ' a été expédiée — Éditions Bleu 47';

    ob_start();
    _mailer_header('Votre commande est en route !');
    ?>
<p style="font-size:16px;color:#333">Bonjour <?= htmlspecialchars($commande['prenom']) ?>,</p>
<p style="color:#555">Votre commande <strong>#<?= htmlspecialchars($commande['reference']) ?></strong>
a été expédiée aujourd'hui à l'adresse suivante :</p>
<p style="color:#555;margin-left:16px">
  <?= htmlspecialchars($commande['prenom'] . ' ' . $commande['nom']) ?><br>
  <?= nl2br(htmlspecialchars($commande['adresse'])) ?><br>
  <?= htmlspecialchars($commande['code_postal'] . ' ' . $commande['ville']) ?><br>
  <?= htmlspecialchars($commande['pays']) ?>
</p>
<p style="color:#555;font-size:14px">Pour toute question, contactez-nous à
  <a href="mailto:<?= MAIL_TO ?>" style="color:#1a4a8a"><?= MAIL_TO ?></a>.</p>
    <?php
    _mailer_footer();
    $body = ob_get_clean();

    return _send_html_mail($commande['email'], $sujet, $body);
}

// ─── Helpers privés ───────────────────────────────────────────────

function _mailer_header(string $titre): void
{
    echo '<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#f4f5f7;font-family:\'Inter\',Arial,sans-serif">';
    echo '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">';
    echo '<div style="background:#1a4a8a;padding:24px 32px">';
    echo '<span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-.02em">bleu<span style="color:#2563c4">47</span></span>';
    echo '</div>';
    echo '<div style="padding:32px">';
    echo '<h2 style="margin:0 0 20px;color:#1a1a2e;font-size:20px">' . htmlspecialchars($titre) . '</h2>';
}

function _mailer_footer(): void
{
    echo '</div>';
    echo '<div style="background:#f7f8fa;padding:16px 32px;border-top:1px solid #e0e4ef;font-size:12px;color:#888;text-align:center">';
    echo 'Éditions Bleu 47 — 24 rue de la Banque, 71100 Chalon-sur-Saône — ';
    echo '<a href="mailto:' . MAIL_TO . '" style="color:#1a4a8a">' . MAIL_TO . '</a>';
    echo '</div></div></body></html>';
}

function _send_html_mail(string $to, string $sujet, string $body, ?string $attachPath = null): bool
{
    require_once __DIR__ . '/phpmailer/Exception.php';
    require_once __DIR__ . '/phpmailer/PHPMailer.php';
    require_once __DIR__ . '/phpmailer/SMTP.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    try {
        // Serveur SMTP
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        // Expéditeur et destinataire
        $mail->setFrom(MAIL_FROM, MAIL_NAME);
        $mail->addReplyTo(MAIL_TO, MAIL_NAME);
        $mail->addAddress($to);

        // DKIM — si la clé privée est présente
        $dkimKey = __DIR__ . '/../private/dkim_private.pem';
        if (is_file($dkimKey)) {
            $mail->DKIM_domain     = 'bleu47.fr';
            $mail->DKIM_selector   = 'mail';
            $mail->DKIM_private    = $dkimKey;
            $mail->DKIM_passphrase = '';
            $mail->DKIM_identity   = MAIL_FROM;
        }

        // Contenu
        $mail->isHTML(true);
        $mail->Subject = $sujet;
        $mail->Body    = $body;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</tr>'], "\n", $body));

        if ($attachPath && is_file($attachPath)) {
            $attachName = 'Facture-' . basename($attachPath);
            $mail->addAttachment($attachPath, $attachName);
        }

        $mail->send();
        return true;

    } catch (PHPMailer\PHPMailer\Exception $e) {
        error_log('[MAILER] PHPMailer error — ' . $mail->ErrorInfo);
        return false;
    }
}
