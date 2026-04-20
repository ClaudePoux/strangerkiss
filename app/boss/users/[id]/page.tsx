"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function adminFetch(token: string, url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), "X-Admin-Token": token, "Content-Type": "application/json" },
  });
}

interface UserDetail {
  user: { id: string; phone: string | null; credits: number; ref_code: string | null; created_at: string };
  last_seen: string | null;
  pins: { id: string; name: string; age: number; last_seen: string | null }[];
  reports_count: number;
  encounters_count: number;
  ban: { ban_type: string; banned_until: string | null; reason: string | null; created_at: string } | null;
}

export default function UserDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editCredits, setEditCredits] = useState("");

  useEffect(() => {
    try {
      const t = localStorage.getItem("sk_admin_token");
      const exp = localStorage.getItem("sk_admin_expires");
      if (t && exp && new Date(exp) > new Date()) {
        setToken(t);
      } else {
        router.push("/boss");
      }
    } catch {
      router.push("/boss");
    }
  }, [router]);

  useEffect(() => {
    if (!token || !id) return;
    adminFetch(token, `/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, id]);

  async function addCredits() {
    if (!token || !data) return;
    setMsg("");
    const amount = parseInt(editCredits);
    if (!amount || amount <= 0) { setMsg("Montant invalide"); return; }
    const r = await adminFetch(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ action: "add_credits", phone: data.user.phone, amount }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✓ ${amount} crédits ajoutés` : `Erreur : ${d.error}`);
    if (d.ok) {
      setData((prev) => prev ? { ...prev, user: { ...prev.user, credits: prev.user.credits + amount } } : prev);
      setEditCredits("");
    }
  }

  async function toggleBan(action: "ban" | "unban") {
    if (!token || !data?.user.phone) return;
    setMsg("");
    const r = await adminFetch(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ action, phone: data.user.phone, ban_type: "permanent" }),
    });
    const d = await r.json();
    setMsg(d.ok ? `✓ ${action === "ban" ? "Banni" : "Débanni"}` : `Erreur : ${d.error}`);
    if (d.ok) {
      // Recharger
      adminFetch(token, `/api/admin/users/${id}`).then((r) => r.json()).then(setData);
    }
  }

  async function deleteUser() {
    if (!token || !data?.user.phone || !confirm("Supprimer définitivement cet utilisateur ?")) return;
    const r = await adminFetch(token, "/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ action: "delete_user", phone: data.user.phone }),
    });
    const d = await r.json();
    if (d.ok) router.push("/boss");
    else setMsg(`Erreur : ${d.error}`);
  }

  if (!token) return null;
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-3xl animate-pulse">⏳</div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-white/40">Utilisateur introuvable.</p>
    </div>
  );

  const { user, last_seen, pins, reports_count, encounters_count, ban } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* Nav */}
        <div className="flex items-center gap-3">
          <Link href="/boss" className="text-white/30 hover:text-white/60 text-sm">← Admin</Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60 text-sm">Utilisateur</span>
        </div>

        <h1 className="text-2xl font-bold">
          Stranger<span className="text-[#e91e8c]">Kiss</span>{" "}
          <span className="text-white/40 font-normal text-lg">— Détail utilisateur</span>
        </h1>

        {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</p>}

        {/* Fiche */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm text-white/40 uppercase tracking-wider">Informations</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {[
                ["ID", <span className="font-mono text-white/50 text-xs">{user.id}</span>],
                ["Téléphone", <span className="font-mono text-white">{user.phone ?? "—"}</span>],
                ["Crédits", <span className="text-[#e91e8c] font-semibold">{user.credits}</span>],
                ["Code parrainage", <span className="font-mono text-white/50">{user.ref_code ?? "—"}</span>],
                ["Inscription", <span className="text-white/60">{fmt(user.created_at)}</span>],
                ["Dernière activité", <span className="text-white/60">{fmt(last_seen)}</span>],
                ["Signalements reçus", <span className={reports_count > 0 ? "text-amber-400 font-semibold" : "text-white/40"}>{reports_count}</span>],
                ["Rencontres validées", <span className="text-white/60">{encounters_count}</span>],
                ["Statut ban", ban ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${ban.ban_type === "permanent" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {ban.ban_type} — expire {fmt(ban.banned_until)}
                  </span>
                ) : <span className="text-green-400 text-xs">Actif</span>],
              ].map(([label, value], i) => (
                <tr key={i}>
                  <td className="py-2.5 text-white/30 w-44">{label}</td>
                  <td className="py-2.5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Profils (pins) */}
        {pins.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm text-white/40 uppercase tracking-wider">Profils publiés</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-white/30 border-b border-white/10">
                <th className="pb-2 font-normal text-left">Pseudo</th>
                <th className="pb-2 font-normal text-left">Âge</th>
                <th className="pb-2 font-normal text-left">Vu le</th>
              </tr></thead>
              <tbody>{pins.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 text-white/80">{p.name}</td>
                  <td className="py-2 text-white/50">{p.age} ans</td>
                  <td className="py-2 text-white/40">{fmt(p.last_seen)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm text-white/40 uppercase tracking-wider">Actions</h2>

          {/* Crédits */}
          {user.phone && (
            <div className="flex gap-3 items-center">
              <input
                value={editCredits}
                onChange={(e) => setEditCredits(e.target.value)}
                type="number" min="1" placeholder="Crédits à ajouter"
                className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none w-40"
              />
              <button onClick={addCredits} className="bg-[#7c3aed]/80 hover:bg-[#7c3aed] text-white text-sm px-4 py-2 rounded-lg">
                + Ajouter des crédits
              </button>
            </div>
          )}

          {/* Ban / Débannir */}
          {user.phone && (
            <div className="flex gap-3 flex-wrap">
              {ban ? (
                <button onClick={() => toggleBan("unban")} className="bg-green-700/80 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg">
                  Débannir
                </button>
              ) : (
                <button onClick={() => toggleBan("ban")} className="bg-red-600/80 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg">
                  Bannir (permanent)
                </button>
              )}
              <button onClick={deleteUser} className="bg-red-900/60 hover:bg-red-900 text-red-300 text-sm px-4 py-2 rounded-lg border border-red-800/40">
                Supprimer le compte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
