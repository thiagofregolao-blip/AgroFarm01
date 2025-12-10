import { db } from "./schema";

export function setState(key: string, value: string) {
  db.runSync("INSERT OR REPLACE INTO app_state(key,value) VALUES (?,?)", [key, value]);
}

export function getState(key: string): string | null {
  const row = db.getFirstSync("SELECT value FROM app_state WHERE key=?", [key]) as any;
  return row?.value ?? null;
}

export function deleteState(key: string) {
  db.runSync("DELETE FROM app_state WHERE key=?", [key]);
}
