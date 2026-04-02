import { createClient } from "@supabase/supabase-js";

export type LookingFor = "hug" | "french_kiss";
export type Gender = "homme" | "femme" | "non-binaire" | "autre";

export interface UserPin {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  nationality: string;
  bio: string;
  appearance: string;
  looking_for: LookingFor;
  lat: number;
  lng: number;
  created_at: string;
}

export interface Message {
  id: string;
  from_id: string;
  to_id: string;
  content: string;
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/*
  SQL schema to run in Supabase:

  create table user_pins (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    age integer not null check (age >= 18),
    gender text not null check (gender in ('homme', 'femme', 'non-binaire', 'autre')),
    nationality text not null default '',
    bio text not null default '',
    appearance text not null default '',
    looking_for text not null check (looking_for in ('hug', 'french_kiss')),
    lat double precision not null,
    lng double precision not null,
    created_at timestamptz default now()
  );

  create table messages (
    id uuid primary key default gen_random_uuid(),
    from_id uuid not null,
    to_id uuid not null,
    content text not null check (length(content) > 0 and length(content) <= 500),
    created_at timestamptz default now()
  );

  create index on messages (from_id, to_id, created_at);
  create index on messages (to_id, from_id, created_at);

  -- Auto-delete pins older than 24 hours
  -- delete from user_pins where created_at < now() - interval '24 hours';

  -- Enable Row Level Security
  alter table user_pins enable row level security;
  create policy "public read" on user_pins for select using (true);
  create policy "public insert" on user_pins for insert with check (true);

  alter table messages enable row level security;
  create policy "public read" on messages for select using (true);
  create policy "public insert" on messages for insert with check (true);
*/

export async function upsertUserPin(
  pin: Omit<UserPin, "id" | "created_at">
): Promise<UserPin | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_pins")
    .insert(pin)
    .select()
    .single();
  if (error) {
    console.error("Supabase insert error:", error);
    return null;
  }
  return data as UserPin;
}

export async function getNearbyUsers(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<UserPin[]> {
  if (!supabase) return [];
  const delta = radiusKm / 111;
  const { data, error } = await supabase
    .from("user_pins")
    .select("*")
    .gte("lat", lat - delta)
    .lte("lat", lat + delta)
    .gte("lng", lng - delta)
    .lte("lng", lng + delta)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Supabase select error:", error);
    return [];
  }
  return data as UserPin[];
}

export async function getMessages(
  myId: string,
  otherId: string
): Promise<Message[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(from_id.eq.${myId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${myId})`
    )
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("Supabase messages error:", error);
    return [];
  }
  return data as Message[];
}

export async function sendMessage(
  fromId: string,
  toId: string,
  content: string
): Promise<Message | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({ from_id: fromId, to_id: toId, content })
    .select()
    .single();
  if (error) {
    console.error("Supabase send error:", error);
    return null;
  }
  return data as Message;
}

export function subscribeToMessages(
  myId: string,
  otherId: string,
  onMessage: (msg: Message) => void
) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chat-${[myId, otherId].sort().join("-")}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new as Message;
        const inConv =
          (msg.from_id === myId && msg.to_id === otherId) ||
          (msg.from_id === otherId && msg.to_id === myId);
        if (inConv) onMessage(msg);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
