/**
 * CRM Mobile Routes — visitas, trips, checklists, fazendas/talhoes, geo, agenda.
 * Extraido de routes.ts para isolar o dominio CRM.
 */

import type { Express } from "express";
import { db } from "./db";
import { requireAuth } from "./auth";
import { CRMStorage } from "./storage-crm";
import { parseAgenda } from "./services/nlp.service";
import { farms, fields, insertFarmSchema, insertFieldSchema } from "@shared/schema";
import { visits } from "@shared/schema.crm";
import { eq, desc } from "drizzle-orm";
import { logger } from "./lib/logger";

export function registerCrmMobileRoutes(app: Express): void {

  // VISITS
  app.get("/api/visits", requireAuth, async (req: any, res) => {
    const { assignee, updated_since } = req.query as { assignee?: string; updated_since?: string };
    const data = await CRMStorage.getVisits({ assignee, updatedSince: updated_since });

    const enriched = await Promise.all(data.map(async (visit: any) => {
      if (visit.farm_id) {
        const [farm] = await db.select().from(farms).where(eq(farms.id, visit.farm_id)).limit(1);
        if (farm) return { ...visit, lat: farm.lat, lng: farm.lng };
      }
      return visit;
    }));

    res.json(enriched);
  });

  app.get("/api/visits/route", requireAuth, async (req: any, res) => {
    const { assignee, date } = req.query as { assignee?: string; date?: string };
    const data = await CRMStorage.getRoute({ assignee, date });
    res.json(data);
  });

  app.post("/api/visits", requireAuth, async (req: any, res) => {
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    const invalidItems = payload.filter((v: any) => {
      const clientId = v.clientId || v.client_id;
      return !clientId || (typeof clientId === 'string' && clientId.trim() === '');
    });

    if (invalidItems.length > 0) {
      logger.warn('Visitas sem client_id rejeitadas', { count: invalidItems.length });
      return res.status(400).json({
        error: "client_id e obrigatorio para todas as visitas",
        invalid_count: invalidItems.length,
        invalid_items: invalidItems.map((v: any) => ({ id: v.id, notes: v.notes }))
      });
    }

    const created = await CRMStorage.createVisitsBulk(payload);
    res.status(201).json(created);
  });

  app.patch("/api/visits/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const data = req.body;

    if (data.client_id !== undefined) {
      if (!data.client_id || (typeof data.client_id === 'string' && data.client_id.trim() === '')) {
        return res.status(400).json({ error: "client_id nao pode ser vazio" });
      }
    }

    const [updated] = await db.update(visits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visits.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Visita nao encontrada" });
    res.json(updated);
  });

  app.patch("/api/visits/:id/status", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { status } = req.body as { status: any };
    const updated = await CRMStorage.updateVisitStatus(id, status);
    res.json(updated);
  });

  // TRIPS
  app.post("/api/trips/start", requireAuth, async (req: any, res) => {
    const { visit_id, gps, odometer, op_id } = req.body || {};
    if (!visit_id) return res.status(400).json({ error: "visit_id e obrigatorio" });
    const trip = await CRMStorage.startTrip({
      visitId: visit_id,
      odometer: odometer ?? null,
      gps: gps ?? null,
      opId: op_id ?? null,
      actor: req.user?.id ?? null
    });
    res.status(201).json(trip);
  });

  app.post("/api/trips/gps", requireAuth, async (req: any, res) => {
    const batch = Array.isArray(req.body) ? req.body : [];
    const n = await CRMStorage.appendGpsBatch(batch);
    res.json({ inserted: n });
  });

  app.post("/api/trips/:id/end", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { odometer } = req.body || {};
    const t = await CRMStorage.endTrip(id, odometer ?? null);
    res.json({ ok: true, trip: t });
  });

  // CHECKLISTS
  app.post("/api/checklists/:visitId", requireAuth, async (req: any, res) => {
    const { visitId } = req.params;
    const { template, answers, photos, signatures, finished } = req.body || {};
    const checklist = await CRMStorage.saveChecklist(visitId, {
      template, answers, photos, signatures, finished
    });
    res.status(201).json(checklist);
  });

  // FARMS & FIELDS
  app.get("/api/farms", requireAuth, async (_req, res) => {
    const farmsData = await db.select().from(farms);
    res.json(farmsData);
  });

  app.post("/api/farms", requireAuth, async (req: any, res) => {
    const data = insertFarmSchema.parse(req.body);
    const [created] = await db.insert(farms).values(data).returning();
    res.status(201).json(created);
  });

  app.delete("/api/farms/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    await db.delete(farms).where(eq(farms.id, id));
    res.json({ success: true });
  });

  app.get("/api/fields", requireAuth, async (req: any, res) => {
    try {
      const { farm_id } = req.query;
      let data;
      if (farm_id) {
        data = await db.query.fields.findMany({
          where: (fields: any, { eq }: any) => eq(fields.farmId, farm_id as string)
        });
      } else {
        data = await db.query.fields.findMany();
      }
      res.json(data);
    } catch (err) {
      logger.error('Erro ao buscar fields', { route: '/api/fields' }, err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({ error: "Falha ao buscar talhoes" });
    }
  });

  app.post("/api/fields", requireAuth, async (req: any, res) => {
    try {
      const data = insertFieldSchema.parse(req.body);
      const fieldData: any = {
        farmId: data.farmId,
        name: data.name,
        ...(data.crop && { crop: data.crop }),
        ...((data as any).season && { season: (data as any).season })
      };
      const [created] = await db.insert(fields).values(fieldData).returning();
      res.status(201).json(created);
    } catch (err) {
      logger.error('Erro ao criar field', { route: '/api/fields' }, err instanceof Error ? err : new Error(String(err)));
      res.status(400).json({ error: "Falha ao criar talhao" });
    }
  });

  // GEO
  app.get("/api/geo/fields/:id/contains", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { lat, lng } = req.query as any;
    if (!lat || !lng) return res.status(400).json({ error: "lat/lng obrigatorios" });
    const inside = await CRMStorage.pointInsideField(id, parseFloat(lat), parseFloat(lng));
    res.json({ inside });
  });

  // AGENDA (texto -> visitas)
  app.post("/api/agenda/parse", requireAuth, async (req: any, res) => {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "text e obrigatorio" });
    const parsed = await parseAgenda(text);
    res.json({ items: parsed.map(p => ({ ...p, match_ok: !!p.client_id })) });
  });

  app.post("/api/agenda/confirm", requireAuth, async (req: any, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items vazio" });
    }

    const validItems = items.filter(v => v.client_id);
    const invalidItems = items.filter(v => !v.client_id);

    if (validItems.length === 0) {
      return res.status(400).json({
        error: "Nenhum cliente reconhecido",
        invalid: invalidItems.map((i: any) => i.client_name || i.notes || "Item desconhecido")
      });
    }

    const payload = validItems.map((v: any) => ({
      clientId: v.client_id,
      farmId: v.farm_id ?? null,
      fieldId: v.field_id ?? null,
      scheduledAt: v.date ? new Date(`${v.date}T${v.time ? v.time : "09:00"}:00-03:00`) : new Date(),
      windowStart: v.date ? new Date(`${v.date}T${v.time ? v.time : "09:00"}:00-03:00`) : new Date(),
      windowEnd: null,
      status: "PLANEJADA" as const,
      assignee: req.user?.id ?? null,
      notes: v.notes ?? null
    }));

    const created = await CRMStorage.createVisitsBulk(payload);
    res.status(201).json({
      created: created.length,
      visits: created,
      skipped: invalidItems.length,
      invalid_items: invalidItems.map((i: any) => i.client_name || i.notes || "Item desconhecido")
    });
  });
}
