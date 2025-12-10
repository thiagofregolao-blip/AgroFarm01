import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from "react-native";
import { db } from "@db/schema";
import { setState, getState } from "@db/state";
import { updateVisitStatus } from "@db/operations";
import { manualTripStart, stopTracking } from "@geo/tripDetector";

export default function ActiveVisit() {
  const [visits, setVisits] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getState("active_visit_id"));

  useEffect(() => {
    loadVisits();
  }, []);

  function loadVisits() {
    const v = db.getAllSync(
      "SELECT id, client_id, window_start, status FROM visits ORDER BY window_start"
    );
    setVisits((v as any[]) || []);
  }

  function choose(id: string) {
    setActiveId(id);
    setState("active_visit_id", id);
  }

  async function startTrip() {
    if (!activeId) return;
    try {
      await manualTripStart(activeId);
      updateVisitStatus(activeId, "EM_DESLOCAMENTO");
      loadVisits();
    } catch (error) {
      console.error('Start trip error:', error);
    }
  }

  async function arrivedAtLocation() {
    if (!activeId) return;
    await stopTracking();
    updateVisitStatus(activeId, "NO_LOCAL");
    loadVisits();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rota do dia — selecione a visita ativa</Text>
      <FlatList
        data={visits}
        keyExtractor={(i: any) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => choose(item.id)}
            style={[
              styles.visitCard,
              activeId === item.id && styles.activeCard
            ]}
          >
            <Text style={styles.clientText}>{item.client_id} • {item.status}</Text>
            <Text style={styles.timeText}>
              {item.window_start ? new Date(item.window_start).toLocaleTimeString() : "sem janela"}
            </Text>
            {activeId === item.id && (
              <Text style={styles.activeText}>✓ VISITA ATIVA</Text>
            )}
          </TouchableOpacity>
        )}
      />
      
      {activeId && (
        <View style={styles.actions}>
          <Button title="Iniciar Viagem" onPress={startTrip} color="#1e90ff" />
          <Button title="Cheguei no Local" onPress={arrivedAtLocation} color="#22c55e" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 12,
    fontSize: 16,
  },
  visitCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
    borderRadius: 8,
  },
  activeCard: {
    borderColor: "#22c55e",
    backgroundColor: "#f0fdf4",
  },
  clientText: {
    fontSize: 14,
    fontWeight: "500",
  },
  timeText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  activeText: {
    color: "#22c55e",
    fontWeight: "bold",
    marginTop: 4,
  },
  actions: {
    marginTop: 16,
    gap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
