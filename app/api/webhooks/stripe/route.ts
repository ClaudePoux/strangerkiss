import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminSb } from "@/lib/admin-auth";
import { notifyAdmin } from "@/lib/resend";

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
    console.error("[stripe/webhook] Signature invalide:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId  = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits ?? "0", 10);

    if (!userId || !credits) {
      console.error("[stripe/webhook] Metadata manquante:", session.metadata);
      return NextResponse.json({ error: "Metadata manquante" }, { status: 400 });
    }

    // Incrément atomique via la fonction RPC Supabase (security definer)
    const { error } = await adminSb.rpc("add_credits", {
      p_user_id: userId,
      p_amount: credits,
    });

    if (error) {
      console.error("[stripe/webhook] add_credits RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[stripe/webhook] +${credits} crédits → user ${userId.slice(0, 8)}…`);

    const amount = session.amount_total ? `${(session.amount_total / 100).toFixed(2)} ${(session.currency ?? "eur").toUpperCase()}` : "—";
    notifyAdmin({
      subject: "💳 Achat de crédits StrangerKiss",
      title: "💳 Achat de crédits",
      rows: [
        ["User ID", userId.slice(0, 8) + "…"],
        ["Crédits achetés", String(credits)],
        ["Montant", amount],
        ["Session Stripe", session.id.slice(0, 16) + "…"],
      ],
    });
  }

  return NextResponse.json({ received: true });
}
