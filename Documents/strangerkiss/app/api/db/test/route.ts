import { NextResponse } from "next/server";
import { pool, mysqlReady } from "@/lib/mysql";

// GET /api/db/test — vérifie la connexion MySQL et liste les tables
export async function GET() {
  if (!mysqlReady) {
    return NextResponse.json({
      ok: false,
      error: "Variables d'environnement MySQL manquantes",
      missing: [
        !process.env.MYSQL_HOST && "MYSQL_HOST",
        !process.env.MYSQL_DATABASE && "MYSQL_DATABASE",
        !process.env.MYSQL_USER && "MYSQL_USER",
        !process.env.MYSQL_PASSWORD && "MYSQL_PASSWORD",
      ].filter(Boolean),
    }, { status: 503 });
  }

  try {
    const start = Date.now();
    const [tables] = await pool.execute("SHOW TABLES");
    const latency = Date.now() - start;

    const tableNames = (tables as Record<string, string>[]).map(
      (row) => Object.values(row)[0]
    );

    // Vérifie que les 4 tables attendues existent
    const expected = ["users", "user_pins", "messages", "match_requests"];
    const missing = expected.filter((t) => !tableNames.includes(t));

    return NextResponse.json({
      ok: missing.length === 0,
      latency_ms: latency,
      host: process.env.MYSQL_HOST,
      database: process.env.MYSQL_DATABASE,
      tables: tableNames,
      missing_tables: missing,
      message: missing.length === 0
        ? "Connexion MySQL OVH opérationnelle ✓"
        : `Tables manquantes : ${missing.join(", ")} — exécute scripts/migrate.sql dans phpMyAdmin`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      error: message,
      hint: "Vérifie MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD dans .env.local",
    }, { status: 500 });
  }
}
