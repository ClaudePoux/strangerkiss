<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/db.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect(BASE . '/admin/auteurs.php');
}
csrf_check();

$id   = (int)($_POST['id'] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM auteurs WHERE id = ?");
$stmt->execute([$id]);
$auteur = $stmt->fetch();

if (!$auteur) {
    flash('error', 'Auteur introuvable.');
    redirect(BASE . '/admin/auteurs.php');
}

// Vérifier qu'aucun livre n'est lié
$chk = $pdo->prepare("SELECT COUNT(*) FROM livres WHERE auteur_id = ?");
$chk->execute([$id]);
$nb = (int)$chk->fetchColumn();

if ($nb > 0) {
    flash('error', 'Impossible de supprimer : ' . $nb . ' livre(s) sont liés à cet auteur.');
    redirect(BASE . '/admin/auteurs.php');
}

if ($auteur['photo'] && file_exists(UPLOAD_DIR . $auteur['photo'])) {
    @unlink(UPLOAD_DIR . $auteur['photo']);
}

$pdo->prepare("DELETE FROM auteurs WHERE id = ?")->execute([$id]);
flash('success', 'Auteur « ' . $auteur['prenom'] . ' ' . $auteur['nom'] . ' » supprimé.');
redirect(BASE . '/admin/auteurs.php');
