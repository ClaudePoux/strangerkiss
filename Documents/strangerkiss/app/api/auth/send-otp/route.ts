import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
    return NextResponse.json(
      { error: "Numéro de téléphone invalide (format international requis, ex: +33612345678)" },
      { status: 400 }
    );
  }

  try {
    await sendOtp(phone);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-otp error:", err);
    return NextResponse.json(
      { error: "Impossible d'envoyer le SMS. Vérifiez votre numéro." },
      { status: 500 }
    );
  }
}
