"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { UserPin, LookingFor, Gender } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import PhoneVerification from "@/components/PhoneVerification";
import ReferralCard from "@/components/ReferralCard";
import SurveyModal from "@/components/SurveyModal";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

function getOrCreateMyId(): string {
  try {
    const stored = localStorage.getItem("sk_my_id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("sk_my_id", id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Maps browser locale to a demo_pins country code. */
function localeToCountry(locale: string): string {
  const map: Record<string, string> = {
    fr: "fr", it: "it", de: "de", es: "es", en: "en",
    pl: "ee", cs: "ee", hu: "ee", sk: "ee", ro: "ee",
  };
  return map[locale.split(/[-_]/)[0].toLowerCase()] ?? "fr";
}

/** Minimal seeded PRNG (LCG) — deterministic for a given seed. */
function seededRng(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = ((s * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    return s / 0x100000000;
  };
}

/** Returns [lat, lng] offset by `distM` metres in direction `angleDeg`. */
function offsetLatLng(
  lat: number, lng: number, distM: number, angleDeg: number
): [number, number] {
  const R = 6371000;
  const d = distM / R;
  const a = (angleDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(a)
  );
  const lng2 =
    (lng * Math.PI) / 180 +
    Math.atan2(
      Math.sin(a) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

function flagEmoji(code: string): string {
  if (!code) return "";
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

async function fetchBlocked(pinId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/blocks?pin_id=${pinId}`);
    const { blocked } = await res.json();
    return blocked ?? [];
  } catch {
    return [];
  }
}

// Composant interne qui utilise useSearchParams() — doit rester dans un Suspense
function MapPageContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const LABEL: Record<string, string> = {
    hug: t("map.hug"),
    french_kiss: t("map.frenchKiss"),
  };

  function translateGender(g: string): string {
    const m: Record<string, string> = {
      femme: t("profile.genderFemme"),
      homme: t("profile.genderHomme"),
      "non-binaire": t("profile.genderNonBinaire"),
    };
    return m[g] ?? g;
  }

  const [profile, setProfile] = useState<{
    name: string;
    age: number;
    gender: Gender;
    nationality: string;
    bio: string;
    appearance: string;
    looking_for: LookingFor;
  } | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [credits, setCredits] = useState<number | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoErrorKey, setGeoErrorKey] = useState("");
  const [pins, setPins] = useState<UserPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [unreadSender, setUnreadSender] = useState<{ id: string; name: string; appearance: string } | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  // Portal monté côté client uniquement (SSR-safe)
  const [portalMounted, setPortalMounted] = useState(false);

  // Ping : ref conservée entre les renders
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPinIdRef    = useRef<string>("");
  // Timestamp du dernier contrôle inbox (initialisé au chargement)
  const inboxSinceRef   = useRef<string>(new Date().toISOString());
  // Ref vers startPing pour que le handler visibilitychange puisse l'appeler
  // sans dépendance d'ordre (startPing est déclaré via useCallback plus bas)
  const startPingRef    = useRef<(pinId: string) => void>(() => {});
  // Ref vers pins pour l'effet inbox — évite de re-créer l'intervalle à chaque refresh pins
  const pinsRef         = useRef<UserPin[]>([]);

  // Portal SSR-safe : monté uniquement après hydratation côté client
  useEffect(() => { setPortalMounted(true); }, []);

  // Stop/restart ping selon visibilité de l'onglet
  useEffect(() => {
    function stopPing() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        stopPing();
      } else if (document.visibilityState === "visible") {
        // Onglet redevenu visible (retour du chat, switch d'app…)
        // 1. Relancer le ping pour éviter l'expiration du pin
        if (pingPinIdRef.current) startPingRef.current(pingPinIdRef.current);
        // 2. Avancer le curseur inbox au moment du retour — les messages vus
        //    dans le chat ne déclencheront pas une nouvelle notification,
        //    et le prochain poll ne captera que les VRAIS nouveaux messages.
        inboxSinceRef.current = new Date().toISOString();
      }
    }
    // bfcache iOS Safari : pageshow avec persisted=true signifie que la page
    // est restaurée depuis le cache sans remontage React → même traitement.
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted && pingPinIdRef.current) {
        startPingRef.current(pingPinIdRef.current);
        inboxSinceRef.current = new Date().toISOString();
      }
    }
    window.addEventListener("beforeunload", stopPing);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", stopPing);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
      stopPing();
    };
  }, []);

  // Ping toutes les 4 min pour rester visible sur la carte
  const startPing = useCallback((pinId: string) => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingPinIdRef.current = pinId;
    pingIntervalRef.current = setInterval(async () => {
      try {
        await fetch("/api/db/pins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin_id: pingPinIdRef.current }),
        });
      } catch { /* ignore — le prochain ping réessaiera */ }
    }, 4 * 60 * 1000);
  }, []);

  // Synchronise la ref dès que startPing est (re)créé
  useEffect(() => { startPingRef.current = startPing; }, [startPing]);

  // Synchronise pinsRef à chaque update de pins (sans recréer l'effet inbox)
  useEffect(() => { pinsRef.current = pins; }, [pins]);

  // Déclenche la SurveyModal si sk_survey_pending est actif.
  // Appelée au montage ET à chaque retour de visibilité (router cache Next.js).
  function checkSurveyPending(source: string) {
    try {
      const pending = localStorage.getItem("sk_survey_pending");
      const done    = localStorage.getItem("sk_survey_done");
      console.log(`[MapClient] checkSurveyPending (${source}) — pending:`, pending, "done:", done);
      if (pending === "true" && done !== "true") {
        console.log("[MapClient] → setShowSurvey(true)");
        setShowSurvey(true);
        localStorage.removeItem("sk_survey_pending");
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const id = getOrCreateMyId();
    setMyId(id);
    fetchBlocked(id).then(setBlocked);
    try {
      const stored = localStorage.getItem("sk_profile");
      if (stored) setProfile(JSON.parse(stored));
      const storedUserId = localStorage.getItem("sk_user_id");
      if (storedUserId) {
        setUserId(storedUserId);
        const cached = localStorage.getItem("sk_user_credits");
        if (cached !== null) setCredits(parseInt(cached, 10));
        fetch(`/api/credits/balance?user_id=${storedUserId}`)
          .then((r) => r.json())
          .then(({ credits: c }) => {
            if (c != null) {
              setCredits(c);
              localStorage.setItem("sk_user_credits", String(c));
            }
          })
          .catch(() => {});
      }
      if (localStorage.getItem("sk_phone")) setPhoneVerified(true);
      // Enquête post-expérience : check initial au montage
      checkSurveyPending("[MapClient] mount");
    } catch { /* ignore */ }

    // Fallback pour le router cache Next.js (retour arrière sans remontage complet) :
    // re-check au retour de visibilité (même onglet, même page redevenue visible)
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkSurveyPending("[MapClient] visibilitychange");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const refreshPins = useCallback(async (lat: number, lng: number, currentMyId: string) => {
    try {
      const nearbyRes = await fetch(`/api/db/pins?lat=${lat}&lng=${lng}`);
      if (!nearbyRes.ok) return;
      const { pins: nearby } = await nearbyRes.json();
      setPins((nearby as UserPin[]).filter((p) => p.id !== currentMyId));
    } catch { /* ignore */ }
  }, []);

  const loadMap = useCallback(
    async (lat: number, lng: number) => {
      setCoords([lat, lng]);

      if (profile) {
        try {
          if (isDemo) {
            // Sélectionner 3-5 profils fictifs depuis Supabase selon la langue du navigateur.
            // Rotation toutes les 6h basée sur une seed déterministe.
            const country = localeToCountry(locale);
            const cacheKey = `sk_demo_pins_${country}`;
            let pool: UserPin[] | null = null;
            try {
              const cached = sessionStorage.getItem(cacheKey);
              if (cached) pool = JSON.parse(cached) as UserPin[];
            } catch { /* ignore */ }

            if (!pool) {
              try {
                const res = await fetch(`/api/demo/pins?country=${country}`);
                const { pins: fetched } = await res.json();
                pool = fetched as UserPin[];
                sessionStorage.setItem(cacheKey, JSON.stringify(pool));
              } catch { pool = []; }
            }

            if (pool && pool.length > 0) {
              // Seed basée sur l'heure arrondie à la tranche de 6h
              const slot = Math.floor(Date.now() / (6 * 3600 * 1000));
              const rng = seededRng(slot);
              const count = 3 + Math.floor(rng() * 3); // 3–5 profils
              const shuffled = [...pool].sort(() => rng() - 0.5);
              const selected = shuffled.slice(0, Math.min(count, shuffled.length));
              const now = new Date().toISOString();
              setPins(
                selected.map((d, i) => {
                  const dist = 200 + Math.floor(rng() * 800); // 200–1000 m
                  const angle = rng() * 360;
                  const [pLat, pLng] = offsetLatLng(lat, lng, dist, angle);
                  return {
                    ...d,
                    id: `demo-${i + 1}`,
                    user_id: undefined,
                    lat: pLat,
                    lng: pLng,
                    created_at: now,
                    last_seen: now,
                  };
                })
              );
            }
          } else {
            const storedUserId  = localStorage.getItem("sk_user_id") ?? undefined;
            const existingPinId = localStorage.getItem("sk_my_id")   ?? undefined;
            const pinRes = await fetch("/api/db/pins", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pin_id: existingPinId,
                name: profile.name,
                age: profile.age,
                gender: profile.gender,
                nationality: profile.nationality ?? "",
                bio: profile.bio,
                appearance: profile.appearance,
                looking_for: profile.looking_for,
                lat,
                lng,
                user_id: storedUserId ?? null,
              }),
            });
            const { pin, user_id: returnedUserId } = await pinRes.json();
            if (pin?.id) {
              localStorage.setItem("sk_my_id", pin.id);
              setMyId(pin.id);
              fetchBlocked(pin.id).then(setBlocked);
              startPing(pin.id);
            }
            if (returnedUserId && !storedUserId) {
              localStorage.setItem("sk_user_id", returnedUserId);
              setUserId(returnedUserId);
              setCredits(3);
              localStorage.setItem("sk_user_credits", "3");
              setTimeout(() => setShowVerify(true), 3000);
            }
            const nearbyRes = await fetch(`/api/db/pins?lat=${lat}&lng=${lng}`);
            const { pins: nearby } = await nearbyRes.json();
            const ownId = localStorage.getItem("sk_my_id");
            setPins((nearby as UserPin[]).filter((p) => p.id !== ownId));
          }
        } catch {
          if (!isDemo) setPins([]);
        }
      }
      setLoading(false);
    },
    [profile, isDemo, startPing]
  );

  // Rafraîchissement toutes les 10s (mode réel uniquement)
  useEffect(() => {
    if (!coords || loading || isDemo) return;
    const [lat, lng] = coords;
    const currentMyId = myId;
    const interval = setInterval(() => refreshPins(lat, lng, currentMyId), 10000);
    return () => clearInterval(interval);
  }, [coords, myId, loading, isDemo, refreshPins]);

  // Polling inbox toutes les 10s — notification si nouveau message reçu.
  // N'inclut PAS `pins` dans les deps : pins change toutes les 10s (refreshPins)
  // et provoquerait un clear+restart de l'intervalle en permanence, empêchant
  // le poll de tirer. pinsRef donne accès à la valeur courante sans dépendance.
  useEffect(() => {
    if (!myId || isDemo || loading) return;
    const interval = setInterval(async () => {
      try {
        const since = inboxSinceRef.current;
        inboxSinceRef.current = new Date().toISOString();
        const res = await fetch(`/api/db/messages?inbox=${encodeURIComponent(myId)}&since=${encodeURIComponent(since)}`);
        if (!res.ok) return;
        const { messages } = await res.json();
        if (messages?.length > 0) {
          const senderId = messages[0].from_id as string;
          // Chercher dans les pins courants (via ref, sans dépendance de l'effet)
          let senderPin = pinsRef.current.find((p) => p.id === senderId);
          if (!senderPin) {
            try {
              const pr = await fetch(`/api/db/pins?pin_id=${encodeURIComponent(senderId)}`);
              if (pr.ok) {
                const { pin } = await pr.json();
                senderPin = pin ?? undefined;
              }
            } catch { /* ignore */ }
          }
          setUnreadSender({
            id: senderId,
            name: senderPin?.name ?? "Quelqu'un",
            appearance: senderPin?.appearance ?? "",
          });
        }
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, isDemo, loading]); // pins intentionnellement exclu — voir pinsRef ci-dessus

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErrorKey("map.geoNotSupported");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadMap(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setGeoErrorKey(err.code === 1 ? "map.geoDenied" : "map.geoError");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [loadMap, isDemo]);

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link href="/">
          <img src="/logo-StrangerKiss-blanc.svg" alt="StrangerKiss" className="h-7" />
        </Link>
        <div className="flex items-center gap-3">
          {profile && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {profile.name}, {t("map.age", { age: String(profile.age) })}
                </div>
                <div className="text-xs text-white/40">{LABEL[profile.looking_for]}</div>
              </div>
              <Link
                href="/profile"
                className="text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-full px-3 py-1.5 transition-colors"
              >
                {t("map.modify")}
              </Link>
            </div>
          )}
          {credits !== null && (
            <div className="flex items-center gap-2">
              <Link
                href="/credits"
                className="flex items-center gap-1 text-xs font-medium bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors"
                title="Mes crédits"
              >
                <span className="text-[#e91e8c]">💞</span>
                <span className="text-white/70">{credits}</span>
              </Link>
              {!phoneVerified && !showVerify && userId && !isDemo && (
                <button
                  onClick={() => setShowVerify(true)}
                  className="text-xs text-[#e91e8c]/70 hover:text-[#e91e8c] border border-[#e91e8c]/20 rounded-full px-2.5 py-1.5 transition-colors"
                  title={t("verify.title")}
                >
                  +3
                </button>
              )}
            </div>
          )}
          {!profile && (
            <Link href="/profile" className="text-sm text-[#e91e8c] hover:underline">
              {t("map.createProfile")}
            </Link>
          )}
        </div>
      </header>

      {/* Bannière mode démo */}
      {isDemo && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#7c3aed]/10 border-b border-[#7c3aed]/20 text-xs text-[#a78bfa]">
          <span>🎭 {t("map.demoMode")}</span>
          <Link href="/profile?demo=true" className="underline hover:text-white transition-colors">
            {t("map.modify")}
          </Link>
        </div>
      )}

      {/* Zone carte */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="text-4xl animate-pulse">📍</div>
            <p className="text-white/60 text-sm">{t("map.locating")}</p>
          </div>
        )}
        {!loading && geoErrorKey && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 z-20">
            <div className="text-5xl">😕</div>
            <p className="text-white/70 text-center max-w-sm">{t(geoErrorKey)}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#e91e8c] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#c2186f] transition-colors"
            >
              {t("map.retry")}
            </button>
          </div>
        )}
        {!loading && coords && (
          <MapView
            currentUser={profile}
            pins={pins.filter(p => !blocked.includes(p.id))}
            center={coords}
            myId={myId}
            locale={locale}
          />
        )}

        {/* Toast rendu via portal dans document.body — échappe à tout stacking context */}
        {portalMounted && unreadSender && createPortal(
          <div
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border-2 border-[#e91e8c]"
            style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 9999, maxWidth: "90vw", width: "max-content", boxShadow: "0 4px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(233,30,140,0.15)" }}
          >
            <span className="text-xl flex-shrink-0">💬</span>
            <Link
              href={`/chat/${unreadSender.id}?name=${encodeURIComponent(unreadSender.name)}&appearance=${encodeURIComponent(unreadSender.appearance)}`}
              className="flex-1 min-w-0"
              onClick={() => setUnreadSender(null)}
            >
              <p className="text-[#1a1a2e] text-sm font-bold truncate">{unreadSender.name}</p>
              <p className="text-[#e91e8c] text-xs font-medium">Nouveau message →</p>
            </Link>
            <button
              onClick={() => setUnreadSender(null)}
              className="flex-shrink-0 text-[#1a1a2e]/30 hover:text-[#1a1a2e]/70 transition-colors text-lg leading-none"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>,
          document.body
        )}
      </div>

      {/* Vérification téléphone */}
      {!loading && !isDemo && !phoneVerified && showVerify && userId && (
        <PhoneVerification
          userId={userId}
          t={t}
          onSuccess={(_bonus, _waitlisted, _refCode, newCredits) => {
            setPhoneVerified(true);
            setShowVerify(false);
            setCredits(newCredits);
            try { localStorage.setItem("sk_user_credits", String(newCredits)); } catch { /* ignore */ }
          }}
          onDismiss={() => setShowVerify(false)}
        />
      )}

      {/* Carte de parrainage */}
      {!loading && !isDemo && phoneVerified && userId && (
        <ReferralCard userId={userId} t={t} />
      )}

      {/* Enquête post-expérience — portal dans document.body pour passer au-dessus de Leaflet */}
      {portalMounted && showSurvey && !isDemo && createPortal(
        <SurveyModal t={t} onClose={() => setShowSurvey(false)} />,
        document.body
      )}

      {/* Panneau profils proches */}
      {!loading && coords && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/80">
              {t("map.nearby")}{" "}
              <span className="text-white/40 font-normal">
                ({pins.length} {pins.length !== 1 ? t("map.persons") : t("map.person")})
              </span>
            </h2>
          </div>

          {pins.length === 0 && (
            <p className="text-sm text-white/30 italic">{t("map.nobody")}</p>
          )}

          <div className="flex gap-3 overflow-x-auto pb-1">
            {pins.filter(p => !blocked.includes(p.id)).map((pin) => (
              <div
                key={pin.id}
                className="flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[180px] max-w-[210px] flex flex-col gap-1.5"
              >
                <div className="text-2xl">{pin.looking_for === "hug" ? "🤗" : <img src="/levres.svg" alt="kiss" className="w-8 h-8" />}</div>
                <div className="font-semibold text-white text-sm">
                  {flagEmoji(pin.nationality)}{pin.nationality ? " " : ""}{pin.name}, {t("map.age", { age: String(pin.age) })}
                </div>
                <div className="text-xs text-white/40">
                  {translateGender(pin.gender)} · {LABEL[pin.looking_for]}
                </div>
                {pin.bio && (
                  <p className="text-xs text-white/30 leading-relaxed line-clamp-2">{pin.bio}</p>
                )}
                {pin.appearance && (
                  <p className="text-xs text-[#e91e8c]/60 leading-relaxed line-clamp-1">
                    👀 {pin.appearance}
                  </p>
                )}
                <Link
                  href={`/chat/${pin.id}?name=${encodeURIComponent(pin.name)}&appearance=${encodeURIComponent(pin.appearance ?? "")}`}
                  className="mt-1 flex items-center justify-center gap-1.5 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/35 border border-[#7c3aed]/30 text-[#a78bfa] text-xs font-medium rounded-xl py-2 transition-colors"
                >
                  {t("map.message")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// Export par défaut : Suspense autour de MapPageContent (requis pour useSearchParams)
export default function MapClient() {
  return (
    <Suspense>
      <MapPageContent />
    </Suspense>
  );
}
