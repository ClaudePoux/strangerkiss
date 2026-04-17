import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Message } from "@/lib/supabase";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/db/messages?from=&to=&since=   (since = ISO string, optionnel — pour le polling)
// GET /api/db/messages?inbox=myId&since=  (vérifie les messages non lus entrants pour la carte)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inbox = searchParams.get("inbox");
  const since = searchParams.get("since");

  // Mode inbox : retourne les from_id des expéditeurs ayant envoyé un message depuis `since`
  if (inbox) {
    const sinceTs = since ?? new Date(0).toISOString();
    const { data, error } = await sb
      .from("messages")
      .select("id, from_id, created_at")
      .eq("to_id", inbox)
      .gt("created_at", sinceTs)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ messages: [] });
    return NextResponse.json({ messages: data });
  }

  const fromId = searchParams.get("from");
  const toId = searchParams.get("to");

  if (!fromId || !toId) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  let query = sb
    .from("messages")
    .select("*")
    .or(`and(from_id.eq.${fromId},to_id.eq.${toId}),and(from_id.eq.${toId},to_id.eq.${fromId})`)
    .order("created_at", { ascending: true });

  if (since) {
    query = query.gt("created_at", since).limit(50);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: data as Message[] });
}

// POST /api/db/messages
export async function POST(req: NextRequest) {
  const { from_id, to_id, content } = await req.json();

  if (!from_id || !to_id || !content) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("messages")
    .insert({ from_id, to_id, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data as Message });
}
