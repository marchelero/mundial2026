#!/bin/bash
set -e

echo "🏆 Mundial 2026 - Polla App"
echo "==========================="
echo ""

# Cargar .env si existe
if [ -f .env ]; then
  set -a; source .env; set +a
  echo "📄 Configuración cargada desde .env"
fi

# Generar config.js automáticamente desde .env si existe y tiene ADMIN_EMAILS
if [ ! -f pb_public/config.js ]; then
  if [ -n "$ADMIN_EMAILS" ]; then
    echo "📝 Generando pb_public/config.js desde .env..."
    echo "var ADMIN_EMAILS = ['$(echo $ADMIN_EMAILS | sed "s/,/','/g")'];" > pb_public/config.js
    echo "✅ config.js creado con emails: $ADMIN_EMAILS"
  else
    echo "⚠️  No existe pb_public/config.js"
    echo "   Copiá pb_public/config.example.js como config.js y configurá tus emails"
    echo ""
  fi
fi

# Check if pocketbase binary exists
if [ ! -f "./pocketbase" ]; then
  echo "📥 Descargando PocketBase..."
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  [ "$ARCH" = "x86_64" ] && ARCH="amd64"
  [ "$ARCH" = "aarch64" ] && ARCH="arm64"
  URL="https://github.com/pocketbase/pocketbase/releases/download/v0.39.3/pocketbase_0.39.3_${OS}_${ARCH}.zip"
  curl -L "$URL" -o /tmp/pb.zip
  unzip -o /tmp/pb.zip -d .
  rm /tmp/pb.zip
  echo "✅ PocketBase descargado"
fi

echo "🚀 Iniciando servidor..."
echo "   Admin UI: http://localhost:8090/_/"
echo "   App:      http://localhost:8090/"
echo "   Red:      http://$(ip -4 addr show | grep -oP 'inet \K[\d.]+' | grep -v 127.0.0.1 | head -1):8090/"
echo ""

./pocketbase serve --http 0.0.0.0:8090
