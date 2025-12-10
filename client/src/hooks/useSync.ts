import { useCallback, useEffect, useState } from "react";
import { db, OutboxItem, VisitLocal } from "@/lib/crm/idb";

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const pull = useCallback(async () => {
    try {
      const last = (await getLastUpdatedSince()) || "2024-01-01T00:00:00Z";
      const res = await fetch(`/api/visits?updated_since=${last}`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        console.log('Pull failed:', res.status);
        return;
      }
      
      const data = await res.json() as VisitLocal[];
      
      if (!Array.isArray(data)) {
        console.log('Pull data is not an array:', data);
        return;
      }
      
      await db.transaction('rw', db.visits, async () => {
        for (const v of data) await db.visits.put(v);
      });
    } catch (err) {
      console.error('Pull error:', err);
    }
  }, []);

  const push = useCallback(async () => {
    const items = await db.outbox.orderBy("created_at").toArray();
    for (const it of items) {
      try {
        if (it.type === "TRIP_START") {
          await fetch("/api/trips/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(it.payload)
          });
        } else if (it.type === "TRIP_END") {
          const visitId = it.payload.visit_id;
          if (visitId) {
            await fetch(`/api/trips/${visitId}/end`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ odometer: it.payload.odometer })
            });
          }
        } else if (it.type === "GPS_BATCH") {
          await fetch("/api/trips/gps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(it.payload)
          });
        } else if (it.type === "CHECKLIST") {
          await fetch(`/api/checklists/${it.payload.visitId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(it.payload.data)
          });
        } else if (it.type === "VISIT_CREATE") {
          await fetch(`/api/visits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(it.payload)
          });
        } else if (it.type === "VISIT_UPDATE") {
          await fetch(`/api/visits/${it.payload.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(it.payload)
          });
        }
        await db.outbox.delete(it.id!);
      } catch {
        await db.outbox.update(it.id!, { attempts: (it.attempts||0)+1 });
        break;
      }
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      setSyncing(true);
      await push();
      await pull();
      setLastSync(Date.now());
      await setLastUpdatedSince(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  }, [pull, push]);

  useEffect(() => {
    syncNow();
    const online = () => syncNow();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [syncNow]);

  return { syncing, lastSync, syncNow };
}

async function setLastUpdatedSince(iso: string) {
  await db.settings.put({ key: "lastUpdatedSince", value: iso });
}

async function getLastUpdatedSince() {
  const s = await db.settings.get("lastUpdatedSince");
  return s?.value as string | undefined;
}

export async function enqueue(type: OutboxItem["type"], payload: any) {
  await db.outbox.add({ type, payload, created_at: Date.now(), attempts: 0 });
}
