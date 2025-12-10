import { useEffect, useMemo, useState } from "react";
import { db, ClientLocal, FarmLocal, FieldLocal } from "@/lib/crm/idb";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Sprout } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function CRMClientes() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<ClientLocal[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientLocal | null>(null);
  const [farms, setFarms] = useState<FarmLocal[]>([]);
  const [fields, setFields] = useState<FieldLocal[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<FarmLocal | null>(null);

  // Dialog states for new farm/field
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [farmForm, setFarmForm] = useState({ name: "", lat: "", lng: "", address: "" });
  const [fieldForm, setFieldForm] = useState({ name: "", crop: "" });

  async function load() {
    try {
      const res = await fetch(`/api/clients?q=${q}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      // Backend retorna array direto com clientes do consultor autenticado
      const clientsArray = Array.isArray(data) ? data : [];
      setClients(clientsArray);
      if (clientsArray.length > 0) {
        await db.clients.bulkPut(clientsArray);
      }
      console.log(`✅ CRM: Carregados ${clientsArray.length} clientes para este consultor`);
    } catch (err) {
      console.error('❌ Erro carregando clientes:', err);
      const localClients = await db.clients.toArray();
      setClients(localClients || []);
    }
  }

  async function loadFarms(clientId: string) {
    try {
      const res = await fetch(`/api/farms?client_id=${clientId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      const farmsArray = Array.isArray(data) ? data : [];
      setFarms(farmsArray);
      if (farmsArray.length > 0) await db.farms.bulkPut(farmsArray);
    } catch (err) {
      console.warn("⚠️ Erro loadFarms, usando local", err);
      const localFarms = await db.farms.where('client_id').equals(clientId).toArray();
      setFarms(localFarms || []);
    }
  }

  async function loadFields(farmId: string) {
    try {
      const res = await fetch(`/api/fields?farm_id=${farmId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      const fieldsArray = Array.isArray(data) ? data : [];
      setFields(fieldsArray);
      if (fieldsArray.length > 0) await db.fields.bulkPut(fieldsArray);
    } catch (err) {
      console.warn("⚠️ Erro loadFields, usando local", err);
      const localFields = await db.fields.where('farm_id').equals(farmId).toArray();
      setFields(localFields || []);
    }
  }

  async function createFarm() {
    if (!selectedClient || !farmForm.name) return;
    
    // Local usa snake_case para compatibilidade com IndexedDB
    const farm: FarmLocal = {
      id: `farm-${Date.now()}`,
      name: farmForm.name,
      client_id: selectedClient.id,
      lat: farmForm.lat ? parseFloat(farmForm.lat) : null,
      lng: farmForm.lng ? parseFloat(farmForm.lng) : null,
      address: farmForm.address || null,
    };

    // Salva localmente PRIMEIRO (offline-first)
    await db.farms.put(farm);
    
    // Tenta sincronizar com backend (sem quebrar se falhar)
    try {
      const farmPayload = {
        name: farmForm.name,
        clientId: selectedClient.id
      };
      const res = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(farmPayload)
      });
      if (res.ok) {
        console.log('✅ Fazenda sincronizada com backend');
      } else {
        console.warn('⚠️ Fazenda salva localmente, sync com backend falhou');
      }
    } catch (err) {
      console.warn('⚠️ Sem conexão, fazenda salva apenas localmente');
    }

    setNewFarmOpen(false);
    setFarmForm({ name: "", lat: "", lng: "", address: "" });
    
    // Recarrega da base local (mais confiável)
    const localFarms = await db.farms.where('client_id').equals(selectedClient.id).toArray();
    setFarms(localFarms || []);
  }

  async function createField() {
    if (!selectedFarm || !fieldForm.name) return;
    
    // Local usa snake_case para compatibilidade com IndexedDB
    const field: FieldLocal = {
      id: `field-${Date.now()}`,
      name: fieldForm.name,
      farm_id: selectedFarm.id,
      crop: fieldForm.crop || null,
    };

    // Salva localmente PRIMEIRO (offline-first)
    await db.fields.put(field);
    
    // Tenta sincronizar com backend (sem quebrar se falhar)
    try {
      const fieldPayload = {
        name: fieldForm.name,
        farmId: selectedFarm.id
      };
      const res = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fieldPayload)
      });
      if (res.ok) {
        console.log('✅ Talhão sincronizado com backend');
      } else {
        console.warn('⚠️ Talhão salvo localmente, sync com backend falhou');
      }
    } catch (err) {
      console.warn('⚠️ Sem conexão, talhão salvo apenas localmente');
    }

    setNewFieldOpen(false);
    setFieldForm({ name: "", crop: "" });
    
    // Recarrega da base local (mais confiável)
    const localFields = await db.fields.where('farm_id').equals(selectedFarm.id).toArray();
    setFields(localFields || []);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedClient) {
      loadFarms(selectedClient.id);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedFarm) {
      loadFields(selectedFarm.id);
    }
  }, [selectedFarm]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(s));
  }, [clients, q]);

  // Show farm details if a farm is selected
  if (selectedFarm) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedFarm(null)}
            data-testid="button-back-to-farms"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">{selectedFarm.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedClient?.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Talhões</CardTitle>
            <Dialog open={newFieldOpen} onOpenChange={setNewFieldOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-field">+ Talhão</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Talhão</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input 
                      value={fieldForm.name}
                      onChange={(e) => setFieldForm({...fieldForm, name: e.target.value})}
                      placeholder="Ex: Talhão 1"
                      data-testid="input-field-name"
                    />
                  </div>
                  <div>
                    <Label>Cultura</Label>
                    <Input 
                      value={fieldForm.crop}
                      onChange={(e) => setFieldForm({...fieldForm, crop: e.target.value})}
                      placeholder="Ex: Soja"
                      data-testid="input-field-crop"
                    />
                  </div>
                  <Button onClick={createField} className="w-full" data-testid="button-save-field">
                    Criar Talhão
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fields.map(field => (
                <div key={field.id} className="border rounded-lg p-3" data-testid={`field-item-${field.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Sprout className="h-4 w-4 text-green-600" />
                        {field.name}
                      </div>
                      {field.crop && (
                        <Badge variant="outline" className="mt-1">
                          {field.crop}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum talhão cadastrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show farms list if a client is selected
  if (selectedClient) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedClient(null)}
            data-testid="button-back-to-clients"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">{selectedClient.name}</h2>
            <p className="text-sm text-muted-foreground">Fazendas</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fazendas</CardTitle>
            <Dialog open={newFarmOpen} onOpenChange={setNewFarmOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-farm">+ Fazenda</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Fazenda</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input 
                      value={farmForm.name}
                      onChange={(e) => setFarmForm({...farmForm, name: e.target.value})}
                      placeholder="Ex: Fazenda Aurora"
                      data-testid="input-farm-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Latitude</Label>
                      <Input 
                        value={farmForm.lat}
                        onChange={(e) => setFarmForm({...farmForm, lat: e.target.value})}
                        placeholder="-25.123"
                        data-testid="input-farm-lat"
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input 
                        value={farmForm.lng}
                        onChange={(e) => setFarmForm({...farmForm, lng: e.target.value})}
                        placeholder="-54.456"
                        data-testid="input-farm-lng"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Endereço</Label>
                    <Input 
                      value={farmForm.address}
                      onChange={(e) => setFarmForm({...farmForm, address: e.target.value})}
                      placeholder="Ex: Alto Paraná, Paraguai"
                      data-testid="input-farm-address"
                    />
                  </div>
                  <Button onClick={createFarm} className="w-full" data-testid="button-save-farm">
                    Criar Fazenda
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {farms.map(farm => (
                <div 
                  key={farm.id} 
                  className="border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setSelectedFarm(farm)}
                  data-testid={`farm-item-${farm.id}`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    {farm.name}
                  </div>
                  {farm.address && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {farm.address}
                    </div>
                  )}
                  {(farm.lat && farm.lng) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      📍 {farm.lat.toFixed(4)}, {farm.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              ))}
              {farms.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma fazenda cadastrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show clients list
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente..."
            data-testid="input-search-client"
          />
          <div className="space-y-2">
            {list.map(c => (
              <div 
                key={c.id} 
                className="border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setSelectedClient(c)}
                data-testid={`client-item-${c.id}`}
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.cluster && `Cluster: ${c.cluster}`}
                  {c.cluster && c.priority && " • "}
                  {c.priority && `Prioridade: ${c.priority}`}
                </div>
                <Badge variant={c.isActive ? "default" : "secondary"} className="mt-2">
                  {c.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))}
            {list.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                Nenhum cliente encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
