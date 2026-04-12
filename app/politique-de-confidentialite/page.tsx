import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité — StrangerKiss",
};

export default function PolitiqueConfidentialitePage() {
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

      <h1 className="text-3xl font-bold text-white mb-2">
        Politique de confidentialité
      </h1>
      <p className="text-white/40 text-sm mb-10">Conforme au RGPD (Règlement UE 2016/679)</p>

      <div className="space-y-10 text-sm text-white/60 leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">1. Responsable du traitement</h2>
          <div className="pl-4 border-l border-white/10 space-y-1">
            <p><strong className="text-white/80">SARL TWADEO</strong></p>
            <p>24 rue de la Banque — 71100 Chalon-sur-Saône</p>
            <p>SIRET : 51401006500027</p>
            <p>Contact : <a href="mailto:claude.poux@twadeo.fr" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">claude.poux@twadeo.fr</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">2. Données collectées</h2>
          <div className="space-y-4">
            <div>
              <p className="text-white/80 font-medium mb-2">Lors de l'inscription</p>
              <ul className="space-y-1 pl-4 list-disc list-outside">
                <li><strong className="text-white/70">Numéro de téléphone</strong> — utilisé uniquement pour la vérification par SMS (Twilio Verify). Il n'est jamais communiqué à d'autres utilisateurs.</li>
              </ul>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-2">Lors de la création d'un profil</p>
              <ul className="space-y-1 pl-4 list-disc list-outside">
                <li><strong className="text-white/70">Prénom ou pseudo</strong> (librement choisi, non nominatif)</li>
                <li><strong className="text-white/70">Âge</strong> (vérification de majorité — 18 ans minimum)</li>
                <li><strong className="text-white/70">Genre</strong> (optionnel)</li>
                <li><strong className="text-white/70">Nationalité</strong> (optionnel)</li>
                <li><strong className="text-white/70">Géolocalisation</strong> — coordonnées GPS collectées avec le consentement explicite du navigateur, utilisées uniquement pour afficher les profils proches</li>
                <li><strong className="text-white/70">Description physique et bio</strong> (librement rédigées, optionnelles)</li>
              </ul>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-2">Lors de l'utilisation du chat</p>
              <ul className="space-y-1 pl-4 list-disc list-outside">
                <li><strong className="text-white/70">Messages texte</strong> échangés entre deux utilisateurs</li>
                <li><strong className="text-white/70">Photos selfie</strong> envoyées volontairement dans une conversation</li>
              </ul>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-2">Enquête post-expérience (optionnelle)</p>
              <ul className="space-y-1 pl-4 list-disc list-outside">
                <li><strong className="text-white/70">Genre déclaré</strong> et <strong className="text-white/70">situation de voyage</strong> — collectés une seule fois, à usage statistique uniquement, pour adapter l'expérience et comprendre nos utilisateurs. Ces données ne sont jamais communiquées à des tiers.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">3. Finalités du traitement</h2>
          <ul className="space-y-2 pl-4 list-disc list-outside">
            <li>Vérification de l'identité et de la majorité via SMS</li>
            <li>Affichage des profils à proximité sur la carte</li>
            <li>Mise en relation entre utilisateurs consentants</li>
            <li>Gestion du système de crédits et des paiements</li>
            <li>Prévention des abus et sécurité du service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">4. Durée de conservation</h2>
          <ul className="space-y-2 pl-4 list-disc list-outside">
            <li><strong className="text-white/70">Profils (pins) :</strong> supprimés automatiquement après <strong className="text-white/70">24 heures</strong></li>
            <li><strong className="text-white/70">Messages et selfies :</strong> conservés le temps de la conversation, supprimables sur demande</li>
            <li><strong className="text-white/70">Compte utilisateur (numéro de téléphone + crédits) :</strong> conservé jusqu'à la suppression du compte ou sur demande</li>
            <li><strong className="text-white/70">Données de paiement :</strong> gérées exclusivement par Stripe — nous ne stockons aucune donnée bancaire</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">5. Base légale</h2>
          <ul className="space-y-2 pl-4 list-disc list-outside">
            <li><strong className="text-white/70">Consentement</strong> (art. 6.1.a RGPD) — géolocalisation, création de profil</li>
            <li><strong className="text-white/70">Exécution du contrat</strong> (art. 6.1.b RGPD) — vérification SMS, gestion des crédits</li>
            <li><strong className="text-white/70">Intérêt légitime</strong> (art. 6.1.f RGPD) — sécurité et prévention des abus</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">6. Sous-traitants</h2>
          <div className="space-y-2">
            {[
              { name: "Supabase", role: "Base de données et authentification", location: "États-Unis (clauses contractuelles types UE)" },
              { name: "Vercel", role: "Hébergement de l'application", location: "États-Unis (clauses contractuelles types UE)" },
              { name: "Twilio", role: "Envoi des SMS de vérification", location: "États-Unis (clauses contractuelles types UE)" },
              { name: "Stripe", role: "Traitement des paiements", location: "États-Unis (certifié PCI-DSS)" },
              { name: "DeepL", role: "Traduction des messages", location: "Allemagne (Union Européenne)" },
            ].map((p) => (
              <div key={p.name} className="pl-4 border-l border-white/10">
                <span className="text-white/80 font-medium">{p.name}</span> — {p.role}
                <span className="block text-white/30 text-xs mt-0.5">{p.location}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">7. Vos droits</h2>
          <p className="mb-3">Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="space-y-1 pl-4 list-disc list-outside">
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement (« droit à l'oubli »)</li>
            <li>Droit à la portabilité</li>
            <li>Droit d'opposition et de limitation du traitement</li>
            <li>Droit de retirer votre consentement à tout moment</li>
          </ul>
          <p className="mt-3">
            Pour exercer ces droits : <a href="mailto:claude.poux@twadeo.fr" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">claude.poux@twadeo.fr</a>
          </p>
          <p className="mt-2">
            En cas de litige non résolu, vous pouvez saisir la <strong className="text-white/70">CNIL</strong> : <a href="https://www.cnil.fr" className="text-[#e91e8c]/70 hover:text-[#e91e8c] transition-colors">cnil.fr</a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white/90 mb-3">8. Cookies</h2>
          <p>
            StrangerKiss n'utilise pas de cookies de traçage ou publicitaires. Seul le stockage local du navigateur (<code className="text-white/50">localStorage</code>) est utilisé pour conserver temporairement votre session et préférences de langue.
          </p>
        </section>

        <p className="text-white/20 text-xs pt-4 border-t border-white/5">
          Dernière mise à jour : avril 2026 —{" "}
          <Link href="/mentions-legales" className="hover:text-white/40 transition-colors">
            Mentions légales
          </Link>
        </p>
      </div>
    </main>
  );
}
