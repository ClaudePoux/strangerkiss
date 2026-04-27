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

// Label HTML pour tooltip permanent (emoji ou img SVG).
// outerSize : si fourni, enveloppe l'icône dans un div DOM rond avec bordure blanche.
// Centré sur le circleMarker via direction:'center' — élément DOM, toujours visible.
// Relation géométrique : outerSize = 2 * (circleMarker.radius + 4)
function markerLabel(isHug: boolean, iconSize: number, outerSize?: number): string {
  const icon = isHug
    ? `<span style="font-size:${iconSize}px;line-height:1">🤗</span>`
    : `<img src="/levres.svg" style="width:${iconSize}px;height:${iconSize}px;object-fit:contain;display:block">`;
  if (!outerSize) return icon;
  return `<div style="width:${outerSize}px;height:${outerSize}px;border-radius:50%;border:4px solid white;box-sizing:border-box;display:flex;align-items:center;justify-content:center">${icon}</div>`;
}

export default function MapView({ currentUser, pins, center, myId, locale }: Props) {
  const mapRef            = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef        = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasRendererRef = useRef<any>(null);
  // Tracks currently rendered markers by pin id — avoids clearLayers on each refresh
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersMapRef     = useRef<Map<string, any>>(new Map());

  const [mapReady, setMapReady] = useState(false);

  const { t } = useI18n();

  // ── Effet 1 : création de la carte (une seule fois au montage) ───────────────
  useEffect(() => {
    if (!mapRef.current) return;

    let destroyed = false;

    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current) return;

      leafletRef.current = L;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, { center, zoom: 15, zoomControl: true, zoomAnimation: false });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Canvas renderer : tous les cercles sont dessinés dans un seul <canvas>,
      // complètement immunisé contre les problèmes de compositing WebKit/iOS.
      const renderer = L.canvas();
      canvasRendererRef.current = renderer;

      // CSS pour les tooltips permanents (label emoji/svg centré, sans bulle Leaflet)
      if (!document.getElementById("sk-emoji-label-style")) {
        const style = document.createElement("style");
        style.id = "sk-emoji-label-style";
        style.textContent = `
          .emoji-label {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            font-size: 20px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }
          .emoji-label::before { display: none !important; }
          .emoji-label-sm { font-size: 16px; }
        `;
        document.head.appendChild(style);
      }

      // Marqueur "moi" — radius 16, outerSize 40 = 2*(16+4)
      const youIsHug = currentUser?.looking_for === "hug";
      const youColor = youIsHug ? "#f59e0b" : "#e91e8c";

      const hugLabel  = t("map.hug");
      const kissLabel = t("map.frenchKiss");

      L.circleMarker(center, {
        renderer,
        radius:      16,
        fillColor:   youColor,
        color:       "transparent",
        weight:      0,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(markerLabel(youIsHug, 18, 40), {
          permanent:  true,
          direction:  "center",
          className:  "emoji-label",
          offset:     [0, 0],
        })
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

      setTimeout(() => {
        if (!map || destroyed) return;
        map.invalidateSize();
        setMapReady(true);
      }, 300);
    });

    return () => {
      destroyed = true;
      setMapReady(false);
      markersMapRef.current.clear();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current    = null;
        markersLayerRef.current   = null;
        leafletRef.current        = null;
        canvasRendererRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effet 2 : mise à jour des marqueurs (pins OU mapReady changent) ─────────
  // Diff par ID : on n'efface JAMAIS tous les marqueurs d'un coup.
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !markersLayerRef.current || !canvasRendererRef.current) return;

    const L        = leafletRef.current;
    const renderer = canvasRendererRef.current;
    const hugLabel  = t("map.hug");
    const kissLabel = t("map.frenchKiss");

    const newPinIds = new Set(pins.map(p => p.id));

    // Supprimer les marqueurs dont le pin a disparu
    for (const [id, marker] of markersMapRef.current) {
      if (!newPinIds.has(id)) {
        markersLayerRef.current.removeLayer(marker);
        markersMapRef.current.delete(id);
      }
    }

    // Ajouter uniquement les nouveaux pins (pas encore affichés)
    pins.forEach((pin) => {
      if (markersMapRef.current.has(pin.id)) return;
      try {
        const dist    = getDistanceKm(center[0], center[1], pin.lat, pin.lng);
        const distStr = dist < 1
          ? t("mapView.distanceM", { dist: String(Math.round(dist * 1000)) })
          : t("mapView.distanceKm", { dist: dist.toFixed(1) });
        const isHug    = pin.looking_for === "hug";
        const pinColor = isHug ? "#f59e0b" : "#ec4899";

        const chatUrl = `/chat/${pin.id}?name=${encodeURIComponent(pin.name)}&appearance=${encodeURIComponent(pin.appearance ?? "")}`;
        const marker = L.circleMarker([pin.lat, pin.lng], {
          renderer,
          radius:      19,
          fillColor:   pinColor,
          color:       "rgba(255,255,255,0.6)",
          weight:      2,
          fillOpacity: 1,
        })
          .addTo(markersLayerRef.current)
          .bindTooltip(markerLabel(isHug, 18), {
            permanent:  true,
            direction:  "center",
            className:  "emoji-label emoji-label-sm",
            offset:     [0, 0],
          })
          .bindPopup(popupStyle(`
            <strong>${flagEmoji(pin.nationality ?? "")} ${pin.name}</strong>
            <br/><span style="font-size:12px">${t("mapView.age", { age: String(pin.age) })} · ${pin.gender ?? ""}</span>
            <br/><span style="font-size:12px">${isHug ? hugLabel : kissLabel}</span>
            ${pin.bio ? `<br/><span style="font-size:11px;color:#555;font-style:italic">${pin.bio}</span>` : ""}
            ${pin.appearance ? `<br/><span style="font-size:11px;color:#c2186f">👀 ${pin.appearance}</span>` : ""}
            <br/><span style="font-size:11px;color:#888">${distStr}</span>
            <br/><a href="${chatUrl}" style="display:inline-block;margin-top:6px;background:#7c3aed;color:white;font-size:11px;padding:3px 10px;border-radius:8px;text-decoration:none">${t("mapView.message")}</a>
          `));
        markersMapRef.current.set(pin.id, marker);
      } catch (err) {
        console.error("[MapView] Erreur rendu marqueur", pin.name, err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapReady]);

  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden">
      <div
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
      />
    </div>
  );
}
