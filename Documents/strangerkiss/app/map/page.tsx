"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { UserPin, LookingFor, Gender } from "@/lib/supabase";

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
    { dlat: 0.003, dlng: 0.004, name: "Sofia", age: 24, gender: "femme", bio: "Voyageuse solo, j'adore les rencontres sincères ✈️", appearance: "veste rouge, cheveux bouclés, terrasse du café", looking_for: "french_kiss" },
    { dlat: -0.002, dlng: 0.005, name: "Liam", age: 29, gender: "homme", bio: "Backpacker irlandais de passage 🍀", appearance: "t-shirt vert, sac à dos bleu marine", looking_for: "hug" },
    { dlat: 0.005, dlng: -0.003, name: "Yuki", age: 22, gender: "non-binaire", bio: "En vadrouille dans toute l'Europe 🌍", appearance: "bonnet orange, veste en jean", looking_for: "hug" },
    { dlat: -0.004, dlng: -0.006, name: "Marco", age: 31, gender: "homme", bio: "", appearance: "", looking_for: "french_kiss" },
    { dlat: 0.001, dlng: -0.007, name: "Amara", age: 27, gender: "femme", bio: "Curieuse et libre 🌸", appearance: "robe jaune, près de la fontaine", looking_for: "hug" },
  ];
  return offsets.map((o, i) => ({
    id: `demo-${i}`,
    name: o.name,
    age: o.age,
    gender: o.gender as Gender,
    bio: o.bio,
    appearance: o.appearance,
    looking_for: o.looking_for as LookingFor,
    lat: lat + o.dlat,
    lng: lng + o.dlng,
    created_at: new Date().toISOString(),
  }));
}

const LABEL: Record<string, string> = {
  hug: "🤗 Hug",
  french_kiss: "💋 French kiss",
};

export default function MapPage() {
  const [profile, setProfile] = useState<{
    name: string;
    age: number;
    gender: Gender;
    bio: string;
    appearance: string;
    looking_for: LookingFor;
  } | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState("");
  const [pins, setPins] = useState<UserPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMyId(getOrCreateMyId());
    try {
      const stored = localStorage.getItem("sk_profile");
      if (stored) setProfile(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const loadMap = useCallback(
    async (lat: number, lng: number) => {
      setCoords([lat, lng]);
      const { supabase, upsertUserPin, getNearbyUsers } = await import("@/lib/supabase");

      if (supabase && profile) {
        const inserted = await upsertUserPin({
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          bio: profile.bio,
          appearance: profile.appearance,
          looking_for: profile.looking_for,
          lat,
          lng,
        });
        if (inserted) {
          try { localStorage.setItem("sk_my_id", inserted.id); } catch { /* */ }
          setMyId(inserted.id);
        }
        const nearby = await getNearbyUsers(lat, lng);
        setPins(
          nearby.filter(
            (p) => Math.abs(p.lat - lat) > 0.0001 || Math.abs(p.lng - lng) > 0.0001
          )
        );
      } else {
        setPins(getMockPins(lat, lng));
      }
      setLoading(false);
    },
    [profile]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas supportée par ce navigateur.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadMap(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setGeoError(
          err.code === 1
            ? "Accès à la localisation refusé. Autorise-le dans les paramètres de ton navigateur."
            : "Impossible de te localiser. Réessaie."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [loadMap]);

  const supabaseReady = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link href="/" className="text-xl font-bold">
          Stranger<span className="text-[#e91e8c]">Kiss</span>
        </Link>
        {profile && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-white">
                {profile.name}, {profile.age} ans
              </div>
              <div className="text-xs text-white/40">{LABEL[profile.looking_for]}</div>
            </div>
            <Link
              href="/profile"
              className="text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-full px-3 py-1.5 transition-colors"
            >
              Modifier
            </Link>
          </div>
        )}
        {!profile && (
          <Link href="/profile" className="text-sm text-[#e91e8c] hover:underline">
            Créer mon profil
          </Link>
        )}
      </header>

      {/* Map area */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="text-4xl animate-pulse">📍</div>
            <p className="text-white/60 text-sm">Localisation en cours…</p>
          </div>
        )}
        {!loading && geoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 z-20">
            <div className="text-5xl">😕</div>
            <p className="text-white/70 text-center max-w-sm">{geoError}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#e91e8c] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#c2186f] transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}
        {!loading && coords && (
          <MapView currentUser={profile} pins={pins} center={coords} myId={myId} />
        )}
      </div>

      {/* Bottom panel */}
      {!loading && coords && (
        <div className="border-t border-white/5 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/80">
              À proximité{" "}
              <span className="text-white/40 font-normal">
                ({pins.length} personne{pins.length !== 1 ? "s" : ""})
              </span>
            </h2>
            {!supabaseReady && (
              <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
                Mode démo
              </span>
            )}
          </div>

          {pins.length === 0 && (
            <p className="text-sm text-white/30 italic">
              Personne dans les environs pour l&apos;instant…
            </p>
          )}

          <div className="flex gap-3 overflow-x-auto pb-1">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[180px] max-w-[210px] flex flex-col gap-1.5"
              >
                <div className="text-2xl">{pin.looking_for === "hug" ? "🤗" : "💋"}</div>
                <div className="font-semibold text-white text-sm">
                  {pin.name}, {pin.age} ans
                </div>
                <div className="text-xs text-white/40">
                  {pin.gender} · {LABEL[pin.looking_for]}
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
                  💬 Message
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
