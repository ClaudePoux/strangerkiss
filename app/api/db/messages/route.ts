import { NextRequest, NextResponse } from "next/server";
import { pool, mysqlReady } from "@/lib/mysql";
import type { Message } from "@/lib/supabase";

// GET /api/db/messages?from=&to=&since=   (since = ISO string, optionnel — pour le polling)
export async function GET(req: NextRequest) {
  if (!mysqlReady) return NextResponse.json({ messages: [] });

  const { searchParams } = new URL(req.url);
  const fromId = searchParams.get("from");
  const toId = searchParams.get("to");
  const since = searchParams.get("since"); // ISO datetime avec ms

  if (!fromId || !toId) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  let rows;
  if (since) {
    // Polling : uniquement les nouveaux messages
    [rows] = await pool.execute(
      `SELECT id, from_id, to_id, content,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at
       FROM messages
       WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
         AND created_at > ?
       ORDER BY created_at ASC
       LIMIT 50`,
      [fromId, toId, toId, fromId, since.replace("T", " ").replace("Z", "")]
    );
  } else {
    // Chargement initial : historique complet
    [rows] = await pool.execute(
      `SELECT id, from_id, to_id, content,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at
       FROM messages
       WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
       ORDER BY created_at ASC
       LIMIT 200`,
      [fromId, toId, toId, fromId]
    );
  }

  return NextResponse.json({ messages: rows as Message[] });
}

// POST /api/db/messages
export async function POST(req: NextRequest) {
  if (!mysqlReady) return NextResponse.json({ message: null });

  const { from_id, to_id, content } = await req.json();

  if (!from_id || !to_id || !content) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const mysqlDate = now.toISOString().slice(0, 23).replace("T", " "); // avec ms

  await pool.execute(
    `INSERT INTO messages (id, from_id, to_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, from_id, to_id, content, mysqlDate]
  );

  const message: Message = {
    id,
    from_id,
    to_id,
    content,
    created_at: now.toISOString(),
  };

  return NextResponse.json({ message });
}
