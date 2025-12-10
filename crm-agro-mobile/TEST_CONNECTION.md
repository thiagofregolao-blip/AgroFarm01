# 📡 TESTE DE CONECTIVIDADE MOBILE

## 🔍 Status Atual

**Backend:** ✅ Rodando em `https://17ae9dc1-8e31-40d1-881b-109572f48345-00-1ksns2gutezyn.spock.replit.dev`  
**Mobile App:** ❓ Não conecta (zero requisições no log do backend)

## 🧪 Como Testar

### 1️⃣ No Terminal do Mac (mobile):

```bash
cd ~/Downloads/crm-agro-mobile
npx expo start --clear
```

### 2️⃣ No celular Android:

1. **Force close do Expo Go** (matar app completamente)
2. **Abrir Expo Go** novamente
3. **Escanear QR code** que aparece no Terminal

### 3️⃣ Quando o app abrir:

**Tela de login deve mostrar:**
- ✅ Campos de usuário e senha
- ✅ **Linha pequena com URL** (🔗 https://17ae9dc1...)
- ✅ Botão "ENTRAR"

**Teste de Login:**
- Usuário: `fregolao`
- Senha: `123`

**OU**

- Usuário: `bruno`
- Senha: `123`

### 4️⃣ Verificar logs:

**Se aparecer erro "Falha no login":**
- Verificar se a **URL aparece** na tela
- Verificar no **Terminal do mobile** se há erros de rede
- Verificar no **log do backend** (Replit) se apareceu `POST /api/login`

## ⚠️ Problemas Conhecidos

### Expo Go tem limitações:

1. **Background location NÃO funciona totalmente** no Expo Go
   - Aviso "Background location permission denied" é **NORMAL**
   - Para background tracking funcionar 100%, precisa fazer build nativo

2. **Cookies podem não funcionar** entre dispositivo e Replit
   - Replit usa HTTPS mas pode ter problemas de CORS/cookies
   - Vamos debugar isso se o login falhar

## 📋 Checklist

- [ ] Terminal mostra QR code sem erros vermelhos
- [ ] App abre no celular sem tela vermelha de erro
- [ ] Tela de login aparece com URL visível
- [ ] Ao fazer login, backend recebe `POST /api/login` (verificar logs)
- [ ] Se falhar, anotar mensagem de erro EXATA
