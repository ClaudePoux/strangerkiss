<?php
$pageTitle = 'Mentions légales';
$pageDesc  = 'Mentions légales, CGV et politique RGPD des Éditions Bleu 47.';
require_once __DIR__ . '/includes/header.php';
?>

<div class="container" style="padding-top:2.5rem;padding-bottom:4rem">

  <!-- Fil d'Ariane -->
  <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="<?= BASE ?>/">Accueil</a></li>
      <li class="breadcrumb-item active">Mentions légales</li>
    </ol>
  </nav>

  <!-- Navigation interne -->
  <div class="d-flex gap-3 mb-4 flex-wrap" style="font-size:.875rem">
    <a href="#mentions" class="text-blue47">Mentions légales</a>
    <a href="#cgv" class="text-blue47">CGV</a>
    <a href="#rgpd" class="text-blue47">RGPD</a>
  </div>

  <div class="row justify-content-center">
    <div class="col-lg-8" style="font-size:.95rem;line-height:1.8;color:var(--text-secondary)">

      <!-- Mentions légales -->
      <section id="mentions" class="mb-5">
        <h1 class="section-title mb-4" style="font-size:1.6rem">Mentions légales</h1>

        <h2 style="font-size:1.1rem;color:var(--text-primary)">Éditeur du site</h2>
        <p>
          <strong>Éditions Bleu 47</strong><br>
          Bourgogne-Franche-Comté, France<br>
          Email : <a href="mailto:contact@bleu47.fr" class="text-blue47">contact@bleu47.fr</a><br>
          Directeur de la publication : Claude Poux
        </p>

        <h2 style="font-size:1.1rem;color:var(--text-primary)">Hébergement</h2>
        <p>
          OVHcloud<br>
          2 rue Kellermann — 59100 Roubaix, France<br>
          <a href="https://www.ovhcloud.com" target="_blank" rel="noopener" class="text-blue47">www.ovhcloud.com</a>
        </p>

        <h2 style="font-size:1.1rem;color:var(--text-primary)">Propriété intellectuelle</h2>
        <p>L'ensemble du contenu de ce site (textes, images, couvertures, maquettes) est la propriété exclusive des Éditions Bleu 47 ou de leurs auteurs respectifs. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.</p>

        <h2 style="font-size:1.1rem;color:var(--text-primary)">Responsabilité</h2>
        <p>Les Éditions Bleu 47 s'efforcent d'assurer l'exactitude des informations publiées sur ce site. Elles ne sauraient être tenues responsables des erreurs, omissions ou des résultats obtenus par un mauvais usage de ces informations.</p>
      </section>

      <hr class="my-5">

      <!-- CGV -->
      <section id="cgv" class="mb-5">
        <h2 class="section-title mb-4" style="font-size:1.6rem">Conditions Générales de Vente</h2>
        <p class="p-3 rounded" style="background:#fff8e1;border:1px solid #ffd54f;font-size:.875rem">
          <strong>Phase 1 — Boutique non disponible.</strong> La vente en ligne n'est pas encore active. Les présentes CGV seront complétées lors de l'ouverture de la boutique (Phase 2).
        </p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Produits</h3>
        <p>Les Éditions Bleu 47 commercialisent des livres papier et numériques. Les prix affichés sont en euros TTC. La TVA applicable aux livres est de 5,5 % pour le papier et 5,5 % pour le numérique.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Droit de rétractation</h3>
        <p>Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux livres numériques dont le téléchargement a déjà commencé. Pour les livres papier, le délai légal de rétractation est de 14 jours à compter de la réception.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Litiges</h3>
        <p>En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. Le droit applicable est le droit français. Le tribunal compétent est celui du ressort du siège social des Éditions Bleu 47.</p>
      </section>

      <hr class="my-5">

      <!-- RGPD -->
      <section id="rgpd">
        <h2 class="section-title mb-4" style="font-size:1.6rem">Politique de confidentialité (RGPD)</h2>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Données collectées</h3>
        <p>Les Éditions Bleu 47 collectent uniquement les données nécessaires au traitement de vos demandes (formulaire de contact, soumission de manuscrit). Ces données sont : nom, prénom, adresse email, téléphone (optionnel), contenu de votre message.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Finalité du traitement</h3>
        <p>Les données collectées sont utilisées exclusivement pour répondre à vos demandes. Elles ne sont pas cédées à des tiers, ni utilisées à des fins commerciales.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Durée de conservation</h3>
        <p>Les données sont conservées le temps nécessaire au traitement de votre demande, et supprimées dans un délai maximum de 3 ans.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Vos droits</h3>
        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Pour exercer ces droits, contactez-nous à <a href="mailto:contact@bleu47.fr" class="text-blue47">contact@bleu47.fr</a>.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Cookies</h3>
        <p>Ce site n'utilise pas de cookies publicitaires ou de tracking. Seuls des cookies de session indispensables au fonctionnement du site peuvent être déposés.</p>

        <h3 style="font-size:1.05rem;color:var(--text-primary)">Réclamations</h3>
        <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL : <a href="https://www.cnil.fr" target="_blank" rel="noopener" class="text-blue47">www.cnil.fr</a>.</p>
      </section>

    </div>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
