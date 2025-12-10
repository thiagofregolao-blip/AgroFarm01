import React, { useState } from "react";
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useAuth } from "./AuthContext";
import { DebugInfo } from "../DebugInfo";

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setErr(null);
    try {
      await login(username.trim(), password);
    } catch (e: any) {
      const errorMsg = e?.message || e?.response?.data?.error || "Falha no login";
      setErr(errorMsg);
      console.error("Login error:", e);
      Alert.alert("Erro de Login", errorMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CRM Agro Mobile</Text>
      <Text style={styles.subtitle}>Entrar v3.0</Text>
      
      <DebugInfo />
      
      <TextInput
        placeholder="Usuário"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />
      
      <TextInput
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      
      {err ? <Text style={styles.error}>{err}</Text> : null}
      
      <Button
        title={busy ? "Entrando..." : "Entrar"}
        onPress={onSubmit}
        disabled={busy || loading}
        color="#22c55e"
      />
      
      {(busy || loading) && <ActivityIndicator style={styles.loader} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#22c55e",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  error: {
    color: "#ef4444",
    marginBottom: 12,
  },
  loader: {
    marginTop: 12,
  },
});
