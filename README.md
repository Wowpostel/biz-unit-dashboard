# ERPEVV

Цеховой контур ERP: спецификация → технология → заказ → запуск количеством → QR детали в работе → терминал → дашборд диспетчера.

Репозиторий раньше содержал прототип «Business Unit Dashboard». Этот домен **не развивается**. Ниже — новый модульный монолит (NestJS + Prisma + PostgreSQL + React/Vite).

## Быстрый старт (Docker Compose)

```bash
docker compose up --build
```

Откройте http://localhost:8080

При первом запуске API применит схему и заполнит пилотного тенанта.

## Локальная разработка

PostgreSQL: база `erpevv`, пользователь `erpevv` / `erpevv`.

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run seed
npm run start:dev
```

```bash
cd frontend
npm install
npm run dev
```

Офис: http://localhost:5173  
Киоск: http://localhost:5173/kiosk

## Пилотные учётки

| Роль | Почта | Пароль |
| --- | --- | --- |
| Администратор | admin@erpevv.local | Admin123! |
| Технолог | tech@erpevv.local | Tech123! |
| Диспетчер | disp@erpevv.local | Disp123! |
| Оператор | oper@erpevv.local | Oper123! |

Оператор после входа попадает только на терминал.

## Модули API

`identity` · `shop` · `engineering` · `production` · `terminal` · `dispatch`

В модели с первого дня есть `tenantId`. Отдельная БД на регистрацию не выдаётся.
