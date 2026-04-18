"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom"; // conservé pour SurveyModal
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { UserPin, LookingFor, Gender } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { useNotificationContext } from "@/lib/notificationContext";
import PhoneVerification from "@/components/PhoneVerification";
import ReferralCard from "@/components/ReferralCard";
import SurveyModal from "@/components/SurveyModal";
import NotificationBar from "@/components/NotificationBar";

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

  const { notifs, push, dismiss, credits, updateCredits } = useNotificationContext();

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
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoErrorKey, setGeoErrorKey] = useState("");
  const [pins, setPins] = useState<UserPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  // Portal monté côté client uniquement (SSR-safe)
  const [portalMounted, setPortalMounted] = useState(false);

  // Suivi pins pour détecter les nouveaux profils proches
  const prevPinsCountRef   = useRef<number>(-1);
  const lastNewProfilesRef = useRef<number>(0);
  // Suivi visibilité pour détecter l'expiration du profil
  const lastVisibleRef     = useRef<number>(Date.now());

  // Ping : ref conservée entre les renders
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPinIdRef    = useRef<string>("");
  // Ref vers startPing pour que le handler visibilitychange puisse l'appeler
  const startPingRef    = useRef<(pinId: string) => void>(() => {});

  // Portal SSR-safe : monté uniquement après hydratation côté client
  useEffect(() => {
    setPortalMounted(true);
    console.log("[MapClient] mount — isDemo:", isDemo, "| portalMounted → true");
  }, []);

  // Trace les changements de showSurvey pour détecter si le modal est bien déclenché
  useEffect(() => {
    console.log(
      "[MapClient] showSurvey changed →", showSurvey,
      "| portalMounted:", portalMounted,
      "| isDemo:", isDemo,
      "| => modal visible:", portalMounted && showSurvey && !isDemo,
    );
  }, [showSurvey]); // eslint-disable-line react-hooks/exhaustive-deps

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
        lastVisibleRef.current = Date.now();
        stopPing();
      } else if (document.visibilityState === "visible") {
        if (pingPinIdRef.current) startPingRef.current(pingPinIdRef.current);
        // Notifier si le profil a pu expirer (absent > 8 min)
        const awayMs = Date.now() - lastVisibleRef.current;
        if (awayMs > 8 * 60 * 1000 && pingPinIdRef.current) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          push({ type: "profile_expiring", text: t("notif.profileExpiring"), persistent: false });
        }
      }
    }
    // bfcache iOS Safari
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted && pingPinIdRef.current) {
        startPingRef.current(pingPinIdRef.current);
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

  // Déclenche la SurveyModal si sk_survey_pending est actif.
  function checkSurveyPending(source: string) {
    try {
      const pending = localStorage.getItem("sk_survey_pending");
      const done    = localStorage.getItem("sk_survey_done");
      console.log(
        `[MapClient] checkSurveyPending ▶ source="${source}"`,
        "| pending:", pending,
        "| done:", done,
        "| isDemo:", isDemo,
        "| portalMounted:", portalMounted,
      );
      if (pending !== "true") {
        console.log("[MapClient]   → sk_survey_pending absent ou != 'true' — rien");
        return;
      }
      if (done === "true") {
        console.log("[MapClient]   → sk_survey_done=true — survey déjà effectué, on nettoie");
        localStorage.removeItem("sk_survey_pending");
        return;
      }
      console.log("[MapClient]   → setShowSurvey(true) !");
      setShowSurvey(true);
      localStorage.removeItem("sk_survey_pending");
    } catch (err) {
      console.error("[MapClient] checkSurveyPending ERROR:", err);
    }
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
        // Crédits initiaux lus depuis le cache — le context gère le polling
        const cached = localStorage.getItem("sk_user_credits");
        if (cached !== null) updateCredits(parseInt(cached, 10));
        fetch(`/api/credits/balance?user_id=${storedUserId}`)
          .then((r) => r.json())
          .then(({ credits: c }) => {
            if (c != null) {
              updateCredits(c);
              // Notifier le context des IDs
              window.dispatchEvent(
                new CustomEvent("sk:ids_update", {
                  detail: { myId: id, userId: storedUserId, credits: c },
                })
              );
            }
          })
          .catch(() => {});
      } else {
        // Pas encore de userId — notifier quand même le myId
        window.dispatchEvent(new CustomEvent("sk:ids_update", { detail: { myId: id } }));
      }
      if (localStorage.getItem("sk_phone")) setPhoneVerified(true);
      checkSurveyPending("[MapClient] mount");
    } catch { /* ignore */ }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkSurveyPending("[MapClient] visibilitychange");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    function onSurveyCheck() {
      console.log("[MapClient] ← event sk:survey_check reçu");
      checkSurveyPending("[MapClient] sk:survey_check");
    }
    window.addEventListener("sk:survey_check", onSurveyCheck);
    console.log("[MapClient] listener sk:survey_check enregistré");

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("sk:survey_check", onSurveyCheck);
    };
  }, []);

  // Notifier le context quand myId/userId changent (ex : après création du pin)
  useEffect(() => {
    if (!myId) return;
    window.dispatchEvent(
      new CustomEvent("sk:ids_update", {
        detail: { myId, userId: userId || undefined },
      })
    );
  }, [myId, userId]);

  const refreshPins = useCallback(async (lat: number, lng: number, currentMyId: string) => {
    try {
      const nearbyRes = await fetch(`/api/db/pins?lat=${lat}&lng=${lng}`);
      if (!nearbyRes.ok) return;
      const { pins: nearby } = await nearbyRes.json();
      const filtered = (nearby as UserPin[]).filter((p) => p.id !== currentMyId);
      setPins(filtered);

      // Détecter les nouveaux profils (max 1 notif toutes les 2 min)
      const prev = prevPinsCountRef.current;
      const now  = Date.now();
      if (prev !== -1 && filtered.length > prev && now - lastNewProfilesRef.current > 2 * 60 * 1000) {
        const diff = filtered.length - prev;
        push({
          type: "new_profiles",
          text: diff === 1
            ? t("notif.newProfile")
            : t("notif.newProfiles", { count: String(diff) }),
          persistent: false,
        });
        lastNewProfilesRef.current = now;
      }
      prevPinsCountRef.current = filtered.length;
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push, t]);

  const loadMap = useCallback(
    async (lat: number, lng: number) => {
      setCoords([lat, lng]);

      if (profile) {
        try {
          if (isDemo) {
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
              const slot = Math.floor(Date.now() / (6 * 3600 * 1000));
              const rng = seededRng(slot);
              const count = 3 + Math.floor(rng() * 3);
              const shuffled = [...pool].sort(() => rng() - 0.5);
              const selected = shuffled.slice(0, Math.min(count, shuffled.length));
              const now = new Date().toISOString();
              setPins(
                selected.map((d, i) => {
                  const dist = 200 + Math.floor(rng() * 800);
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
              updateCredits(3);
              // Notifier le context du nouvel userId + crédits initiaux
              window.dispatchEvent(
                new CustomEvent("sk:ids_update", {
                  detail: { myId: pin?.id, userId: returnedUserId, credits: 3 },
                })
              );
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
    [profile, isDemo, startPing, updateCredits]
  );

  // Rafraîchissement toutes les 10s (mode réel uniquement)
  useEffect(() => {
    if (!coords || loading || isDemo) return;
    const [lat, lng] = coords;
    const currentMyId = myId;
    const interval = setInterval(() => refreshPins(lat, lng, currentMyId), 10000);
    return () => clearInterval(interval);
  }, [coords, myId, loading, isDemo, refreshPins]);

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

      {/* Barre de notifications persistante */}
      <NotificationBar notifs={notifs} onDismiss={dismiss} />

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

      </div>

      {/* Vérification téléphone */}
      {!loading && !isDemo && !phoneVerified && showVerify && userId && (
        <PhoneVerification
          userId={userId}
          t={t}
          onSuccess={(_bonus, _waitlisted, _refCode, newCredits) => {
            setPhoneVerified(true);
            setShowVerify(false);
            updateCredits(newCredits);
          }}
          onDismiss={() => setShowVerify(false)}
        />
      )}

      {/* Carte de parrainage */}
      {!loading && !isDemo && phoneVerified && userId && (
        <ReferralCard userId={userId} t={t} />
      )}

      {/* Enquête post-expérience — portal dans document.body pour passer au-dessus de Leaflet */}
      {showSurvey && console.log(
        "[MapClient] render — showSurvey=true | portalMounted:", portalMounted,
        "| isDemo:", isDemo,
        "| => portal visible:", portalMounted && !isDemo,
      ) as unknown as null}
      {portalMounted && showSurvey && !isDemo && createPortal(
        <SurveyModal t={t} onClose={() => {
          console.log("[MapClient] SurveyModal onClose → setShowSurvey(false)");
          setShowSurvey(false);
        }} />,
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
