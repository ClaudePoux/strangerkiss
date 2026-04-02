import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID ?? "";

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendOtp(phone: string): Promise<void> {
  if (!client) throw new Error("Twilio not configured");
  await client.verify.v2.services(verifySid).verifications.create({
    to: phone,
    channel: "sms",
  });
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<boolean> {
  if (!client) throw new Error("Twilio not configured");
  const check = await client.verify.v2
    .services(verifySid)
    .verificationChecks.create({ to: phone, code });
  return check.status === "approved";
}
