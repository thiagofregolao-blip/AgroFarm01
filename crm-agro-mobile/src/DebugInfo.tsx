import { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { API_BASE, api } from "@api/client";

export function DebugInfo() {
  const [status, setStatus] = useState("Testando...");

  async function testConnection() {
    try {
      setStatus("Conectando...");
      const response = await api.get("/api/user");
      setStatus(`✅ Conectado! Status: ${response.status}`);
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido";
      const code = err.code || "N/A";
      const responseStatus = err.response?.status || "N/A";
      setStatus(`❌ Erro: ${errorMsg} | Code: ${code} | HTTP: ${responseStatus}`);
      console.error("Connection test failed:", err);
    }
  }

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <View style={{ backgroundColor: '#fef3c7', padding: 8, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, color: '#92400e', fontWeight: 'bold' }}>
        🔍 DEBUG v4.0 - {new Date().toLocaleTimeString()}
      </Text>
      <Text style={{ fontSize: 9, color: '#92400e' }}>
        API: {API_BASE}
      </Text>
      <Text style={{ fontSize: 9, color: '#92400e', marginTop: 4 }}>
        {status}
      </Text>
      <Button title="Testar Novamente" onPress={testConnection} color="#92400e" />
    </View>
  );
}
