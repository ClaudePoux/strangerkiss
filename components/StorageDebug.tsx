"use client";

/**
 * StorageDebug — intercepte TOUTES les opérations localStorage sur les clés critiques.
 * Affiche les stack traces pour identifier exactement d'où viennent les modifications.
 * À conserver jusqu'à ce que le bug de disparition sk_user_id / sk_phone soit résolu.
 */

import { useEffect } from "react";

const WATCHED = ["sk_user_id", "sk_phone", "sk_my_id", "sk_user_credits", "sk_ref_code"];

function short(value: string): string {
  if (!value) return '""';
  if (value.length <= 20) return `"${value}"`;
  return `"${value.slice(0, 10)}…${value.slice(-4)}"`;
}

function stack(): string {
  return (new Error().stack ?? "")
    .split("\n")
    .slice(2, 6)   // sauter Error() lui-même + cette fonction
    .map((l) => "  " + l.trim())
    .join("\n");
}

export default function StorageDebug() {
  useEffect(() => {
    if (typeof localStorage === "undefined") return;

    const origRemove = localStorage.removeItem.bind(localStorage);
    const origSet    = localStorage.setItem.bind(localStorage);
    const origClear  = localStorage.clear.bind(localStorage);

    localStorage.removeItem = function (key: string) {
      if (WATCHED.includes(key)) {
        console.warn(
          `%c[SK-STORAGE] removeItem("${key}")`,
          "color:#ff4444;font-weight:bold",
          "\n" + stack()
        );
      }
      return origRemove(key);
    };

    localStorage.setItem = function (key: string, value: string) {
      if (WATCHED.includes(key)) {
        console.log(
          `%c[SK-STORAGE] setItem("${key}", ${short(value)})`,
          "color:#44ff88",
          "\n" + stack()
        );
      }
      return origSet(key, value);
    };

    localStorage.clear = function () {
      console.error(
        "%c[SK-STORAGE] clear() ← TOUTES LES CLÉS EFFACÉES !",
        "color:#ff0000;font-weight:bold;font-size:14px",
        "\n" + stack()
      );
      return origClear();
    };

    // Log snapshot initial pour comparer avec l'état après navigation
    console.log(
      "%c[SK-STORAGE] snapshot au montage",
      "color:#aaaaff",
      Object.fromEntries(
        WATCHED.map((k) => [k, localStorage.getItem(k) ? short(localStorage.getItem(k)!) : null])
      )
    );

    return () => {
      localStorage.removeItem = origRemove;
      localStorage.setItem    = origSet;
      localStorage.clear      = origClear;
    };
  }, []);

  return null;
}
