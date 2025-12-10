# 🔧 FIX LOGIN - Executar no Mac

## Problema Identificado
O Replit bloqueia acesso externo de dispositivos móveis. Solução: usar LocalTunnel.

---

## ✅ PASSO A PASSO COMPLETO

### 1️⃣ Atualizar client.ts

```bash
cd ~/Downloads/crm-agro-mobile/src/api

# Backup do arquivo original
cp client.ts client.ts.backup

# Criar novo client.ts
cat > client.ts << 'ENDOFFILE'
import axios from "axios";

export const API_BASE = "https://mighty-seas-mix.loca.lt";
console.log("API_BASE carregado:", API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export function attachAuthInterceptors(onUnauthorized: () => void) {
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.response?.status === 401) {
        onUnauthorized();
      }
      return Promise.reject(err);
    }
  );
}
ENDOFFILE

# Verificar se foi criado corretamente
cat client.ts
```

---

### 2️⃣ Atualizar DebugInfo.tsx

```bash
cd ~/Downloads/crm-agro-mobile/src

cat > DebugInfo.tsx << 'ENDOFFILE'
import { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { API_BASE, api } from "./api/client";

export function DebugInfo() {
  const [status, setStatus] = useState("Testando...");

  async function testConnection() {
    try {
      setStatus("Conectando...");
      const response = await api.get("/api/user");
      setStatus("CONECTADO! Status: " + response.status);
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido";
      const code = err.code || "N/A";
      const responseStatus = err.response?.status || "N/A";
      setStatus("ERRO: " + errorMsg + " | Code: " + code + " | HTTP: " + responseStatus);
      console.error("Connection test failed:", err);
    }
  }

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <View style={{ backgroundColor: "#fef3c7", padding: 8, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, color: "#92400e", fontWeight: "bold" }}>
        DEBUG v5.0 - {new Date().toLocaleTimeString()}
      </Text>
      <Text style={{ fontSize: 9, color: "#92400e" }}>
        API: {API_BASE}
      </Text>
      <Text style={{ fontSize: 9, color: "#92400e", marginTop: 4 }}>
        {status}
      </Text>
      <Button title="Testar Novamente" onPress={testConnection} color="#92400e" />
    </View>
  );
}
ENDOFFILE

# Verificar
cat DebugInfo.tsx
```

---

### 3️⃣ Rebuild Completo

```bash
cd ~/Downloads/crm-agro-mobile

# Limpar cache
rm -rf .expo node_modules/.cache

# Rebuild
npx expo run:android --clear
```

---

### 4️⃣ Enquanto compila: Liberar LocalTunnel

**No browser do emulador Android:**
1. Abra: `https://mighty-seas-mix.loca.lt`
2. Role até o final da página
3. Clique: **"Are you the developer?"**
4. Isso libera o acesso permanentemente

---

### 5️⃣ Testar Login

Depois do rebuild:
- Usuário: `bruno`
- Senha: `123`

---

## 🔍 Debug

**Se ainda falhar, me envie:**
1. Print da tela do app (deve mostrar DEBUG v5.0)
2. Mensagem de erro completa do terminal
3. O que aparece ao clicar em "Testar Novamente"

---

## ⚡ Atalho Rápido (Se já fez o rebuild antes)

```bash
cd ~/Downloads/crm-agro-mobile

# Apenas atualizar os arquivos e reload
# Execute os comandos cat > client.ts e cat > DebugInfo.tsx acima
# Depois no terminal do Expo, pressione: r
```
