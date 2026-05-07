<?php
$pageTitle = 'La maison';
$pageDesc  = 'Présentation des Éditions Bleu 47, maison d\'édition indépendante basée en Bourgogne-Franche-Comté.';
require_once __DIR__ . '/includes/header.php';
?>

<!-- Hero page -->
<div style="background:var(--blue47-dark);color:#fff;padding:3rem 0 2.5rem">
  <div class="container">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb" style="--bs-breadcrumb-divider-color:rgba(255,255,255,.4)">
        <li class="breadcrumb-item"><a href="<?= BASE ?>/" style="color:rgba(255,255,255,.6)">Accueil</a></li>
        <li class="breadcrumb-item active" style="color:rgba(255,255,255,.9)">La maison</li>
      </ol>
    </nav>
    <h1 style="color:#fff;font-family:'Playfair Display',Georgia,serif">La maison</h1>
    <p style="color:rgba(255,255,255,.7);font-size:1.05rem;max-width:560px">
      Couleur primaire, nombre premier — depuis Bourgogne-Franche-Comté.
    </p>
  </div>
</div>

<div class="container" style="padding-top:3rem;padding-bottom:4rem">
  <div class="row justify-content-center">
    <div class="col-lg-8">

      <!-- Histoire -->
      <section class="mb-5">
        <h2 class="section-title mb-3" style="font-size:1.6rem">Notre histoire</h2>
        <p>Les Éditions Bleu 47 sont nées d'une conviction simple : la littérature indépendante mérite une maison qui lui ressemble. Fondée en Bourgogne-Franche-Comté, Bleu 47 publie des auteurs dont les voix sortent du lot — sans concession au formatage éditorial des grands groupes.</p>
        <p>Le nom vient d'une double évidence : le bleu, couleur primaire comme la littérature qui revient à l'essentiel ; 47, nombre premier comme ces textes qui ne se divisent que par eux-mêmes et par leur propre ambition.</p>
        <p>Chaque titre publié chez Bleu 47 est le résultat d'un dialogue exigeant entre l'auteur et l'éditeur. Nous croyons à la force du texte, à la qualité de l'objet livre et à la fidélité à nos auteurs dans la durée.</p>
      </section>

      <!-- Ligne éditoriale -->
      <section class="mb-5">
        <h2 class="section-title mb-3" style="font-size:1.6rem">Ligne éditoriale</h2>
        <p>Bleu 47 publie des auteurs francophones, en priorité des voix régionales de Bourgogne-Franche-Comté et des territoires limitrophes, sans exclusive géographique si le projet nous convainc.</p>
        <p>Nous ne cherchons pas le best-seller facile. Nous cherchons le texte nécessaire — celui qui aurait manqué s'il n'avait pas été publié.</p>
      </section>

      <!-- Collections -->
      <section class="mb-5">
        <h2 class="section-title mb-4" style="font-size:1.6rem">Nos collections</h2>

        <div class="d-flex flex-column gap-4">

          <div class="p-4 rounded border" style="border-left:4px solid var(--adrenaline)!important">
            <h3 style="color:var(--adrenaline);font-size:1.2rem;margin-bottom:.5rem">Adrénaline</h3>
            <p class="mb-1 text-secondary">Polars, thrillers et romans noirs</p>
            <p class="mb-0" style="font-size:.95rem">Des récits à tension maximale, ancrés dans des territoires réels. Nos polars ne sont pas de simples divertissements : ils sont aussi des regards sur la société, la violence, l'injustice. Exigeants, addictifs, souvent dérangeants.</p>
          </div>

          <div class="p-4 rounded border" style="border-left:4px solid var(--fictions)!important">
            <h3 style="color:var(--fictions);font-size:1.2rem;margin-bottom:.5rem">Fictions</h3>
            <p class="mb-1 text-secondary">Romans et récits contemporains</p>
            <p class="mb-0" style="font-size:.95rem">La collection généraliste de Bleu 47. Romans de formation, récits intimes, fresques familiales — tout ce qui ne rentre pas dans une case mais qui compte. La littérature à l'état pur.</p>
          </div>

          <div class="p-4 rounded border" style="border-left:4px solid var(--bd)!important">
            <h3 style="color:var(--bd);font-size:1.2rem;margin-bottom:.5rem">BD / Romans graphiques</h3>
            <p class="mb-1 text-secondary">Bande dessinée et romans graphiques</p>
            <p class="mb-0" style="font-size:.95rem">Parce que l'image et le texte ensemble disent parfois ce que ni l'un ni l'autre ne dirait seul. Nous défendons la bande dessinée d'auteur, le roman graphique exigeant, l'illustration comme langage.</p>
          </div>

        </div>
      </section>

      <!-- CTA -->
      <div class="manuscrit-banner">
        <h3 class="mb-2">Vous êtes auteur ?</h3>
        <p class="mb-3" style="color:rgba(255,255,255,.8)">Bleu 47 est ouverte aux soumissions. Nous lisons tout.</p>
        <a href="<?= BASE ?>/manuscrit.php" class="btn btn-light btn-lg">Soumettre un manuscrit →</a>
      </div>

    </div>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
