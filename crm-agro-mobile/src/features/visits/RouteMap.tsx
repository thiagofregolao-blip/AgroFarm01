import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { api } from "@api/client";
import { useAuth } from "@auth/AuthContext";

const BASE = { lat: -25.3, lng: -57.6 };

function haversine(a: {lat:number,lng:number}, b: {lat:number,lng:number}) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s1 = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

function statusColor(status?: string) {
  switch(status) {
    case "PLANEJADA": return "#9aa0a6";
    case "PRONTA": return "#1e90ff";
    case "EM_DESLOCAMENTO": return "#ff8c00";
    case "NO_LOCAL": return "#34a853";
    case "CONCLUIDA": return "#6f42c1";
    default: return "#9aa0a6";
  }
}

export default function RouteMap() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoute();
  }, []);

  async function loadRoute() {
    try {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await api.get("/api/visits/route", {
        params: { date: today, assignee: user?.username }
      });
      const filtered = (data || []).filter((v: any) => v.lat && v.lng);
      setVisits(filtered);
    } catch (error) {
      console.error('Load route error:', error);
    } finally {
      setLoading(false);
    }
  }

  const ordered = useMemo(() => {
    const withScore = visits.map((v: any) => {
      const timeScore = v.window_start ? new Date(v.window_start).getTime() : Number.MAX_SAFE_INTEGER;
      const dist = haversine(BASE, { lat: v.lat, lng: v.lng });
      return { ...v, _time: timeScore, _dist: dist };
    });
    withScore.sort((a: any, b: any) => (a._time - b._time) || (a._dist - b._dist));
    return withScore;
  }, [visits]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando rota...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>🗺️ Mapa temporariamente desabilitado</Text>
        <Text style={styles.mapSubtext}>Rota otimizada por horário e distância</Text>
      </View>
      
      <FlatList
        data={ordered}
        keyExtractor={(i: any) => i.id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.headerText}>📍 Base → {ordered.length} visitas</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.visitItem}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
            <View style={styles.visitContent}>
              <Text style={styles.visitNumber}>
                {index + 1}. {item.client_id}
              </Text>
              <Text style={styles.visitStatus}>{item.status}</Text>
              <Text style={styles.visitTime}>
                {item.window_start ? new Date(item.window_start).toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : "sem horário"}
              </Text>
              <Text style={styles.visitDistance}>~{item._dist.toFixed(1)} km da base</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma visita agendada para hoje</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: "#f0f9ff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    margin: 16,
  },
  mapText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0369a1",
  },
  mapSubtext: {
    fontSize: 12,
    color: "#0284c7",
    marginTop: 4,
  },
  loadingText: {
    textAlign: "center",
    padding: 20,
    color: "#666",
  },
  listHeader: {
    padding: 12,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  visitItem: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  visitContent: {
    flex: 1,
  },
  visitNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  visitStatus: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  visitTime: {
    fontSize: 12,
    color: "#0284c7",
    marginTop: 4,
  },
  visitDistance: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
  },
});
