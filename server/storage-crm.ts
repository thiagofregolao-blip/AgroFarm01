import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  visits, trips, telemetryGps, checklists, fields, farms, auditLogs
} from "@shared/schema.crm";

export type InsertVisit = typeof visits.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type Trip = typeof trips.$inferSelect;

export const CRMStorage = {
  // VISITS
  async getVisits(params: { assignee?: string; updatedSince?: string }) {
    const where = [];
    if (params.assignee) where.push(eq(visits.assignee, params.assignee));
    if (params.updatedSince) {
      where.push(gte(visits.updatedAt, new Date(params.updatedSince)));
    }
    return db.select().from(visits)
      .where(where.length ? and(...where) : undefined)
      .orderBy(visits.updatedAt);
  },

  async getRoute(params: { assignee?: string; date?: string }) {
    const dateFilter = params.date ? sql`DATE(v.window_start) = ${params.date}` : sql`true`;
    const assigneeFilter = params.assignee ? sql`v.assignee = ${params.assignee}` : sql`true`;

    return db.execute(sql`
      SELECT v.id, v.client_id, v.status, v.window_start, v.window_end,
             COALESCE(ST_Y(ST_Centroid(f.geom)), ST_Y(fa.centroid)) AS lat,
             COALESCE(ST_X(ST_Centroid(f.geom)), ST_X(fa.centroid)) AS lng
        FROM visits v
   LEFT JOIN fields f ON f.id = v.field_id
   LEFT JOIN farms  fa ON fa.id = v.farm_id
       WHERE ${assigneeFilter} AND ${dateFilter}
    ORDER BY v.window_start NULLS LAST
    `) as unknown as Array<{
      id: string; client_id: string; status: string;
      window_start: string | null; window_end: string | null;
      lat: number | null; lng: number | null;
    }>;
  },

  async createVisitsBulk(payload: any[]) {
    if (!payload?.length) return [];
    
    // Mapear snake_case para camelCase (schema do Drizzle) e converter strings para Date
    const normalized = payload.map(v => ({
      id: v.id,
      clientId: v.clientId || v.client_id,
      farmId: v.farmId || v.farm_id || null,
      fieldId: v.fieldId || v.field_id || null,
      scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : v.scheduled_at ? new Date(v.scheduled_at) : null,
      windowStart: v.windowStart ? new Date(v.windowStart) : v.window_start ? new Date(v.window_start) : null,
      windowEnd: v.windowEnd ? new Date(v.windowEnd) : v.window_end ? new Date(v.window_end) : null,
      status: v.status || 'PLANEJADA',
      assignee: v.assignee || null,
      notes: v.notes || null,
    }));
    
    const inserted = await db.insert(visits).values(normalized).returning();
    return inserted;
  },

  async updateVisitStatus(id: string, next: typeof visits.$inferInsert["status"]) {
    const row = await db.update(visits).set({ status: next, updatedAt: new Date() }).where(eq(visits.id, id)).returning();
    return row[0];
  },

  // TRIPS
  async startTrip(data: {
    visitId: string; odometer?: number | null; gps?: { lat?: number; lng?: number; speedKmh?: number; accuracyM?: number } | null; opId?: string | null; actor?: string | null;
  }) {
    if (data.opId) {
      const dup = await db.execute(sql`SELECT 1 FROM audit_logs WHERE action='TRIP_START' AND payload->>'op_id' = ${data.opId} LIMIT 1`);
      if ((dup as any).rowCount > 0) return { duplicate: true };
    }

    const [trip] = await db.insert(trips).values({
      visitId: data.visitId,
      startedAt: new Date(),
      startOdometer: data.odometer ?? null
    }).returning();

    await db.update(visits).set({ status: "EM_DESLOCAMENTO", updatedAt: new Date() }).where(eq(visits.id, data.visitId));
    await db.insert(auditLogs).values({
      actor: data.actor ?? null,
      action: "TRIP_START",
      entity: "trip",
      entityId: trip.id,
      payload: { op_id: data.opId ?? null }
    });

    if (data.gps?.lat && data.gps?.lng) {
      await db.insert(telemetryGps).values({
        tripId: trip.id,
        ts: new Date(),
        lat: String(data.gps.lat),
        lng: String(data.gps.lng),
        speedKmh: data.gps.speedKmh ? String(data.gps.speedKmh) : null,
        accuracyM: data.gps.accuracyM ? String(data.gps.accuracyM) : null
      });
    }
    return trip;
  },

  async appendGpsBatch(batch: Array<{ tripId: string; ts?: string; lat: number; lng: number; speedKmh?: number | null; accuracyM?: number | null }>) {
    if (!batch?.length) return 0;
    await db.insert(telemetryGps).values(batch.map(p => ({
      tripId: p.tripId,
      ts: p.ts ? new Date(p.ts) : new Date(),
      lat: String(p.lat),
      lng: String(p.lng),
      speedKmh: p.speedKmh != null ? String(p.speedKmh) : null,
      accuracyM: p.accuracyM != null ? String(p.accuracyM) : null
    })));
    return batch.length;
  },

  async endTrip(id: string, odometer?: number | null) {
    // Aceita tanto trip_id quanto visit_id
    // Primeiro tenta como trip_id
    let tripResult = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    
    // Se não encontrou, tenta buscar por visit_id (trip mais recente da visita)
    if (!tripResult || tripResult.length === 0) {
      tripResult = await db.select().from(trips)
        .where(eq(trips.visitId, id))
        .orderBy(sql`${trips.startedAt} DESC`)
        .limit(1);
    }
    
    if (!tripResult || tripResult.length === 0) {
      throw new Error(`Trip não encontrado para ID: ${id}`);
    }
    
    const tripId = tripResult[0].id;
    const visitId = tripResult[0].visitId;
    
    const [t] = await db.update(trips).set({
      endedAt: new Date(),
      endOdometer: odometer ?? null,
      updatedAt: new Date()
    }).where(eq(trips.id, tripId)).returning();

    // Não sobrescreve status se já está CONCLUIDA
    await db.execute(sql`
      UPDATE visits 
      SET status = CASE 
        WHEN status = 'CONCLUIDA' THEN 'CONCLUIDA'
        ELSE 'NO_LOCAL'
      END,
      updated_at = NOW()
      WHERE id = ${visitId}
    `);
    return t;
  },

  // CHECKLIST
  async saveChecklist(visitId: string, payload: {
    template?: string | null;
    answers?: Record<string, any>;
    photos?: any;
    signatures?: any;
    finished?: boolean;
  }) {
    const row = await db.insert(checklists).values({
      visitId,
      template: payload.template ?? null,
      answers: payload.answers ?? {},
      photos: payload.photos ?? {},
      signatures: payload.signatures ?? {},
      finished: !!payload.finished,
      finishedAt: payload.finished ? new Date() : null
    }).returning();

    // Always update visit's updatedAt for delta-sync, and status when finished
    if (payload.finished) {
      await db.update(visits).set({ status: "CONCLUIDA", updatedAt: new Date() }).where(eq(visits.id, visitId));
    } else {
      await db.update(visits).set({ updatedAt: new Date() }).where(eq(visits.id, visitId));
    }
    return row[0];
  },

  // GEO (ST_Contains)
  async pointInsideField(fieldId: string, lat: number, lng: number) {
    const res = await db.execute(sql`
      SELECT ST_Contains(geom, ST_SetSRID(ST_Point(${lng}, ${lat}),4326)) AS inside
        FROM fields WHERE id = ${fieldId}
    `);
    const row = (res as any).rows?.[0];
    return !!row?.inside;
  }
};
