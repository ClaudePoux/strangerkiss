"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LAUNCH_DATE = new Date("2026-05-24T00:00:00Z");

type ApiResult = { status: number; body: unknown } | { error: string };

export default function DebugSessionPage() {
  const router = useRouter();
  const [ls, setLs] = useState<Record<string, string | null>>({});
  const [sessionResult, setSessionResult] = useState<ApiResult | null>(null);
  const [betaCheckResult, setBetaCheckResult] = useState<ApiResult | null>(null);
  const [betaRestoreResult, setBetaRestoreResult] = useState<ApiResult | null>(null);
  const [running, setRunning] = useState(false);

  // Blocage post-lancement
  useEffect(() => {
    if (Date.now() >= LAUNCH_DATE.getTime()) {
      router.replace("/");
    }
  }, [router]);

  async function callApi(url: string, options?: RequestInit): Promise<ApiResult> {
    try {
      const res = await fetch(url, options);
      let body: unknown;
      try { body = await res.json(); } catch { body = await res.text(); }
      return { status: res.status, body };
    } catch (err) {
      return { error: String(err) };
    }
  }

  async function runDiag() {
    setRunning(true);

    // 1. Lire le localStorage
    const keys = ["sk_user_id", "sk_phone", "sk_my_id", "sk_user_credits", "sk_ref_code"];
    const snapshot: Record<string, string | null> = {};
    for (const k of keys) {
      try { snapshot[k] = localStorage.getItem(k); } catch { snapshot[k] = "(erreur lecture)"; }
    }
    setLs(snapshot);

    const userId = snapshot["sk_user_id"];
    const phone  = snapshot["sk_phone"];

    // 2. session/check
    if (userId) {
      const params = new URLSearchParams();
      params.set("user_id", userId);
      if (phone) params.set("phone", phone);
      const r = await callApi(`/api/session/check?${params}`);
      setSessionResult(r);
    } else {
      setSessionResult({ error: "sk_user_id absent — appel ignoré" });
    }

    // 3. beta/check
    if (userId || phone) {
      const params = new URLSearchParams();
      if (phone)  params.set("phone", phone);
      if (userId) params.set("user_id", userId);
      const r = await callApi(`/api/beta/check?${params}`);
      setBetaCheckResult(r);
    } else {
      setBetaCheckResult({ error: "sk_user_id et sk_phone absents — appel ignoré" });
    }

    // 4. beta/restore
    if (phone) {
      const r = await callApi("/api/beta/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, user_id: userId ?? undefined }),
      });
      setBetaRestoreResult(r);
    } else {
      setBetaRestoreResult({ error: "sk_phone absent — appel ignoré" });
    }

    setRunning(false);
  }

  if (Date.now() >= LAUNCH_DATE.getTime()) {
    return null;
  }

  return (
    <main style={{ fontFamily: "monospace", padding: "24px", maxWidth: "900px" }}>
      <h1>🔧 Debug session</h1>
      <p style={{ color: "#888", fontSize: "13px" }}>
        Page temporaire — disparaît le 24 mai 2026.
      </p>

      <button
        onClick={runDiag}
        disabled={running}
        style={{ marginTop: "16px", padding: "8px 20px", cursor: "pointer" }}
      >
        {running ? "Chargement…" : "▶ Lancer le diagnostic"}
      </button>

      {Object.keys(ls).length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2>1. localStorage (sk_*)</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Clé</th>
                <th style={thStyle}>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ls).map(([k, v]) => (
                <tr key={k}>
                  <td style={tdStyle}>{k}</td>
                  <td style={{ ...tdStyle, wordBreak: "break-all" }}>
                    {v === null ? <em style={{ color: "#aaa" }}>(absent)</em> : v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sessionResult !== null && (
        <section style={{ marginTop: "32px" }}>
          <h2>2. /api/session/check</h2>
          <pre style={preStyle}>{JSON.stringify(sessionResult, null, 2)}</pre>
        </section>
      )}

      {betaCheckResult !== null && (
        <section style={{ marginTop: "32px" }}>
          <h2>3. /api/beta/check</h2>
          <pre style={preStyle}>{JSON.stringify(betaCheckResult, null, 2)}</pre>
        </section>
      )}

      {betaRestoreResult !== null && (
        <section style={{ marginTop: "32px" }}>
          <h2>4. /api/beta/restore</h2>
          <pre style={preStyle}>{JSON.stringify(betaRestoreResult, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #444",
  padding: "6px 12px",
  textAlign: "left",
  background: "#111",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 12px",
  verticalAlign: "top",
};

const preStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #333",
  padding: "12px",
  overflowX: "auto",
  fontSize: "13px",
  lineHeight: "1.5",
};
