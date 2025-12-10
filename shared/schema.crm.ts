import {
  pgTable, uuid, varchar, text, timestamp, jsonb, integer, numeric, boolean,
  bigint, pgEnum, customType
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ENUM de status de visita
export const visitStatusEnum = pgEnum("visit_status", [
  "PLANEJADA", "PRONTA", "EM_DESLOCAMENTO", "NO_LOCAL", "CONCLUIDA"
]);

// Custom type for PostGIS geometry
const geometryPoint = customType<{ data: string }>({
  dataType() {
    return 'geometry(Point,4326)';
  },
});

const geometryPolygon = customType<{ data: string }>({
  dataType() {
    return 'geometry(Polygon,4326)';
  },
});

// --- FARMS (fazendas) ---
export const farms = pgTable("farms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name"),
  centroid: geometryPoint("centroid")
});

// --- FIELDS (talhões) ---
export const fields = pgTable("fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmId: varchar("farm_id").notNull().references(() => farms.id),
  name: text("name"),
  crop: text("crop"),
  season: text("season"),
  geom: geometryPolygon("geom"),
  areaHa: numeric("area_ha"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedBy: varchar("updated_by")
});

// --- VISITS ---
export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  farmId: varchar("farm_id").references(() => farms.id),
  fieldId: varchar("field_id").references(() => fields.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  status: visitStatusEnum("status").notNull().default("PLANEJADA"),
  assignee: varchar("assignee"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// --- TRIPS (viagens) ---
export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").references(() => visits.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  startOdometer: integer("start_odometer"),
  endOdometer: integer("end_odometer"),
  distanceKm: numeric("distance_km"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// --- TELEMETRY ---
export const telemetryGps = pgTable("telemetry_gps", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tripId: varchar("trip_id").references(() => trips.id),
  ts: timestamp("ts", { withTimezone: true }),
  lat: numeric("lat"),
  lng: numeric("lng"),
  speedKmh: numeric("speed_kmh"),
  accuracyM: numeric("accuracy_m")
});

// --- CHECKLISTS ---
export const checklists = pgTable("checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").references(() => visits.id),
  template: text("template"),
  answers: jsonb("answers"),
  photos: jsonb("photos"),
  signatures: jsonb("signatures"),
  finished: boolean("finished").default(false),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// --- AUTOMATIONS (mínimo viável p/ futuro) ---
export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title"),
  active: boolean("active").default(true),
  schedule: text("schedule"),
  config: jsonb("config")
});

// --- AUDIT LOGS ---
export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
  actor: varchar("actor"),
  action: text("action"),
  entity: text("entity"),
  entityId: text("entity_id"),
  payload: jsonb("payload")
});
