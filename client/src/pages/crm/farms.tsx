import { useState, useEffect } from "react";
import { db } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Trash2 } from "lucide-react";

type Farm = {
  id: string;
  name: string;
  client_id?: string;
  lat?: number;
  lng?: number;
  address?: string;
  notes?: string;
};

type Field = {
  id: string;
  name: string;
  farm_id: string;
  area?: number;
  crop?: string;
  notes?: string;
};

type Client = {
  id: string;
  name: string;
};

export default function CRMFarms() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  const [farmForm, setFarmForm] = useState({ client_id: "", name: "", lat: "", lng: "", address: "", notes: "" });
  const [fieldForm, setFieldForm] = useState({ name: "", area: "", crop: "", notes: "" });

  useEffect(() => {
    loadFarms();
    loadClients();
  }, []);

  async function loadClients() {
    // Buscar do servidor e sincronizar com IndexedDB
    try {
      const response = await fetch('/api/clients', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const serverClients = await response.json();
        
        // Sincronizar com IndexedDB
        await db.clients.clear();
        for (const client of serverClients) {
          await db.clients.put(client);
        }
        
        setClients(serverClients);
      } else {
        // Se falhar, carrega do IndexedDB local
        const data = await db.clients.toArray();
        setClients(data as any);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      // Se falhar, carrega do IndexedDB local
      const data = await db.clients.toArray();
      setClients(data as any);
    }
  }

  useEffect(() => {
    if (selectedFarm) {
      loadFields(selectedFarm);
    }
  }, [selectedFarm]);

  async function loadFarms() {
    // Buscar do servidor e sincronizar com IndexedDB
    try {
      const response = await fetch('/api/farms', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const serverFarms = await response.json();
        
        // Sincronizar com IndexedDB
        await db.farms.clear();
        for (const farm of serverFarms) {
          await db.farms.put({
            id: farm.id,
            client_id: farm.clientId,
            name: farm.name,
            lat: farm.lat ? parseFloat(farm.lat) : undefined,
            lng: farm.lng ? parseFloat(farm.lng) : undefined,
            address: farm.address,
            notes: farm.notes,
          });
        }
        
        setFarms(serverFarms.map((f: any) => ({
          id: f.id,
          client_id: f.clientId,
          name: f.name,
          lat: f.lat ? parseFloat(f.lat) : undefined,
          lng: f.lng ? parseFloat(f.lng) : undefined,
          address: f.address,
          notes: f.notes,
        })));
      } else {
        // Se falhar, carrega do IndexedDB local
        const data = await db.farms.toArray();
        setFarms(data as any);
      }
    } catch (err) {
      console.error('Erro ao carregar fazendas:', err);
      // Se falhar, carrega do IndexedDB local
      const data = await db.farms.toArray();
      setFarms(data as any);
    }
  }

  async function loadFields(farmId: string) {
    const data = await db.fields.where("farm_id").equals(farmId).toArray();
    setFields(data as any);
  }

  async function handleAddFarm() {
    if (!farmForm.client_id) {
      alert('Selecione um cliente');
      return;
    }
    
    if (!farmForm.name) {
      alert('Nome da fazenda é obrigatório');
      return;
    }
    
    if (!farmForm.lat || !farmForm.lng) {
      alert('Coordenadas (Latitude e Longitude) são obrigatórias para o geofencing funcionar!');
      return;
    }

    const newFarm = {
      id: crypto.randomUUID(),
      client_id: farmForm.client_id,
      name: farmForm.name,
      lat: parseFloat(farmForm.lat),
      lng: parseFloat(farmForm.lng),
      address: farmForm.address,
      notes: farmForm.notes,
    };
    
    // Salvar localmente
    await db.farms.add(newFarm as any);
    
    // Sincronizar com servidor
    try {
      const payload = {
        name: newFarm.name,
        clientId: newFarm.client_id,
        lat: String(farmForm.lat),
        lng: String(farmForm.lng),
        address: farmForm.address || null,
        notes: farmForm.notes || null
      };
      
      console.log('📤 Enviando fazenda para servidor:', payload);
      
      const response = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Erro do servidor:', error);
        throw new Error(error);
      }
      
      console.log('✅ Fazenda sincronizada com sucesso');
    } catch (err) {
      console.error('❌ Erro ao sincronizar fazenda:', err);
      alert('Fazenda salva localmente, mas erro ao sincronizar com servidor');
    }
    
    setFarmForm({ client_id: "", name: "", lat: "", lng: "", address: "", notes: "" });
    setShowAddFarm(false);
    loadFarms();
  }

  async function handleDeleteFarm(farmId: string) {
    if (!confirm('Tem certeza que deseja excluir esta fazenda?')) return;
    
    await db.farms.delete(farmId);
    
    try {
      await fetch(`/api/farms/${farmId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Erro ao deletar fazenda do servidor:', err);
    }
    
    loadFarms();
    if (selectedFarm === farmId) {
      setSelectedFarm(null);
    }
  }

  async function handleAddField() {
    if (!selectedFarm) return;
    const newField = {
      id: crypto.randomUUID(),
      name: fieldForm.name,
      farm_id: selectedFarm,
      area: fieldForm.area ? parseFloat(fieldForm.area) : undefined,
      crop: fieldForm.crop,
      notes: fieldForm.notes,
    };
    await db.fields.add(newField as any);
    setFieldForm({ name: "", area: "", crop: "", notes: "" });
    setShowAddField(false);
    loadFields(selectedFarm);
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>🏡 Fazendas</CardTitle>
            <Button onClick={() => setShowAddFarm(!showAddFarm)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nova Fazenda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddFarm && (
            <div className="mb-4 p-4 border rounded space-y-3">
              <Select value={farmForm.client_id} onValueChange={(val) => setFarmForm({ ...farmForm, client_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                placeholder="Nome da fazenda"
                value={farmForm.name}
                onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Latitude"
                  type="number"
                  step="0.000001"
                  value={farmForm.lat}
                  onChange={(e) => setFarmForm({ ...farmForm, lat: e.target.value })}
                />
                <Input
                  placeholder="Longitude"
                  type="number"
                  step="0.000001"
                  value={farmForm.lng}
                  onChange={(e) => setFarmForm({ ...farmForm, lng: e.target.value })}
                />
              </div>
              <Input
                placeholder="Endereço"
                value={farmForm.address}
                onChange={(e) => setFarmForm({ ...farmForm, address: e.target.value })}
              />
              <Input
                placeholder="Observações"
                value={farmForm.notes}
                onChange={(e) => setFarmForm({ ...farmForm, notes: e.target.value })}
              />
              <Button onClick={handleAddFarm} className="w-full">Salvar Fazenda</Button>
            </div>
          )}

          <div className="space-y-2">
            {farms.map((farm) => {
              const client = clients.find(c => c.id === farm.client_id);
              return (
              <div
                key={farm.id}
                className={`p-3 border rounded ${
                  selectedFarm === farm.id ? "border-green-600 bg-green-50 dark:bg-green-950" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedFarm(farm.id)}>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{farm.name}</h4>
                    {client && <p className="text-sm text-gray-600 dark:text-gray-400">Cliente: {client.name}</p>}
                    {farm.address && <p className="text-sm text-gray-600 dark:text-gray-400">{farm.address}</p>}
                    {farm.lat && farm.lng && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {farm.lat}, {farm.lng}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFarm(farm.id);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedFarm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>🌾 Talhões</CardTitle>
              <Button onClick={() => setShowAddField(!showAddField)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Talhão
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddField && (
              <div className="mb-4 p-4 border rounded space-y-3">
                <Input
                  placeholder="Nome do talhão"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                />
                <Input
                  placeholder="Área (hectares)"
                  type="number"
                  step="0.01"
                  value={fieldForm.area}
                  onChange={(e) => setFieldForm({ ...fieldForm, area: e.target.value })}
                />
                <Input
                  placeholder="Cultura"
                  value={fieldForm.crop}
                  onChange={(e) => setFieldForm({ ...fieldForm, crop: e.target.value })}
                />
                <Input
                  placeholder="Observações"
                  value={fieldForm.notes}
                  onChange={(e) => setFieldForm({ ...fieldForm, notes: e.target.value })}
                />
                <Button onClick={handleAddField} className="w-full">Salvar Talhão</Button>
              </div>
            )}

            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.id} className="p-3 border rounded">
                  <h5 className="font-medium">{field.name}</h5>
                  <div className="text-sm text-gray-600 mt-1">
                    {field.area && <span>{field.area} ha</span>}
                    {field.crop && <span> • {field.crop}</span>}
                  </div>
                  {field.notes && <p className="text-sm mt-1">{field.notes}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
