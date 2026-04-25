"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
}

interface Ambassador {
  id: string;
  name: string;
  brand?: string;
  website?: string;
  social_links?: SocialLinks;
  description: string;
  why_support?: string;
  photo_url?: string;
  category: string;
  display_order: number;
  partner_since?: string;
}

const CATEGORIES = ["Tous", "Voyage", "Sexualité", "Polyamour", "Lifestyle", "Bien-être", "Art", "Tech"];

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "📷 Instagram",
  tiktok:    "🎵 TikTok",
  youtube:   "▶️ YouTube",
  twitter:   "𝕏 Twitter",
  facebook:  "Facebook",
  linkedin:  "LinkedIn",
};

function AmbassadorCard({ amb }: { amb: Ambassador }) {
  const initials = amb.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const socialEntries = Object.entries(amb.social_links ?? {}).filter(([, v]) => v);

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 hover:bg-white/[0.07] hover:border-[#e91e8c]/20 transition-all">
      {/* Header : photo + nom + marque */}
      <div className="flex items-start gap-5">
        {amb.photo_url ? (
          <img
            src={amb.photo_url}
            alt={amb.name}
            className="w-24 h-24 rounded-2xl object-contain flex-shrink-0 border border-white/10 bg-white/5"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-[#e91e8c]/15 border border-[#e91e8c]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-[#e91e8c]">{initials}</span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-white text-lg">{amb.name}</h3>
          {amb.brand && (
            <p className="text-sm text-white/50 mt-0.5">{amb.brand}</p>
          )}
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-medium text-[#e91e8c] bg-[#e91e8c]/10 border border-[#e91e8c]/20 rounded-full px-2 py-0.5">
            {amb.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-white/60 leading-relaxed">{amb.description}</p>

      {/* Pourquoi ils soutiennent StrangerKiss */}
      {amb.why_support && (
        <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-[#e91e8c]/60 font-medium mb-1">Pourquoi ils soutiennent StrangerKiss</p>
          <p className="text-sm text-white/55 leading-relaxed">{amb.why_support}</p>
        </div>
      )}

      {/* Liens réseaux sociaux + site web empilés verticalement */}
      {(socialEntries.length > 0 || amb.website) && (
        <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
          {socialEntries.map(([platform, url]) => (
            <a
              key={platform}
              href={(url as string).startsWith("http") ? (url as string) : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              {SOCIAL_LABELS[platform] ?? `🔗 ${platform}`}
            </a>
          ))}
          {amb.website && (
            <a
              href={amb.website.startsWith("http") ? amb.website : `https://${amb.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              🌐 Site web
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AmbassadeursPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Tous");

  useEffect(() => {
    fetch("/api/ambassadors")
      .then(r => r.json())
      .then(d => setAmbassadors(d.ambassadors ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ["Tous", ...Array.from(new Set(ambassadors.map(a => a.category))).sort()];
  const filtered = activeCategory === "Tous"
    ? ambassadors
    : ambassadors.filter(a => a.category === activeCategory);

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      {/* Back */}
      <div className="mb-10">
        <Link href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">
          ← Accueil
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-[#e91e8c]/10 border border-[#e91e8c]/25 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#e91e8c] animate-pulse" />
          <span className="text-xs text-[#e91e8c] font-medium">Partenaires & Ambassadeurs</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Ils soutiennent <span className="text-[#e91e8c]">StrangerKiss</span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
          Créateurs, marques et influenceurs qui partagent notre vision des rencontres authentiques.
        </p>
      </div>

      {/* Filtres catégories */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-[#e91e8c] text-white shadow-[0_0_20px_rgba(233,30,140,0.3)]"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grille */}
      {loading ? (
        <div className="text-center py-20 text-white/30 text-sm animate-pulse">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">💋</div>
          <p className="text-white/40 text-sm">Les ambassadeurs arrivent bientôt.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filtered.map(amb => (
            <AmbassadorCard key={amb.id} amb={amb} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-16">
        <p className="text-white/25 text-xs">
          Vous souhaitez devenir ambassadeur·rice ?{" "}
          <a href="mailto:hello@strangerkiss.com" className="underline underline-offset-2 hover:text-white/50 transition-colors">
            Contactez-nous
          </a>
        </p>
      </div>
    </main>
  );
}
