import { useState, useEffect } from "react";
import { db } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Plus, Save } from "lucide-react";

type ChecklistTemplate = {
  id: string;
  name: string;
  items: ChecklistItem[];
};

type ChecklistItem = {
  id: string;
  label: string;
  type: "boolean" | "text" | "number" | "photo";
  required?: boolean;
};

type ChecklistData = {
  id: string;
  visit_id: string;
  template_id: string;
  template_name: string;
  responses: Record<string, any>;
  created_at: string;
};

const DEFAULT_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "soil-analysis",
    name: "Análise de Solo",
    items: [
      { id: "1", label: "Solo preparado?", type: "boolean", required: true },
      { id: "2", label: "pH do solo", type: "number", required: true },
      { id: "3", label: "Umidade adequada?", type: "boolean", required: true },
      { id: "4", label: "Observações", type: "text" },
    ],
  },
  {
    id: "crop-health",
    name: "Saúde da Lavoura",
    items: [
      { id: "1", label: "Pragas identificadas?", type: "boolean", required: true },
      { id: "2", label: "Altura média das plantas (cm)", type: "number" },
      { id: "3", label: "Aplicação de defensivos necessária?", type: "boolean" },
      { id: "4", label: "Notas adicionais", type: "text" },
    ],
  },
  {
    id: "fertilizer-app",
    name: "Aplicação de Fertilizantes",
    items: [
      { id: "1", label: "Produto aplicado", type: "text", required: true },
      { id: "2", label: "Quantidade (kg/ha)", type: "number", required: true },
      { id: "3", label: "Área coberta (ha)", type: "number", required: true },
      { id: "4", label: "Condições climáticas adequadas?", type: "boolean" },
    ],
  },
];

export default function CRMChecklists() {
  const [templates] = useState<ChecklistTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [visits, setVisits] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadVisits();
  }, []);

  async function loadVisits() {
    const data = await db.visits.where("status").equals("NO_LOCAL").toArray();
    setVisits(data);
  }

  function handleResponseChange(itemId: string, value: any) {
    setResponses((prev) => ({ ...prev, [itemId]: value }));
  }

  async function handleSave() {
    if (!selectedTemplate || !selectedVisit) return;

    const checklistData: ChecklistData = {
      id: crypto.randomUUID(),
      visit_id: selectedVisit,
      template_id: selectedTemplate.id,
      template_name: selectedTemplate.name,
      responses,
      created_at: new Date().toISOString(),
    };

    // Save to IndexedDB (will sync to server later)
    await db.outbox.add({
      type: "CHECKLIST",
      payload: checklistData,
      created_at: Date.now(),
      attempts: 0,
    });

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setResponses({});
      setSelectedTemplate(null);
      setSelectedVisit(null);
    }, 2000);
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>📋 Checklists de Campo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select Visit */}
          <div>
            <label className="block mb-2 font-medium text-sm">Visita Atual</label>
            <select
              value={selectedVisit || ""}
              onChange={(e) => setSelectedVisit(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Selecione uma visita</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.client_id} - {v.notes || "Sem descrição"}
                </option>
              ))}
            </select>
          </div>

          {/* Select Template */}
          <div>
            <label className="block mb-2 font-medium text-sm">Template</label>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`p-3 border rounded text-left ${
                    selectedTemplate?.id === tmpl.id ? "border-green-600 bg-green-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    <span className="font-medium">{tmpl.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Form */}
      {selectedTemplate && selectedVisit && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedTemplate.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate.items.map((item) => (
              <div key={item.id}>
                <label className="block mb-2 text-sm font-medium">
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {item.type === "boolean" && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={responses[item.id] || false}
                      onCheckedChange={(checked) => handleResponseChange(item.id, checked)}
                    />
                    <span className="text-sm">
                      {responses[item.id] ? "Sim" : "Não"}
                    </span>
                  </div>
                )}

                {item.type === "text" && (
                  <Input
                    value={responses[item.id] || ""}
                    onChange={(e) => handleResponseChange(item.id, e.target.value)}
                    placeholder="Digite aqui..."
                  />
                )}

                {item.type === "number" && (
                  <Input
                    type="number"
                    value={responses[item.id] || ""}
                    onChange={(e) => handleResponseChange(item.id, parseFloat(e.target.value))}
                    placeholder="Digite um número..."
                  />
                )}
              </div>
            ))}

            <Button onClick={handleSave} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saved ? "✅ Salvo!" : "Salvar Checklist"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
