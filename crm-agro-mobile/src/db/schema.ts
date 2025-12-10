import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("crm_agro.db");

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      farm_id TEXT,
      field_id TEXT,
      scheduled_at TEXT,
      window_start TEXT,
      window_end TEXT,
      status TEXT,
      assignee TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      visit_id TEXT,
      started_at TEXT,
      ended_at TEXT,
      start_odometer INTEGER,
      end_odometer INTEGER,
      distance_km REAL,
      created_at TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS telemetry_buffer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT,
      ts TEXT,
      lat REAL,
      lng REAL,
      speed_kmh REAL,
      accuracy_m REAL
    );
    
    CREATE TABLE IF NOT EXISTS outbox (
      op_id TEXT PRIMARY KEY,
      type TEXT,
      payload TEXT,
      attempts INTEGER DEFAULT 0,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
