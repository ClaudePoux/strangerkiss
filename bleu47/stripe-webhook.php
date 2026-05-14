<?php
// ============================================================
// stripe-webhook.php — Réception des événements Stripe
// Endpoint exclu du CSRF (requêtes POST de Stripe)
// ============================================================

// ─── Logger (défini en premier pour être disponible dès le début) ─
function _webhook_log(string $level, string $message, array $context): void
{
    $logDir  = __DIR__ . '/logs/';
    $logFile = $logDir . 'webhook.log';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    $line = date('Y-m-d H:i:s') . ' [' . $level . '] ' . $message;
    if ($context) {
        $line .= ' | ' . json_encode($context, JSON_UNESCAPED_UNICODE);
    }
    file_put_contents($logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// Charge config + fonctions sans démarrer de session
define('WEBHOOK_MODE', true);
require_once __DIR__ . '/admin/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/stripe.php';
require_once __DIR__ . '/includes/mailer.php';
require_once __DIR__ . '/includes/facture.php';

// ─── Config minimale pour BASE (utilisé dans mailer) ─────────────
if (!defined('BASE')) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    define('BASE', rtrim($protocol . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost'), '/'));
}

// ─── Lecture et vérification du payload ──────────────────────────
$payload   = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

_webhook_log('INFO', 'Webhook reçu — payload=' . strlen($payload) . ' octets | sig=' . (empty($sigHeader) ? 'ABSENT' : 'présente'), []);

if (!$payload || !$sigHeader) {
    _webhook_log('ERROR', 'Payload ou signature manquants', []);
    http_response_code(400);
    exit('Payload ou signature manquants.');
}

if (!stripe_verify_webhook($payload, $sigHeader)) {
    _webhook_log('ERROR', 'Signature invalide', []);
    http_response_code(400);
    exit('Signature invalide.');
}

$event = json_decode($payload, true);
if (!$event || empty($event['type'])) {
    _webhook_log('ERROR', 'Événement JSON invalide', []);
    http_response_code(400);
    exit('Événement invalide.');
}

_webhook_log('INFO', 'Événement Stripe : ' . $event['type'], []);

// Répondre 200 immédiatement à Stripe
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['received' => true]);
flush();

// ─── Traitement de l'événement ────────────────────────────────────
if ($event['type'] === 'checkout.session.completed') {
    $stripeSession = $event['data']['object'] ?? [];
    $ref           = $stripeSession['metadata']['commande_ref'] ?? '';
    $sessionId     = $stripeSession['id'] ?? '';
    $paymentIntent = $stripeSession['payment_intent'] ?? '';

    if (!$ref) {
        _webhook_log('ERROR', 'checkout.session.completed sans commande_ref', $event);
        exit;
    }

    // Récupère la commande
    $stmt = $pdo->prepare('SELECT * FROM commandes WHERE reference = ?');
    $stmt->execute([$ref]);
    $commande = $stmt->fetch();

    if (!$commande) {
        _webhook_log('ERROR', 'Commande introuvable : ' . $ref, []);
        exit;
    }

    // Idempotence : ignorer si déjà traitée
    if ($commande['statut'] === 'payee' || $commande['statut'] === 'expediee') {
        _webhook_log('INFO', 'Commande déjà traitée : ' . $ref, []);
        exit;
    }

    // Met à jour la commande
    $pdo->prepare(
        'UPDATE commandes SET statut = \'payee\', stripe_session_id = ?, stripe_payment_id = ?,
         updated_at = NOW() WHERE id = ?'
    )->execute([$sessionId, $paymentIntent, $commande['id']]);

    // Génère les tokens de téléchargement pour les lignes numériques
    $stmtLignes = $pdo->prepare(
        'SELECT * FROM lignes_commande WHERE commande_id = ?'
    );
    $stmtLignes->execute([$commande['id']]);
    $lignes = $stmtLignes->fetchAll();

    foreach ($lignes as $ligne) {
        if ($ligne['type_article'] === 'numerique') {
            $token   = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', strtotime('+48 hours'));
            $pdo->prepare(
                'UPDATE lignes_commande SET download_token = ?, download_expires = ? WHERE id = ?'
            )->execute([$token, $expires, $ligne['id']]);
        }
    }

    // Recharge les lignes avec tokens
    $stmtLignes->execute([$commande['id']]);
    $lignes = $stmtLignes->fetchAll();

    // Recharge la commande à jour
    $stmt->execute([$ref]);
    $commande = $stmt->fetch();

    _webhook_log('INFO', 'Commande payée en BDD : ' . $ref . ' | email_client=' . $commande['email'], []);

    // ─── Génération de la facture PDF ─────────────────────────────────
    $pdfPath = null;
    try {
        $pdfPath = generer_facture($commande, $lignes);
        if ($pdfPath) {
            _webhook_log('OK', 'Facture générée : ' . basename($pdfPath), []);
        } else {
            _webhook_log('ERROR', 'Échec génération facture pour ' . $ref, []);
        }
    } catch (Throwable $e) {
        _webhook_log('ERROR', 'Exception facture : ' . $e->getMessage(), ['file' => $e->getFile(), 'line' => $e->getLine()]);
    }

    // ─── Email confirmation client ────────────────────────────────
    try {
        error_clear_last();
        $okClient = mail_confirmation_commande($commande, $lignes, $pdfPath);
        $lastErr  = error_get_last();
        _webhook_log(
            $okClient ? 'OK' : 'ERROR',
            'mail() client → ' . $commande['email'] . ' | résultat=' . ($okClient ? 'true' : 'false'),
            $lastErr ? ['php_error' => $lastErr['message']] : []
        );
    } catch (Throwable $e) {
        _webhook_log('ERROR', 'Exception mail client : ' . $e->getMessage(), [
            'file' => $e->getFile(), 'line' => $e->getLine(),
        ]);
    }

    // ─── Email notification admin ─────────────────────────────────
    try {
        error_clear_last();
        $okAdmin = mail_notification_admin($commande, $lignes);
        $lastErr = error_get_last();
        _webhook_log(
            $okAdmin ? 'OK' : 'ERROR',
            'mail() admin → ' . MAIL_TO . ' | résultat=' . ($okAdmin ? 'true' : 'false'),
            $lastErr ? ['php_error' => $lastErr['message']] : []
        );
    } catch (Throwable $e) {
        _webhook_log('ERROR', 'Exception mail admin : ' . $e->getMessage(), [
            'file' => $e->getFile(), 'line' => $e->getLine(),
        ]);
    }

    _webhook_log('OK', '--- Traitement terminé : ' . $ref . ' ---', []);
}

