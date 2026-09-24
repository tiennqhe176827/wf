import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import pg from "pg";

let local;
let pool;
let memory;
let storage = "uninitialized";

const isVercelRuntime = () =>
  process.env.VERCEL === "1" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_ENV === "preview";

export async function initPreferences() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, data JSONB NOT NULL)",
    );
    storage = "PostgreSQL";
    return;
  }

  // Vercel functions have an ephemeral, read-only deployment filesystem.
  // Do not try to create .data/weather.sqlite there. PostgreSQL should be
  // configured for persistence; memory keeps preferences usable without it.
  if (isVercelRuntime()) {
    memory = new Map();
    storage = "In-memory";
    return;
  }

  try {
    mkdirSync(".data", { recursive: true });
    local = new DatabaseSync(".data/weather.sqlite");
    local.exec(
      "CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
    storage = "SQLite";
  } catch (error) {
    // A serverless runtime may not expose VERCEL* variables during module
    // initialization. Fall back only for filesystem permission errors.
    if (!["EROFS", "EACCES", "EPERM"].includes(error?.code)) throw error;
    memory = new Map();
    storage = "In-memory";
  }
}

export function getPreferencesStorage() {
  return storage;
}

export async function getPreferences(id) {
  if (pool)
    return (
      (await pool.query("SELECT data FROM preferences WHERE id=$1", [id]))
        .rows[0]?.data || {}
    );
  if (storage === "In-memory") return memory.get(id) || {};
  const row = local.prepare("SELECT data FROM preferences WHERE id=?").get(id);
  return row ? JSON.parse(row.data) : {};
}
export async function savePreferences(id, data) {
  const input = data && typeof data === "object" ? data : {};
  const cleaned = {};
  if (
    input.maxTemperature !== null &&
    input.maxTemperature !== undefined
  ) {
    const max = Number(input.maxTemperature);
    if (!Number.isFinite(max) || max < 10 || max > 45)
      throw new Error("Ngưỡng nhiệt phải nằm trong khoảng 10–45°C.");
    cleaned.maxTemperature = max;
  }
  cleaned.uvSensitive = input.uvSensitive === true;
  cleaned.transport = ["walking", "bike", "motorbike", "car"].includes(
    input.transport,
  )
    ? input.transport
    : null;
  cleaned.activity = [
    "running",
    "cycling",
    "walking",
    "picnic",
    "photography",
    "laundry",
    "sport",
    "travel",
    "dating",
    "camping",
  ].includes(input.activity)
    ? input.activity
    : null;
  cleaned.commute = /^\d{2}:\d{2}$/.test(input.commute || "")
    ? input.commute
    : null;
  if (pool)
    await pool.query(
      "INSERT INTO preferences(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
      [id, cleaned],
    );
  else if (storage === "In-memory") memory.set(id, cleaned);
  else
    local
      .prepare(
        "INSERT INTO preferences(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(id, JSON.stringify(cleaned));
  return cleaned;
}
