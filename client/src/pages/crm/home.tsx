import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useSync } from "@/hooks/useSync";
import { useTracking } from "@/hooks/useTracking";
import { db, VisitLocal } from "@/lib/crm/idb";
import { Camera, MapPin, Clock, ChevronRight, Play, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { OdometerDialog } from "@/components/OdometerDialog";

type FeedItem = {
  id: string;
  type: "visit" | "photo" | "checklist";
  userName: string;
  clientName: string;
  farmName?: string;
  description: string;
  timestamp: Date;
  photos?: { url: string; description: string; timestamp: string; }[];
  status?: string;
};

type AgendaVisit = {
  id: string;
  order: number;
  clientName: string;
  farmName?: string;
  scheduledTime: string;
  status: string;
  serviceType: string;
};

export default function CRMHome() {
  const [, setLocation] = useLocation();
  const { syncing, syncNow } = useSync();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [agendaVisits, setAgendaVisits] = useState<AgendaVisit[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("Consultor");
  const redirectedRef = useRef(false);
  const [showOdometer, setShowOdometer] = useState(false);
  const odometerCallbackRef = useRef<((odometer: number) => void) | null>(null);
  const markTripStartedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("crm_user");
    if (stored) {
      const user = JSON.parse(stored);
      setUserId(user.id);
      setUserName(user.name || "Consultor");
    }
  }, []);

  // Auto-redirecionar para atendimento quando visita ficar NO_LOCAL
  useEffect(() => {
    const interval = setInterval(async () => {
      if (redirectedRef.current) return;

      const visits = await db.visits.toArray();
      const visitaNoLocal = visits.find(v => v.status === 'NO_LOCAL');
      
      if (visitaNoLocal) {
        redirectedRef.current = true;
        setLocation(`/crm/atendimento/${visitaNoLocal.id}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [setLocation]);

  // Função para recarregar agenda
  async function loadAgenda() {
    try {
      // SEMPRE carrega clientes do servidor para ter dados atualizados
      let clients: any[] = [];
      try {
        const res = await fetch("/api/clients", { credentials: "include" });
        if (res.ok) {
          clients = await res.json();
          await db.clients.bulkPut(clients);
        }
      } catch (err) {
        clients = await db.clients.toArray();
      }
      
      // Carrega visitas
      let visits = await db.visits.toArray();
      const farms = await db.farms.toArray();
      
      // Filter upcoming visits for agenda (todas as visitas com data futura)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingVisits = visits.filter(v => {
        if (!v.window_start) return false;
        const visitDate = new Date(v.window_start);
        visitDate.setHours(0, 0, 0, 0);
        return visitDate >= today;
      });

      // Sort by scheduled time and create agenda
      upcomingVisits.sort((a, b) => {
        const timeA = a.window_start ? new Date(a.window_start).getTime() : 0;
        const timeB = b.window_start ? new Date(b.window_start).getTime() : 0;
        return timeA - timeB;
      });

      const agenda: AgendaVisit[] = upcomingVisits.map((v, index) => {
        const clientId = v.client_id || (v as any).clientId;
        const client = clients.find(c => c.id === clientId);
        
        const farmId = v.farm_id || (v as any).farmId;
        const farm = farmId ? farms.find(f => f.id === farmId) : null;
        
        let scheduledTime = '00:00';
        if (v.window_start) {
          const visitDate = new Date(v.window_start);
          const dateLabel = visitDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const timeLabel = visitDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          scheduledTime = `${dateLabel} ${timeLabel}`;
        }
        
        return {
          id: v.id,
          order: index + 1,
          clientName: client?.name || clientId,
          farmName: farm?.name,
          scheduledTime: scheduledTime,
          status: v.status,
          serviceType: v.notes?.split(' - ')[0] || 'Visita',
        };
      });

      setAgendaVisits(agenda);
      
      // Create feed items from completed visits
      const items: FeedItem[] = [];
      
      for (const visit of visits.filter(v => v.status === 'CONCLUIDA').slice(0, 20)) {
        const client = clients.find(c => c.id === visit.client_id);
        const farm = visit.farm_id ? farms.find(f => f.id === visit.farm_id) : null;
        
        items.push({
          id: visit.id,
          type: "visit",
          userName: userName || "Consultor",
          clientName: client?.name || visit.client_id,
          farmName: farm?.name || undefined,
          description: visit.notes || `Visita ${visit.status}`,
          timestamp: visit.window_start ? new Date(visit.window_start) : new Date(),
          photos: visit.photos || [],
          status: visit.status,
        });
      }
      
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setFeedItems(items);
    } catch (err) {
      console.error("Erro ao carregar agenda:", err);
    }
  }

  // Carrega agenda quando monta OU quando evento dispara (de Agenda)
  useEffect(() => {
    loadAgenda();

    const handleVisitsChanged = () => {
      loadAgenda();
    };
    
    window.addEventListener('visitsChanged', handleVisitsChanged);
    return () => window.removeEventListener('visitsChanged', handleVisitsChanged);
  }, []);

  async function startVisit(visitId: string) {
    // Solicitar quilometragem antes de iniciar
    odometerCallbackRef.current = async (odometer: number) => {
      await db.visits.update(visitId, { status: 'EM_DESLOCAMENTO' });
      
      // Pegar dados da visita
      const visit = await db.visits.get(visitId);
      if (visit) {
        const { enqueue } = await import("@/hooks/useSync");
        
        // Enqueue status change
        await enqueue("VISIT_CREATE", { 
          id: visitId, 
          status: "EM_DESLOCAMENTO" 
        });
        
        // Enqueue trip start com quilometragem
        await enqueue("TRIP_START", { 
          visit_id: visitId,
          ts: new Date().toISOString(), 
          odometer: odometer
        });
      }
      
      // Marcar trip como iniciado para prevenir disparo automático
      if (markTripStartedRef.current) {
        markTripStartedRef.current();
      }
      
      // Trigger re-render
      syncNow();
    };
    setShowOdometer(true);
  }

  useTracking(userId, {
    onRequestOdometer: (callback) => {
      odometerCallbackRef.current = callback;
      setShowOdometer(true);
    },
    onTripStarted: (markStarted) => {
      markTripStartedRef.current = markStarted;
    }
  });

  const statusColors = {
    'PLANEJADA': 'bg-blue-500',
    'PRONTA': 'bg-purple-500',
    'EM_DESLOCAMENTO': 'bg-orange-500',
    'NO_LOCAL': 'bg-yellow-500',
    'CONCLUIDA': 'bg-green-500',
  };

  async function deleteVisit(visitId: string) {
    if (!confirm("Tem certeza que deseja apagar esta visita?")) return;
    
    try {
      await db.visits.delete(visitId);
      // Remove da agenda local
      setAgendaVisits(prev => prev.filter(v => v.id !== visitId));
      console.log("✅ Visita apagada:", visitId);
    } catch (err) {
      console.error("❌ Erro ao apagar visita:", err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sync Banner */}
      <div className="sticky top-0 z-20 bg-green-600 dark:bg-green-700 text-white p-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">📡 GPS ativo</span>
          <button 
            onClick={syncNow}
            disabled={syncing}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            data-testid="button-sync-now"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Agenda Fixa */}
      <div className="sticky top-14 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">📅 Próximas Visitas</h2>
          
          {agendaVisits.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 py-2">Nenhuma visita agendada</p>
          ) : (
            <div className="space-y-2">
              {agendaVisits.map((visit, index) => {
                const isNext = index === 0 && (visit.status === 'PLANEJADA' || visit.status === 'EM_DESLOCAMENTO');
                return (
                <div 
                  key={visit.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isNext 
                      ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-950/30 shadow-sm' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                  data-testid={`agenda-visit-${visit.id}`}
                >
                  {/* Order Number */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${
                    isNext ? 'bg-green-600 dark:bg-green-600 ring-2 ring-green-300' : 'bg-green-600 dark:bg-green-700'
                  } text-white flex items-center justify-center text-xs font-bold`}>
                    {visit.order}
                  </div>
                  
                  {/* Status Indicator */}
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full ${statusColors[visit.status as keyof typeof statusColors] || 'bg-gray-400'}`} />
                  
                  {/* Visit Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {visit.clientName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>{visit.scheduledTime}</span>
                      {visit.farmName && (
                        <>
                          <span>•</span>
                          <span className="truncate">{visit.farmName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {visit.status === 'PLANEJADA' && (
                      <>
                        {visit.farmName ? (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => startVisit(visit.id)}
                            data-testid={`button-start-${visit.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-red-600 dark:text-red-400">Sem local</span>
                        )}
                      </>
                    )}
                    {visit.status === 'EM_DESLOCAMENTO' && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">Em rota</span>
                    )}
                    {visit.status === 'NO_LOCAL' && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">No local</span>
                    )}
                    {visit.status === 'CONCLUIDA' && (
                      <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                    )}
                    
                    {/* Delete Button */}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteVisit(visit.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      data-testid={`button-delete-visit-${visit.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Feed de Histórico */}
      <div className="max-w-2xl mx-auto">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">📸 Histórico de Atendimentos</h3>
        </div>
        
        {feedItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Nenhum atendimento concluído</p>
            <p className="text-sm mt-2">Seus atendimentos finalizados aparecerão aqui</p>
          </div>
        ) : (
          feedItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 mb-0"
              data-testid={`feed-item-${item.id}`}
            >
              {/* Header */}
              <div className="p-3 flex items-center gap-3">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.userName)}`}
                  alt={item.userName}
                  className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {item.clientName}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{item.farmName || 'Sem fazenda'}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: ptBR })}
                </span>
              </div>

              {/* Galeria de Fotos (Instagram style) */}
              {item.photos && item.photos.length > 0 && (
                <div className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                  <div className="flex">
                    {item.photos.map((photo, idx) => (
                      <div key={idx} className="flex-shrink-0 w-full snap-center">
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                          <img 
                            src={photo.url} 
                            alt={photo.description || "Foto do atendimento"} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {photo.description && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-800/50">
                            <p className="text-sm text-gray-700 dark:text-gray-300">{photo.description}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {item.photos.length > 1 && (
                    <div className="flex justify-center gap-1 p-2">
                      {item.photos.map((_, idx) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-3">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {item.description}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  {item.timestamp.toLocaleDateString('pt-BR')} às {item.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Diálogo de Quilometragem */}
      <OdometerDialog
        open={showOdometer}
        title="Quilometragem Inicial"
        description="Digite a quilometragem do veículo para iniciar a rota"
        onConfirm={(odometer) => {
          if (odometerCallbackRef.current) {
            odometerCallbackRef.current(odometer);
            odometerCallbackRef.current = null;
          }
          setShowOdometer(false);
        }}
        onCancel={() => {
          setShowOdometer(false);
          odometerCallbackRef.current = null;
        }}
      />
    </div>
  );
}
