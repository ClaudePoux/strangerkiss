import { NextRequest, NextResponse } from "next/server";
import { pool, mysqlReady } from "@/lib/mysql";

// GET /api/credits/balance?user_id=
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId || !mysqlReady) return NextResponse.json({ credits: null });

  const [rows] = await pool.execute(
    `SELECT credits FROM users WHERE id = ?`,
    [userId]
  );
  const user = (rows as { credits: number }[])[0];
  return NextResponse.json({ credits: user?.credits ?? null });
}
