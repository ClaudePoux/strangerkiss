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

## Stack actuelle (prototype)

- **Framework** : Next.js + TypeScript (App Router) — lire `node_modules/next/dist/docs/` avant tout code
- **Style** : Tailwind CSS
- **Backend / DB** : Supabase (auth, base de données, realtime)
- **Carte** : Leaflet + react-leaflet

## Monétisation

- Système de crédits + vérification par SMS
- Inscription : numéro de téléphone → code SMS → validé
- 3 crédits offerts à l'inscription
- 1 crédit dépensé uniquement quand les deux parties acceptent la rencontre
- Si refus → aucun crédit dépensé
- Chat et carte gratuits
- Recharge : pack de crédits via carte bancaire, Apple Pay, Google Pay

## Stack cible (production)

- **Nom de domaine** : strangerkiss.com (réservé sur OVH)
- **Hébergement** : OVH + Vercel pour Next.js
- **Base de données** : MySQL sur OVH — migration prévue depuis Supabase
- **SMS** : Twilio
- **Paiements** : Stripe (compatibilité native Apple Pay & Google Pay, essentiel pour le mobile)

## Conventions du projet

- Composants dans `components/`
- Logique métier et clients (Supabase, etc.) dans `lib/`
- Pages et layouts dans `app/` (App Router)
- Variables d'environnement préfixées `NEXT_PUBLIC_` pour le client Supabase
