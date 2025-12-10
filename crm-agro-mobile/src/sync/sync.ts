import { db } from "@db/schema";
import { api } from "@api/client";
import { setState, getState } from "@db/state";

export async function syncNow() {
  try {
    // PULL: Delta-sync usando updated_since persistente
    const lastSync = getState("last_sync") || "2024-01-01T00:00:00Z";
    const { data: serverVisits } = await api.get("/api/visits", { 
      params: { updated_since: lastSync } 
    });
    
    db.withTransactionSync(() => {
      for (const v of serverVisits || []) {
        db.execSync(
          `INSERT OR REPLACE INTO visits(
            id, client_id, farm_id, field_id, scheduled_at, window_start, window_end, 
            status, assignee, notes, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            v.id, v.clientId, v.farmId, v.fieldId, v.scheduledAt,
            v.windowStart, v.windowEnd, v.status, v.assignee, v.notes,
            v.createdAt, v.updatedAt
          ]
        );
      }
    });
    
    // Atualizar timestamp de última sincronização
    setState("last_sync", new Date().toISOString());

    // PUSH: Outbox pattern - enviar operações pendentes
    const pending = db.getAllSync(
      "SELECT op_id, type, payload, attempts FROM outbox ORDER BY created_at ASC"
    );
    
    for (const op of (pending as any[]) || []) {
      try {
        const payload = JSON.parse(op.payload);
        
        if (op.type === "TRIP_START") {
          await api.post("/api/trips/start", payload);
        } else if (op.type === "GPS_BATCH") {
          await api.post("/api/trips/gps", payload);
        } else if (op.type === "TRIP_END") {
          await api.post(`/api/trips/${payload.trip_id}/end`, { 
            odometer: payload.odometer 
          });
        } else if (op.type === "VISIT_STATUS") {
          await api.patch(`/api/visits/${payload.visit_id}/status`, { 
            status: payload.status 
          });
        } else if (op.type === "CHECKLIST_SAVE") {
          await api.post(`/api/checklists/${payload.visit_id}`, payload.data);
        } else if (op.type === "VISIT_CREATE") {
          await api.post("/api/visits", payload);
        }
        
        // Sucesso: remover da outbox
        db.runSync("DELETE FROM outbox WHERE op_id=?", [op.op_id]);
      } catch (err) {
        // Falha: incrementar tentativas e aplicar backoff
        db.runSync("UPDATE outbox SET attempts = attempts + 1 WHERE op_id=?", [op.op_id]);
        
        // Se falhou 5 vezes, parar e reportar erro
        if (op.attempts >= 4) {
          console.error("Max retries reached for op:", op.op_id);
          break;
        }
        break; // Backoff natural
      }
    }
    
    return { success: true, synced: serverVisits?.length || 0 };
  } catch (error) {
    console.error("Sync error:", error);
    return { success: false, error };
  }
}

export function enqueue(op_type: string, payload: any) {
  const op_id = `${op_type}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.runSync(
    "INSERT OR REPLACE INTO outbox(op_id, type, payload, created_at) VALUES (?,?,?,datetime('now'))",
    [op_id, op_type, JSON.stringify(payload)]
  );
  return op_id;
}
