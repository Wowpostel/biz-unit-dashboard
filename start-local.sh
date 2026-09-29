#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo "Нужен Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi
echo "Собираю и поднимаю ERPEVV. Браузер: http://localhost:5173"
exec docker compose up --build
