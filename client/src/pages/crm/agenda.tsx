import { useEffect, useMemo, useState } from "react";
import VisitList from "@/components/crm/visit-list";
import { db, ClientLocal, FarmLocal } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

const STATUS = ["PLANEJADA","PRONTA","EM_DESLOCAMENTO","NO_LOCAL","CONCLUIDA"] as const;

const TIPOS_SERVICO = [
  "Inspeção Técnica",
  "Amostra Solo",
  "Amostra Folha",
  "Demonstração Produto",
  "Assistência Técnica",
  "Visita Comercial",
  "Outros",
];

export default function CRMAgenda() {
  const [filter, setFilter] = useState<"TODAS" | typeof STATUS[number]>("TODAS");
  const [visits, setVisits] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientLocal[]>([]);
  const [farms, setFarms] = useState<FarmLocal[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  
  const [form, setForm] = useState({
    client_id: "",
    farm_id: "",
    service_type: "",
    scheduled_date: "",
    scheduled_time: "",
    status: "PLANEJADA" as const,
    notes: "",
  });

  async function load() {
    const v = await db.visits.orderBy("window_start").toArray();
    setVisits(v as any);
  }

  async function loadClients() {
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      const data = await res.json();
      // Garante que data é array antes de setar
      if (Array.isArray(data)) {
        setClients(data);
        await db.clients.bulkPut(data);
      } else {
        // Se não for array (erro, etc), carrega do local
        setClients(await db.clients.toArray());
      }
    } catch {
      setClients(await db.clients.toArray());
    }
  }

  async function loadFarms(clientId: string) {
    try {
      const res = await fetch(`/api/farms?client_id=${clientId}`, { credentials: 'include' });
      const data = await res.json();
      setFarms(data);
    } catch {
      const localFarms = await db.farms.where('client_id').equals(clientId).toArray();
      setFarms(localFarms);
    }
  }

  function handleEditVisit(visit: any) {
    setEditingVisit(visit);
    
    // Preenche form com dados da visita
    const datetime = visit.window_start ? new Date(visit.window_start) : new Date();
    const date = datetime.toISOString().split('T')[0];
    const time = datetime.toTimeString().slice(0, 5);
    
    // Extrai service_type das notes
    const serviceType = TIPOS_SERVICO.find(tipo => visit.notes?.includes(tipo)) || "Visita Comercial";
    const notes = visit.notes?.replace(serviceType, '').replace(/^\s*-\s*/, '') || '';
    
    setForm({
      client_id: visit.client_id,
      farm_id: visit.farm_id || "",
      service_type: serviceType,
      scheduled_date: date,
      scheduled_time: time,
      status: visit.status,
      notes: notes,
    });
    
    setCreateOpen(true);
  }

  async function saveVisit() {
    // Validação rigorosa
    if (!form.client_id || !form.service_type || !form.scheduled_date) {
      alert('Por favor, preencha todos os campos obrigatórios:\n- Cliente\n- Tipo de Serviço\n- Data');
      return;
    }

    // Validação extra: client_id não pode ser vazio
    if (form.client_id.trim() === '') {
      alert('Por favor, selecione um cliente válido');
      return;
    }

    const datetime = form.scheduled_time 
      ? `${form.scheduled_date}T${form.scheduled_time}:00` 
      : `${form.scheduled_date}T08:00:00`;

    const isEditing = !!editingVisit;
    const visit = {
      id: editingVisit?.id || `visit-${Date.now()}`,
      client_id: form.client_id,
      farm_id: form.farm_id || null,
      window_start: datetime,
      window_end: datetime,
      status: form.status,
      notes: `${form.service_type}${form.notes ? ` - ${form.notes}` : ''}`,
    };

    // Save to IndexedDB (always succeeds)
    await db.visits.put(visit as any);

    // Try to sync to backend (best effort)
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const url = isEditing ? `/api/visits/${visit.id}` : '/api/visits';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(visit),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.warn('⚠️ Aviso ao sincronizar visita:', error);
        // Save to outbox for later sync, mas não bloqueia o save local
        await db.outbox.add({
          type: isEditing ? 'VISIT_UPDATE' : 'VISIT_CREATE',
          payload: visit,
          created_at: Date.now(),
          attempts: 0,
        });
      }
    } catch (err) {
      console.warn('⚠️ Erro de conexão ao sincronizar:', err);
      // Save to outbox for later sync
      await db.outbox.add({
        type: isEditing ? 'VISIT_UPDATE' : 'VISIT_CREATE',
        payload: visit,
        created_at: Date.now(),
        attempts: 0,
      });
    }

    setCreateOpen(false);
    setEditingVisit(null);
    setForm({
      client_id: "",
      farm_id: "",
      service_type: "",
      scheduled_date: "",
      scheduled_time: "",
      status: "PLANEJADA",
      notes: "",
    });
    load();
    // Dispara evento para atualizar home page
    window.dispatchEvent(new Event('visitsChanged'));
  }

  useEffect(() => { 
    load(); 
    loadClients();
  }, []);

  useEffect(() => {
    if (form.client_id) {
      loadFarms(form.client_id);
    }
  }, [form.client_id]);

  const filtered = useMemo(() => 
    filter === "TODAS" ? visits : visits.filter(v => v.status === filter), 
    [visits, filter]
  );

  return (
    <div className="p-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-3">
        {(["TODAS", ...STATUS] as const).map(s => (
          <button 
            key={s} 
            onClick={() => setFilter(s as any)}
            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
              filter === s 
                ? 'border-green-600 text-green-600 bg-green-50 dark:bg-green-950/30' 
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900'
            }`}
            data-testid={`filter-${s.toLowerCase()}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Create Visit Button */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) {
          // Reset ao fechar dialog
          setEditingVisit(null);
          setForm({
            client_id: "",
            farm_id: "",
            service_type: "",
            scheduled_date: "",
            scheduled_time: "",
            status: "PLANEJADA",
            notes: "",
          });
        }
      }}>
        <DialogTrigger asChild>
          <Button 
            className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white" 
            size="lg"
            onClick={() => {
              // Reset ao clicar em criar nova
              setEditingVisit(null);
              setForm({
                client_id: "",
                farm_id: "",
                service_type: "",
                scheduled_date: "",
                scheduled_time: "",
                status: "PLANEJADA",
                notes: "",
              });
            }}
            data-testid="button-create-visit"
          >
            <Plus className="h-5 w-5 mr-2" />
            CRIAR VISITA
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVisit ? 'Editar Visita' : 'Nova Visita'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({...form, client_id: v, farm_id: ""})}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.client_id && farms.length > 0 && (
              <div>
                <Label>Fazenda</Label>
                <Select value={form.farm_id} onValueChange={(v) => setForm({...form, farm_id: v})}>
                  <SelectTrigger data-testid="select-farm">
                    <SelectValue placeholder="Selecione a fazenda (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {farms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tipo de Serviço *</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({...form, service_type: v})}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICO.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data *</Label>
                <Input 
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({...form, scheduled_date: e.target.value})}
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label>Hora</Label>
                <Input 
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({...form, scheduled_time: e.target.value})}
                  data-testid="input-time"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea 
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Ex: Verificar pragas, aplicar fertilizante..."
                rows={3}
                data-testid="input-notes"
              />
            </div>

            <Button 
              onClick={saveVisit} 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!form.client_id || !form.service_type || !form.scheduled_date}
              data-testid="button-save-visit"
            >
              {editingVisit ? 'Salvar Alterações' : 'Criar Visita'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VisitList visits={filtered} clients={clients} onEdit={handleEditVisit} />
    </div>
  );
}
