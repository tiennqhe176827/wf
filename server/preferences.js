import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import pg from "pg";

let local, pool;
export async function initPreferences() {
  if (process.env.DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, data JSONB NOT NULL)",
    );
  } else {
    mkdirSync(".data", { recursive: true });
    local = new DatabaseSync(".data/weather.sqlite");
    local.exec(
      "CREATE TABLE IF NOT EXISTS preferences (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
  }
}
export async function getPreferences(id) {
  if (pool)
    return (
      (await pool.query("SELECT data FROM preferences WHERE id=$1", [id]))
        .rows[0]?.data || {}
    );
  const row = local.prepare("SELECT data FROM preferences WHERE id=?").get(id);
  return row ? JSON.parse(row.data) : {};
}
export async function savePreferences(id, data) {
  const cleaned = {};
  if (data.maxTemperature !== null && data.maxTemperature !== undefined) {
    const max = Number(data.maxTemperature);
    if (!Number.isFinite(max) || max < 10 || max > 45)
      throw new Error("Ngưỡng nhiệt phải nằm trong khoảng 10–45°C.");
    cleaned.maxTemperature = max;
  }
  cleaned.uvSensitive = data.uvSensitive === true;
  cleaned.transport = ["walking", "bike", "motorbike", "car"].includes(
    data.transport,
  )
    ? data.transport
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
  ].includes(data.activity)
    ? data.activity
    : null;
  cleaned.commute = /^\d{2}:\d{2}$/.test(data.commute || "")
    ? data.commute
    : null;
  if (pool)
    await pool.query(
      "INSERT INTO preferences(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
      [id, cleaned],
    );
  else
    local
      .prepare(
        "INSERT INTO preferences(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(id, JSON.stringify(cleaned));
  return cleaned;
}
