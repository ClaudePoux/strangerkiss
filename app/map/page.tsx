import { Suspense } from "react";
import MapClient from "./MapClient";

// Force le rendu dynamique (pas de génération statique) pour que
// useSearchParams() dans MapClient reçoive les vrais paramètres d'URL
// et évite le mismatch d'hydratation React #418.
export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <Suspense>
      <MapClient />
    </Suspense>
  );
}
