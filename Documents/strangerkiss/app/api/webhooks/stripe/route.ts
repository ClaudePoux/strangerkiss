import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { pool, mysqlReady } from "@/lib/mysql";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits ?? "0", 10);

    if (!userId || !credits) {
      return NextResponse.json({ error: "Metadata manquante" }, { status: 400 });
    }

    if (mysqlReady) {
      // Incrément atomique MySQL
      await pool.execute(
        `UPDATE users SET credits = credits + ? WHERE id = ?`,
        [credits, userId]
      );
    }
  }

  return NextResponse.json({ received: true });
}
