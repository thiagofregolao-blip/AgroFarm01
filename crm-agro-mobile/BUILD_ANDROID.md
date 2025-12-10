# 📱 BUILD ANDROID - CRM Agro Mobile

## ✅ Assets Configurados!

Os arquivos necessários foram criados:
- ✅ `assets/icon.png` - Ícone do app
- ✅ `assets/splash.png` - Tela de splash
- ✅ `app.json` - Configurado com assets

---

## 🔧 Próximos Passos - Execute no Terminal do Mac

### 1️⃣ Gerar arquivos nativos Android

```bash
cd ~/Downloads/crm-agro-mobile
npx expo prebuild --platform android
```

**O que vai acontecer:**
- ✅ Cria pasta `android/` com código nativo
- ✅ Gera arquivos do Android Studio
- ✅ Configura dependências nativas

---

### 2️⃣ Conectar celular via USB

**No Android:**
1. Vá em **Configurações** → **Sobre o telefone**
2. Toque 7x em **Número da versão** (ativa modo desenvolvedor)
3. Volte → **Opções do desenvolvedor** → Ative **Depuração USB**
4. Conecte o cabo USB ao Mac

**No Mac:**
```bash
# Verificar se o celular foi detectado
adb devices
```

Deve aparecer algo como:
```
List of devices attached
ABCD1234    device
```

---

### 3️⃣ Build e Instalação Automática

```bash
cd ~/Downloads/crm-agro-mobile
npx expo run:android
```

**O que vai acontecer:**
1. ✅ Compila o APK
2. ✅ Instala automaticamente no celular
3. ✅ Abre o app
4. ✅ App conecta ao backend Replit via HTTPS

---

## ⚠️ Requisitos

- ✅ Android Studio instalado (ou apenas Android SDK)
- ✅ Java JDK 17+ instalado
- ✅ Variável ANDROID_HOME configurada

### Instalar Android SDK no Mac (se necessário):

```bash
# Via Homebrew
brew install --cask android-commandlinetools

# Configurar ANDROID_HOME
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## 🎯 Resultado Esperado

✅ App instalado no celular  
✅ Ícone "CRM Agro" aparece na lista de apps  
✅ Ao abrir, mostra tela de login  
✅ Login funciona (conecta ao Replit)  
✅ GPS e localização funcionam nativamente  

---

## 🔍 Troubleshooting

### Erro: "adb not found"
```bash
brew install android-platform-tools
```

### Erro: "SDK location not found"
```bash
# Criar local.properties
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
```

### Erro: "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

## 📊 Diferença: Expo Go vs Build Nativo

| Recurso | Expo Go | Build Nativo |
|---------|---------|--------------|
| Cache problemático | ❌ Sim | ✅ Não |
| Background GPS | ❌ Limitado | ✅ Total |
| Acesso Replit | ❌ Bloqueado | ✅ Direto |
| Instalação | Via QR | APK Instalado |
| Dependências nativas | ❌ Limitado | ✅ Todas |

---

## 🚀 Execute Agora!

```bash
cd ~/Downloads/crm-agro-mobile
npx expo prebuild --platform android
npx expo run:android
```

**Quando terminar, me avise o resultado!** 📱✨
