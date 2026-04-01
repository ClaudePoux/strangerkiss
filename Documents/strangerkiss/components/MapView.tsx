"use client";

import { useEffect, useRef } from "react";
import type { UserPin } from "@/lib/supabase";

interface Props {
  currentUser: { name: string; age: number; gender: string; bio: string; appearance: string; looking_for: string } | null;
  pins: UserPin[];
  center: [number, number];
  myId: string;
}

const LABEL: Record<string, string> = {
  hug: "🤗 Hug",
  french_kiss: "💋 French kiss",
};

function popupStyle(content: string) {
  return `<div style="color:#1a1a2e;font-family:sans-serif;min-width:140px;max-width:200px">${content}</div>`;
}

export default function MapView({ currentUser, pins, center, myId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center,
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // Current user marker
      const youIcon = L.divIcon({
        html: `<div style="
          width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,#e91e8c,#7c3aed);
          display:flex;align-items:center;justify-content:center;
          font-size:22px;border:3px solid white;
          box-shadow:0 0 20px rgba(233,30,140,0.7);
        ">💋</div>`,
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      L.marker(center, { icon: youIcon })
        .addTo(map)
        .bindPopup(popupStyle(`
          <strong>${currentUser?.name ?? "Toi"}</strong>
          <br/><span style="font-size:12px">🎂 ${currentUser?.age ?? "?"} ans · ${currentUser?.gender ?? ""}</span>
          <br/><span style="font-size:12px">${LABEL[currentUser?.looking_for ?? "hug"] ?? ""}</span>
          ${currentUser?.bio ? `<br/><span style="font-size:11px;color:#555;font-style:italic">${currentUser.bio}</span>` : ""}
          ${currentUser?.appearance ? `<br/><span style="font-size:11px;color:#e91e8c">👀 ${currentUser.appearance}</span>` : ""}
          <br/><span style="font-size:11px;color:#e91e8c;font-weight:bold">C'est toi !</span>
        `));

      // Other users markers
      pins.forEach((pin) => {
        const dist = getDistanceKm(center[0], center[1], pin.lat, pin.lng);
        const isHug = pin.looking_for === "hug";
        const pinIcon = L.divIcon({
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:${isHug ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#ec4899,#8b5cf6)"};
            display:flex;align-items:center;justify-content:center;
            font-size:18px;border:2px solid rgba(255,255,255,0.5);
            box-shadow:0 0 12px rgba(0,0,0,0.5);
          ">${isHug ? "🤗" : "💋"}</div>`,
          className: "",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const chatUrl = `/chat/${pin.id}?name=${encodeURIComponent(pin.name)}&appearance=${encodeURIComponent(pin.appearance ?? "")}`;
        L.marker([pin.lat, pin.lng], { icon: pinIcon })
          .addTo(map)
          .bindPopup(popupStyle(`
            <strong>${pin.name}</strong>
            <br/><span style="font-size:12px">🎂 ${pin.age} ans · ${pin.gender ?? ""}</span>
            <br/><span style="font-size:12px">${LABEL[pin.looking_for] ?? pin.looking_for}</span>
            ${pin.bio ? `<br/><span style="font-size:11px;color:#555;font-style:italic">${pin.bio}</span>` : ""}
            ${pin.appearance ? `<br/><span style="font-size:11px;color:#c2186f">👀 ${pin.appearance}</span>` : ""}
            <br/><span style="font-size:11px;color:#888">à ${dist < 1 ? Math.round(dist * 1000) + " m" : dist.toFixed(1) + " km"}</span>
            <br/><a href="${chatUrl}" style="display:inline-block;margin-top:6px;background:#7c3aed;color:white;font-size:11px;padding:3px 10px;border-radius:8px;text-decoration:none">💬 Message</a>
          `));
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mapRef} className="absolute inset-0 rounded-2xl" />
  );
}

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
