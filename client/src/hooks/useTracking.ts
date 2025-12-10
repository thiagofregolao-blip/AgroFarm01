import { useEffect, useRef } from "react";
import { haversineDistance } from "@/utils/geo";
import { enqueue } from "@/hooks/useSync";
import { db } from "@/lib/crm/idb";
import { showNotification } from "@/utils/sw-register";

type Visit = {
  id: string;
  client_id: string;
  status: "PLANEJADA" | "PRONTA" | "EM_DESLOCAMENTO" | "NO_LOCAL" | "CONCLUIDA";
  window_start?: string | null;
};

type TrackingOptions = {
  onRequestOdometer?: (callback: (odometer: number) => void) => void;
  onTripStarted?: (markStarted: () => void) => void;
};

export function useTracking(userId: string, options?: TrackingOptions) {
  const watchId = useRef<number | null>(null);
  const activeVisitIdRef = useRef<string | null>(null);
  const activeFarmLatRef = useRef<number | null>(null);
  const activeFarmLngRef = useRef<number | null>(null);
  const inFarmRef = useRef(false);
  const inBaseRef = useRef(true);
  const tripStartedRef = useRef(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.error("GPS não disponível");
      return;
    }

    // Expõe função para marcar trip como iniciado (para início manual)
    if (options?.onTripStarted) {
      options.onTripStarted(() => {
        tripStartedRef.current = true;
      });
    }

    async function handlePosition(pos: GeolocationPosition) {
      const { latitude, longitude, speed } = pos.coords;

      // salva ponto no banco local
      await db.telemetry.add({
        trip_id: null,
        ts: new Date().toISOString(),
        lat: latitude,
        lng: longitude,
        speed_kmh: speed || 0,
        accuracy_m: pos.coords.accuracy
      });

      // pega visitas do dia
      const visits = await db.visits.toArray() as Visit[];
      if (!visits?.length) return;

      // pega configurações
      const settings = await db.settings.get("config");
      const geofenceBase = (settings?.value?.geofenceBase) || 200;
      const geofenceFarm = (settings?.value?.geofenceFarm) || 200;
      const baseLat = (settings?.value?.baseLat) || -25.516;
      const baseLng = (settings?.value?.baseLng) || -54.616;

      // verifica saída da base
      const distBase = haversineDistance(latitude, longitude, baseLat, baseLng);
      if (inBaseRef.current && distBase > geofenceBase && !tripStartedRef.current) {
        inBaseRef.current = false;
        console.log("🚗 Saiu da base! Solicitando quilometragem...");
        
        // Auto-iniciar primeira visita da agenda
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayVisits = visits.filter(v => {
          if (!v.window_start) return false;
          const visitDate = new Date(v.window_start);
          visitDate.setHours(0, 0, 0, 0);
          return visitDate.getTime() === today.getTime();
        });

        const firstPlanned = todayVisits
          .filter(v => v.status === 'PLANEJADA')
          .sort((a, b) => {
            const timeA = a.window_start ? new Date(a.window_start).getTime() : 0;
            const timeB = b.window_start ? new Date(b.window_start).getTime() : 0;
            return timeA - timeB;
          })[0];

        if (firstPlanned && options?.onRequestOdometer) {
          const clients = await db.clients.toArray();
          const client = clients.find(c => c.id === firstPlanned.client_id);
          const clientName = client?.name || firstPlanned.client_id;
          
          // Solicita quilometragem antes de iniciar
          options.onRequestOdometer(async (odometer: number) => {
            tripStartedRef.current = true;
            
            // Atualiza status local
            await db.visits.update(firstPlanned.id, { status: "EM_DESLOCAMENTO" });
            
            console.log(`🎯 Rota iniciada para ${clientName} - KM: ${odometer}`);
            
            showNotification("Rota Iniciada!", {
              body: `Indo para ${clientName}`,
              icon: "/icon-192.png",
              vibrate: [200, 100, 200],
            });
            
            // Envia para backend
            await enqueue("VISIT_CREATE", { 
              id: firstPlanned.id, 
              status: "EM_DESLOCAMENTO" 
            });
            
            // Inicia trip com quilometragem
            await enqueue("TRIP_START", { 
              visit_id: firstPlanned.id,
              ts: new Date().toISOString(), 
              lat: latitude, 
              lng: longitude,
              odometer: odometer
            });
          });
        } else if (!firstPlanned) {
          // Se não tem visita planejada, apenas marca que saiu da base
          tripStartedRef.current = true;
        }
      }

      // Ordena visitas por horário (agenda sequencial)
      const sortedVisits = visits
        .filter(v => v.status !== 'CONCLUIDA')
        .sort((a, b) => {
          const timeA = a.window_start ? new Date(a.window_start).getTime() : 0;
          const timeB = b.window_start ? new Date(b.window_start).getTime() : 0;
          return timeA - timeB;
        });

      // Monitora próxima visita OU visita ativa (NO_LOCAL)
      const nextVisit = sortedVisits.find(v => 
        v.status === 'EM_DESLOCAMENTO' || v.status === 'PLANEJADA' || v.status === 'NO_LOCAL'
      );

      if (nextVisit) {
        const farmLat = (nextVisit as any).lat;
        const farmLng = (nextVisit as any).lng;
        
        if (farmLat && farmLng) {
          const distFarm = haversineDistance(latitude, longitude, farmLat, farmLng);

          // entrada na fazenda (200m)
          if (!inFarmRef.current && distFarm < geofenceFarm && nextVisit.status !== 'NO_LOCAL') {
            inFarmRef.current = true;
            activeVisitIdRef.current = nextVisit.id;
            activeFarmLatRef.current = farmLat;
            activeFarmLngRef.current = farmLng;
            
            // Pega nome do cliente
            const clients = await db.clients.toArray();
            const client = clients.find(c => c.id === nextVisit.client_id);
            const clientName = client?.name || nextVisit.client_id;
            
            console.log(`📍 Chegou à fazenda ${clientName}`);
            
            showNotification(`Chegou em ${clientName}!`, {
              body: `Iniciando atendimento automaticamente`,
              icon: "/icon-192.png",
              vibrate: [200, 100, 200],
            });
            
            // Atualiza status local IMEDIATAMENTE
            await db.visits.update(nextVisit.id, { status: "NO_LOCAL" });
            
            // Envia para backend depois
            await enqueue("VISIT_CREATE", { 
              id: nextVisit.id, 
              status: "NO_LOCAL" 
            });
          }
        }
      }

      // saída da fazenda - verifica distância da fazenda ativa (independente de sortedVisits)
      if (inFarmRef.current && activeFarmLatRef.current && activeFarmLngRef.current) {
        const distFromActiveFarm = haversineDistance(
          latitude, 
          longitude, 
          activeFarmLatRef.current, 
          activeFarmLngRef.current
        );

        // Se distância > 400m da fazenda ativa, reseta tracking
        if (distFromActiveFarm > geofenceFarm * 2) {
          console.log(`✅ Saindo da fazenda - Preparando para próxima visita`);
          
          showNotification("Saindo da fazenda", {
            body: `Próxima visita será monitorada automaticamente`,
            icon: "/icon-192.png",
            vibrate: [200],
          });

          // RESETA tudo para permitir próxima visita
          inFarmRef.current = false;
          activeVisitIdRef.current = null;
          activeFarmLatRef.current = null;
          activeFarmLngRef.current = null;
        }
      }
    }

    // inicia o watcher
    watchId.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => console.error("Erro GPS", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    console.log("📡 Rastreamento iniciado");

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [userId]);
}
