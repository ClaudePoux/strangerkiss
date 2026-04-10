"use client";

import { useState, useEffect, useCallback } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function adminFetch(password: string, url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), "X-Admin-Password": password, "Content-Type": "application/json" },
  });
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function AuthPanel({ onAuth }: { onAuth: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await res.json();
    setLoading(false);
    if (d.ok) {
      try { localStorage.setItem("sk_admin_pw", password); } catch { /* ignore */ }
      onAuth(password);
    } else {
      setError("Mot de passe incorrect");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔐</div>
          <h1 className="text-xl font-bold text-white">StrangerKiss <span className="text-[#e91e8c]">Admin</span></h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe" required autoFocus
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button disabled={loading} className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
            {loading ? "…" : "Accéder"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

type Tab = "stats" | "users" | "beta" | "vip" | "moderation" | "waitlist" | "credits";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "stats", label: "Statistiques", icon: "📊" },
  { id: "users", label: "Utilisateurs", icon: "👥" },
  { id: "beta", label: "Bêta-testeurs", icon: "🔑" },
  { id: "vip", label: "Surveillance VIP", icon: "👁️" },
  { id: "moderation", label: "Modération", icon: "🚩" },
  { id: "waitlist", label: "Waitlist", icon: "📋" },
  { id: "credits", label: "Crédits", icon: "💰" },
];

// ── Stats tab ────────────────────────────────────────────────────────────────

function StatsTab({ phone }: { phone: string }) {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    adminFetch(phone, `/api/admin/stats?period=${period}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [phone, period]);

  const periods = [
    { id: "day", label: "Aujourd'hui" },
    { id: "week", label: "7 jours" },
    { id: "month", label: "30 jours" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Année" },
  ];

  const cards = data ? [
    { label: "Inscrits (total)", value: data.users_total },
    { label: `Nouveaux inscrits`, value: data.users_period },
    { label: "Pins actifs (24h)", value: data.pins_active_24h },
    { label: "Waitlist (total)", value: data.waitlist_total },
    { label: "Waitlist (période)", value: data.waitlist_period },
    { label: "Parrainages", value: data.referrals_period },
    { label: "Signalements", value: data.reports_period },
    { label: "Bannis (total)", value: data.bans_total },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {periods.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${period === p.id ? "bg-[#e91e8c] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {!data ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(c => (
            <div key={c.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-3xl font-bold text-white">{c.value}</p>
              <p className="text-xs text-white/40 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ phone }: { phone: string }) {
  const [users, setUsers] = useState<{id:string;phone:string;credits:number;created_at:string}[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionPhone, setActionPhone] = useState("");
  const [credits, setCredits] = useState("5");
  const [banType, setBanType] = useState("permanent");
  const [msg, setMsg] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    const r = await adminFetch(phone, `/api/admin/users?q=${encodeURIComponent(search)}`);
    const d = await r.json();
    setUsers(d.users ?? []);
    setLoading(false);
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function action(act: string, target: string) {
    setMsg("");
    const body: Record<string, unknown> = { action: act, phone: target };
    if (act === "add_credits") body.amount = parseInt(credits);
    if (act === "ban") body.ban_type = banType;
    const r = await adminFetch(phone, "/api/admin/users", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Fait" : `Erreur : ${d.error}`);
    load(q);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher par numéro…"
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/30 outline-none w-64" />
        <button onClick={() => load(q)} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl">Rechercher</button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
      </div>
      <div className="flex gap-3 flex-wrap items-center bg-white/5 border border-white/10 rounded-xl p-3">
        <input value={actionPhone} onChange={e => setActionPhone(e.target.value)} placeholder="+336…"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none w-44" />
        <input value={credits} onChange={e => setCredits(e.target.value)} type="number" min="1"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-20 outline-none" />
        <button onClick={() => action("add_credits", actionPhone)} className="bg-[#7c3aed]/80 hover:bg-[#7c3aed] text-white text-sm px-3 py-1.5 rounded-lg">+ Crédits</button>
        <select value={banType} onChange={e => setBanType(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none">
          <option value="24h">Ban 24h</option>
          <option value="permanent">Ban permanent</option>
        </select>
        <button onClick={() => action("ban", actionPhone)} className="bg-red-600/80 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg">Bannir</button>
        <button onClick={() => action("unban", actionPhone)} className="bg-green-700/80 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg">Débannir</button>
      </div>
      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Numéro</th>
            <th className="pb-2 font-normal">Crédits</th>
            <th className="pb-2 font-normal">Inscrit le</th>
            <th className="pb-2 font-normal"></th>
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-white/80 font-mono">{u.phone}</td>
              <td className="py-2 text-white/60">{u.credits}</td>
              <td className="py-2 text-white/40">{fmt(u.created_at)}</td>
              <td className="py-2">
                <button onClick={() => { setActionPhone(u.phone); }} className="text-xs text-white/30 hover:text-white/60 underline">Sélectionner</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

// ── Beta tab ─────────────────────────────────────────────────────────────────

function BetaTab({ phone }: { phone: string }) {
  const [list, setList] = useState<{id:string;phone:string;name:string|null;created_at:string}[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/beta").then(r => r.json()).then(d => setList(d.beta_testers ?? []));
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await adminFetch(phone, "/api/admin/beta", { method: "POST", body: JSON.stringify({ phone: newPhone, name: newName }) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Ajouté" : d.error === "already_exists" ? "Déjà présent" : "Erreur");
    if (d.ok) { setNewPhone(""); setNewName(""); load(); }
  }

  async function remove(p: string) {
    await adminFetch(phone, "/api/admin/beta", { method: "DELETE", body: JSON.stringify({ phone: p }) });
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-3 items-center flex-wrap bg-white/5 border border-white/10 rounded-xl p-3">
        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+336…" required
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none w-44" />
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom (optionnel)"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none w-40" />
        <button type="submit" className="bg-[#e91e8c] hover:bg-[#c2186f] text-white text-sm px-4 py-1.5 rounded-lg">Ajouter</button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-amber-400"}`}>{msg}</span>}
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-white/30 text-left border-b border-white/10">
          <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Nom</th><th className="pb-2 font-normal">Ajouté le</th><th></th>
        </tr></thead>
        <tbody>{list.map(b => (
          <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
            <td className="py-2 text-white/80 font-mono">{b.phone}</td>
            <td className="py-2 text-white/50">{b.name ?? "—"}</td>
            <td className="py-2 text-white/40">{fmt(b.created_at)}</td>
            <td className="py-2"><button onClick={() => remove(b.phone)} className="text-xs text-red-400 hover:text-red-300">Supprimer</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── VIP tab ──────────────────────────────────────────────────────────────────

function VipTab({ phone }: { phone: string }) {
  const [watches, setWatches] = useState<{id:string;phone:string;reason:string|null;created_at:string}[]>([]);
  const [alerts, setAlerts] = useState<{id:string;phone:string;connected_at:string}[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newReason, setNewReason] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/vip").then(r => r.json()).then(d => {
      setWatches(d.watches ?? []);
      setAlerts(d.alerts ?? []);
    });
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await adminFetch(phone, "/api/admin/vip", { method: "POST", body: JSON.stringify({ phone: newPhone, reason: newReason }) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Ajouté" : d.error === "already_exists" ? "Déjà surveillé" : "Erreur");
    if (d.ok) { setNewPhone(""); setNewReason(""); load(); }
  }

  async function remove(p: string) {
    await adminFetch(phone, "/api/admin/vip", { method: "DELETE", body: JSON.stringify({ phone: p }) });
    load();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="flex gap-3 items-center flex-wrap bg-white/5 border border-white/10 rounded-xl p-3">
        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+336…" required
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none w-44" />
        <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Motif de surveillance"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none flex-1 min-w-40" />
        <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-1.5 rounded-lg">Surveiller</button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-amber-400"}`}>{msg}</span>}
      </form>

      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Numéros surveillés</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Motif</th><th className="pb-2 font-normal">Depuis</th><th></th>
          </tr></thead>
          <tbody>{watches.length === 0 ? <tr><td colSpan={4} className="py-3 text-white/20 text-sm">Aucun numéro surveillé</td></tr> : watches.map(w => (
            <tr key={w.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-white/80 font-mono">{w.phone}</td>
              <td className="py-2 text-white/50">{w.reason ?? "—"}</td>
              <td className="py-2 text-white/40">{fmt(w.created_at)}</td>
              <td className="py-2"><button onClick={() => remove(w.phone)} className="text-xs text-red-400 hover:text-red-300">Retirer</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Dernières connexions détectées</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Connecté le</th>
          </tr></thead>
          <tbody>{alerts.length === 0 ? <tr><td colSpan={2} className="py-3 text-white/20 text-sm">Aucune alerte</td></tr> : alerts.map(a => (
            <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-amber-300 font-mono">{a.phone}</td>
              <td className="py-2 text-white/50">{fmt(a.connected_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── Moderation tab ───────────────────────────────────────────────────────────

function ModerationTab({ phone }: { phone: string }) {
  const [reports, setReports] = useState<{reporter_pin_id:string;reported_pin_id:string;reason:string|null;created_at:string}[]>([]);
  const [bans, setBans] = useState<{id:string;phone:string;ban_type:string;banned_until:string|null;reason:string|null;created_at:string}[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/moderation").then(r => r.json()).then(d => {
      setReports(d.reports ?? []);
      setBans(d.bans ?? []);
    });
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function unban(p: string) {
    setMsg("");
    await adminFetch(phone, "/api/admin/moderation", { method: "POST", body: JSON.stringify({ action: "unban", phone: p }) });
    setMsg("✓ Débanni");
    load();
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-green-400 text-sm">{msg}</p>}

      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Bannis ({bans.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Type</th><th className="pb-2 font-normal">Expire</th><th className="pb-2 font-normal">Motif</th><th></th>
          </tr></thead>
          <tbody>{bans.length === 0 ? <tr><td colSpan={5} className="py-3 text-white/20 text-sm">Aucun banni</td></tr> : bans.map(b => (
            <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-white/80 font-mono">{b.phone}</td>
              <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${b.ban_type === "permanent" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>{b.ban_type}</span></td>
              <td className="py-2 text-white/40">{b.banned_until ? fmt(b.banned_until) : "∞"}</td>
              <td className="py-2 text-white/40">{b.reason ?? "—"}</td>
              <td className="py-2"><button onClick={() => unban(b.phone)} className="text-xs text-green-400 hover:text-green-300">Débannir</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Signalements récents ({reports.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Signalant (pin)</th><th className="pb-2 font-normal">Signalé (pin)</th><th className="pb-2 font-normal">Date</th>
          </tr></thead>
          <tbody>{reports.length === 0 ? <tr><td colSpan={3} className="py-3 text-white/20 text-sm">Aucun signalement</td></tr> : reports.map((r, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-white/50 font-mono text-xs">{r.reporter_pin_id.slice(0, 8)}…</td>
              <td className="py-2 text-white/80 font-mono text-xs">{r.reported_pin_id.slice(0, 8)}…</td>
              <td className="py-2 text-white/40">{fmt(r.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── Waitlist tab ─────────────────────────────────────────────────────────────

function WaitlistTab({ phone }: { phone: string }) {
  const [list, setList] = useState<{phone:string;status:string;created_at:string}[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    adminFetch(phone, "/api/admin/waitlist")
      .then(r => r.json())
      .then(d => { setList(d.waitlist ?? []); setTotal(d.total ?? 0); });
  }, [phone]);

  function exportCsv() {
    const url = `/api/admin/waitlist?format=csv`;
    const a = document.createElement("a");
    a.href = url;
    const headers = new Headers({ "X-Admin-Phone": phone });
    fetch(url, { headers }).then(r => r.blob()).then(blob => {
      a.href = URL.createObjectURL(blob);
      a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    });
  }

  const converted = list.filter(r => r.status === "converti").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-4 text-sm">
          <span className="text-white/60">Total : <strong className="text-white">{total}</strong></span>
          <span className="text-white/60">Convertis : <strong className="text-green-400">{converted}</strong></span>
          <span className="text-white/60">En attente : <strong className="text-amber-400">{total - converted}</strong></span>
        </div>
        <button onClick={exportCsv} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-1.5 rounded-lg">⬇ Export CSV</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-white/30 text-left border-b border-white/10">
          <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Statut</th><th className="pb-2 font-normal">Inscrit le</th>
        </tr></thead>
        <tbody>{list.map((r, i) => (
          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
            <td className="py-2 text-white/80 font-mono">{r.phone}</td>
            <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "converti" ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>{r.status}</span></td>
            <td className="py-2 text-white/40">{fmt(r.created_at)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Credits tab ──────────────────────────────────────────────────────────────

function CreditsTab({ phone }: { phone: string }) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("5");
  const [bulkPhones, setBulkPhones] = useState("");
  const [allVerified, setAllVerified] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setLoading(true);
    const body: Record<string, unknown> = { action: mode, amount: parseInt(amount) };
    if (mode === "single") body.phone = target;
    else if (allVerified) body.all_verified = true;
    else body.phones = bulkPhones.split("\n").map(s => s.trim()).filter(Boolean);

    const r = await adminFetch(phone, "/api/admin/credits", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    setLoading(false);
    setMsg(d.ok ? `✓ ${d.updated} utilisateur(s) mis à jour` : `Erreur : ${d.error}`);
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        {(["single", "bulk"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === m ? "bg-[#e91e8c] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {m === "single" ? "Individuel" : "En masse"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        {mode === "single" ? (
          <div>
            <label className="block text-xs text-white/40 mb-1">Numéro de téléphone</label>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="+336…" required
              className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input type="checkbox" checked={allVerified} onChange={e => setAllVerified(e.target.checked)}
                className="accent-[#e91e8c]" />
              Tous les utilisateurs vérifiés
            </label>
            {!allVerified && (
              <div>
                <label className="block text-xs text-white/40 mb-1">Numéros (un par ligne)</label>
                <textarea value={bulkPhones} onChange={e => setBulkPhones(e.target.value)}
                  rows={5} placeholder="+33612345678&#10;+33698765432"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none font-mono" />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-white/40 mb-1">Nombre de crédits à attribuer</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="1" required
            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
        </div>

        {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
          {loading ? "…" : "Attribuer les crédits"}
        </button>
      </form>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function Dashboard({ adminPhone, onLogout }: { adminPhone: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-white/5 flex flex-col py-6 px-3 shrink-0">
        <div className="px-3 mb-6">
          <p className="text-lg font-bold text-white">Stranger<span className="text-[#e91e8c]">Kiss</span></p>
          <p className="text-xs text-white/30">Interface admin</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${tab === t.id ? "bg-white/10 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="px-3">
          <button onClick={onLogout} className="text-xs text-white/30 hover:text-white/60">Déconnexion</button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <h2 className="text-xl font-bold text-white mb-6">
          {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
        </h2>
        {tab === "stats"      && <StatsTab phone={adminPhone} />}
        {tab === "users"      && <UsersTab phone={adminPhone} />}
        {tab === "beta"       && <BetaTab phone={adminPhone} />}
        {tab === "vip"        && <VipTab phone={adminPhone} />}
        {tab === "moderation" && <ModerationTab phone={adminPhone} />}
        {tab === "waitlist"   && <WaitlistTab phone={adminPhone} />}
        {tab === "credits"    && <CreditsTab phone={adminPhone} />}
      </main>
    </div>
  );
}

export default function BossPage() {
  const [adminPassword, setAdminPassword] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sk_admin_pw");
      if (stored) setAdminPassword(stored);
    } catch { /* ignore */ }
  }, []);

  function logout() {
    try { localStorage.removeItem("sk_admin_pw"); } catch { /* ignore */ }
    setAdminPassword(null);
  }

  if (!adminPassword) return <AuthPanel onAuth={setAdminPassword} />;
  return <Dashboard adminPhone={adminPassword} onLogout={logout} />;
}
