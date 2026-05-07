# Bleu 47 — Installation OVH

## 1. Prérequis

- Hébergement OVH mutualisé avec PHP 8.1+ et MySQL 5.7+ (ou MariaDB 10.4+)
- Extensions PHP requises : `pdo_mysql`, `gd`, `fileinfo`, `mbstring`, `openssl`
- Accès FTP (FileZilla ou client équivalent)
- Accès phpMyAdmin (espace client OVH → Hébergements → Bases de données)
- Nom de domaine pointant sur l'hébergement (DNS configuré)

---

## 2. Création de la base MySQL OVH

1. Connectez-vous à l'**espace client OVH** → *Hébergements* → votre hébergement → onglet **Bases de données**
2. Cliquez **Créer une base de données**
3. Notez les informations fournies à la création :
   - **Hôte** : `mysqlXXX.hosting.ovh.net` (indiqué dans le récapitulatif)
   - **Nom de la base** : ex. `nqmwgujbleu`
   - **Utilisateur** : même valeur que le nom de la base par défaut
   - **Mot de passe** : celui que vous avez défini

---

## 3. Import de install.sql via phpMyAdmin

1. Depuis l'espace client OVH → *Bases de données* → cliquez **phpMyAdmin** sur la ligne de votre base
2. Authentifiez-vous avec les identifiants de la base
3. Sélectionnez la base dans le panneau de gauche
4. Onglet **Importer** → choisissez le fichier `bleu47/install.sql`
5. Encodage : `utf8` — cliquez **Exécuter**

Le script crée les 5 tables (`collections`, `auteurs`, `livres`, `actus`, `revues_presse`) et insère les données initiales (3 collections, l'auteur Claude Poux, 4 romans, 3 actualités).

---

## 4. Configuration de admin/config.php

Ouvrez `bleu47/admin/config.php` et renseignez chaque constante :

```php
// Identifiants admin
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', '');          // voir section 8 — à générer

// Base de données
define('DB_HOST', 'mysqlXXX.hosting.ovh.net');   // hôte fourni par OVH
define('DB_NAME', 'nqmwgujbleu');
define('DB_USER', 'nqmwgujbleu');
define('DB_PASS', 'votre_mot_de_passe_bdd');

// Emails
define('MAIL_TO',   'contact@bleu47.fr');         // destinataire des formulaires
define('MAIL_FROM', 'noreply@bleu47.fr');
define('MAIL_NAME', 'Éditions Bleu 47');

// Chemin upload (absolu, avec slash final)
define('UPLOAD_DIR', '/homez.XXX/votrelogin/www/assets/img/');
```

> **Chemin UPLOAD_DIR** : depuis phpMyAdmin ou le gestionnaire de fichiers OVH, copiez le chemin absolu de votre répertoire web. Il ressemble à `/homez.XXX/votrelogin/www/`. Ajoutez `assets/img/` à la fin.

---

## 5. Upload FTP

Connectez-vous en FTP avec les identifiants de votre hébergement OVH.

**Structure à uploader :**

```
www/                        ← racine web OVH (dossier www ou public_html)
└── bleu47/                 ← tout le contenu du dossier bleu47/
    ├── .htaccess
    ├── index.php
    ├── admin/
    ├── assets/
    ├── includes/
    ├── tmp/
    └── …
```

Si le site doit être à la racine du domaine (ex. `https://bleu47.fr`), uploadez le **contenu** du dossier `bleu47/` directement dans `www/` plutôt que le dossier lui-même.

> **Fichiers cachés** : assurez-vous que votre client FTP affiche les fichiers dotfiles (`.htaccess`, `.htpasswd`). Dans FileZilla : *Serveur → Forcer l'affichage des fichiers cachés*.

---

## 6. Permissions

Après upload, certains dossiers doivent être accessibles en écriture par PHP :

| Dossier               | Permission | Rôle                              |
|-----------------------|------------|-----------------------------------|
| `tmp/sessions/`       | `755`      | Stockage des sessions PHP         |
| `assets/img/`         | `755`      | Upload des couvertures et photos  |

**Via FileZilla :**

1. Clic droit sur le dossier → *Permissions du fichier*
2. Entrez `755` dans le champ numérique
3. Cochez *Récursion dans les sous-dossiers* → *Appliquer aux répertoires uniquement*

Si les dossiers n'existent pas encore, créez-les depuis le gestionnaire de fichiers OVH ou en FTP avant de les uploader.

---

## 7. Premier accès admin

1. Ouvrez `https://votre-domaine.fr/admin/` dans votre navigateur
2. Identifiant : valeur de `ADMIN_USER` dans `config.php` (défaut : `admin`)
3. Mot de passe : à générer — voir section suivante

---

## 8. Changer le mot de passe admin

Le mot de passe est stocké sous forme de hash bcrypt dans `ADMIN_PASS`. Pour en générer un :

**Option A — en ligne de commande PHP (si SSH disponible) :**

```bash
php -r "echo password_hash('votre_nouveau_mot_de_passe', PASSWORD_BCRYPT) . PHP_EOL;"
```

**Option B — script web temporaire (à supprimer immédiatement après) :**

Créez un fichier `bleu47/genhash.php` avec ce contenu :

```php
<?php
if (!empty($_POST['p'])) {
    echo htmlspecialchars(password_hash($_POST['p'], PASSWORD_BCRYPT));
}
?>
<form method="post">
  <input name="p" type="password" placeholder="Mot de passe">
  <button type="submit">Générer</button>
</form>
```

Accédez à `https://votre-domaine.fr/genhash.php`, copiez le hash généré, collez-le dans `ADMIN_PASS` de `config.php`, puis **supprimez `genhash.php` immédiatement**.

**Résultat dans config.php :**

```php
define('ADMIN_PASS', '$2y$10$abcdefghijklmnopqrstuvOEXAMPLEHASHxxxxxxxxxxxxxxxxxxxxx');
```

---

## 9. Note sur RewriteOptions IgnoreInherit

OVH mutualisé utilise Apache avec un `.htaccess` global au niveau de la racine. Si les règles de réécriture du `.htaccess` du site entrent en conflit avec ce fichier parent (erreurs 500 ou redirections en boucle), ajoutez cette directive **en tête** du fichier `bleu47/.htaccess` :

```apache
RewriteOptions IgnoreInherit
```

Cela isole les règles `mod_rewrite` du site de tout `.htaccess` parent hérité. Cette directive est spécifique à OVH (Apache 2.4 mutualisé) et n'est pas nécessaire sur d'autres hébergeurs.

Si vous rencontrez une erreur **500** après upload alors que le site fonctionnait en local, c'est le premier réglage à tester.
