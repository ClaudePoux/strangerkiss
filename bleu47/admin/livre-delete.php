<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/db.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(BASE . '/admin/livres.php');
}
csrf_check();

$id   = (int)($_POST['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM livres WHERE id = ?");
$stmt->execute([$id]);
$livre = $stmt->fetch();

if (!$livre) {
    flash('error', 'Livre introuvable.');
    redirect(BASE . '/admin/livres.php');
}

// SET NULL sur actus et revues (géré par FK ON DELETE SET NULL)
// Supprime la couverture
if ($livre['couverture'] && file_exists(UPLOAD_DIR . $livre['couverture'])) {
    @unlink(UPLOAD_DIR . $livre['couverture']);
}

$pdo->prepare("DELETE FROM livres WHERE id = ?")->execute([$id]);
flash('success', 'Livre « ' . $livre['titre'] . ' » supprimé.');
redirect(BASE . '/admin/livres.php');
