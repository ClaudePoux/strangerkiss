/**
 * Notifications email vers hello@strangerkiss.com via l'API Resend.
 * Toutes les fonctions sont fire-and-forget : elles ne bloquent jamais le flux principal.
 * Si RESEND_API_KEY est absent, un warning est loggué et l'email est ignoré.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL ?? "StrangerKiss <notifications@strangerkiss.com>";
const TO   = "hello@strangerkiss.com";

/** Masque un numéro : +33612345678 → +336****678 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  const visible = 4;
  return phone.slice(0, visible) + "*".repeat(Math.max(0, phone.length - visible - 3)) + phone.slice(-3);
}

/** Formate l'heure courante (fuseau Paris) */
function fmtNow(): string {
  return new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/** Wrapper HTML minimaliste pour les emails admin */
function emailHtml(title: string, rows: [string, string][]): string {
  const rowsHtml = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:6px 12px;color:#888;font-size:13px;white-space:nowrap">${label}</td>
        <td style="padding:6px 12px;color:#fff;font-size:13px">${value}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#0f0f0f;font-family:system-ui,sans-serif">
  <div style="max-width:480px;margin:0 auto">
    <p style="font-size:22px;font-weight:700;color:#fff;margin:0 0 16px">${title}</p>
    <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden">
      ${rowsHtml}
    </table>
    <p style="font-size:11px;color:#444;margin-top:20px">
      StrangerKiss · ${fmtNow()}
    </p>
  </div>
</body>
</html>`;
}

/** Envoie un email admin — fire-and-forget, n'échoue jamais. */
export function notifyAdmin({
  subject,
  title,
  rows,
}: {
  subject: string;
  title: string;
  rows: [string, string][];
}): void {
  if (!RESEND_API_KEY) {
    console.warn("[resend] RESEND_API_KEY manquante — email ignoré:", subject);
    return;
  }

  const html = emailHtml(title, rows);

  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: TO, subject, html }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.error("[resend] Erreur HTTP", r.status, "—", body.slice(0, 300));
      } else {
        console.log("[resend] ✓ Email envoyé:", subject);
      }
    })
    .catch((err) => console.error("[resend] Erreur réseau:", err));
}
