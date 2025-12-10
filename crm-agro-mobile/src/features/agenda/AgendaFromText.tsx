import React, { useState } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from "react-native";
import { api } from "@api/client";

export default function AgendaFromText() {
  const [text, setText] = useState("amanhã: João Pereira inspeção 08:00; Maria Lopes amostra 10:30 (obs: prioridade)");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function parse() {
    try {
      setLoading(true);
      const { data } = await api.post("/api/agenda/parse", { text });
      setItems(data.items || []);
    } catch (error) {
      Alert.alert("Erro", "Falha ao analisar texto");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    const validItems = items.filter(i => i.client_id);
    
    if (!validItems.length) {
      Alert.alert("Aviso", "Nenhuma visita válida para confirmar");
      return;
    }

    try {
      setLoading(true);
      
      const payload = validItems.map(i => ({
        client_id: i.client_id,
        intent: i.intent,
        date: i.date,
        time: i.time,
        notes: i.notes,
        priority: i.priority
      }));
      
      await api.post("/api/agenda/confirm", { items: payload });
      Alert.alert("Sucesso", `${payload.length} visitas criadas!`);
      setItems([]);
      setText("");
    } catch (error) {
      Alert.alert("Erro", "Falha ao criar visitas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gerar agenda por texto</Text>
      
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Digite aqui... Ex: amanhã João Silva inspeção 08:00"
        multiline
        style={styles.input}
      />
      
      <Button
        title={loading ? "Analisando..." : "Analisar"}
        onPress={parse}
        disabled={loading}
        color="#22c55e"
      />
      
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[
            styles.itemCard,
            !item.client_id && styles.itemCardError
          ]}>
            <Text style={styles.itemClient}>
              Cliente: {item.client_name} {item.client_id ? "✅" : "❌ não encontrado"}
            </Text>
            <Text style={styles.itemDetail}>Intent: {item.intent || "-"}</Text>
            <Text style={styles.itemDetail}>Dia/Hora: {item.date} {item.time || ""}</Text>
            {item.notes ? <Text style={styles.itemDetail}>Obs: {item.notes}</Text> : null}
            <Text style={styles.itemDetail}>Prioridade: {item.priority || "normal"}</Text>
          </View>
        )}
      />
      
      {items.length > 0 && (
        <Button
          title={loading ? "Criando..." : `Confirmar e criar ${items.filter(i => i.client_id).length} visitas`}
          onPress={confirm}
          disabled={loading}
          color="#22c55e"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    textAlignVertical: "top",
  },
  itemCard: {
    padding: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginVertical: 4,
  },
  itemCardError: {
    backgroundColor: "#fee2e2",
  },
  itemClient: {
    fontWeight: "500",
  },
  itemDetail: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
