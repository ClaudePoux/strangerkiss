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
  // Tracks currently rendered markers by pin id — avoids clearLayers on each refresh
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersMapRef    = useRef<Map<string, any>>(new Map());

  // mapReady passe à true quand Leaflet est chargé et la carte prête.
  // C'est le signal qui permet à Effect 2 de rendre les marqueurs,
  // même si les pins sont arrivés avant la fin du chargement de Leaflet.
  const [mapReady, setMapReady] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

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

      // zoomAnimation:false — désactive le transform CSS sur le conteneur pendant les zooms
      // (discrets ET pinch/touchZoom). Sur mobile, TouchZoom applique un scale() sur le
      // conteneur entier pendant le geste ; markerZoomAnimation:false ne couvre pas ce chemin.
      // zoomAnimation:false implique markerZoomAnimation:false et supprime les deux.
      const map = L.map(mapRef.current, { center, zoom: 15, zoomControl: true, zoomAnimation: false });

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
          -webkit-transform:translateZ(0);transform:translateZ(0);
        ">${youIsHug ? "🤗" : '<img src="/levres.svg" style="width:22px;height:22px;object-fit:contain" />'}</div>`,
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const hugLabel  = t("map.hug");
      const kissLabel = t("map.frenchKiss");

      L.marker(center, { icon: youIcon, pane: "overlayPane" })
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

      // Force l'overlayPane sur son propre layer de compositing GPU.
      // Les marqueurs vivent dans overlayPane (pane:'overlayPane') qui a un stacking
      // context différent de markerPane sous WebKit — plus stable pendant le pinch-zoom.
      const overlayPane = map.getPane("overlayPane");
      if (overlayPane) {
        (overlayPane as HTMLElement).style.webkitTransform = "translateZ(0)";
        (overlayPane as HTMLElement).style.transform       = "translateZ(0)";
        (overlayPane as HTMLElement).style.willChange      = "transform";
      }

      // ── Diagnostic zoom : inspecte les marqueurs dans le DOM avant/après chaque zoom
      function inspectMarkers(label: string) {
        const pane = mapRef.current?.querySelector(".leaflet-overlay-pane");
        const ts = new Date().toLocaleTimeString("fr-FR", { hour12: false });
        if (!pane) {
          setDebugLines(prev => [`${ts} [${label}] ⚠ overlay-pane absent`, ...prev].slice(0, 12));
          return;
        }
        const all = pane.querySelectorAll(".leaflet-marker-icon");
        const details: string[] = [];
        all.forEach((el, i) => {
          const s = window.getComputedStyle(el);
          const tf = (el as HTMLElement).style.transform || s.transform || "—";
          const tfShort = tf.length > 30 ? tf.slice(0, 30) + "…" : tf;
          const isHidden =
            s.display === "none" ||
            s.opacity === "0" ||
            s.visibility === "hidden";
          if (isHidden) {
            details.push(`  #${i} display=${s.display} opacity=${s.opacity} vis=${s.visibility}`);
            details.push(`     tf=${tfShort}`);
          }
        });
        const hidden = details.length / 2;
        const summary = `${ts} [${label}] total=${all.length} hidden=${hidden}`;
        setDebugLines(prev => [summary, ...details, ...prev].slice(0, 20));
      }

      map.on("zoomstart", () => inspectMarkers("zoomstart"));
      map.on("zoomend",   () => inspectMarkers("zoomend"));

      // Sur mobile, la barre d'adresse Safari/Chrome réduit le viewport au chargement.
      // setMapReady(true) est appelé DANS le timeout, après invalidateSize(),
      // pour que les marqueurs soient positionnés avec les dimensions correctes de la carte.
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
        mapInstanceRef.current  = null;
        markersLayerRef.current = null;
        leafletRef.current      = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effet 2 : mise à jour des marqueurs (pins OU mapReady changent) ─────────
  // Diff par ID : on n'efface JAMAIS tous les marqueurs d'un coup — les marqueurs
  // existants restent stables pendant un zoom ou un refresh périodique des pins.
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !markersLayerRef.current) return;

    const L = leafletRef.current;
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
            -webkit-transform:translateZ(0);transform:translateZ(0);
          ">${isHug ? "🤗" : '<img src="/levres.svg" style="width:18px;height:18px;object-fit:contain" />'}</div>`,
          className: "",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const chatUrl = `/chat/${pin.id}?name=${encodeURIComponent(pin.name)}&appearance=${encodeURIComponent(pin.appearance ?? "")}`;
        const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon, pane: "overlayPane" })
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
        markersMapRef.current.set(pin.id, marker);
      } catch (err) {
        console.error("[MapView] Erreur rendu marqueur", pin.name, err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapReady]);

  return (
    <>
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <div
          ref={mapRef}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
        />
      </div>
      {debugLines.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 12, left: 12, zIndex: 9999,
          background: 'rgba(0,0,0,0.82)', color: '#0f0', fontFamily: 'monospace',
          fontSize: 11, padding: '8px 10px', borderRadius: 8, maxWidth: 'calc(100vw - 24px)',
          whiteSpace: 'pre', overflowX: 'auto', lineHeight: 1.5,
          pointerEvents: 'none',
        }}>
          {debugLines.join("\n")}
        </div>
      )}
    </>
  );
}
