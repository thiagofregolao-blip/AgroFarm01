import React, { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@api/client";

type Client = { 
  id: string; 
  name: string; 
  cluster?: string | null; 
  priority?: string | null; 
  active: boolean 
};

export default function ClientsScreen() {
  const [q, setQ] = useState("");

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => {
      const { data } = await api.get<Client[]>("/api/clients");
      return data;
    }
  });

  const list = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter(c => c.name.toLowerCase().includes(s));
  }, [data, q]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontWeight: "bold", fontSize: 16 }}>Clientes</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar cliente..."
          style={{ 
            borderWidth: 1, 
            borderColor: "#ddd", 
            borderRadius: 8, 
            padding: 10, 
            marginTop: 8 
          }}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
            <Text style={{ fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: "#666" }}>
              {item.cluster ? `Cluster: ${item.cluster}  • ` : ""}{item.priority ? `Prioridade: ${item.priority}` : ""}
            </Text>
            <Text style={{ color: item.active ? "#22c55e" : "#c00" }}>
              {item.active ? "Ativo" : "Inativo"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
