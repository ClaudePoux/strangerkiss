import Link from "next/link";
import { adminSb } from "@/lib/admin-auth";

export const metadata = {
  title: "Conditions générales d'utilisation — StrangerKiss",
};

async function getLegalContent(): Promise<string | null> {
  try {
    const { data } = await adminSb
      .from("legal_pages")
      .select("content_fr")
      .eq("slug", "cgv")
      .maybeSingle();
    return data?.content_fr || null;
  } catch {
    return null;
  }
}

export default async function CgvPage() {
  const dbContent = await getLegalContent();

  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <div className="mb-10">
        <Link href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">
          ← Retour
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-10">
        {"Conditions générales d'utilisation"}
      </h1>

      <div className="space-y-10 text-sm text-white/60 leading-relaxed">
        {dbContent ? (
          <p className="whitespace-pre-line">{dbContent}</p>
        ) : (
          <>
            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Objet</h2>
              <p>
                Les présentes Conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;utilisation du service StrangerKiss, accessible à l&apos;adresse strangerkiss.com, édité par la SARL TWADEO.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Accès au service</h2>
              <p>
                L&apos;accès à StrangerKiss est réservé aux personnes physiques majeures (18 ans ou plus). En utilisant le service, vous attestez être majeur(e) et accepter pleinement les présentes CGU.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Description du service</h2>
              <p>
                StrangerKiss est une plateforme de géolocalisation permettant à des utilisateurs inscrits de se trouver à proximité dans le but d&apos;échanger un hug ou un baiser consenti. Le service comprend :
              </p>
              <ul className="mt-2 pl-4 space-y-1 list-disc list-inside">
                <li>La création et la publication d&apos;un profil géolocalisé</li>
                <li>La visualisation des profils à proximité sur une carte</li>
                <li>Un système de messagerie entre utilisateurs</li>
                <li>Un système de demande de rencontre par consentement mutuel</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Inscription et vérification</h2>
              <p>
                L&apos;inscription est gratuite et requiert la vérification d&apos;un numéro de téléphone mobile valide. 3 crédits sont offerts à l&apos;inscription. Le numéro de téléphone n&apos;est jamais visible des autres utilisateurs ; il sert uniquement à l&apos;identification et à la modération.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Crédits et paiement</h2>
              <p>
                Le service fonctionne par un système de crédits. Un crédit est dépensé uniquement lorsqu&apos;une rencontre est mutuellement acceptée par les deux parties. En cas de refus, aucun crédit n&apos;est prélevé. Des crédits supplémentaires peuvent être acquis via paiement sécurisé (carte bancaire, Apple Pay, Google Pay) par l&apos;intermédiaire de Stripe.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Comportement des utilisateurs</h2>
              <p>
                Les utilisateurs s&apos;engagent à n&apos;utiliser le service que dans un cadre légal et respectueux. Il est notamment interdit de :
              </p>
              <ul className="mt-2 pl-4 space-y-1 list-disc list-inside">
                <li>Publier des informations fausses ou trompeuses</li>
                <li>Harceler, menacer ou insulter d&apos;autres utilisateurs</li>
                <li>Contacter des utilisateurs n&apos;ayant pas accepté de rencontre</li>
                <li>Utiliser le service à des fins commerciales ou publicitaires</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Modération et sanctions</h2>
              <p>
                La SARL TWADEO se réserve le droit de suspendre ou bannir tout compte en cas de non-respect des présentes CGU. Un système de signalement est disponible dans le chat. Les bannis peuvent faire l&apos;objet d&apos;un blocage temporaire (24h) ou définitif.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Responsabilité</h2>
              <p>
                StrangerKiss est un service de mise en relation. La SARL TWADEO ne saurait être tenue responsable des rencontres organisées entre utilisateurs, ni des actes commis lors de ces rencontres. Chaque utilisateur agit sous sa propre responsabilité.
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
              <h2 className="text-base font-semibold text-white/90 mb-3">Modification des CGU</h2>
              <p>
                La SARL TWADEO se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de tout changement substantiel. L&apos;utilisation du service après notification vaut acceptation des nouvelles CGU.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-white/90 mb-3">Droit applicable</h2>
              <p>
                Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux français.
              </p>
            </section>

            <p className="text-white/20 text-xs pt-4 border-t border-white/5">
              Dernière mise à jour : avril 2026
            </p>
          </>
        )}
      </div>
    </main>
  );
}
