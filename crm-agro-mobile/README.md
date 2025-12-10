# 📱 CRM Agro Mobile

App mobile Android (Expo + React Native) para gerenciamento de visitas de campo com funcionalidades offline-first.

## 🚀 Funcionalidades

- ✅ **Autenticação por Cookie** - Sessão compartilhada com web app
- 📍 **Geofencing Inteligente** - Detecta saída da base + velocidade para iniciar viagens
- 🗺️ **Mapa de Rota** - Visualização otimizada das visitas do dia
- 📝 **Agenda por Texto** - Parser NLP para criar visitas com linguagem natural
- 💾 **Offline-First** - SQLite local + outbox pattern para sincronização
- 🔄 **Delta Sync** - Sincronização incremental com backend
- 📊 **Tracking GPS** - Registro automático de telemetria durante viagens

## 📋 Pré-requisitos

- Node.js 18+
- Android Studio (para emulador) ou dispositivo Android físico
- Expo CLI: `npm install -g expo-cli`

## 🔧 Instalação

1. **Instalar dependências**
```bash
cd crm-agro-mobile
npm install
```

2. **Configurar URL do backend**

Edite `src/api/client.ts` e configure a URL do seu Replit:

```typescript
export const API_BASE = "https://seu-repl.replit.app";
```

Ou crie um arquivo `.env` na raiz:
```
EXPO_PUBLIC_API_URL=https://seu-repl.replit.app
```

3. **Iniciar o app**
```bash
npx expo start
```

4. **Rodar no Android**
- Pressione `a` no terminal para abrir no emulador Android
- Ou escaneie o QR code com o app Expo Go no celular

## 🏗️ Estrutura do Projeto

```
crm-agro-mobile/
├── src/
│   ├── api/              # Cliente HTTP com axios
│   ├── auth/             # Sistema de autenticação
│   ├── db/               # SQLite local (schema + state)
│   ├── geo/              # Geofencing e tracking GPS
│   ├── sync/             # Sincronização offline-first
│   └── features/
│       ├── visits/       # Telas de visitas e mapa
│       └── agenda/       # Parser NLP para agenda
├── app.json              # Configuração Expo
├── package.json
└── tsconfig.json
```

## 🔐 Configuração do Backend

O app se conecta aos seguintes endpoints:

- `POST /api/login` - Autenticação (retorna cookie de sessão)
- `GET /api/user` - Dados do usuário logado
- `POST /api/logout` - Encerrar sessão
- `GET /api/visits?updated_since=ISO_DATE` - Delta sync de visitas
- `GET /api/visits/route?date=YYYY-MM-DD` - Rota otimizada do dia
- `POST /api/trips/start` - Iniciar viagem
- `POST /api/trips/gps` - Enviar telemetria GPS
- `POST /api/trips/:id/end` - Finalizar viagem
- `POST /api/agenda/parse` - Parser NLP de texto
- `POST /api/agenda/confirm` - Criar visitas em lote

**IMPORTANTE:** O backend deve configurar cookies com `SameSite=None; Secure` para funcionar em HTTPS.

## 📱 Funcionalidades Detalhadas

### Sincronização Offline

O app usa **outbox pattern** para garantir que nenhuma ação seja perdida:

1. Ações do usuário são salvas localmente no SQLite
2. Tentativas de sincronização automáticas quando online
3. Retry com backoff exponencial em caso de falha
4. Delta-sync incremental usando `updated_since`

### Geofencing e Trip Detection

- Registra geofence de 200m na base (coordenadas configuráveis)
- Detecta saída da base + velocidade > 15km/h
- Inicia trip automaticamente e ativa tracking GPS
- Envia telemetria a cada 7 segundos ou 10 metros

### Parser NLP de Agenda

Converte texto natural em visitas agendadas:

```
"amanhã: João Pereira inspeção 08:00; Maria Lopes amostra 10:30 (obs: prioridade)"
```

O sistema:
- Extrai nomes de clientes (fuzzy match com master_clients)
- Identifica intent (inspeção, reunião, entrega, amostra)
- Parseia data/hora
- Detecta prioridade e observações

## 🧪 Testando

1. **Fazer login** com credenciais do sistema web
2. **Sincronizar** para baixar visitas do dia
3. **Selecionar visita ativa** na lista
4. **Ver mapa de rota** com visitas ordenadas
5. **Criar agenda** usando texto natural

## 🔒 Permissões Android

O app requer as seguintes permissões (já configuradas em `app.json`):

- `ACCESS_FINE_LOCATION` - GPS preciso
- `ACCESS_COARSE_LOCATION` - Localização aproximada
- `ACCESS_BACKGROUND_LOCATION` - Tracking em background

## 🐛 Troubleshooting

### Cookies não funcionam
- Verifique se o backend está em HTTPS
- Confirme que `SameSite=None; Secure` está configurado
- Use `withCredentials: true` no axios (já configurado)

### Geofencing não detecta saída
- Verifique permissões de localização em background
- Android 10+ requer `ACCESS_BACKGROUND_LOCATION`
- Teste com velocidade > 15km/h

### Delta sync não atualiza
- Confirme que o backend atualiza `updatedAt` em todas mutations
- Verifique timestamp salvo em `app_state.last_sync`

## 📚 Próximos Passos

- [ ] Adicionar upload de fotos em checklists
- [ ] Implementar assinaturas digitais
- [ ] Cache de mapas offline
- [ ] Notificações push para novas visitas
- [ ] Modo escuro

## 📄 Licença

Uso interno - Agro Farma Digital
