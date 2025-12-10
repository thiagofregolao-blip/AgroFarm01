#!/bin/bash
# Script de limpeza completa de cache para Mac

echo "🧹 Limpando cache do mobile..."

# Limpar diretórios de cache
rm -rf .expo 2>/dev/null
rm -rf .metro 2>/dev/null
rm -rf node_modules/.cache 2>/dev/null

# Limpar Metro Bundler cache (compatível com Mac)
if [ -d "$TMPDIR" ]; then
  find "$TMPDIR" -name 'metro-*' -type d -exec rm -rf {} + 2>/dev/null || true
  find "$TMPDIR" -name 'haste-*' -type d -exec rm -rf {} + 2>/dev/null || true
  find "$TMPDIR" -name 'react-*' -type d -exec rm -rf {} + 2>/dev/null || true
fi

echo "✅ Cache limpo!"
echo ""
echo "📱 Agora execute: npx expo start --clear"
