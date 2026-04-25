"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
}

interface Ambassador {
  id: string;
  name: string;
  brand?: string;
  website?: string;
  social_links?: SocialLinks;
  description: string;
  photo_url?: string;
  referral_code?: string;
  category: string;
  display_order: number;
  partner_since?: string;
}

const CATEGORIES = ["Tous", "Voyage", "Sexualité", "Polyamour", "Lifestyle", "Bien-être", "Art", "Tech"];

function SocialIcon({ platform, url }: { platform: string; url: string }) {
  const icons: Record<string, string> = {
    instagram: "📷",
    tiktok: "🎵",
    youtube: "▶️",
    twitter: "𝕏",
  };
  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-white/40 hover:text-white/80 transition-colors text-sm"
      title={platform}
    >
      {icons[platform] ?? "🔗"}
    </a>
  );
}

function AmbassadorCard({ amb }: { amb: Ambassador }) {
  const initials = amb.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const socialEntries = Object.entries(amb.social_links ?? {}).filter(([, v]) => v);

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 hover:bg-white/[0.07] hover:border-[#e91e8c]/20 transition-all group">
      {/* Header : photo + nom + marque */}
      <div className="flex items-start gap-4">
        {amb.photo_url ? (
          <img
            src={amb.photo_url}
            alt={amb.name}
            className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-white/10"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#e91e8c]/15 border border-[#e91e8c]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-[#e91e8c]">{initials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-base truncate">{amb.name}</h3>
          {amb.brand && (
            <p className="text-sm text-white/50 truncate">{amb.brand}</p>
          )}
          <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider font-medium text-[#e91e8c] bg-[#e91e8c]/10 border border-[#e91e8c]/20 rounded-full px-2 py-0.5">
            {amb.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{amb.description}</p>

      {/* Footer : liens */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-3">
          {socialEntries.map(([platform, url]) => (
            <SocialIcon key={platform} platform={platform} url={url as string} />
          ))}
          {amb.website && (
            <a
              href={amb.website.startsWith("http") ? amb.website : `https://${amb.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/80 transition-colors text-sm"
              title="Site web"
            >
              🌐
            </a>
          )}
        </div>
        {amb.referral_code && (
          <Link
            href={`/?ref=${amb.referral_code}`}
            className="text-xs text-[#e91e8c]/60 hover:text-[#e91e8c] bg-[#e91e8c]/5 hover:bg-[#e91e8c]/10 border border-[#e91e8c]/15 rounded-full px-3 py-1 transition-all"
          >
            Code : {amb.referral_code}
          </Link>
        )}
      </div>
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
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
