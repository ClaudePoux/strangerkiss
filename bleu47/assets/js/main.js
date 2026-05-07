/* main.js — Editions Bleu 47 */

document.addEventListener('DOMContentLoaded', function () {

  // Sticky header : ombre au scroll
  var header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // Confirmation avant suppression
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (!confirm(el.dataset.confirm || 'Confirmer ?')) {
        e.preventDefault();
      }
    });
  });

  // Auto-dismiss alertes Bootstrap apres 4s
  document.querySelectorAll('.alert-dismissible').forEach(function (alert) {
    setTimeout(function () {
      var bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      if (bsAlert) bsAlert.close();
    }, 4000);
  });

});
