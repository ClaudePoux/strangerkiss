"use client";

import { useState, useEffect, useCallback } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function adminFetch(token: string, url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: { ...(opts?.headers ?? {}), "X-Admin-Token": token, "Content-Type": "application/json" },
  });
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function AuthPanel({ onAuth }: { onAuth: (token: string, expiresAt: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim(), password }),
    });
    const d = await res.json();
    setLoading(false);
    if (d.ok) {
      try {
        localStorage.setItem("sk_admin_token", d.token);
        localStorage.setItem("sk_admin_expires", d.expires_at);
      } catch { /* ignore */ }
      onAuth(d.token, d.expires_at);
    } else if (d.error === "too_many_attempts") {
      setError(`Trop de tentatives. Réessayez dans ${d.retry_after_minutes} minutes.`);
    } else {
      const remaining = d.attempts_remaining ?? 0;
      setError(`Identifiants incorrects.${remaining > 0 ? ` ${remaining} tentative(s) restante(s).` : " Compte bloqué 15 min."}`);
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
          <input type="text" value={login} onChange={e => setLogin(e.target.value)}
            placeholder="Identifiant" required autoFocus autoComplete="username"
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe" required autoComplete="current-password"
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

type Tab = "stats" | "users" | "beta" | "vip" | "moderation" | "waitlist" | "credits" | "encounters" | "legal" | "launch" | "ambassadors";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "stats", label: "Statistiques", icon: "📊" },
  { id: "users", label: "Utilisateurs", icon: "👥" },
  { id: "beta", label: "Bêta-testeurs", icon: "🔑" },
  { id: "vip", label: "Surveillance VIP", icon: "👁️" },
  { id: "moderation", label: "Modération", icon: "🚩" },
  { id: "waitlist", label: "Waitlist", icon: "📋" },
  { id: "credits", label: "Crédits", icon: "💰" },
  { id: "encounters", label: "Rencontres", icon: "💞" },
  { id: "legal", label: "Pages légales", icon: "📄" },
  { id: "ambassadors", label: "Ambassadeurs", icon: "🌟" },
  { id: "launch", label: "Lancement 🚀", icon: "🚀" },
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

function lastSeenDot(iso: string | null) {
  if (!iso) return <span className="text-white/20">—</span>;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = diff / 60000;
  const dot = mins < 10
    ? "bg-green-400"
    : mins < 60
    ? "bg-amber-400"
    : "bg-white/20";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-white/40">{fmt(iso)}</span>
    </span>
  );
}

function UsersTab({ phone }: { phone: string }) {
  const [users, setUsers] = useState<{id:string;phone:string|null;credits:number;created_at:string;last_seen:string|null;block_count:number}[]>([]);
  const [q, setQ] = useState("");
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionPhone, setActionPhone] = useState("");
  const [credits, setCredits] = useState("5");
  const [banType, setBanType] = useState("permanent");
  const [msg, setMsg] = useState("");

  const load = useCallback(async (search = "", po = false) => {
    setLoading(true);
    const params = new URLSearchParams({ q: search });
    if (po) params.set("phone_only", "true");
    const r = await adminFetch(phone, `/api/admin/users?${params}`);
    const d = await r.json();
    setUsers(d.users ?? []);
    setLoading(false);
  }, [phone]);

  useEffect(() => { load(q, phoneOnly); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(act: string, target: string) {
    setMsg("");
    const body: Record<string, unknown> = { action: act, phone: target };
    if (act === "add_credits") body.amount = parseInt(credits);
    if (act === "ban") body.ban_type = banType;
    const r = await adminFetch(phone, "/api/admin/users", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Fait" : `Erreur : ${d.error}`);
    load(q, phoneOnly);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher par numéro…"
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/30 outline-none w-64" />
        <button onClick={() => load(q, phoneOnly)} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl">Rechercher</button>
        <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer select-none">
          <input type="checkbox" checked={phoneOnly} onChange={e => { setPhoneOnly(e.target.checked); load(q, e.target.checked); }} className="accent-[#e91e8c]" />
          Avec numéro uniquement
        </label>
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
        <button onClick={() => { if (confirm(`Supprimer ${actionPhone} ?`)) action("delete_user", actionPhone); }} className="bg-red-900/60 hover:bg-red-900 text-red-300 text-sm px-3 py-1.5 rounded-lg">Supprimer</button>
      </div>
      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-white/30 text-left border-b border-white/10">
            <th className="pb-2 font-normal">Numéro</th>
            <th className="pb-2 font-normal">Crédits</th>
            <th className="pb-2 font-normal">Inscrit le</th>
            <th className="pb-2 font-normal">Actif</th>
            <th className="pb-2 font-normal">Blocks</th>
            <th className="pb-2 font-normal"></th>
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 text-white/80 font-mono">{u.phone ?? <span className="text-white/20 italic">anonyme</span>}</td>
              <td className="py-2 text-white/60">{u.credits}</td>
              <td className="py-2 text-white/40">{fmt(u.created_at)}</td>
              <td className="py-2">{lastSeenDot(u.last_seen)}</td>
              <td className="py-2">
                {u.block_count > 0
                  ? <a href={`/boss/users/${u.id}`} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-medium">{u.block_count}</a>
                  : <span className="text-white/20">0</span>
                }
              </td>
              <td className="py-2 flex gap-3">
                <a href={`/boss/users/${u.id}`} target="_blank" rel="noreferrer" className="text-xs text-[#a78bfa] hover:underline">Détail</a>
                {u.phone && <button onClick={() => setActionPhone(u.phone!)} className="text-xs text-white/30 hover:text-white/60 underline">Sélectionner</button>}
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

type BlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocker: { name: string; age: number | null; nationality: string | null; phone: string } | null;
  blocked: { name: string; age: number | null; nationality: string | null; phone: string } | null;
};

function ModerationTab({ phone }: { phone: string }) {
  const [reports, setReports] = useState<{reporter_pin_id:string;reported_pin_id:string;reason:string|null;created_at:string}[]>([]);
  const [bans, setBans] = useState<{id:string;phone:string;ban_type:string;banned_until:string|null;reason:string|null;created_at:string}[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/moderation").then(r => r.json()).then(d => {
      setReports(d.reports ?? []);
      setBans(d.bans ?? []);
      setBlocks(d.blocks ?? []);
    });
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function unban(p: string) {
    setMsg("");
    await adminFetch(phone, "/api/admin/moderation", { method: "POST", body: JSON.stringify({ action: "unban", phone: p }) });
    setMsg("✓ Débanni");
    load();
  }

  async function unblock(blockerId: string, blockedId: string) {
    setMsg("");
    await adminFetch(phone, "/api/admin/moderation", { method: "POST", body: JSON.stringify({ action: "unblock", blocker_id: blockerId, blocked_id: blockedId }) });
    setMsg("✓ Déblocage effectué");
    load();
  }

  return (
    <div className="space-y-6">
      {msg && <p className="text-green-400 text-sm">{msg}</p>}

      {/* Blocks */}
      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">Blocages ({blocks.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="text-white/30 text-left border-b border-white/10">
              <th className="pb-2 font-normal">Bloqueur — pseudo / âge / pays / n°</th>
              <th className="pb-2 font-normal">Bloqué — pseudo / âge / pays / n°</th>
              <th className="pb-2 font-normal">Date</th>
              <th></th>
            </tr></thead>
            <tbody>{blocks.length === 0
              ? <tr><td colSpan={4} className="py-3 text-white/20 text-sm">Aucun blocage</td></tr>
              : blocks.map((b) => (
              <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 text-white/70 text-xs">
                  <span className="text-white/80">{b.blocker?.name ?? "—"}</span>
                  {b.blocker?.age ? `, ${b.blocker.age} ans` : ""}{" "}
                  {b.blocker?.nationality ? `🏳️ ${b.blocker.nationality}` : ""}
                  <span className="ml-1 font-mono text-white/30">{b.blocker?.phone}</span>
                </td>
                <td className="py-2 text-white/70 text-xs">
                  <span className="text-white/80">{b.blocked?.name ?? "—"}</span>
                  {b.blocked?.age ? `, ${b.blocked.age} ans` : ""}{" "}
                  {b.blocked?.nationality ? `🏳️ ${b.blocked.nationality}` : ""}
                  <span className="ml-1 font-mono text-white/30">{b.blocked?.phone}</span>
                </td>
                <td className="py-2 text-white/40">{fmt(b.created_at)}</td>
                <td className="py-2"><button onClick={() => unblock(b.blocker_id, b.blocked_id)} className="text-xs text-amber-400 hover:text-amber-300">Débloquer</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

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
  const [list, setList] = useState<{id:string;phone:string;status:string;created_at:string}[]>([]);
  const [total, setTotal] = useState(0);
  const [newPhone, setNewPhone] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/waitlist")
      .then(r => r.json())
      .then(d => { setList(d.waitlist ?? []); setTotal(d.total ?? 0); });
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await adminFetch(phone, "/api/admin/waitlist", { method: "POST", body: JSON.stringify({ phone: newPhone }) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Ajouté" : `Erreur : ${d.error}`);
    if (d.ok) { setNewPhone(""); load(); }
  }

  async function saveEdit(id: string) {
    setMsg("");
    const r = await adminFetch(phone, "/api/admin/waitlist", { method: "PUT", body: JSON.stringify({ id, phone: editPhone }) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Modifié" : `Erreur : ${d.error}`);
    if (d.ok) { setEditId(null); setEditPhone(""); load(); }
  }

  async function removeEntry(id: string) {
    if (!confirm("Supprimer ce numéro de la waitlist ?")) return;
    setMsg("");
    const r = await adminFetch(phone, "/api/admin/waitlist", { method: "DELETE", body: JSON.stringify({ id }) });
    const d = await r.json();
    setMsg(d.ok ? "✓ Supprimé" : `Erreur : ${d.error}`);
    if (d.ok) load();
  }

  function exportCsv() {
    const url = `/api/admin/waitlist?format=csv`;
    fetch(url, { headers: { "X-Admin-Token": phone } }).then(r => r.blob()).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    });
  }

  const converted = list.filter(r => r.status === "converti").length;

  return (
    <div className="space-y-4">
      {/* Ajouter */}
      <form onSubmit={addEntry} className="flex gap-3 items-center flex-wrap bg-white/5 border border-white/10 rounded-xl p-3">
        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+336… (format E.164)" required pattern="^\+[1-9]\d{6,14}$"
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 outline-none w-52" />
        <button type="submit" className="bg-[#e91e8c] hover:bg-[#c2186f] text-white text-sm px-4 py-1.5 rounded-lg">Ajouter</button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
      </form>

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
          <th className="pb-2 font-normal">Numéro</th><th className="pb-2 font-normal">Statut</th><th className="pb-2 font-normal">Inscrit le</th><th></th>
        </tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
            <td className="py-2 text-white/80 font-mono">
              {editId === r.id
                ? <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none w-44" />
                : r.phone}
            </td>
            <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "converti" ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>{r.status}</span></td>
            <td className="py-2 text-white/40">{fmt(r.created_at)}</td>
            <td className="py-2 flex gap-3">
              {editId === r.id
                ? <>
                    <button onClick={() => saveEdit(r.id)} className="text-xs text-green-400 hover:text-green-300">Sauver</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-white/30 hover:text-white/60">Annuler</button>
                  </>
                : <>
                    <button onClick={() => { setEditId(r.id); setEditPhone(r.phone); }} className="text-xs text-[#a78bfa] hover:underline">Modifier</button>
                    <button onClick={() => removeEntry(r.id)} className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
                  </>}
            </td>
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
  const [lookedUp, setLookedUp] = useState<{ credits: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState("5");
  const [bulkPhones, setBulkPhones] = useState("");
  const [allVerified, setAllVerified] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!target) return;
    setLookupLoading(true); setLookedUp(null); setMsg("");
    const r = await adminFetch(phone, `/api/admin/credits?phone=${encodeURIComponent(target)}`);
    const d = await r.json();
    setLookupLoading(false);
    if (d.credits !== undefined) setLookedUp({ credits: d.credits });
    else setMsg(d.error === "user_not_found" ? "Utilisateur introuvable" : `Erreur : ${d.error}`);
  }

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
    if (d.ok && mode === "single" && lookedUp) {
      setLookedUp({ credits: lookedUp.credits + parseInt(amount) });
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        {(["single", "bulk"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setLookedUp(null); setMsg(""); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === m ? "bg-[#e91e8c] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {m === "single" ? "Individuel" : "En masse"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        {mode === "single" ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">Numéro de téléphone</label>
              <div className="flex gap-2">
                <input value={target} onChange={e => { setTarget(e.target.value); setLookedUp(null); }} placeholder="+336…" required
                  className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                <button type="button" onClick={lookup} disabled={lookupLoading}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg shrink-0">
                  {lookupLoading ? "…" : "Vérifier"}
                </button>
              </div>
            </div>
            {lookedUp !== null && (
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-white/50">Crédits actuels :</span>
                <span className="text-[#e91e8c] font-bold text-base">{lookedUp.credits}</span>
              </div>
            )}
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

        <button type="submit" disabled={loading || (mode === "single" && !lookedUp)}
          className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
          {loading ? "…" : "Attribuer les crédits"}
        </button>
        {mode === "single" && !lookedUp && <p className="text-xs text-white/30 text-center">Cliquez sur "Vérifier" pour consulter le solde avant d'ajouter</p>}
      </form>
    </div>
  );
}

// ── Encounters tab ───────────────────────────────────────────────────────────

type Encounter = {
  id: string; created_at: string; lat: number | null; lng: number | null;
  user1_id: string; user1_pseudo: string | null; user1_age: number | null; user1_nationality: string | null; user1_phone: string | null;
  user2_id: string; user2_pseudo: string | null; user2_age: number | null; user2_nationality: string | null; user2_phone: string | null;
};

function EncountersTab({ phone }: { phone: string }) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search = "", f = "", t = "") => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const r = await adminFetch(phone, `/api/admin/encounters?${params}`);
    const d = await r.json();
    setEncounters(d.encounters ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  function maskPhone(p: string | null) {
    if (!p) return "—";
    return p.slice(0, 4) + "***" + p.slice(-3);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par numéro ou pseudo…"
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/30 outline-none w-64" />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none" />
        <button onClick={() => load(q, from, to ? to + "T23:59:59Z" : "")} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl">
          Filtrer
        </button>
        <span className="text-white/40 text-sm">{total} rencontre{total !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <p className="text-white/30 text-sm">Chargement…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="text-white/30 text-left border-b border-white/10">
              <th className="pb-2 font-normal">Date</th>
              <th className="pb-2 font-normal">Participant 1</th>
              <th className="pb-2 font-normal">Participant 2</th>
            </tr></thead>
            <tbody>{encounters.length === 0
              ? <tr><td colSpan={3} className="py-3 text-white/20">Aucune rencontre enregistrée</td></tr>
              : encounters.map((e) => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 text-white/40 whitespace-nowrap">{fmt(e.created_at)}</td>
                <td className="py-2 text-xs">
                  <span className="text-white/80 font-medium">{e.user1_pseudo ?? "—"}</span>
                  {e.user1_age ? `, ${e.user1_age} ans` : ""}
                  {e.user1_nationality ? ` · ${e.user1_nationality}` : ""}
                  <span className="ml-1 font-mono text-white/30">{maskPhone(e.user1_phone)}</span>
                </td>
                <td className="py-2 text-xs">
                  <span className="text-white/80 font-medium">{e.user2_pseudo ?? "—"}</span>
                  {e.user2_age ? `, ${e.user2_age} ans` : ""}
                  {e.user2_nationality ? ` · ${e.user2_nationality}` : ""}
                  <span className="ml-1 font-mono text-white/30">{maskPhone(e.user2_phone)}</span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Launch tab ───────────────────────────────────────────────────────────────

interface DiagResult {
  ok: boolean;
  config: Record<string, string | null>;
  missing: string[];
  connectivity: {
    status: number;
    ok: boolean;
    body: Record<string, unknown> | unknown[] | null;
    error?: string;
  } | null;
  sms_queue_count: number | null;
  error?: string;
}

interface LaunchResult {
  ok: boolean;
  total: number;
  sent: number;
  credited: number;
  errors: { phone: string; error: string }[];
  error?: string;
}

function LaunchTab({ phone }: { phone: string }) {
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Date de lancement
  const [launchDateCurrent, setLaunchDateCurrent] = useState<string | null>(null);
  const [launchDateInput, setLaunchDateInput] = useState("");
  const [dateSaving, setDateSaving] = useState(false);
  const [dateMsg, setDateMsg] = useState("");

  useEffect(() => {
    adminFetch(phone, "/api/admin/settings?key=launch_date")
      .then(r => r.json())
      .then(d => {
        if (d.value) {
          setLaunchDateCurrent(d.value);
          setLaunchDateInput(d.value.slice(0, 10));
        }
      })
      .catch(() => {});
  }, [phone]);

  async function saveLaunchDate() {
    if (!launchDateInput) return;
    setDateSaving(true); setDateMsg("");
    const isoValue = `${launchDateInput}T00:00:00Z`;
    const r = await adminFetch(phone, "/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ key: "launch_date", value: isoValue }),
    });
    const d = await r.json();
    setDateSaving(false);
    if (d.ok) {
      setLaunchDateCurrent(isoValue);
      setDateMsg("✓ Date mise à jour");
    } else {
      setDateMsg(`Erreur : ${d.error}`);
    }
  }

  async function runDiag() {
    setDiagLoading(true); setDiagResult(null);
    const r = await adminFetch(phone, "/api/admin/sms-diagnostic");
    const d = await r.json();
    setDiagResult(d);
    setDiagLoading(false);
  }

  async function runLaunch() {
    setLaunchLoading(true); setLaunchResult(null);
    const r = await adminFetch(phone, "/api/admin/launch-sms", { method: "POST", body: "{}" });
    const d = await r.json();
    setLaunchResult(d);
    setLaunchLoading(false);
    setConfirmed(false);
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Date de lancement */}
      <div className="bg-white/5 border border-[#7c3aed]/20 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-white font-semibold">📅 Date de lancement</h3>
          <p className="text-xs text-white/40 mt-1">Modifie la date affichée sur le compte à rebours public.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={launchDateInput}
            onChange={e => { setLaunchDateInput(e.target.value); setDateMsg(""); }}
            className="bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#7c3aed]/50 focus:ring-2 focus:ring-[#7c3aed]/15"
          />
          <button
            onClick={saveLaunchDate}
            disabled={dateSaving || !launchDateInput}
            className="bg-[#7c3aed]/80 hover:bg-[#7c3aed] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            {dateSaving ? "Sauvegarde…" : "Enregistrer"}
          </button>
          {dateMsg && (
            <span className={`text-sm ${dateMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
              {dateMsg}
            </span>
          )}
        </div>
        {launchDateCurrent && (
          <p className="text-xs text-white/30">
            Actuelle en base : {new Date(launchDateCurrent).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Diagnostic OVH */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-white font-semibold">🔍 Diagnostic OVH SMS</h3>
          <p className="text-xs text-white/40 mt-1">Vérifie la configuration et la connectivité sans envoyer de SMS.</p>
        </div>
        <button onClick={runDiag} disabled={diagLoading}
          className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-xl transition-all">
          {diagLoading ? "Test en cours…" : "Lancer le diagnostic"}
        </button>
        {diagResult && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${diagResult.ok ? "text-green-400" : "text-red-400"}`}>
              {diagResult.ok ? "✓ OVH opérationnel" : "✗ Problème détecté"}
            </div>
            {/* Variables d'environnement */}
            <div className="bg-black/30 rounded-xl p-4 space-y-1.5">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Variables d'environnement</p>
              {Object.entries(diagResult.config ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/50">{k}</span>
                  <span className={v ? "text-green-400" : "text-red-400"}>{v ?? "— MANQUANT —"}</span>
                </div>
              ))}
            </div>
            {/* Manquants */}
            {diagResult.missing.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
                <p className="font-semibold mb-1">Variables manquantes :</p>
                {diagResult.missing.map(k => <p key={k}>• {k}</p>)}
              </div>
            )}
            {/* Connectivité */}
            {diagResult.connectivity && (
              <div className="bg-black/30 rounded-xl p-4 space-y-1">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Réponse OVH API</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/50">HTTP status :</span>
                  <span className={diagResult.connectivity.ok ? "text-green-400" : "text-red-400"}>
                    {diagResult.connectivity.status}
                  </span>
                </div>
                {diagResult.connectivity.error && (
                  <p className="text-xs text-red-300 break-all">
                    Erreur : {diagResult.connectivity.error}
                  </p>
                )}
                {diagResult.connectivity.body && (
                  <pre className="text-xs text-white/40 overflow-auto max-h-32 mt-2">
                    {JSON.stringify(diagResult.connectivity.body, null, 2) ?? ""}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SMS de lancement */}
      <div className="bg-white/5 border border-[#e91e8c]/20 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-white font-semibold">🚀 SMS de lancement — Waitlist</h3>
          <p className="text-xs text-white/40 mt-1">
            Envoie un SMS à <strong className="text-white/70">tous les numéros de la waitlist</strong> et attribue
            automatiquement <strong className="text-white/70">10 crédits</strong> à chaque compte existant.
          </p>
          <div className="mt-3 bg-black/30 rounded-xl px-4 py-3 text-xs text-white/60 font-mono italic">
            "StrangerKiss est live ! Vos 10 crédits vous attendent sur strangerkiss.com 💋"
          </div>
        </div>

        {!confirmed ? (
          <button onClick={() => setConfirmed(true)}
            className="bg-[#e91e8c]/80 hover:bg-[#e91e8c] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(233,30,140,0.25)]">
            🚀 Envoyer SMS de lancement
          </button>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <p className="text-amber-300 text-sm font-semibold">⚠️ Confirmation requise</p>
            <p className="text-white/60 text-xs">
              Cette action enverra un SMS à tous les numéros de la waitlist. Elle est irréversible.
              Vérifiez que le diagnostic OVH est OK avant de continuer.
            </p>
            <div className="flex gap-3">
              <button onClick={runLaunch} disabled={launchLoading}
                className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                {launchLoading ? "Envoi en cours…" : "✓ Confirmer l'envoi"}
              </button>
              <button onClick={() => setConfirmed(false)} disabled={launchLoading}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm px-5 py-2.5 rounded-xl transition-all">
                Annuler
              </button>
            </div>
          </div>
        )}

        {launchLoading && (
          <p className="text-xs text-white/40 animate-pulse">Envoi en cours, ne pas fermer cette page…</p>
        )}

        {launchResult && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${launchResult.ok ? "text-green-400" : "text-red-400"}`}>
              {launchResult.ok ? "✓ Envoi terminé" : `✗ Erreur : ${launchResult.error}`}
            </div>
            {launchResult.ok && (
              <div className="bg-black/30 rounded-xl p-4 space-y-1.5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Total waitlist", value: launchResult.total },
                    { label: "SMS envoyés", value: launchResult.sent },
                    { label: "Crédités", value: launchResult.credited },
                  ].map(c => (
                    <div key={c.label}>
                      <p className="text-2xl font-bold text-white">{c.value}</p>
                      <p className="text-xs text-white/40">{c.label}</p>
                    </div>
                  ))}
                </div>
                {launchResult.errors.length > 0 && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1">
                    <p className="text-xs text-red-300 font-semibold">Erreurs ({launchResult.errors.length}) :</p>
                    {launchResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-400 font-mono">{e.phone} — {e.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legal tab ────────────────────────────────────────────────────────────────

const LEGAL_PAGES = [
  { slug: "mentions-legales",              label: "Mentions légales" },
  { slug: "politique-de-confidentialite",  label: "Politique de confidentialité" },
  { slug: "notre-histoire",                label: "Notre histoire" },
  { slug: "cgv",                           label: "CGU" },
] as const;

type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];

const LEGAL_LANGS = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
] as const;

type LegalPageData = Record<string, string> & { updated_at?: string };

function LegalTab({ phone }: { phone: string }) {
  const [activeSlug, setActiveSlug] = useState<LegalSlug>("mentions-legales");
  const [pages, setPages] = useState<Record<LegalSlug, LegalPageData>>({} as Record<LegalSlug, LegalPageData>);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [langSaving, setLangSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch(phone, "/api/admin/legal")
      .then(r => r.json())
      .then(d => {
        const map: Record<string, LegalPageData> = {};
        for (const p of (d.pages ?? [])) map[p.slug as LegalSlug] = p;
        setPages(map as Record<LegalSlug, LegalPageData>);
      })
      .catch(() => {});
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  const current = pages[activeSlug] ?? {};

  function setField(field: string, value: string) {
    setPages(prev => ({
      ...prev,
      [activeSlug]: { ...prev[activeSlug], [field]: value },
    }));
  }

  async function saveAndTranslate() {
    setSaving(true); setMsg("");
    const r = await adminFetch(phone, "/api/admin/legal", {
      method: "POST",
      body: JSON.stringify({ slug: activeSlug, content_fr: current.content_fr ?? "" }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.ok) {
      setMsg(`✓ Sauvegardé et traduit en ${d.translated?.length ?? 0} langue(s)`);
      load();
    } else {
      setMsg(`Erreur : ${d.error}`);
    }
  }

  async function saveLang(lang: string) {
    setLangSaving(lang); setMsg("");
    const r = await adminFetch(phone, "/api/admin/legal", {
      method: "PUT",
      body: JSON.stringify({ slug: activeSlug, lang, content: current[`content_${lang}`] ?? "" }),
    });
    const d = await r.json();
    setLangSaving(null);
    setMsg(d.ok ? `✓ ${lang.toUpperCase()} sauvegardé` : `Erreur : ${d.error}`);
  }

  return (
    <div className="space-y-5">
      {/* Page selector */}
      <div className="flex gap-2 flex-wrap">
        {LEGAL_PAGES.map(p => (
          <button key={p.slug} onClick={() => { setActiveSlug(p.slug); setMsg(""); setExpandedLang(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeSlug === p.slug ? "bg-[#e91e8c] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {current.updated_at && (
        <p className="text-xs text-white/20">Dernière mise à jour : {fmt(current.updated_at)}</p>
      )}

      {/* French textarea */}
      <div className="space-y-2">
        <label className="block text-xs text-white/40">Contenu en français</label>
        <textarea
          value={current.content_fr ?? ""}
          onChange={e => setField("content_fr", e.target.value)}
          rows={14}
          placeholder="Saisissez le contenu en français…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e91e8c]/40 resize-y font-mono leading-relaxed"
        />
      </div>

      {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</p>}

      <button
        onClick={saveAndTranslate}
        disabled={saving}
        className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all"
      >
        {saving ? "Traduction en cours…" : "Sauvegarder et traduire automatiquement"}
      </button>

      {/* Per-language manual override */}
      <div className="space-y-2 pt-2">
        <p className="text-xs text-white/30 uppercase tracking-wider">Corrections par langue</p>
        {LEGAL_LANGS.map(({ code, label }) => (
          <div key={code} className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedLang(expandedLang === code ? null : code)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 transition-colors"
            >
              <span>{label}</span>
              <span className="text-white/20">{expandedLang === code ? "▲" : "▼"}</span>
            </button>
            {expandedLang === code && (
              <div className="px-4 pb-4 space-y-2 bg-white/3">
                <textarea
                  value={current[`content_${code}`] ?? ""}
                  onChange={e => setField(`content_${code}`, e.target.value)}
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/20 resize-y font-mono leading-relaxed"
                />
                <button
                  onClick={() => saveLang(code)}
                  disabled={langSaving === code}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  {langSaving === code ? "…" : `Sauvegarder ${label}`}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ambassadors tab ───────────────────────────────────────────────────────────

function isoToFr(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function frToIso(fr: string): string {
  if (!fr) return "";
  const m = fr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return fr;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

interface Ambassador {
  id: string;
  name: string;
  brand?: string;
  website?: string;
  social_links?: Record<string, string>;
  description: string;
  why_support: string;
  photo_url?: string;
  referral_code?: string;
  category: string;
  display_order: number;
  active: boolean;
  partner_since?: string;
  created_at: string;
}

const EMPTY_AMB: Omit<Ambassador, "id" | "created_at"> = {
  name: "", brand: "", website: "", social_links: {},
  description: "", why_support: "", photo_url: "",
  referral_code: "", category: "Lifestyle", display_order: 0,
  active: true, partner_since: "",
};

function AmbassadorsTab({ phone }: { phone: string }) {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Ambassador> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch(phone, "/api/admin/ambassadors");
    const d = await r.json();
    const list: Ambassador[] = d.ambassadors ?? [];
    setAmbassadors(list);
    setLoading(false);
    // charger les stats de parrainage pour chaque ambassadeur avec un referral_code
    list.filter(a => a.referral_code).forEach(a => {
      adminFetch(phone, `/api/admin/ambassadors/${a.id}`)
        .then(r2 => r2.json())
        .then(s => setStats(prev => ({ ...prev, [a.id]: s.referral_count ?? 0 })))
        .catch(() => {});
    });
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true); setMsg("");
    const url = isNew ? "/api/admin/ambassadors" : `/api/admin/ambassadors/${editing.id}`;
    const method = isNew ? "POST" : "PATCH";
    const r = await adminFetch(phone, url, { method, body: JSON.stringify(editing) });
    const d = await r.json();
    setSaving(false);
    if (d.ok || d.ambassador) {
      setMsg("✓ Sauvegardé");
      setEditing(null);
      load();
    } else {
      setMsg(`Erreur : ${d.error}`);
    }
  }

  async function toggleActive(amb: Ambassador) {
    await adminFetch(phone, `/api/admin/ambassadors/${amb.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !amb.active }),
    });
    load();
  }

  async function deleteAmb(id: string) {
    if (!window.confirm("Supprimer cet ambassadeur ?")) return;
    await adminFetch(phone, `/api/admin/ambassadors/${id}`, { method: "DELETE" });
    load();
  }

  async function moveOrder(id: string, direction: -1 | 1) {
    const idx = ambassadors.findIndex(a => a.id === id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ambassadors.length) return;
    const a = ambassadors[idx];
    const b = ambassadors[swapIdx];
    await Promise.all([
      adminFetch(phone, `/api/admin/ambassadors/${a.id}`, { method: "PATCH", body: JSON.stringify({ display_order: b.display_order }) }),
      adminFetch(phone, `/api/admin/ambassadors/${b.id}`, { method: "PATCH", body: JSON.stringify({ display_order: a.display_order }) }),
    ]);
    load();
  }

  const inputCls = "w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-[#e91e8c]/50";

  if (editing !== null) {
    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">{isNew ? "Nouvel ambassadeur" : "Modifier"}</h3>
          <button onClick={() => { setEditing(null); setMsg(""); }} className="text-white/40 hover:text-white/70 text-sm">✕ Annuler</button>
        </div>

        {/* Nom */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Nom / Pseudo *</label>
          <input value={editing.name ?? ""} onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))} placeholder="Camille Dupont" className={inputCls} />
        </div>

        {/* Marque */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Marque / Raison sociale</label>
          <input value={editing.brand ?? ""} onChange={e => setEditing(prev => ({ ...prev, brand: e.target.value }))} placeholder="Love & Travel Co." className={inputCls} />
        </div>

        {/* Photo upload */}
        <div>
          <label className="block text-xs text-white/40 mb-2">Photo</label>
          <div className="flex items-center gap-3">
            {editing.photo_url ? (
              <img src={editing.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/5 border border-dashed border-white/15 flex items-center justify-center flex-shrink-0 text-white/20 text-xs">Photo</div>
            )}
            <div className="flex-1 space-y-1">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const fd = new FormData();
                  fd.append("file", file);
                  const r = await fetch("/api/admin/upload/ambassadors", {
                    method: "POST",
                    headers: { "X-Admin-Token": phone },
                    body: fd,
                  });
                  const d = await r.json();
                  setUploading(false);
                  if (d.url) setEditing(prev => ({ ...prev, photo_url: d.url }));
                  else setMsg(`Erreur upload : ${d.error}`);
                }}
                className="text-sm text-white/50 file:mr-2 file:px-3 file:py-1 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white/60 hover:file:bg-white/15 cursor-pointer w-full"
              />
              {uploading && <p className="text-xs text-white/30">Upload en cours…</p>}
              {editing.photo_url && (
                <button onClick={() => setEditing(prev => ({ ...prev, photo_url: "" }))} className="text-xs text-red-400/60 hover:text-red-400">Supprimer la photo</button>
              )}
            </div>
          </div>
        </div>

        {/* Réseaux sociaux */}
        <div>
          <label className="block text-xs text-white/40 mb-2">Réseaux sociaux</label>
          <div className="space-y-2">
            {([
              { key: "instagram", label: "Instagram",   placeholder: "https://instagram.com/pseudo" },
              { key: "tiktok",    label: "TikTok",      placeholder: "https://tiktok.com/@pseudo" },
              { key: "youtube",   label: "YouTube",     placeholder: "https://youtube.com/@chaine" },
              { key: "facebook",  label: "Facebook",    placeholder: "https://facebook.com/page" },
              { key: "twitter",   label: "X (Twitter)", placeholder: "https://x.com/pseudo" },
              { key: "linkedin",  label: "LinkedIn",    placeholder: "https://linkedin.com/in/pseudo" },
            ] as { key: string; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-white/30 w-24 shrink-0">{label}</span>
                <input
                  value={(editing.social_links ?? {})[key] ?? ""}
                  onChange={e => setEditing(prev => ({
                    ...prev,
                    social_links: { ...(prev?.social_links ?? {}), [key]: e.target.value },
                  }))}
                  placeholder={placeholder}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Site web */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Site web</label>
          <input value={editing.website ?? ""} onChange={e => setEditing(prev => ({ ...prev, website: e.target.value }))} placeholder="https://example.com" className={inputCls} />
        </div>

        {/* Code ambassadeur */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Code ambassadeur</label>
          <input value={editing.referral_code ?? ""} onChange={e => setEditing(prev => ({ ...prev, referral_code: e.target.value }))} placeholder="CAMILLE20" className={inputCls} />
        </div>

        {/* Partenaire depuis */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Partenaire depuis (jj/mm/aaaa)</label>
          <input
            value={isoToFr(editing.partner_since ?? "")}
            onChange={e => setEditing(prev => ({ ...prev, partner_since: frToIso(e.target.value) }))}
            placeholder="01/05/2026"
            className={inputCls}
          />
        </div>

        {/* Catégorie — overflow visible pour que la liste déroulante soit accessible */}
        <div style={{ overflow: "visible" }}>
          <label className="block text-xs text-white/40 mb-1">Catégorie</label>
          <select
            value={editing.category ?? "Lifestyle"}
            onChange={e => setEditing(prev => ({ ...prev, category: e.target.value }))}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#e91e8c]/50"
          >
            {["Voyage", "Sexualité", "Polyamour", "Lifestyle", "Bien-être", "Art", "Tech"].map(c => (
              <option key={c} value={c} className="bg-[#1a1a2e] text-white">{c}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Description *</label>
          <textarea
            value={editing.description ?? ""}
            onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Présentation courte (visible sur la page publique)"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Pourquoi soutenir */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Pourquoi soutenir StrangerKiss</label>
          <textarea
            value={editing.why_support ?? ""}
            onChange={e => setEditing(prev => ({ ...prev, why_support: e.target.value }))}
            placeholder="Ce qu'ils partagent de notre vision…"
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Actif */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={e => setEditing(prev => ({ ...prev, active: e.target.checked }))}
              className="accent-[#e91e8c]"
            />
            Actif (visible sur la page publique)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
          {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{ambassadors.length} ambassadeur{ambassadors.length > 1 ? "s" : ""}</p>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
          <button
            onClick={() => { setIsNew(true); setEditing({ ...EMPTY_AMB }); setMsg(""); }}
            className="bg-[#e91e8c] hover:bg-[#c2186f] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/30 text-sm">Chargement…</p>
      ) : ambassadors.length === 0 ? (
        <p className="text-white/30 text-sm">Aucun ambassadeur.</p>
      ) : (
        <div className="space-y-3">
          {ambassadors.map((amb, idx) => (
            <div key={amb.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4">
              {/* Photo miniature */}
              {amb.photo_url ? (
                <img src={amb.photo_url} alt={amb.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#e91e8c]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#e91e8c]">{amb.name[0]?.toUpperCase()}</span>
                </div>
              )}

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{amb.name}</span>
                  {amb.brand && <span className="text-white/40 text-xs">· {amb.brand}</span>}
                  <span className="text-[10px] uppercase tracking-wider text-[#e91e8c] bg-[#e91e8c]/10 rounded-full px-2 py-0.5">{amb.category}</span>
                  {!amb.active && <span className="text-[10px] text-white/30 bg-white/5 rounded-full px-2 py-0.5">inactif</span>}
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate">{amb.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                  {amb.referral_code && <span>Code: <span className="text-white/50 font-mono">{amb.referral_code}</span></span>}
                  {amb.referral_code && stats[amb.id] !== undefined && (
                    <span>· <span className="text-white/60">{stats[amb.id]}</span> parrainages</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => moveOrder(amb.id, -1)} disabled={idx === 0}
                  className="text-white/30 hover:text-white/60 disabled:opacity-20 px-1.5 py-1 text-xs" title="Monter">↑</button>
                <button onClick={() => moveOrder(amb.id, 1)} disabled={idx === ambassadors.length - 1}
                  className="text-white/30 hover:text-white/60 disabled:opacity-20 px-1.5 py-1 text-xs" title="Descendre">↓</button>
                <button onClick={() => toggleActive(amb)}
                  className={`px-2 py-1 rounded-lg text-xs transition-all ${amb.active ? "text-green-400 bg-green-500/10 hover:bg-green-500/20" : "text-white/30 bg-white/5 hover:bg-white/10"}`}>
                  {amb.active ? "Actif" : "Inactif"}
                </button>
                <button onClick={() => { setIsNew(false); setEditing({ ...amb }); setMsg(""); }}
                  className="text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-xs transition-all">
                  Modifier
                </button>
                <button onClick={() => deleteAmb(amb.id)}
                  className="text-red-400/60 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded-lg text-xs transition-all">
                  Suppr.
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
        {tab === "encounters" && <EncountersTab phone={adminPhone} />}
        {tab === "legal"      && <LegalTab phone={adminPhone} />}
        {tab === "launch"       && <LaunchTab phone={adminPhone} />}
        {tab === "ambassadors"  && <AmbassadorsTab phone={adminPhone} />}
      </main>
    </div>
  );
}

export default function BossPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      const storedToken   = localStorage.getItem("sk_admin_token");
      const storedExpires = localStorage.getItem("sk_admin_expires");
      if (storedToken && storedExpires && new Date(storedExpires) > new Date()) {
        setToken(storedToken);
      } else {
        // Session expirée — nettoyer silencieusement
        localStorage.removeItem("sk_admin_token");
        localStorage.removeItem("sk_admin_expires");
      }
    } catch { /* ignore */ }
    setChecking(false);
  }, []);

  async function logout() {
    try {
      const t = localStorage.getItem("sk_admin_token");
      if (t) {
        await fetch("/api/admin/auth/logout", {
          method: "POST",
          headers: { "X-Admin-Token": t },
        });
      }
      localStorage.removeItem("sk_admin_token");
      localStorage.removeItem("sk_admin_expires");
    } catch { /* ignore */ }
    setToken(null);
  }

  function handleAuth(newToken: string, expiresAt: string) {
    try {
      localStorage.setItem("sk_admin_token", newToken);
      localStorage.setItem("sk_admin_expires", expiresAt);
    } catch { /* ignore */ }
    setToken(newToken);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-3xl animate-pulse">⏳</div>
      </div>
    );
  }

  if (!token) return <AuthPanel onAuth={handleAuth} />;
  return <Dashboard adminPhone={token} onLogout={logout} />;
}
