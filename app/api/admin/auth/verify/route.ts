import { NextRequest, NextResponse } from "next/server";
import { adminSb } from "@/lib/admin-auth";

// POST /api/admin/auth/verify  { phone, code }
export async function POST(req: NextRequest) {
  const { phone, code } = await req.json().catch(() => ({}));
  if (!phone || !code) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: row } = await adminSb
    .from("sms_codes").select("code, expires_at").eq("phone", phone).maybeSingle();

  if (!row) return NextResponse.json({ error: "code_not_found" }, { status: 400 });
  if (new Date(row.expires_at) < new Date()) {
    await adminSb.from("sms_codes").delete().eq("phone", phone);
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }
  if (row.code !== String(code)) return NextResponse.json({ error: "code_invalid" }, { status: 400 });

  const { data: admin } = await adminSb
    .from("admins").select("name").eq("phone", phone).maybeSingle();
  if (!admin) return NextResponse.json({ error: "not_admin" }, { status: 403 });

  await adminSb.from("sms_codes").delete().eq("phone", phone);
  return NextResponse.json({ ok: true, name: admin.name });
}
