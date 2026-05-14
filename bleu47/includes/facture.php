<?php
/**
 * Génération de facture PDF pour les commandes Bleu 47.
 * Retourne le chemin absolu du fichier généré, ou false en cas d'échec.
 */
function generer_facture(array $commande, array $lignes): string|false
{
    require_once __DIR__ . '/pdf.php';

    $pdf = new Bleu47PDF();
    $pdf->addPage();

    // ── Constantes de mise en page ───────────────────────────────────
    $ML  = 40.0;    // marge gauche
    $MR  = 555.28;  // marge droite (595.28 - 40)
    $W   = 515.28;  // largeur utile
    $BLU = [26, 74, 138]; // #1a4a8a

    // TVA
    $tvaRate = 0.055;

    // ── En-tête ──────────────────────────────────────────────────────
    // Boîte logo bleu47
    $pdf->setColor(...$BLU);
    $pdf->rect($ML, 38, 150, 44);
    $pdf->setColor(255, 255, 255);
    $pdf->text($ML + 10, 68, 'bleu47', true, 22.0);

    // Coordonnées éditeur (droite)
    $pdf->setColor(60, 60, 60);
    $infoX = $MR - 180;
    $pdf->text($infoX, 50, 'SARL Bleu 47', true, 9.0);
    $pdf->text($infoX, 62, '24 rue de la Banque', false, 8.5);
    $pdf->text($infoX, 73, '71100 Chalon-sur-Saône', false, 8.5);
    $pdf->text($infoX, 84, 'SIRET 531 634 285 00021', false, 8.0);
    $pdf->text($infoX, 93, 'editeur@bleu47.fr', false, 8.0);

    // Séparateur
    $pdf->setColor(0, 0, 0);
    $pdf->setStroke(...$BLU);
    $pdf->setLineWidth(0.8);
    $pdf->hLine($ML, $MR, 98);
    $pdf->setLineWidth(0.5);
    $pdf->setStroke(0, 0, 0);

    // ── Bloc client (gauche) + Facture (droite) ──────────────────────
    $pdf->setColor(60, 60, 60);
    $pdf->text($ML, 115, 'Facturé à :', true, 8.5);

    $cy = 128.0;
    $pdf->text($ML, $cy, $commande['prenom'] . ' ' . $commande['nom'], true, 9.0); $cy += 13;

    if (!empty($commande['type_client']) && $commande['type_client'] === 'professionnel') {
        $pdf->text($ML, $cy, $commande['raison_sociale'] ?? '', false, 9.0); $cy += 13;
        $pdf->text($ML, $cy, 'SIRET : ' . ($commande['siret'] ?? ''), false, 8.5); $cy += 13;
    }

    if (!empty($commande['adresse'])) {
        $pdf->text($ML, $cy, $commande['adresse'], false, 9.0); $cy += 13;
        $pdf->text($ML, $cy, ($commande['code_postal'] ?? '') . ' ' . ($commande['ville'] ?? ''), false, 9.0); $cy += 13;
        $pdf->text($ML, $cy, $commande['pays'] ?? 'France', false, 9.0); $cy += 13;
    }

    // Bloc facture (droite)
    $fx = $ML + 270;
    $pdf->setColor(...$BLU);
    $pdf->text($fx, 115, 'FACTURE', true, 16.0);
    $pdf->setColor(60, 60, 60);
    $pdf->text($fx, 133, 'N° ' . $commande['reference'], false, 9.0);
    $dateStr = date('d/m/Y', strtotime($commande['created_at']));
    $pdf->text($fx, 146, 'Date : ' . $dateStr, false, 9.0);
    $pdf->text($fx, 159, 'Paiement reçu le : ' . $dateStr, false, 9.0);

    // ── Tableau des articles ─────────────────────────────────────────
    // Colonnes : Désignation(270) | Format(55) | Qté(28) | Prix HT(62) | TVA(42) | TTC(58)
    // x positions:
    $cDes = $ML;        // 40
    $cFmt = 313.0;
    $cQty = 371.0;
    $cHT  = 401.0;
    $cTVA = 465.0;
    $cTTC = 509.0;
    // largeurs de colonnes
    $wDes = $cFmt - $cDes - 3;  // ~270
    $wFmt = $cQty - $cFmt - 3;  // ~55
    $wQty = $cHT  - $cQty - 3;  // ~27
    $wHT  = $cTVA - $cHT  - 3;  // ~61
    $wTVA = $cTTC - $cTVA - 3;  // ~41
    $wTTC = $MR   - $cTTC;      // ~46
    // bords droits des colonnes pour l'alignement
    $rFmt = $cFmt + $wFmt;
    $rQty = $cQty + $wQty;
    $rHT  = $cHT  + $wHT;
    $rTVA = $cTVA + $wTVA;
    $rTTC = $MR;

    $hy   = max($cy + 10, 210.0); // y début du tableau

    // En-tête du tableau
    $pdf->setColor(...$BLU);
    $pdf->rect($ML, $hy, $W, 16);
    $pdf->setColor(255, 255, 255);
    $hBaseline = $hy + 11;
    $pdf->textC($cDes, $wDes, $hBaseline, 'Désignation',    true, 8.5);
    $pdf->textC($cFmt, $wFmt, $hBaseline, 'Format',         true, 8.5);
    $pdf->textC($cQty, $wQty, $hBaseline, 'Qté',            true, 8.5);
    $pdf->textC($cHT,  $wHT,  $hBaseline, 'Prix unit. HT',  true, 8.5);
    $pdf->textC($cTVA, $wTVA, $hBaseline, 'TVA 5,5 %',      true, 8.5);
    $pdf->textC($cTTC, $wTTC, $hBaseline, 'Total TTC',       true, 8.5);

    $ry = $hy + 16; // y courant lignes

    // Lignes articles
    $rowH   = 18.0; // hauteur ligne standard
    $lignesBG = [245, 247, 251]; // bleu très clair pour lignes paires

    foreach ($lignes as $idx => $l) {
        $prixTTC = (float)$l['prix_unitaire'] * (int)$l['quantite'];
        $prixHT  = round($prixTTC / (1 + $tvaRate), 2);
        $prixTVA = round($prixTTC - $prixHT, 2);

        // Fond alterné
        if ($idx % 2 === 1) {
            $pdf->setColor(...$lignesBG);
            $pdf->rect($ML, $ry, $W, $rowH);
        }

        $bl = $ry + 12; // baseline texte
        $pdf->setColor(30, 30, 30);
        // Désignation (titre + auteur)
        $titre = mb_strimwidth($l['titre'], 0, 40, '…', 'UTF-8');
        $pdf->text($cDes, $bl, $titre, false, 8.5);
        $pdf->text($cDes, $bl + 9, $l['auteur'], false, 7.5);

        $rowH2 = ($rowH + 9);
        // Format
        $fmt = $l['type_article'] === 'numerique' ? 'EPUB' : 'Papier';
        $pdf->textC($cFmt, $wFmt, $bl, $fmt, false, 8.5);
        // Qté
        $pdf->textC($cQty, $wQty, $bl, (string)(int)$l['quantite'], false, 8.5);
        // Prix HT
        $pdf->textR($rHT, $bl, number_format($prixHT / max(1, (int)$l['quantite']), 2, ',', '') . ' EUR', false, 8.5);
        // TVA
        $pdf->textR($rTVA, $bl, number_format($prixTVA, 2, ',', '') . ' EUR', false, 8.5);
        // TTC
        $pdf->textR($rTTC, $bl, number_format($prixTTC, 2, ',', '') . ' EUR', false, 8.5);

        $ry += $rowH + (($rowH2 > $rowH) ? 9 : 0);
    }

    // Frais de port (exonérés TVA)
    if ((float)($commande['frais_port'] ?? 0) > 0) {
        $fp = (float)$commande['frais_port'];
        $pdf->setColor(240, 240, 240);
        $pdf->rect($ML, $ry, $W, 16);
        $bl = $ry + 11;
        $pdf->setColor(80, 80, 80);
        $pdf->text($cDes, $bl, 'Frais de port', false, 8.5);
        $pdf->textC($cFmt, $wFmt, $bl, '—', false, 8.5);
        $pdf->textC($cQty, $wQty, $bl, '1', false, 8.5);
        $pdf->textR($rHT,  $bl, number_format($fp, 2, ',', '') . ' EUR', false, 8.5);
        $pdf->text($cTVA + 2, $bl, 'Exo.', false, 7.5);
        $pdf->textR($rTTC, $bl, number_format($fp, 2, ',', '') . ' EUR', false, 8.5);
        $ry += 16;
    }

    // Séparateur avant totaux
    $pdf->setStroke(...$BLU);
    $pdf->setLineWidth(0.8);
    $pdf->hLine($ML, $MR, $ry + 4);
    $pdf->setLineWidth(0.5);
    $pdf->setStroke(0, 0, 0);

    $ty = $ry + 18; // y totaux

    // Calculs totaux
    $totalTTC  = (float)$commande['montant_ttc'] + (float)($commande['frais_port'] ?? 0);
    $totalHT   = (float)$commande['montant_ht'];
    $totalTVA  = (float)$commande['montant_tva'];
    $fpHT      = (float)($commande['frais_port'] ?? 0);
    $totalHTtot= round($totalHT + $fpHT, 2);

    $tl = $MR - 230; // x début zone totaux

    $pdf->setColor(60, 60, 60);
    $pdf->text($tl, $ty, 'Total HT (livres)', false, 9.0);
    $pdf->textR($rTTC, $ty, number_format($totalHT, 2, ',', '') . ' EUR', false, 9.0);
    $ty += 13;

    $pdf->text($tl, $ty, 'TVA 5,5 % (livres)', false, 9.0);
    $pdf->textR($rTTC, $ty, number_format($totalTVA, 2, ',', '') . ' EUR', false, 9.0);
    $ty += 13;

    if ($fpHT > 0) {
        $pdf->text($tl, $ty, 'Frais de port HT (exo. TVA)', false, 9.0);
        $pdf->textR($rTTC, $ty, number_format($fpHT, 2, ',', '') . ' EUR', false, 9.0);
        $ty += 13;
    }

    // Total TTC — fond bleu
    $pdf->setColor(...$BLU);
    $pdf->rect($tl - 5, $ty - 3, $MR - $tl + 5, 18);
    $pdf->setColor(255, 255, 255);
    $pdf->text($tl, $ty + 10, 'TOTAL TTC', true, 10.0);
    $pdf->textR($rTTC, $ty + 10, number_format($totalTTC, 2, ',', '') . ' EUR', true, 10.0);
    $ty += 26;

    // Mention acquittée
    $pdf->setColor(0, 120, 0);
    $pdf->text($tl, $ty, '✓ Facture acquittée — Paiement reçu le ' . $dateStr, false, 8.5);
    $ty += 20;

    // ── Mentions légales ────────────────────────────────────────────
    $pdf->setStroke(180, 180, 180);
    $pdf->setLineWidth(0.5);
    $pdf->hLine($ML, $MR, $ty);
    $ty += 10;

    $pdf->setColor(100, 100, 100);
    // Choisit la mention TVA selon la situation
    $mentionTVA = 'TVA 5,5 % applicable sur les livres (article 278-0 bis du CGI).';
    $pdf->text($ML, $ty, $mentionTVA, false, 7.5);
    $ty += 11;
    $pdf->text($ML, $ty, 'Frais de port exonérés de TVA.', false, 7.5);

    // ── Pied de page ────────────────────────────────────────────────
    $footerY = 820.0;
    $pdf->setColor(...$BLU);
    $pdf->rect($ML, $footerY, $W, 1.5); // ligne bleu
    $pdf->setColor(120, 120, 120);
    $footerTxt = 'SARL Bleu 47  —  SIRET 531 634 285 00021  —  editeur@bleu47.fr';
    $pdf->textC($ML, $W, $footerY + 10, $footerTxt, false, 7.5);

    // ── Chemin de sortie ────────────────────────────────────────────
    $annee   = date('Y', strtotime($commande['created_at']));
    $outDir  = __DIR__ . '/../factures/' . $annee . '/';
    $outPath = $outDir . $commande['reference'] . '.pdf';

    if ($pdf->save($outPath)) {
        return $outPath;
    }
    return false;
}
