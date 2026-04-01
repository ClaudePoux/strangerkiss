import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 pt-20 pb-16 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#e91e8c]/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#7c3aed]/10 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="text-7xl mb-6 select-none">💋</div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Stranger</span>
            <span className="text-[#e91e8c]">Kiss</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 mb-10 leading-relaxed">
            Tu voyages. Tu croises des gens. Parfois tu as juste envie
            d&apos;un <strong className="text-white/80">hug</strong> ou
            d&apos;un vrai{" "}
            <strong className="text-[#e91e8c]">French kiss</strong> avec
            un·e inconnu·e. StrangerKiss te connecte à ceux qui cherchent
            la même chose, autour de toi, maintenant.
          </p>

          <Link
            href="/profile"
            className="inline-block bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold text-lg px-10 py-4 rounded-full transition-all duration-200 shadow-[0_0_30px_rgba(233,30,140,0.4)] hover:shadow-[0_0_50px_rgba(233,30,140,0.6)] hover:scale-105 active:scale-95"
          >
            Je me lance →
          </Link>

          <p className="mt-5 text-sm text-white/30">
            Aucun compte requis. Anonyme. Gratuit.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl font-semibold text-white/80 mb-10">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: "✏️",
                title: "1. Crée ton profil",
                desc: "Pseudo, âge, et ce que tu cherches : hug ou French kiss.",
              },
              {
                icon: "📍",
                title: "2. Géolocalise-toi",
                desc: "On te place sur la carte. Les autres te voient, tu les vois.",
              },
              {
                icon: "💞",
                title: "3. Trouve un match",
                desc: "Approche les gens qui cherchent la même chose que toi.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.08] transition-colors"
              >
                <div className="text-4xl mb-3">{step.icon}</div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/20">
        StrangerKiss — prototype v0.1 · Pour adultes consentants uniquement
      </footer>
    </main>
  );
}
