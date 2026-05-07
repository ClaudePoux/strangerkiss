/* admin.js — Administration Bleu 47 */

document.addEventListener('DOMContentLoaded', function () {

  // Confirmation avant suppression
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (!confirm(el.dataset.confirm || 'Supprimer cet element ?')) {
        e.preventDefault();
      }
    });
  });

  // Auto-slug depuis le titre
  var titreInput = document.getElementById('titre');
  var slugInput  = document.getElementById('slug');
  if (titreInput && slugInput) {
    titreInput.addEventListener('input', function () {
      if (!slugInput.dataset.manual) {
        slugInput.value = slugify(titreInput.value);
      }
    });
    slugInput.addEventListener('input', function () {
      slugInput.dataset.manual = '1';
    });
  }

  function slugify(text) {
    var map = {a:/[àâäáãå]/g,e:/[èéêë]/g,i:/[ìîïí]/g,o:/[òôöóõ]/g,u:/[ùûüú]/g,c:/ç/g,n:/ñ/g,y:/[ýÿ]/g,oe:/œ/g,ae:/æ/g};
    text = text.toLowerCase().trim();
    for (var key in map) { text = text.replace(map[key], key); }
    return text.replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
  }

  // Preview couleur collection
  var colorInput = document.getElementById('couleur');
  var colorDot   = document.getElementById('couleur-preview');
  if (colorInput && colorDot) {
    colorDot.style.background = colorInput.value;
    colorInput.addEventListener('input', function () {
      colorDot.style.background = colorInput.value;
    });
  }

  // Preview image upload
  var fileInput    = document.getElementById('image-upload');
  var imagePreview = document.getElementById('image-preview');
  if (fileInput && imagePreview) {
    fileInput.addEventListener('change', function () {
      var file = this.files[0];
      if (file && file.type.startsWith('image/')) {
        var reader = new FileReader();
        reader.onload = function (e) { imagePreview.src = e.target.result; imagePreview.style.display = 'block'; };
        reader.readAsDataURL(file);
      }
    });
  }

  // Auto-dismiss alertes
  document.querySelectorAll('.alert-dismissible').forEach(function (alert) {
    setTimeout(function () {
      var bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      if (bsAlert) bsAlert.close();
    }, 4000);
  });

});
