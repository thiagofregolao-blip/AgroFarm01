# 📱 Guia: Transformar App Web em App Nativo

Este guia explica como transformar o **AgroFarmDigital** (app web) em um app nativo para **Apple App Store** e **Google Play Store**.

## 🎯 Opções Disponíveis

### 1. **Capacitor** (Recomendado) ⭐
- ✅ Mantém 100% do código React existente
- ✅ Acesso a recursos nativos (câmera, GPS, notificações)
- ✅ Build para iOS e Android
- ✅ Fácil de implementar

### 2. **React Native**
- ✅ Performance melhor
- ❌ Requer reescrever componentes
- ❌ Mais trabalho

### 3. **PWA (Progressive Web App)**
- ✅ Mais simples
- ❌ Não é "app nativo" nas lojas
- ❌ Funciona como app instalável

---

## 🚀 Implementação com Capacitor

### Passo 1: Instalar Capacitor

```bash
cd /Volumes/KINGSTON/Desktop/AgroFarmDigital/AgroFarmDigital
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

### Passo 2: Inicializar Capacitor

```bash
npx cap init
```

**Perguntas:**
- App name: `AgroFarm Digital`
- App ID: `com.agrofarmdigital.app`
- Web dir: `client/dist` (ou onde o Vite builda)

### Passo 3: Configurar Build

Atualizar `vite.config.ts` para gerar build compatível:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', // Importante para Capacitor
  build: {
    outDir: 'client/dist',
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    port: 3000,
  },
});
```

### Passo 4: Adicionar Plataformas

```bash
# Adicionar iOS (requer Mac)
npx cap add ios

# Adicionar Android
npx cap add android
```

### Passo 5: Configurar Capacitor

Criar/atualizar `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrofarmdigital.app',
  appName: 'AgroFarm Digital',
  webDir: 'client/dist',
  server: {
    // Em desenvolvimento, apontar para servidor local
    // url: 'http://localhost:3000',
    // cleartext: true,
    
    // Em produção, usar URL do Railway
    url: 'https://www.agrofarmdigital.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
```

### Passo 6: Adicionar Plugins Úteis

```bash
# Câmera (para upload de fotos)
npm install @capacitor/camera

# Geolocalização (para mapas)
npm install @capacitor/geolocation

# Status Bar (controlar barra de status)
npm install @capacitor/status-bar

# Network (verificar conexão)
npm install @capacitor/network

# App (controlar app lifecycle)
npm install @capacitor/app

# Push Notifications
npm install @capacitor/push-notifications
```

### Passo 7: Atualizar Código para Detectar Plataforma

Criar `client/src/lib/capacitor.ts`:

```typescript
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', 'web'

// Exemplo de uso
if (isNative) {
  // Código específico para app nativo
  console.log('Rodando em app nativo:', platform);
}
```

### Passo 8: Scripts no package.json

Adicionar scripts:

```json
{
  "scripts": {
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && esbuild scripts/run-migration.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/run-migration.js",
    "build:mobile": "vite build",
    "cap:sync": "npm run build:mobile && npx cap sync",
    "cap:ios": "npm run cap:sync && npx cap open ios",
    "cap:android": "npm run cap:sync && npx cap open android",
    "cap:run:ios": "npm run cap:sync && npx cap run ios",
    "cap:run:android": "npm run cap:sync && npx cap run android"
  }
}
```

---

## 📱 Build para Produção

### Android (Google Play)

#### 1. Preparar Ambiente

```bash
# Instalar Android Studio
# https://developer.android.com/studio

# Configurar variáveis de ambiente
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

#### 2. Build APK/AAB

```bash
cd android
./gradlew assembleRelease  # APK
./gradlew bundleRelease     # AAB (recomendado para Play Store)
```

**Arquivos gerados:**
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

#### 3. Assinar APK/AAB

```bash
# Gerar keystore (apenas primeira vez)
keytool -genkey -v -keystore agrofarm-release.keystore -alias agrofarm -keyalg RSA -keysize 2048 -validity 10000

# Configurar em android/app/build.gradle
```

#### 4. Upload para Google Play

1. Acessar [Google Play Console](https://play.google.com/console)
2. Criar novo app
3. Upload do AAB
4. Preencher informações (descrição, screenshots, etc.)
5. Enviar para revisão

### iOS (App Store)

#### 1. Requisitos

- **Mac com Xcode** (obrigatório)
- Conta Apple Developer ($99/ano)
- Certificados e provisioning profiles

#### 2. Build no Xcode

```bash
npm run cap:ios
# Abre Xcode automaticamente
```

No Xcode:
1. Selecionar dispositivo/simulador
2. Product → Archive
3. Distribute App
4. App Store Connect
5. Upload

#### 3. App Store Connect

1. Acessar [App Store Connect](https://appstoreconnect.apple.com)
2. Criar novo app
3. Preencher informações
4. Upload build via Xcode
5. Enviar para revisão

---

## 🔧 Configurações Importantes

### 1. Permissões (Android)

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 2. Permissões (iOS)

`ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Precisamos da câmera para tirar fotos de produtos</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Precisamos da localização para mapas e geolocalização</string>
```

### 3. Configurar URL do Backend

Em produção, atualizar `capacitor.config.ts`:

```typescript
server: {
  url: 'https://www.agrofarmdigital.com',
  cleartext: false,
}
```

### 4. Splash Screen e Ícone

```bash
# Gerar ícones e splash screens
npm install @capacitor/assets
npx capacitor-assets generate
```

Colocar imagens em:
- `assets/icon.png` (1024x1024)
- `assets/splash.png` (2732x2732)

---

## 📦 Estrutura de Arquivos

```
AgroFarmDigital/
├── client/
│   ├── dist/          # Build do Vite (usado pelo Capacitor)
│   └── src/
├── android/           # Projeto Android (gerado pelo Capacitor)
├── ios/              # Projeto iOS (gerado pelo Capacitor)
├── capacitor.config.ts
└── package.json
```

---

## 🧪 Testar Localmente

### Android

```bash
# Conectar dispositivo via USB ou usar emulador
npm run cap:android
# Abre Android Studio
# Clicar em Run (▶️)
```

### iOS (apenas Mac)

```bash
npm run cap:ios
# Abre Xcode
# Selecionar simulador/dispositivo
# Clicar em Run (▶️)
```

---

## 🎨 Melhorias para Mobile

### 1. Adicionar PWA Manifest

`client/public/manifest.json`:

```json
{
  "name": "AgroFarm Digital",
  "short_name": "AgroFarm",
  "description": "Sistema de gestão agrícola",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2. Adicionar Meta Tags

`client/index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 3. Detectar Offline

```typescript
import { Network } from '@capacitor/network';

const status = await Network.getStatus();
if (!status.connected) {
  // Mostrar aviso de offline
}
```

---

## 📋 Checklist de Publicação

### Google Play
- [ ] Gerar AAB assinado
- [ ] Criar conta Google Play Developer ($25 uma vez)
- [ ] Preencher informações do app
- [ ] Adicionar screenshots (pelo menos 2)
- [ ] Configurar classificação de conteúdo
- [ ] Política de privacidade
- [ ] Enviar para revisão

### App Store
- [ ] Gerar build no Xcode
- [ ] Criar conta Apple Developer ($99/ano)
- [ ] Configurar certificados
- [ ] Preencher informações do app
- [ ] Adicionar screenshots
- [ ] Política de privacidade
- [ ] Enviar para revisão

---

## 🐛 Problemas Comuns

### "Web assets not found"
```bash
npm run build:mobile
npx cap sync
```

### "Network error" no app
- Verificar `capacitor.config.ts` → `server.url`
- Em desenvolvimento, usar `http://localhost:3000` com `cleartext: true`

### Build Android falha
- Verificar Java JDK instalado
- Verificar `ANDROID_HOME` configurado
- Limpar build: `cd android && ./gradlew clean`

---

## 📚 Recursos

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Apple Developer Guide](https://developer.apple.com/documentation)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)

---

## 🚀 Próximos Passos

1. ✅ Instalar Capacitor
2. ✅ Configurar build
3. ✅ Testar em dispositivo
4. ✅ Adicionar plugins necessários
5. ✅ Gerar builds de produção
6. ✅ Publicar nas lojas
