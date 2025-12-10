#!/bin/bash
set -e

echo "🔧 CONSERTANDO MOBILE APP - Aguarde..."
echo ""

# 1. Limpar TUDO
echo "1️⃣ Removendo node_modules e caches..."
rm -rf node_modules .expo .metro package-lock.json

# 2. Reinstalar LIMPO
echo "2️⃣ Reinstalando dependências..."
npm install --legacy-peer-deps

# 3. Limpar Metro cache
echo "3️⃣ Limpando Metro bundler..."
npx expo start --clear &
EXPO_PID=$!
sleep 3
kill $EXPO_PID 2>/dev/null || true

echo ""
echo "✅ PRONTO! Agora execute:"
echo "   npx expo start --clear"
echo ""
echo "📱 No celular:"
echo "   1. FECHE Expo Go completamente"
echo "   2. Abra novamente"
echo "   3. Escaneie o QR code"
