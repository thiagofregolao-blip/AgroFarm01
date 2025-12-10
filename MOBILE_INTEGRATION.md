# 📱 Integração Mobile - CRM Agro

Este documento descreve como integrar o app mobile Android (`crm-agro-mobile`) com o backend existente.

## 🏗️ Arquitetura

O app mobile usa **offline-first architecture** com:

- **SQLite local** para armazenamento persistente
- **Outbox pattern** para sincronização confiável
- **Delta-sync** incremental usando timestamps `updatedAt`
- **Cookie-based auth** compartilhada com web app
- **Geofencing** para detecção automática de viagens
- **GPS tracking** com telemetria em batch

## ✅ Backend já implementado

Todos os endpoints necessários já estão implementados:

### Autenticação
- ✅ `POST /api/login` - Retorna cookie de sessão
- ✅ `GET /api/user` - Dados do usuário logado  
- ✅ `POST /api/logout` - Encerra sessão

### Visitas e CRM
- ✅ `GET /api/visits?updated_since=ISO` - Delta-sync de visitas
- ✅ `GET /api/visits/route?date=YYYY-MM-DD&assignee=username` - Rota otimizada
- ✅ `PATCH /api/visits/:id/status` - Atualiza status da visita

### Viagens e GPS
- ✅ `POST /api/trips/start` - Inicia viagem
- ✅ `POST /api/trips/gps` - Envia telemetria GPS em batch
- ✅ `POST /api/trips/:id/end` - Finaliza viagem

### Checklists
- ✅ `POST /api/checklists/:visitId` - Salva checklist de inspeção

### Parser NLP
- ✅ `POST /api/agenda/parse` - Converte texto em visitas estruturadas
- ✅ `POST /api/agenda/confirm` - Cria visitas em lote

### Geofencing
- ✅ `GET /api/geo/fields/:id/contains` - Validação de geofence

## 🔧 Configuração Necessária

### 1. Cookies HTTPS

Para o app funcionar com autenticação por cookie, o backend precisa configurar:

```typescript
// Em server/index.ts ou onde configura sessão
app.use(session({
  cookie: {
    httpOnly: true,
    secure: true,           // Requer HTTPS
    sameSite: 'none',       // Permite cross-origin
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 dias
  }
}));
```

### 2. CORS

O backend já está configurado para aceitar credenciais:

```typescript
app.use(cors({
  origin: true,
  credentials: true
}));
```

### 3. Cache Control

Todos os endpoints já enviam headers de cache corretos:

```typescript
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
```

## 📊 Fluxo de Sincronização

### Delta-sync (Backend → Mobile)

1. App mobile envia `GET /api/visits?updated_since=2025-01-01T10:00:00Z`
2. Backend retorna apenas visitas com `updatedAt > timestamp`
3. App merge local com dados do servidor

**CRÍTICO:** Todas as mutations devem atualizar `updatedAt`:

```typescript
// ✅ CORRETO - Atualiza timestamp
await db.update(visits)
  .set({ 
    status: 'CONCLUIDA',
    updatedAt: new Date()  // Importante!
  })
  .where(eq(visits.id, id));

// ❌ ERRADO - Não atualiza timestamp
await db.update(visits)
  .set({ status: 'CONCLUIDA' })
  .where(eq(visits.id, id));
```

### Outbox Pattern (Mobile → Backend)

1. Ações do usuário são salvas em `outbox` local
2. Worker tenta enviar quando online
3. Remove da outbox após sucesso
4. Retry com backoff exponencial se falhar

## 🗺️ Geofencing e Trip Detection

### Detecção Automática de Viagem

O app registra um geofence circular de 200m na base e monitora:

1. **Evento de saída** da geofence
2. **Velocidade > 15km/h**
3. Se ambos verdadeiros → `POST /api/trips/start`

### GPS Tracking

Durante a viagem:
- Telemetria a cada 7 segundos ou 10 metros
- Enviado em batch: `POST /api/trips/gps`
- Payload: `{ trip_id, points: [{lat, lng, speed_kmh, accuracy_m, timestamp}] }`

### Finalização

Quando usuário marca visita como "NO_LOCAL":
- App chama `POST /api/trips/:id/end`
- Backend calcula distância total e duração

## 📝 Parser NLP

### Formato de Entrada

```
amanhã: João Silva inspeção 08:00; Maria Lopes amostra 10:30 (obs: prioridade)
```

### Pipeline

1. **Parse** → `POST /api/agenda/parse { text }`
2. Backend usa Fuse.js para fuzzy match de clientes
3. Retorna: `{ items: [{ client_id, intent, date, time, notes, priority }] }`
4. **Confirm** → `POST /api/agenda/confirm { items }`
5. Backend cria visitas em batch

## 🔐 Segurança

### Sessões

- Cookie HttpOnly impede acesso via JavaScript
- SameSite=None requer HTTPS
- Expira em 7 dias automaticamente

### Dados Locais

- SQLite não criptografado (Android protege por sandbox)
- Logout limpa banco local completamente
- Nenhum dado sensível em AsyncStorage

## 📱 Instalação e Deploy

### Desenvolvimento

```bash
cd crm-agro-mobile
npm install
npx expo start
# Pressione 'a' para Android
```

### Build de Produção

```bash
# Build APK
npx eas build --platform android --profile preview

# Build AAB para Google Play
npx eas build --platform android --profile production
```

Requer configuração de `eas.json`:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

## 🧪 Testando Integração

### Checklist de Testes

- [ ] Login funciona e cria sessão persistente
- [ ] Delta-sync retorna apenas visitas modificadas
- [ ] Geofence detecta saída da base
- [ ] Trip inicia automaticamente com velocidade
- [ ] GPS tracking envia telemetria
- [ ] Parser NLP reconhece clientes corretamente
- [ ] Checklist salva e atualiza `visit.updatedAt`
- [ ] Logout limpa banco local e sessão

### Testando Offline

1. Ativar modo avião
2. Tentar marcar visita como concluída
3. Verificar outbox: `SELECT * FROM outbox`
4. Desativar modo avião
5. Verificar que ação foi sincronizada

## 🐛 Troubleshooting

### "Network Error" no login
- Verifique se backend está em HTTPS
- Confirme URL correta em `src/api/client.ts`
- Teste com `curl -v https://seu-repl.replit.app/api/user`

### Delta-sync não funciona
- Backend deve atualizar `updatedAt` em TODAS mutations
- Verificar tabelas CRM: `createdAt`, `updatedAt` são obrigatórios
- Checar timezone: usar sempre UTC

### Geofence não detecta saída
- Permissões de localização em background (Android 10+)
- Raio muito pequeno (testar com 300-500m)
- Velocidade muito baixa (mínimo 15km/h)

### Trip não inicia automaticamente
- Verificar logs: `await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)`
- Confirmar que `lastExitAt` foi registrado
- Testar manualmente: `POST /api/trips/start`

## 📚 Referências

- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo Task Manager](https://docs.expo.dev/versions/latest/sdk/task-manager/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)

## 🚀 Próximos Passos

- [ ] Adicionar upload de fotos em checklists
- [ ] Implementar assinaturas digitais
- [ ] Cache de mapas offline (react-native-offline-maps)
- [ ] Push notifications (Expo Notifications)
- [ ] Modo escuro
