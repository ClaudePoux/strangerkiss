<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/db.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(BASE . '/admin/collections.php');
}
csrf_check();

$id   = (int)($_POST['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM collections WHERE id = ?");
$stmt->execute([$id]);
$col  = $stmt->fetch();

if (!$col) {
    flash('error', 'Collection introuvable.');
    redirect(BASE . '/admin/collections.php');
}

// Vérifier qu'aucun livre n'est lié
$chk = $pdo->prepare("SELECT COUNT(*) FROM livres WHERE collection_id = ?");
$chk->execute([$id]);
$nb = (int)$chk->fetchColumn();

if ($nb > 0) {
    flash('error', 'Impossible de supprimer : ' . $nb . ' livre(s) appartiennent à cette collection.');
    redirect(BASE . '/admin/collections.php');
}

// Supprime l'image si présente
if ($col['couverture'] && file_exists(UPLOAD_DIR . $col['couverture'])) {
    @unlink(UPLOAD_DIR . $col['couverture']);
}

$pdo->prepare("DELETE FROM collections WHERE id = ?")->execute([$id]);
flash('success', 'Collection « ' . $col['nom'] . ' » supprimée.');
redirect(BASE . '/admin/collections.php');
