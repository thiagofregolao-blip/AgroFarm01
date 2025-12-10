import { useState, useEffect } from "react";
import { db } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Table } from "lucide-react";

type Visit = {
  id: string;
  client_id: string;
  status: string;
  window_start?: string | null;
  window_end?: string | null;
  notes?: string | null;
};

export default function CRMReports() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadVisits();
  }, []);

  async function loadVisits() {
    const data = await db.visits.toArray();
    setVisits(data as any);
  }

  const filteredVisits = visits.filter((v) => {
    if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
    if (startDate && v.window_start && v.window_start < startDate) return false;
    if (endDate && v.window_end && v.window_end > endDate) return false;
    return true;
  });

  function exportToCSV() {
    const headers = ["ID", "Cliente", "Status", "Início", "Fim", "Notas"];
    const rows = filteredVisits.map((v) => [
      v.id,
      v.client_id,
      v.status,
      v.window_start || "",
      v.window_end || "",
      v.notes || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_visitas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function exportToJSON() {
    const json = JSON.stringify(filteredVisits, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_visitas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  const stats = {
    total: filteredVisits.length,
    planejadas: filteredVisits.filter((v) => v.status === "PLANEJADA").length,
    concluidas: filteredVisits.filter((v) => v.status === "CONCLUIDA").length,
    noLocal: filteredVisits.filter((v) => v.status === "NO_LOCAL").length,
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>📊 Relatórios e Exportação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-2 text-sm font-medium">Data Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Data Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="ALL">Todos</option>
              <option value="PLANEJADA">Planejada</option>
              <option value="PRONTA">Pronta</option>
              <option value="EM_DESLOCAMENTO">Em Deslocamento</option>
              <option value="NO_LOCAL">No Local</option>
              <option value="CONCLUIDA">Concluída</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <p className="text-sm text-gray-600">Concluídas</p>
              <p className="text-2xl font-bold">{stats.concluidas}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded">
              <p className="text-sm text-gray-600">Planejadas</p>
              <p className="text-2xl font-bold">{stats.planejadas}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded">
              <p className="text-sm text-gray-600">No Local</p>
              <p className="text-2xl font-bold">{stats.noLocal}</p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="space-y-2">
            <Button onClick={exportToCSV} className="w-full" variant="outline">
              <Table className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button onClick={exportToJSON} className="w-full" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Exportar JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visit List */}
      <Card>
        <CardHeader>
          <CardTitle>Visitas Filtradas ({filteredVisits.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredVisits.map((v) => (
              <div key={v.id} className="p-3 border rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium">{v.client_id}</h5>
                    <p className="text-sm text-gray-600">{v.status}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {v.window_start ? new Date(v.window_start).toLocaleDateString() : "-"}
                  </span>
                </div>
                {v.notes && <p className="text-sm mt-2">{v.notes}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
