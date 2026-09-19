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
| Суперпользователь | super@erpevv.local | Super123! |
| Администратор | admin@erpevv.local | Admin123! |
| Технолог | tech@erpevv.local | Tech123! |
| Диспетчер | disp@erpevv.local | Disp123! |
| Оператор | oper@erpevv.local | Oper123! |

Суперпользователь обходит ролевые ограничения: весь офисный нав (дашборд, заказы, спецификации, посты, оборудование, сотрудники, виды операций, пользователи) и ссылка на терминал. В киоск-ловушку оператора не попадает.

Оператор после входа попадает только на терминал.

## Модули API

`identity` · `shop` · `engineering` · `production` · `terminal` · `dispatch`

## Фото деталей

Не blob в Postgres: URL с NAS или файл на диске, в БД путь и имя.

Шаблон: `{Tenant.photoBaseUrl}/{номер}.png`  
По умолчанию: `https://starksk1.synology.me/web_images/images/{номер}.png`  
Пример: деталь **0350166** → `https://starksk1.synology.me/web_images/images/0350166.png`

- Имя файла = номер детали, не наименование.
- Пачка в офисе: спецификация → «Фото деталей» (запасной путь, например `Д-01.jpg`).
- Inbox: `backend/uploads/parts/inbox/` — положите файлы и нажмите «Разложить inbox». Локальный файл перекрывает NAS.
- Раскладка: `backend/uploads/parts/{код_тенанта}/{номер}.ext` (пилот: `uploads/parts/pilot/`).

Номер (обозначение) и наименование — разные поля. Поиск на терминале — по номеру.
