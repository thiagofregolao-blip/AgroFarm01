import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/crm/idb";
import VisitList from "@/components/crm/visit-list";

export default function CRMHistorico() {
  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const all = await db.visits.toArray();
      setVisits(all as any);
    })();
  }, []);

  const concluded = useMemo(
    () => (visits || [])
      .filter(v => v.status === "CONCLUIDA")
      .sort((a, b) =>
        (new Date((b.window_start||0) as any).getTime() - new Date((a.window_start||0) as any).getTime())
      ),
    [visits]
  );

  return (
    <div style={{ padding: 12 }}>
      <h3>Histórico de Visitas</h3>
      {concluded.length ? <VisitList visits={concluded} /> : <div>Nenhuma visita concluída.</div>}
    </div>
  );
}
