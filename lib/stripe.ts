import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const CREDIT_PACKS = [
  {
    id: "starter",
    credits: 5,
    price: 200, // 2,00 € — tarif année de lancement
    label: "Starter",
    description: "5 crédits",
  },
  {
    id: "explorer",
    credits: 15,
    price: 500, // 5,00 € — tarif année de lancement
    label: "Explorer",
    description: "15 crédits",
    popular: true,
  },
  {
    id: "nomad",
    credits: 35,
    price: 1000, // 10,00 € — tarif année de lancement
    label: "Nomad",
    description: "35 crédits",
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];
