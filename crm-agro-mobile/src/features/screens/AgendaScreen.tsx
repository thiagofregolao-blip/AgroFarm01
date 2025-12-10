import React, { useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@api/client";
import AgendaFromText from "../agenda/AgendaFromText";

type Visit = {
  id: string; 
  client_id: string; 
  status: string;
  window_start?: string | null; 
  notes?: string | null;
};

const STATUS = ["PLANEJADA","PRONTA","EM_DESLOCAMENTO","NO_LOCAL","CONCLUIDA"] as const;

export default function AgendaScreen() {
  const [filter, setFilter] = useState<typeof STATUS[number] | "TODAS">("TODAS");

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["visits", "agenda"],
    queryFn: async () => {
      const { data } = await api.get<Visit[]>("/api/visits");
      return data;
    }
  });

  const visits = data || [];
  const filtered = useMemo(
    () => filter === "TODAS" ? visits : visits.filter(v => v.status === filter),
    [visits, filter]
  );

  return (
    <FlatList
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontWeight: "bold", fontSize: 16 }}>Agenda</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["TODAS", ...STATUS] as const).map(s => (
              <TouchableOpacity 
                key={s} 
                onPress={() => setFilter(s)}
                style={{ 
                  paddingVertical: 6, 
                  paddingHorizontal: 10, 
                  borderWidth: 1, 
                  borderColor: filter===s?"#22c55e":"#ddd", 
                  borderRadius: 999 
                }}
              >
                <Text style={{ color: filter===s?"#22c55e":"#444" }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      data={filtered}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "600" }}>{item.client_id}</Text>
          <Text style={{ color: "#666" }}>
            {item.window_start ? new Date(item.window_start).toLocaleString() : "sem horário"}
          </Text>
          <Text style={{ color: "#22c55e", fontWeight: "600" }}>{item.status}</Text>
          {item.notes ? <Text style={{ color: "#555" }}>{item.notes}</Text> : null}
        </View>
      )}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      ListFooterComponent={
        <View style={{ padding: 16 }}>
          <AgendaFromText />
        </View>
      }
    />
  );
}
