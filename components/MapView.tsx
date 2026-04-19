"use client";

import { useEffect, useRef, useState } from "react";
import type { UserPin } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface Props {
  currentUser: { name: string; age: number; gender: string; bio: string; appearance: string; looking_for: string; nationality?: string } | null;
  pins: UserPin[];
  center: [number, number];
  myId: string;
  locale: string;
}

function popupStyle(content: string) {
  return `<div style="color:#1a1a2e;font-family:sans-serif;min-width:140px;max-width:200px">${content}</div>`;
}

function flagEmoji(code: string): string {
  if (!code) return "";
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export default function MapView({ currentUser, pins, center, myId, locale }: Props) {
  const mapRef           = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef       = useRef<any>(null);

  // mapReady passe à true quand Leaflet est chargé et la carte prête.
  // C'est le signal qui permet à Effect 2 de rendre les marqueurs,
  // même si les pins sont arrivés avant la fin du chargement de Leaflet.
  const [mapReady, setMapReady] = useState(false);

  const { t } = useI18n();

  // ── Effet 1 : création de la carte (une seule fois par locale) ──────────────
  useEffect(() => {
    if (!mapRef.current) return;

    // Détruire la carte précédente si changement de locale
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current  = null;
      markersLayerRef.current = null;
      leafletRef.current      = null;
      setMapReady(false);
    }

    let destroyed = false;

    console.log("[MapView] Effet 1 — import Leaflet");

    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current) return;

      leafletRef.current = L;
      console.log("[MapView] Leaflet chargé — center:", center);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, { center, zoom: 15, zoomControl: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marqueur "moi" — icône et gradient selon looking_for
      const youIsHug = currentUser?.looking_for === "hug";
      const youIcon = L.divIcon({
        html: `<div style="
          width:44px;height:44px;border-radius:50%;
          background:${youIsHug
            ? "linear-gradient(135deg,#f59e0b,#ef4444)"
            : "linear-gradient(135deg,#e91e8c,#7c3aed)"};
          display:flex;align-items:center;justify-content:center;
          font-size:22px;border:3px solid white;
          box-shadow:0 0 20px rgba(233,30,140,0.7);
        ">${youIsHug ? "🤗" : '<img src="/levres.svg" style="width:22px;height:22px;object-fit:contain" />'}</div>`,
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const hugLabel  = t("map.hug");
      const kissLabel = t("map.frenchKiss");

      L.marker(center, { icon: youIcon })
        .addTo(map)
        .bindPopup(popupStyle(`
          <strong>${flagEmoji(currentUser?.nationality ?? "")} ${currentUser?.name ?? "—"}</strong>
          <br/><span style="font-size:12px">${t("mapView.age", { age: String(currentUser?.age ?? "?") })} · ${currentUser?.gender ?? ""}</span>
          <br/><span style="font-size:12px">${currentUser?.looking_for === "french_kiss" ? kissLabel : hugLabel}</span>
          ${currentUser?.bio ? `<br/><span style="font-size:11px;color:#555;font-style:italic">${currentUser.bio}</span>` : ""}
          ${currentUser?.appearance ? `<br/><span style="font-size:11px;color:#e91e8c">👀 ${currentUser.appearance}</span>` : ""}
          <br/><span style="font-size:11px;color:#e91e8c;font-weight:bold">${t("mapView.itsYou")}</span>
        `));

      // Layer group dédié aux autres utilisateurs
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current  = map;

      // Sur mobile, la barre d'adresse Safari/Chrome réduit le viewport au chargement.
      // setMapReady(true) est appelé DANS le timeout, après invalidateSize(),
      // pour que les marqueurs soient positionnés avec les dimensions correctes de la carte.
      // Si setMapReady était appelé avant, les marqueurs seraient calculés hors de la zone visible.
      console.log("[MapView] setTimeout 500ms — invalidateSize puis setMapReady");
      setTimeout(() => {
        if (!map || destroyed) return;
        map.invalidateSize();
        console.log("[MapView] setMapReady(true) — après invalidateSize");
        setMapReady(true);
      }, 500);
    });

    return () => {
      destroyed = true;
      setMapReady(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current  = null;
        markersLayerRef.current = null;
        leafletRef.current      = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effet 2 : mise à jour des marqueurs (pins OU mapReady changent) ─────────
  useEffect(() => {
    console.log("[MapView] Effet 2 — mapReady:", mapReady, "| pins:", pins.length,
      "| leaflet:", !!leafletRef.current, "| layer:", !!markersLayerRef.current);

    if (!mapReady || !leafletRef.current || !markersLayerRef.current) {
      console.log("[MapView] Effet 2 — skip (conditions non remplies)");
      return;
    }

    const L = leafletRef.current;
    markersLayerRef.current.clearLayers();

    const hugLabel  = t("map.hug");
    const kissLabel = t("map.frenchKiss");

    const mapBounds = mapInstanceRef.current?.getBounds?.();
    console.log("[MapView] Effet 2 — rendu", pins.length, "marqueur(s) | bounds:", mapBounds?.toBBoxString?.() ?? "inconnu", "| center:", center);
    pins.forEach((pin) => {
      const inBounds = mapBounds?.contains?.([pin.lat, pin.lng]);
      console.log("[MapView]   pin:", pin.name, "lat:", pin.lat, "lng:", pin.lng, "| inBounds:", inBounds);
      try {
        const dist    = getDistanceKm(center[0], center[1], pin.lat, pin.lng);
        const distStr = dist < 1
          ? t("mapView.distanceM", { dist: String(Math.round(dist * 1000)) })
          : t("mapView.distanceKm", { dist: dist.toFixed(1) });
        const isHug = pin.looking_for === "hug";

        const pinIcon = L.divIcon({
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:${isHug
              ? "linear-gradient(135deg,#f59e0b,#ef4444)"
              : "linear-gradient(135deg,#ec4899,#8b5cf6)"};
            display:flex;align-items:center;justify-content:center;
            font-size:18px;border:2px solid rgba(255,255,255,0.5);
            box-shadow:0 0 12px rgba(0,0,0,0.5);
          ">${isHug ? "🤗" : '<img src="/levres.svg" style="width:18px;height:18px;object-fit:contain" />'}</div>`,
          className: "",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const chatUrl = `/chat/${pin.id}?name=${encodeURIComponent(pin.name)}&appearance=${encodeURIComponent(pin.appearance ?? "")}`;
        L.marker([pin.lat, pin.lng], { icon: pinIcon })
          .addTo(markersLayerRef.current)
          .bindPopup(popupStyle(`
            <strong>${flagEmoji(pin.nationality ?? "")} ${pin.name}</strong>
            <br/><span style="font-size:12px">${t("mapView.age", { age: String(pin.age) })} · ${pin.gender ?? ""}</span>
            <br/><span style="font-size:12px">${isHug ? hugLabel : kissLabel}</span>
            ${pin.bio ? `<br/><span style="font-size:11px;color:#555;font-style:italic">${pin.bio}</span>` : ""}
            ${pin.appearance ? `<br/><span style="font-size:11px;color:#c2186f">👀 ${pin.appearance}</span>` : ""}
            <br/><span style="font-size:11px;color:#888">${distStr}</span>
            <br/><a href="${chatUrl}" style="display:inline-block;margin-top:6px;background:#7c3aed;color:white;font-size:11px;padding:3px 10px;border-radius:8px;text-decoration:none">${t("mapView.message")}</a>
          `));
      } catch (err) {
        console.error("[MapView] ERREUR marqueur", pin.name, "lat:", pin.lat, "lng:", pin.lng, err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapReady]);

  return (
    <div
      ref={mapRef}
      className="rounded-2xl"
      style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', minHeight: '300px' }}
    />
  );
}
