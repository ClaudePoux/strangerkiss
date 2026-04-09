"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { UserPin, LookingFor, Gender } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

function getMockPins(lat: number, lng: number): UserPin[] {
  const offsets = [
    { dlat: 0.003, dlng: 0.004, name: "Sofia", age: 24, gender: "femme", nationality: "ES", bio: "Voyageuse solo, j'adore les rencontres sincères ✈️", appearance: "veste rouge, cheveux bouclés, terrasse du café", looking_for: "french_kiss" },
    { dlat: -0.002, dlng: 0.005, name: "Liam", age: 29, gender: "homme", nationality: "IE", bio: "Backpacker irlandais de passage 🍀", appearance: "t-shirt vert, sac à dos bleu marine", looking_for: "hug" },
    { dlat: 0.005, dlng: -0.003, name: "Yuki", age: 22, gender: "non-binaire", nationality: "JP", bio: "En vadrouille dans toute l'Europe 🌍", appearance: "bonnet orange, veste en jean", looking_for: "hug" },
    { dlat: -0.004, dlng: -0.006, name: "Marco", age: 31, gender: "homme", nationality: "IT", bio: "", appearance: "", looking_for: "french_kiss" },
    { dlat: 0.001, dlng: -0.007, name: "Amara", age: 27, gender: "femme", nationality: "SN", bio: "Curieuse et libre 🌸", appearance: "robe jaune, près de la fontaine", looking_for: "hug" },
  ];
  return offsets.map((o, i) => ({
    id: `demo-${i}`,
    name: o.name,
    age: o.age,
    gender: o.gender as Gender,
    nationality: o.nationality,
    bio: o.bio,
    appearance: o.appearance,
    looking_for: o.looking_for as LookingFor,
    lat: lat + o.dlat,
    lng: lng + o.dlng,
    created_at: new Date().toISOString(),
  }));
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

export default function MapPage() {
  const { t, locale } = useI18n();

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

          // Upsert du pin sur la carte
          const pinRes = await fetch("/api/db/pins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
          setPins(getMockPins(lat, lng));
        }
      } else {
        setPins(getMockPins(lat, lng));
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
  }, [loadMap]);


  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link href="/" className="text-xl font-bold">
          Stranger<span className="text-[#e91e8c]">Kiss</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
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
