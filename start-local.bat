@echo off
chcp 65001 >nul
cd /d "%~dp0"
where docker >nul 2>&1
if errorlevel 1 (
  echo Нужен Docker Desktop: https://www.docker.com/products/docker-desktop/
  echo Запустите Docker и повторите.
  pause
  exit /b 1
)
echo Собираю и поднимаю ERPEVV. Браузер: http://localhost:5173
docker compose up --build
