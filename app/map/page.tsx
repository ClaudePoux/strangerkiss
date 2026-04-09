"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { UserPin, LookingFor, Gender } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";


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


// Paris centre
const DEMO_CENTER: [number, number] = [48.8566, 2.3522];

function getDemoPins(): UserPin[] {
  const [lat, lng] = DEMO_CENTER;
  return [
    { id: "demo-0", name: "Sofia", age: 24, gender: "femme", nationality: "ES", bio: "Voyageuse solo de passage ✈️", appearance: "veste rouge, cheveux bouclés", looking_for: "french_kiss", lat: lat + 0.003, lng: lng + 0.004, created_at: new Date().toISOString() },
    { id: "demo-1", name: "Liam", age: 29, gender: "homme", nationality: "IE", bio: "Backpacker irlandais 🍀", appearance: "t-shirt vert, sac à dos bleu", looking_for: "hug", lat: lat - 0.002, lng: lng + 0.005, created_at: new Date().toISOString() },
    { id: "demo-2", name: "Yuki", age: 22, gender: "non-binaire", nationality: "JP", bio: "En vadrouille dans toute l'Europe 🌍", appearance: "bonnet orange, veste en jean", looking_for: "hug", lat: lat + 0.005, lng: lng - 0.003, created_at: new Date().toISOString() },
    { id: "demo-3", name: "Marco", age: 31, gender: "homme", nationality: "IT", bio: "", appearance: "casquette noire, terrasse du Louvre", looking_for: "french_kiss", lat: lat - 0.004, lng: lng - 0.006, created_at: new Date().toISOString() },
    { id: "demo-4", name: "Amara", age: 27, gender: "femme", nationality: "SN", bio: "Curieuse et libre 🌸", appearance: "robe jaune, près de la fontaine", looking_for: "hug", lat: lat + 0.001, lng: lng - 0.007, created_at: new Date().toISOString() },
  ];
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
      autre: t("profile.genderAutre"),
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
  const [credits, setCredits] = useState<number | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoErrorKey, setGeoErrorKey] = useState("");
  const [pins, setPins] = useState<UserPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getOrCreateMyId();
    setMyId(id);
    // Charger les blocages depuis Supabase
    fetchBlocked(id).then(setBlocked);
    try {
      const stored = localStorage.getItem("sk_profile");
      if (stored) setProfile(JSON.parse(stored));
      const userId = localStorage.getItem("sk_user_id");
      if (userId) {
        const cached = localStorage.getItem("sk_user_credits");
        if (cached !== null) setCredits(parseInt(cached, 10));
        fetch(`/api/credits/balance?user_id=${userId}`)
          .then((r) => r.json())
          .then(({ credits: c }) => {
            if (c != null) {
              setCredits(c);
              localStorage.setItem("sk_user_credits", String(c));
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshPins = useCallback(async (lat: number, lng: number, currentMyId: string) => {
    try {
      const nearbyRes = await fetch(`/api/db/pins?lat=${lat}&lng=${lng}`);
      if (!nearbyRes.ok) return;
      const { pins: nearby } = await nearbyRes.json();
      setPins(
        (nearby as UserPin[]).filter(
          (p) => p.id !== currentMyId &&
            (Math.abs(p.lat - lat) > 0.0001 || Math.abs(p.lng - lng) > 0.0001)
        )
      );
    } catch {
      // ignore — on réessaiera au prochain intervalle
    }
  }, []);

  const loadMap = useCallback(
    async (lat: number, lng: number) => {
      setCoords([lat, lng]);

      if (profile) {
        try {
          const userId = localStorage.getItem("sk_user_id") ?? undefined;

          // Upsert du pin sur la carte (pin_id = identifiant stable du device)
          const existingPinId = localStorage.getItem("sk_my_id") ?? undefined;
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
              user_id: userId ?? null,
            }),
          });
          const { pin } = await pinRes.json();
          if (pin?.id) {
            localStorage.setItem("sk_my_id", pin.id);
            setMyId(pin.id);
            // Recharger les blocages avec le vrai pin.id Supabase
            fetchBlocked(pin.id).then(setBlocked);
          }

          // Récupérer les profils proches
          const nearbyRes = await fetch(`/api/db/pins?lat=${lat}&lng=${lng}`);
          const { pins: nearby } = await nearbyRes.json();
          setPins(
            (nearby as UserPin[]).filter(
              (p) => Math.abs(p.lat - lat) > 0.0001 || Math.abs(p.lng - lng) > 0.0001
            )
          );
        } catch {
          setPins([]);
        }
      }
      setLoading(false);
    },
    [profile]
  );

  // Rafraîchissement automatique des pins toutes les 10 secondes
  useEffect(() => {
    if (!coords || loading) return;
    const [lat, lng] = coords;
    const currentMyId = myId;
    const interval = setInterval(() => refreshPins(lat, lng, currentMyId), 10000);
    return () => clearInterval(interval);
  }, [coords, myId, loading, refreshPins]);

  useEffect(() => {
    if (isDemo) {
      setCoords(DEMO_CENTER);
      setPins(getDemoPins());
      setLoading(false);
      return;
    }
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
        <Link href="/" className="text-xl font-bold">
          Stranger<span className="text-[#e91e8c]">Kiss</span>
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
            <Link
              href="/credits"
              className="flex items-center gap-1 text-xs font-medium bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors"
              title="Mes crédits"
            >
              <span className="text-[#e91e8c]">💞</span>
              <span className="text-white/70">{credits}</span>
            </Link>
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
          <span>🎭 {t("map.demoMode")} — Paris</span>
          <Link href="/profile" className="underline hover:text-white transition-colors">
            {t("map.createProfile")}
          </Link>
        </div>
      )}

      {/* Map area */}
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
          <MapView currentUser={profile} pins={pins.filter(p => !blocked.includes(p.id))} center={coords} myId={myId} locale={locale} />
        )}
      </div>

      {/* Bottom panel */}
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
                <div className="text-2xl">{pin.looking_for === "hug" ? "🤗" : "💋"}</div>
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

export default function MapPage() {
  return (
    <Suspense>
      <MapPageContent />
    </Suspense>
  );
}
