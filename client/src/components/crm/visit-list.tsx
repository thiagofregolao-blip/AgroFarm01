import { useMemo } from "react";

export type Visit = {
  id: string;
  client_id: string;
  status: "PLANEJADA"|"PRONTA"|"EM_DESLOCAMENTO"|"NO_LOCAL"|"CONCLUIDA";
  window_start?: string | null;
  notes?: string | null;
};

type Client = {
  id: string;
  name: string;
};

export default function VisitList({ 
  visits, 
  clients = [], 
  onEdit 
}: { 
  visits: Visit[]; 
  clients?: Client[];
  onEdit?: (visit: Visit) => void;
}) {
  const clientNames = useMemo(() => {
    const names: Record<string, string> = {};
    clients.forEach(c => {
      names[c.id] = c.name;
    });
    return names;
  }, [clients]);

  return (
    <div>
      {visits.map(v => (
        <div 
          key={v.id} 
          onClick={() => onEdit?.(v)}
          style={{ 
            padding: 10, 
            borderBottom: "1px solid #eee", 
            marginBottom: 8, 
            background: "#fff", 
            borderRadius: 6,
            cursor: onEdit ? "pointer" : "default"
          }}
          className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div style={{ fontWeight: 600 }}>{clientNames[v.client_id] || v.client_id}</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
            {v.window_start ? new Date(v.window_start).toLocaleString('pt-BR') : 'Sem horário'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: v.status === "CONCLUIDA" ? "#1db954" : "#666" }}>
            {v.status}
          </div>
          {v.notes && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{v.notes}</div>}
        </div>
      ))}
    </div>
  );
}
