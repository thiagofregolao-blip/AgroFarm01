import { useState, useEffect } from "react";
import { db } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = {
  geofenceBase: number;
  geofenceFarm: number;
  gpsInterval: number;
  baseLat: number | string;
  baseLng: number | string;
};

const DEFAULTS: Settings = {
  geofenceBase: 200,
  geofenceFarm: 200,
  gpsInterval: 10000,
  baseLat: -25.516,
  baseLng: -54.616,
};

export default function CRMSettings() {
  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const config = await db.settings.get("config");
      if (config?.value) {
        setForm(config.value);
      }
    })();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === "baseLat" || name === "baseLng") {
      // Para campos de coordenadas, aceita string e converte só ao salvar
      setForm((f) => ({ ...f, [name]: value === "" ? "" : parseFloat(value) || value }));
    } else {
      // Para outros campos numéricos
      const parsed = value === "" ? 0 : parseFloat(value);
      setForm((f) => ({ ...f, [name]: isNaN(parsed) ? 0 : parsed }));
    }
  }

  async function handleSave() {
    // Converte coordenadas de string para número ao salvar
    const toSave = {
      ...form,
      baseLat: typeof form.baseLat === "string" ? parseFloat(form.baseLat) || 0 : form.baseLat,
      baseLng: typeof form.baseLng === "string" ? parseFloat(form.baseLng) || 0 : form.baseLng
    };
    await db.settings.put({ key: "config", value: toSave });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Configurações de Rastreamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-2 font-medium text-sm">Raio da Base (metros)</label>
            <Input
              type="number"
              name="geofenceBase"
              value={form.geofenceBase}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Raio da Fazenda (metros)</label>
            <Input
              type="number"
              name="geofenceFarm"
              value={form.geofenceFarm}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Intervalo GPS (ms)</label>
            <Input
              type="number"
              name="gpsInterval"
              value={form.gpsInterval}
              onChange={handleChange}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">📍 Coordenadas da Base</h3>
            
            <div className="mb-3">
              <label className="block mb-2 font-medium text-sm">Latitude</label>
              <Input
                type="text"
                name="baseLat"
                value={form.baseLat}
                onChange={handleChange}
                placeholder="Ex: -25.516"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm">Longitude</label>
              <Input
                type="text"
                name="baseLng"
                value={form.baseLng}
                onChange={handleChange}
                placeholder="Ex: -54.616"
              />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">
            {saved ? "✅ Salvo!" : "💾 Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
