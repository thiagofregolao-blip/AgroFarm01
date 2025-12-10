import React, { useMemo } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@api/client";

type Visit = { 
  id: string; 
  client_id: string; 
  status: string; 
  window_start?: string | null; 
  notes?: string | null 
};

export default function HistoryScreen() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["visits", "history"],
    queryFn: async () => {
      const { data } = await api.get<Visit[]>("/api/visits");
      return data;
    }
  });

  const concluded = useMemo(
    () => (data || []).filter(v => v.status === "CONCLUIDA").sort((a,b) =>
      (new Date(b.window_start || 0).getTime() - new Date(a.window_start || 0).getTime())
    ),
    [data]
  );

  return (
    <FlatList
      data={concluded}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "600" }}>{item.client_id}</Text>
          <Text style={{ color: "#666" }}>
            {item.window_start ? new Date(item.window_start).toLocaleString() : "—"}
          </Text>
          {item.notes ? <Text style={{ color: "#555" }}>{item.notes}</Text> : null}
        </View>
      )}
      ListEmptyComponent={
        <View style={{ padding: 16 }}>
          <Text>Nenhuma visita concluída ainda.</Text>
        </View>
      }
    />
  );
}
