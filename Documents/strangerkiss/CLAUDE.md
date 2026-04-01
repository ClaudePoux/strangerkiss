@AGENTS.md

# StrangerKiss

App web de géolocalisation pour voyageurs qui souhaitent échanger un hug ou un baiser avec un inconnu à proximité.

## Stack technique

- **Framework** : Next.js 16 (App Router) — lire `node_modules/next/dist/docs/` avant tout code
- **Style** : Tailwind CSS v4
- **Backend / DB** : Supabase (auth, base de données, realtime)
- **Carte** : Leaflet + react-leaflet
- **Langage** : TypeScript

## Concept produit

Un utilisateur partage sa position sur une carte et indique ce qu'il propose (hug / baiser). Les autres voyageurs à proximité voient les pins sur la carte et peuvent envoyer une demande de rencontre. Les deux parties doivent accepter avant qu'un match soit confirmé.

## Conventions du projet

- Composants dans `components/`
- Logique métier et clients (Supabase, etc.) dans `lib/`
- Pages et layouts dans `app/` (App Router)
- Variables d'environnement préfixées `NEXT_PUBLIC_` pour le client Supabase
