<?php // includes/footer.php ?>

<footer class="site-footer">
  <div class="container">
    <div class="row g-5">

      <div class="col-lg-4">
        <div class="footer-brand">
          <span class="brand-logo">bleu<span class="brand-num">47</span></span>
        </div>
        <p class="mt-3">Maison d'édition indépendante basée en Bourgogne-Franche-Comté. Trois collections : Adrénaline, Fictions et BD / Romans graphiques.</p>
        <p class="footer-tagline"><em>Couleur primaire, nombre premier</em></p>
      </div>

      <div class="col-lg-4">
        <h5 class="footer-heading">Liens rapides</h5>
        <ul class="footer-links">
          <li><a href="<?= BASE ?>/la-maison.php">La maison</a></li>
          <li><a href="<?= BASE ?>/collections.php">Collections</a></li>
          <li><a href="<?= BASE ?>/catalogue.php">Catalogue</a></li>
          <li><a href="<?= BASE ?>/auteurs.php">Auteurs</a></li>
          <li><a href="<?= BASE ?>/actus.php">Actualités</a></li>
          <li><a href="<?= BASE ?>/revue-de-presse.php">Revue de presse</a></li>
          <li><a href="<?= BASE ?>/manuscrit.php">Soumettre un manuscrit</a></li>
        </ul>
      </div>

      <div class="col-lg-4">
        <h5 class="footer-heading">Contact</h5>
        <address class="footer-address">
          Éditions Bleu 47<br>
          Bourgogne-Franche-Comté, France<br>
          <a href="mailto:contact@bleu47.fr">contact@bleu47.fr</a>
        </address>
        <div class="footer-social mt-3">
          <a href="#" class="footer-social-link" aria-label="Facebook">Facebook</a>
          <a href="#" class="footer-social-link" aria-label="Instagram">Instagram</a>
        </div>
        <a href="<?= BASE ?>/contact.php" class="btn btn-outline-light btn-sm mt-3">Nous contacter</a>
      </div>

    </div>
    <hr class="footer-sep">
    <div class="footer-bottom">
      <p>&copy; <?= date('Y') ?> Éditions Bleu 47 &mdash;
        <a href="<?= BASE ?>/mentions-legales.php">Mentions légales</a> &middot;
        <a href="<?= BASE ?>/mentions-legales.php#cgv">CGV</a> &middot;
        <a href="<?= BASE ?>/mentions-legales.php#rgpd">RGPD</a>
      </p>
    </div>
  </div>
</footer>

<!-- Bootstrap 5 JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc4s9bIOgUxi8T/jzmALY9qFE9hbBF9UQrIGa3tM1kN" crossorigin="anonymous"></script>
<!-- JS personnalisé -->
<script src="<?= BASE ?>/assets/js/main.js"></script>
</body>
</html>
