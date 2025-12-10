# 📱 TESTE SIMPLES - SEM REINSTALAR NADA

## 🎯 Objetivo
Fazer o login funcionar no mobile sem mexer em dependências.

## ⚠️ IMPORTANTE
**NÃO delete node_modules**  
**NÃO reinstale nada**  
**Use o que já está instalado**

---

## 🔄 Passos

### 1. No Terminal do Mac onde está o Expo rodando:

Se o Expo já está rodando:
- Pressione **R** (reload)
- OU pressione **Ctrl+C** e rode: `npx expo start` (sem --clear)

Se não está rodando:
```bash
cd ~/Downloads/crm-agro-mobile
npx expo start
```

### 2. No celular:

1. **Abra o Expo Go** (se já está aberto, balance o celular → Reload)
2. **Escaneie o QR code** (se precisar)

### 3. O que deve acontecer:

**Tela de login carrega → Digite:**
- Usuário: `fregolao`
- Senha: `123`

**OU**

- Usuário: `bruno`  
- Senha: `123`

---

## 📊 Resultados Possíveis

### ✅ Cenário 1: LOGIN FUNCIONA
- App redireciona para dashboard
- **SUCESSO!**

### ❌ Cenário 2: "Falha no login"
**Me diga:**
- Qual mensagem de erro aparece EXATA?
- A URL aparece na tela? (linha pequena com 🔗)
- Aparece popup de erro?

### ❌ Cenário 3: Tela vermelha de erro
**Tire foto e me envie**

---

## 🔍 Debugging

Se falhar, no **Terminal do Mac**, pressione:
- **J** → abre debugger do React Native
- Veja o console e me diga o que aparece

---

**Execute isso e me diga o resultado exato!**
