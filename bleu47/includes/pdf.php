<?php
/**
 * Générateur PDF minimal pour les factures Bleu 47.
 * Utilise les polices Type1 intégrées (Helvetica/Helvetica-Bold).
 * Aucune dépendance externe requise.
 */
class Bleu47PDF
{
    const PW = 595.28; // largeur A4 en points
    const PH = 841.89; // hauteur A4 en points

    private string $stream = '';

    // Widths Helvetica (1/1000 em) — suffisant pour factures françaises
    private static array $W = [
        ' '=>278,'!'=>278,'"'=>355,'#'=>556,'$'=>556,'%'=>889,'&'=>667,"'"=>222,
        '('=>333,')'=>333,'*'=>389,'+'=>584,','=>278,'-'=>333,'.'=>278,'/'=>278,
        '0'=>556,'1'=>556,'2'=>556,'3'=>556,'4'=>556,'5'=>556,'6'=>556,'7'=>556,
        '8'=>556,'9'=>556,':'=>278,';'=>278,'<'=>584,'='=>584,'>'=>584,'?'=>556,
        '@'=>1015,'A'=>667,'B'=>667,'C'=>722,'D'=>722,'E'=>667,'F'=>611,'G'=>778,
        'H'=>722,'I'=>278,'J'=>500,'K'=>667,'L'=>556,'M'=>833,'N'=>722,'O'=>778,
        'P'=>667,'Q'=>778,'R'=>722,'S'=>667,'T'=>611,'U'=>722,'V'=>667,'W'=>944,
        'X'=>667,'Y'=>667,'Z'=>611,'a'=>556,'b'=>556,'c'=>500,'d'=>556,'e'=>556,
        'f'=>278,'g'=>556,'h'=>556,'i'=>222,'j'=>222,'k'=>500,'l'=>222,'m'=>833,
        'n'=>556,'o'=>556,'p'=>556,'q'=>556,'r'=>333,'s'=>500,'t'=>278,'u'=>556,
        'v'=>500,'w'=>722,'x'=>500,'y'=>500,'z'=>500,
    ];

    public function addPage(): void
    {
        $this->stream = '';
        $this->e('0.5 w'); // épaisseur de trait par défaut
        $this->e('0 g');   // couleur noire par défaut
    }

    private function e(string $s): void
    {
        $this->stream .= $s . "\n";
    }

    /** y depuis le haut → y PDF depuis le bas */
    private function py(float $y): float
    {
        return round(self::PH - $y, 3);
    }

    /** Définit la couleur de remplissage et de texte (RGB 0–255) */
    public function setColor(int $r, int $g, int $b): void
    {
        $this->e(sprintf('%.3f %.3f %.3f rg', $r / 255, $g / 255, $b / 255));
    }

    /** Définit la couleur de trait (RGB 0–255) */
    public function setStroke(int $r, int $g, int $b): void
    {
        $this->e(sprintf('%.3f %.3f %.3f RG', $r / 255, $g / 255, $b / 255));
    }

    /** Épaisseur de trait en points */
    public function setLineWidth(float $w): void
    {
        $this->e(sprintf('%.2f w', $w));
    }

    /** Rectangle plein (y depuis le haut) */
    public function rect(float $x, float $y, float $w, float $h): void
    {
        $py = $this->py($y + $h);
        $this->e(sprintf('%.2f %.2f %.2f %.2f re f', $x, $py, $w, $h));
    }

    /** Rectangle tracé seulement */
    public function rectS(float $x, float $y, float $w, float $h): void
    {
        $py = $this->py($y + $h);
        $this->e(sprintf('%.2f %.2f %.2f %.2f re S', $x, $py, $w, $h));
    }

    /** Ligne horizontale */
    public function hLine(float $x1, float $x2, float $y): void
    {
        $py = $this->py($y);
        $this->e(sprintf('%.2f %.2f m %.2f %.2f l S', $x1, $py, $x2, $py));
    }

    /** Calcule la largeur d'une chaîne UTF-8 en points pour une taille donnée */
    public function strW(string $utf8, float $size): float
    {
        $s   = $this->_win1252($utf8);
        $len = strlen($s);
        $w   = 0;
        for ($i = 0; $i < $len; $i++) {
            $w += self::$W[$s[$i]] ?? 556;
        }
        return $w / 1000 * $size;
    }

    /**
     * Affiche du texte.
     * @param bool $bold  true = Helvetica-Bold
     * @param float $size taille en points
     */
    public function text(float $x, float $y, string $utf8, bool $bold = false, float $size = 9.0): void
    {
        $fn  = $bold ? 'F2' : 'F1';
        $py  = $this->py($y);
        $str = $this->_pdfStr($utf8);
        $this->e(sprintf('BT /%s %.1f Tf %.2f %.2f Td (%s) Tj ET', $fn, $size, $x, $py, $str));
    }

    /** Texte aligné à droite (rightX = bord droit) */
    public function textR(float $rightX, float $y, string $utf8, bool $bold = false, float $size = 9.0): void
    {
        $w = $this->strW($utf8, $size);
        $this->text($rightX - $w, $y, $utf8, $bold, $size);
    }

    /** Texte centré dans une boîte de largeur $w démarrant à $x */
    public function textC(float $x, float $boxW, float $y, string $utf8, bool $bold = false, float $size = 9.0): void
    {
        $tw = $this->strW($utf8, $size);
        $this->text($x + ($boxW - $tw) / 2, $y, $utf8, $bold, $size);
    }

    /** Convertit UTF-8 → Windows-1252 */
    private function _win1252(string $s): string
    {
        return mb_convert_encoding($s, 'Windows-1252', 'UTF-8');
    }

    /** Prépare une chaîne pour un littéral PDF (...)*/
    private function _pdfStr(string $utf8): string
    {
        $s = $this->_win1252($utf8);
        // Échappement des caractères spéciaux PDF
        $out = '';
        $len = strlen($s);
        for ($i = 0; $i < $len; $i++) {
            $b = ord($s[$i]);
            if ($b === 92) { $out .= '\\\\'; }
            elseif ($b === 40) { $out .= '\\('; }
            elseif ($b === 41) { $out .= '\\)'; }
            elseif ($b === 13) { $out .= '\\r'; }
            else { $out .= chr($b); }
        }
        return $out;
    }

    /** Génère et sauvegarde le PDF. Retourne true en cas de succès. */
    public function save(string $path): bool
    {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $content = $this->stream;
        $length  = strlen($content);

        $buf  = "%PDF-1.4\n";
        $off  = [];

        $off[1] = strlen($buf);
        $buf   .= "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";

        $off[2] = strlen($buf);
        $buf   .= "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";

        $off[3] = strlen($buf);
        $buf   .= "3 0 obj\n<</Type /Page /Parent 2 0 R\n/MediaBox [0 0 595.28 841.89]\n/Contents 4 0 R\n/Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>>\nendobj\n";

        $off[4] = strlen($buf);
        $buf   .= "4 0 obj\n<</Length {$length}>>\nstream\n" . $content . "\nendstream\nendobj\n";

        $off[5] = strlen($buf);
        $buf   .= "5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>\nendobj\n";

        $off[6] = strlen($buf);
        $buf   .= "6 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>\nendobj\n";

        $xref = strlen($buf);
        $buf .= "xref\n0 7\n";
        $buf .= "0000000000 65535 f \n";
        for ($i = 1; $i <= 6; $i++) {
            $buf .= str_pad((string)$off[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }
        $buf .= "trailer\n<</Size 7 /Root 1 0 R>>\nstartxref\n{$xref}\n%%EOF\n";

        return (bool)file_put_contents($path, $buf);
    }
}
