<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/db.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(BASE . '/admin/actus.php');
}
csrf_check();

$id   = (int)($_POST['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM actus WHERE id = ?");
$stmt->execute([$id]);
$actu = $stmt->fetch();

if (!$actu) {
    flash('error', 'Actualité introuvable.');
    redirect(BASE . '/admin/actus.php');
}

$pdo->prepare("DELETE FROM actus WHERE id = ?")->execute([$id]);
flash('success', 'Actualité « ' . $actu['titre'] . ' » supprimée.');
redirect(BASE . '/admin/actus.php');
