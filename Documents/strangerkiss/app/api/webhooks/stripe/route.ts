import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    const db = adminSupabase();

    // Incrément atomique via RPC (à créer dans Supabase — voir schéma SQL dans lib/supabase.ts)
    const { error: rpcError } = await db.rpc("add_credits", {
      p_user_id: userId,
      p_amount: credits,
    });

    if (rpcError) {
      // Fallback non-atomique si la fonction RPC n'existe pas encore
      const { data: user } = await db
        .from("users")
        .select("credits")
        .eq("id", userId)
        .single();
      if (user) {
        await db
          .from("users")
          .update({ credits: (user as { credits: number }).credits + credits })
          .eq("id", userId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
