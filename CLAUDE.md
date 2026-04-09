@AGENTS.md

# StrangerKiss

App web de géolocalisation pour voyageurs souhaitant échanger un hug ou un baiser avec un inconnu à proximité.

## Concept produit

Un utilisateur partage sa position sur une carte et renseigne un profil : prénom/pseudo, âge, sexe, type de rencontre souhaité (hug ou French kiss), un commentaire libre et une description physique "pour me reconnaître". Les autres voyageurs à proximité voient les pins sur la carte et peuvent envoyer une demande de rencontre. Les deux parties doivent accepter avant qu'un match soit confirmé.

## Fonctionnalités développées (prototype)

- Formulaire de profil : prénom/pseudo, âge, sexe, type de rencontre (hug / French kiss), commentaire libre, description physique "pour me reconnaître"
- Carte avec géolocalisation des profils proches (pins)
- Chat entre profils matchés

## Fonctionnalités à développer

- **Multilingue** : français, anglais, allemand, italien, espagnol, mandarin, russe, japonais
- **Photo selfie** dans le chat (envoi de photo en temps réel)
- **Système de consentement** : validation mutuelle obligatoire pour confirmer une rencontre
- **Masquage après refus** : si un profil refuse une demande, il disparaît de la carte pour le profil refusé

## Stack (prototype et production)

- **Framework** : Next.js + TypeScript (App Router) — lire `node_modules/next/dist/docs/` avant tout code
- **Style** : Tailwind CSS
- **Base de données** : Supabase (auth, base de données, realtime) — prototype et production
- **Carte** : Leaflet + react-leaflet

## Authentification

Pas d'inscription classique — vérification invisible par SMS :

1. L'utilisateur remplit son profil (pseudo, âge, sexe, type de rencontre, commentaire, pour me reconnaître)
2. Avant d'apparaître sur la carte : "Entrez votre numéro pour recevoir vos 3 crédits gratuits"
3. Code SMS envoyé via Twilio → validé → profil visible sur la carte

- Pas de mot de passe, pas d'email
- Le numéro de téléphone n'est **jamais visible** des autres utilisateurs
- Il sert uniquement comme identifiant unique, pour la modération et les crédits

## Monétisation

- Système de crédits + vérification par SMS
- Inscription : numéro de téléphone → code SMS → validé
- 3 crédits offerts à l'inscription
- 1 crédit dépensé uniquement quand les deux parties acceptent la rencontre
- Si refus → aucun crédit dépensé
- Chat et carte gratuits
- Recharge : pack de crédits via carte bancaire, Apple Pay, Google Pay

## Production

- **Nom de domaine** : strangerkiss.com (Gandi)
- **Hébergement** : Vercel (déjà déployé)
- **Base de données** : Supabase
- **Paiements** : Stripe (Apple Pay et Google Pay)
- **SMS** : Twilio
- **Traduction** : DeepL API

## Modération

- Bouton "Signaler" dans le chat
- 1er signalement : enregistré silencieusement en base temporaire
- 2ème signalement (par 2 personnes différentes) : avertissement envoyé à l'utilisateur signalé
- 3ème signalement : banni 24h
- Récidive après ban 24h : banni définitivement
- Protection abus : 1 seul signalement possible par signataire pour la même personne
- Interface admin : permet de réapprouver un numéro banni
- Pas de détection automatique des messages (système manuel suffisant)
- Le bannissement se fait par numéro de téléphone (table `banned_phones`)
- À implémenter en même temps que Twilio

## Conventions du projet

- Composants dans `components/`
- Logique métier et clients (Supabase, etc.) dans `lib/`
- Pages et layouts dans `app/` (App Router)
- Variables d'environnement préfixées `NEXT_PUBLIC_` pour le client Supabase
