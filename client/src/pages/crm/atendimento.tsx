import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { db } from "@/lib/crm/idb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OdometerDialog } from "@/components/OdometerDialog";

type Photo = {
  id: string;
  url: string;
  description: string;
  timestamp: Date;
};

export default function Atendimento() {
  const [, params] = useRoute("/crm/atendimento/:visitId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [visitId] = useState(params?.visitId || "");
  const [clientName, setClientName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentDescription, setCurrentDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOdometerDialog, setShowOdometerDialog] = useState(false);

  useEffect(() => {
    (async () => {
      if (!visitId) return;
      
      const visit = await db.visits.get(visitId);
      if (!visit) return;

      const client = await db.clients.get(visit.client_id);
      setClientName(client?.name || visit.client_id);

      if (visit.farm_id) {
        const farm = await db.farms.get(visit.farm_id);
        setFarmName(farm?.name || "");
      }

      // Extrai tipo de serviço das notas
      const service = visit.notes?.split(' - ')[0] || 'Atendimento';
      setServiceType(service);
    })();
  }, [visitId]);

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const photo: Photo = {
        id: `photo-${Date.now()}`,
        url: evt.target?.result as string,
        description: currentDescription,
        timestamp: new Date(),
      };
      setPhotos([...photos, photo]);
      setCurrentDescription("");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(photoId: string) {
    setPhotos(photos.filter(p => p.id !== photoId));
  }

  function updatePhotoDescription(photoId: string, description: string) {
    setPhotos(photos.map(p => 
      p.id === photoId ? { ...p, description } : p
    ));
  }

  async function iniciarConclusao() {
    if (photos.length === 0) {
      toast({
        title: "Adicione pelo menos uma foto",
        description: "Registre o atendimento com fotos",
        variant: "destructive"
      });
      return;
    }

    // Solicita quilometragem final antes de concluir
    setShowOdometerDialog(true);
  }

  async function concluirAtendimento(odometerFinal: number) {
    setLoading(true);

    try {
      // Prepara fotos
      const photoData = photos.map(p => ({
        url: p.url,
        description: p.description,
        timestamp: p.timestamp.toISOString(),
      }));

      // Atualiza visita como concluída COM FOTOS
      await db.visits.update(visitId, { 
        status: "CONCLUIDA",
        notes: `${serviceType} - ${photos.length} foto(s) anexada(s)`,
        photos: photoData
      });

      // Salva no outbox para sync
      await db.outbox.add({
        type: "VISIT_CREATE",
        payload: {
          id: visitId,
          status: "CONCLUIDA",
          photos: photoData,
        },
        created_at: Date.now(),
        attempts: 0,
      });

      // Finaliza trip com quilometragem final
      await db.outbox.add({
        type: "TRIP_END",
        payload: {
          visit_id: visitId,
          odometer: odometerFinal,
        },
        created_at: Date.now(),
        attempts: 0,
      });

      toast({
        title: "Atendimento concluído!",
        description: `${clientName} - ${photos.length} foto(s) salva(s)`,
      });

      // Volta para home
      setLocation("/crm/home");
    } catch (err) {
      console.error("Erro ao concluir:", err);
      toast({
        title: "Erro",
        description: "Não foi possível concluir o atendimento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Atendimento em Andamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-semibold">{clientName}</p>
          </div>
          {farmName && (
            <div>
              <p className="text-sm text-muted-foreground">Fazenda</p>
              <p className="font-semibold">{farmName}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Serviço</p>
            <p className="font-semibold">{serviceType}</p>
          </div>
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fotos do Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Upload Button */}
          <div>
            <label htmlFor="photo-upload" className="block">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 transition-colors">
                <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Toque para adicionar foto
                </p>
              </div>
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
              data-testid="input-photo-upload"
            />
          </div>

          {/* Descrição da próxima foto */}
          <Textarea
            value={currentDescription}
            onChange={(e) => setCurrentDescription(e.target.value)}
            placeholder="Descrição da próxima foto..."
            rows={2}
            data-testid="input-photo-description"
          />

          {/* Lista de Fotos */}
          <div className="space-y-3">
            {photos.map((photo) => (
              <div key={photo.id} className="border rounded-lg p-3 bg-white dark:bg-gray-900">
                <div className="flex gap-3">
                  <img 
                    src={photo.url} 
                    alt="Foto do atendimento"
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <Textarea
                      value={photo.description}
                      onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                      placeholder="Adicione uma descrição..."
                      rows={2}
                      className="mb-2"
                      data-testid={`input-description-${photo.id}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      {photo.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePhoto(photo.id)}
                    data-testid={`button-remove-${photo.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Botão Concluir */}
      <Button
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
        onClick={iniciarConclusao}
        disabled={loading || photos.length === 0}
        data-testid="button-complete-visit"
      >
        <Check className="h-5 w-5 mr-2" />
        Concluir Atendimento ({photos.length} foto{photos.length !== 1 ? 's' : ''})
      </Button>

      {/* Diálogo de Quilometragem Final */}
      <OdometerDialog
        open={showOdometerDialog}
        title="Quilometragem Final"
        description="Digite a quilometragem atual do veículo para finalizar o atendimento"
        onConfirm={(odometer) => {
          setShowOdometerDialog(false);
          concluirAtendimento(odometer);
        }}
        onCancel={() => {
          setShowOdometerDialog(false);
          setLoading(false);
        }}
      />
    </div>
  );
}
