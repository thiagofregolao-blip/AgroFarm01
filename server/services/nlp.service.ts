import Fuse from "fuse.js";
import { db } from "../db";
import { sql } from "drizzle-orm";

type ParsedAgendaItem = {
  client_name: string;
  client_id?: string;
  intent?: string;
  notes?: string;
  priority?: "A" | "B" | "C";
  date?: string;
  time?: string;
};

const INTENT_MAP: Record<string, string> = {
  "inspecao": "INSPECAO_SOJA",
  "inspeção": "INSPECAO_SOJA",
  "amostra": "AMOSTRA_SOLO",
  "pos-venda": "POS_VENDA",
  "pós-venda": "POS_VENDA",
  "colheita": "INSPECAO_COLHEITA"
};

function normalize(s: string){ return s.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase(); }

function parseLines(text: string): ParsedAgendaItem[] {
  const lines = text.split(/\n|;|,/).map(l => l.trim()).filter(Boolean);
  const items: ParsedAgendaItem[] = [];
  for (const raw of lines) {
    const s = normalize(raw);
    const item: ParsedAgendaItem = { client_name: raw };
    if (/\burgente\b|\bprioriza\b/.test(s)) item.priority = "A";
    else if (/\balta\b/.test(s)) item.priority = "A";
    else if (/\bmedia\b|\bmédia\b/.test(s)) item.priority = "B";
    else if (/\bbaixa\b/.test(s)) item.priority = "C";

    for (const k of Object.keys(INTENT_MAP)) {
      if (s.includes(normalize(k))) { item.intent = INTENT_MAP[k]; break; }
    }
    const hm = s.match(/\b(\d{1,2})(?:[:h](\d{2}))?\b/);
    if (hm) {
      const hh = hm[1].padStart(2,"0"); const mm = (hm[2]||"00").padStart(2,"0");
      item.time = `${hh}:${mm}`;
    }
    const obs = s.match(/obs[:\-\s]+(.+)$/) || raw.match(/\((.+)\)/);
    if (obs) item.notes = obs[1];
    items.push(item);
  }
  return items;
}

export async function parseAgenda(text: string) {
  const items = parseLines(text);

  // Busca clientes ativos via master_clients
  const res = await db.execute(sql`SELECT id, name FROM master_clients WHERE is_active = true`);
  const rows = (res as any).rows || [];
  const fuse = new Fuse(rows, { keys: ["name"], threshold: 0.3 });

  const resolved = items.map(i => {
    const best = fuse.search(i.client_name)[0];
    return { ...i, client_id: (best?.item as any)?.id };
  });

  const d = new Date().toISOString().slice(0,10);
  return resolved.map(i => ({ ...i, date: i.date || d }));
}
