import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// POST /api/admin/credits  action: "single" | "bulk"
// single: { phone, amount }
// bulk:   { phones: string[], amount }  ou  { all_verified: true, amount }
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, phone, phones, amount, all_verified } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  if (action === "single") {
    const { data: user } = await adminSb
      .from("users").select("id").eq("phone", phone).maybeSingle();
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    await adminSb.rpc("add_credits", { p_user_id: user.id, p_amount: amount });
    return NextResponse.json({ ok: true, updated: 1 });
  }

  if (action === "bulk") {
    let targets: string[] = phones ?? [];

    if (all_verified) {
      const { data } = await adminSb
        .from("users").select("phone").not("phone", "is", null);
      targets = (data ?? []).map((u) => u.phone);
    }

    if (targets.length === 0) return NextResponse.json({ ok: true, updated: 0 });

    // Récupérer les IDs correspondants
    const { data: users } = await adminSb
      .from("users").select("id").in("phone", targets);

    let updated = 0;
    for (const u of users ?? []) {
      await adminSb.rpc("add_credits", { p_user_id: u.id, p_amount: amount });
      updated++;
    }

    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
