import Dexie, { Table } from "dexie";

export type VisitLocal = {
  id: string;
  client_id: string;
  farm_id?: string | null;
  field_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  status: "PLANEJADA"|"PRONTA"|"EM_DESLOCAMENTO"|"NO_LOCAL"|"CONCLUIDA";
  assignee?: string | null;
  notes?: string | null;
  photos?: { url: string; description: string; timestamp: string; }[];
  updated_at?: string;
};

export type ClientLocal = {
  id: string;
  name: string;
  cluster?: string | null;
  priority?: string | null;
  isActive: boolean;
};

export type TripPoint = {
  id?: number;
  trip_id: string | null;
  ts: string;
  lat: number;
  lng: number;
  speed_kmh?: number | null;
  accuracy_m?: number | null;
};

export type FarmLocal = {
  id: string;
  name: string;
  client_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  notes?: string | null;
};

export type FieldLocal = {
  id: string;
  name: string;
  farm_id: string;
  area?: number | null;
  crop?: string | null;
  notes?: string | null;
};

export type OutboxItem = {
  id?: number;
  type: "TRIP_START"|"TRIP_END"|"GPS_BATCH"|"CHECKLIST"|"VISIT_CREATE"|"VISIT_UPDATE";
  payload: any;
  created_at: number;
  attempts: number;
};

export class CRMDB extends Dexie {
  visits!: Table<VisitLocal, string>;
  clients!: Table<ClientLocal, string>;
  farms!: Table<FarmLocal, string>;
  fields!: Table<FieldLocal, string>;
  telemetry!: Table<TripPoint, number>;
  outbox!: Table<OutboxItem, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super("crm_agro");
    this.version(2).stores({
      visits: "id, status, assignee, window_start",
      clients: "id, name",
      farms: "id, name, client_id",
      fields: "id, name, farm_id",
      telemetry: "++id, trip_id, ts",
      outbox: "++id, type, created_at, attempts",
      settings: "key"
    });
  }
}

export const db = new CRMDB();

export async function putSetting<T=any>(key: string, value: T) {
  await db.settings.put({ key, value });
}

export async function getSetting<T=any>(key: string): Promise<T|null> {
  const row = await db.settings.get(key);
  return (row?.value ?? null) as T|null;
}
