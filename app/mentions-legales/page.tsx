import Link from "next/link";

export const metadata = {
  title: "Mentions légales — StrangerKiss",
};

export default function MentionsLegalesPage() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <div className="mb-10">
        <Link
          href="/"
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          ← Retour
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-10">Mentions légales</h1>

      <div className="space-y-10 text-sm text-white/60 leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Éditeur du site</h2>
          <p>
            Le site <strong className="text-white/80">strangerkiss.com</strong> est édité par :
          </p>
          <div className="mt-3 pl-4 border-l border-white/10 space-y-1">
            <p><strong className="text-white/80">SARL TWADEO</strong></p>
            <p>24 rue de la Banque</p>
            <p>71100 Chalon-sur-Saône</p>
            <p>France</p>
            <p className="pt-1">SIRET : 51401006500027</p>
            <p>Gérant : M. Claude Poux</p>
            <p>Contact : <a href="mailto:claude.poux@twadeo.fr" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">claude.poux@twadeo.fr</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Directeur de la publication</h2>
          <p>M. Claude Poux, gérant de la SARL TWADEO.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Hébergement</h2>
          <div className="space-y-4">
            <div>
              <p className="text-white/80 font-medium mb-1">Application web</p>
              <p>Vercel Inc.</p>
              <p>340 Pine Street, Suite 900</p>
              <p>San Francisco, CA 94104 — États-Unis</p>
              <p><a href="https://vercel.com" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">vercel.com</a></p>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-1">Base de données</p>
              <p>Supabase Inc.</p>
              <p><a href="https://supabase.com" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">supabase.com</a></p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Propriété intellectuelle</h2>
          <p>
            L'ensemble des contenus du site strangerkiss.com (textes, graphismes, logotypes, icônes) est la propriété exclusive de la SARL TWADEO, sauf mention contraire. Toute reproduction, représentation ou diffusion, en tout ou partie, est interdite sans autorisation préalable écrite.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Responsabilité</h2>
          <p>
            StrangerKiss est une plateforme de mise en relation entre adultes consentants (+18 ans). La SARL TWADEO ne saurait être tenue responsable des rencontres organisées entre utilisateurs ni des conséquences qui en découleraient. Les utilisateurs s'engagent à utiliser le service conformément aux lois en vigueur et dans le respect mutuel.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Données personnelles</h2>
          <p>
            Pour toute information relative au traitement de vos données personnelles, consultez notre{" "}
            <Link href="/politique-de-confidentialite" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">
              Politique de confidentialité
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
          </p>
        </section>

        <p className="text-white/20 text-xs pt-4 border-t border-white/5">
          Dernière mise à jour : avril 2026
        </p>
      </div>
    </main>
  );
}
