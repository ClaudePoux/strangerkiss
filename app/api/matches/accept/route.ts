import { NextRequest, NextResponse } from "next/server";
import { pool, mysqlReady } from "@/lib/mysql";

// Appelé quand le destinataire accepte une demande de rencontre.
// Déduit 1 crédit du demandeur (requester_pin_id → users.id).
export async function POST(req: NextRequest) {
  const { requester_pin_id } = await req.json();

  if (!requester_pin_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!mysqlReady) return NextResponse.json({ ok: true, credited: false });

  // Retrouver le user_id du demandeur via son pin
  const [pins] = await pool.execute(
    `SELECT user_id FROM user_pins WHERE id = ?`,
    [requester_pin_id]
  );
  const pin = (pins as { user_id: string | null }[])[0];

  if (!pin?.user_id) {
    // Pas de compte lié → pas de crédit à déduire
    return NextResponse.json({ ok: true, credited: false });
  }

  // Déduction atomique : UPDATE conditionnel (credits >= 1)
  const [result] = await pool.execute(
    `UPDATE users SET credits = credits - 1 WHERE id = ? AND credits >= 1`,
    [pin.user_id]
  ) as unknown as [{ affectedRows: number }];

  if (result.affectedRows === 0) {
    return NextResponse.json(
      { error: "Le demandeur n'a plus de crédits" },
      { status: 402 }
    );
  }

  return NextResponse.json({ ok: true, credited: true });
}
