import React, { useState } from "react";
import { View, Text, Button, ScrollView, Alert } from "react-native";
import { syncNow } from "@sync/sync";
import ActiveVisit from "../visits/ActiveVisit";
import RouteMap from "../visits/RouteMap";

export default function HomeScreen() {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    const result = await syncNow();
    setSyncing(false);
    
    if (result.success) {
      Alert.alert("Sincronizado", `${result.synced} visitas atualizadas`);
    } else {
      Alert.alert("Erro", "Falha na sincronização");
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Button 
        title={syncing ? "Sincronizando..." : "SINCRONIZAR AGORA"} 
        color="#22c55e" 
        onPress={handleSync}
        disabled={syncing}
      />

      <Text style={{ fontWeight: "bold", marginTop: 8 }}>Rota do dia — selecione a visita ativa</Text>
      
      <View style={{ height: 360 }}>
        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Mapa da Rota</Text>
        <View style={{ height: 300, borderWidth: 1, borderColor: "#eee", borderRadius: 8, overflow: "hidden" }}>
          <RouteMap />
        </View>
      </View>

      <ActiveVisit />
    </ScrollView>
  );
}
