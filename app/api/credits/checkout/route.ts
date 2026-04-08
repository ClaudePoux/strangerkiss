import { NextRequest, NextResponse } from "next/server";
import { stripe, CREDIT_PACKS, type PackId } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { packId, userId } = await req.json();

  const pack = CREDIT_PACKS.find((p) => p.id === (packId as PackId));
  if (!pack) {
    return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: pack.price,
          product_data: {
            name: `StrangerKiss — Pack ${pack.label}`,
            description: `${pack.credits} crédits`,
          },
        },
      },
    ],
    metadata: {
      user_id: userId,
      credits: String(pack.credits),
    },
    success_url: `${appUrl}/credits?success=1`,
    cancel_url: `${appUrl}/credits?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
