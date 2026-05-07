<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/db.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(BASE . '/admin/revues.php');
}
csrf_check();

$id   = (int)($_POST['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM revues_presse WHERE id = ?");
$stmt->execute([$id]);
$revue = $stmt->fetch();

if (!$revue) {
    flash('error', 'Revue introuvable.');
    redirect(BASE . '/admin/revues.php');
}

$pdo->prepare("DELETE FROM revues_presse WHERE id = ?")->execute([$id]);
flash('success', 'Revue « ' . $revue['source'] . ' » supprimée.');
redirect(BASE . '/admin/revues.php');
