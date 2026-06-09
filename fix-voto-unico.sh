#!/bin/bash
echo "Email de admin:"
read EMAIL
echo "Contraseña:"
read -s PASS

TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X PATCH "http://127.0.0.1:8090/api/collections/predictions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"updateRule": null}'

echo ""
echo "✅ Listo, ya no se pueden editar predicciones"
