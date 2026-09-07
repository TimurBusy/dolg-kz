# Dolg.kz

Dolg.kz — PWA-сервис для безопасного оформления частных денежных займов между физическими лицами.

## Sprint 1 status

В репозитории подготовлен фундамент DOLG-001—DOLG-010:

- npm workspaces monorepo;
- Next.js 16 frontend;
- NestJS 12 API;
- PostgreSQL;
- Prisma 7;
- Redis;
- Docker Compose;
- Swagger/OpenAPI;
- базовый responsive layout;
- UI primitives (Button, Card, StatusBadge).

## Структура

```text
apps/
  web/       Next.js PWA/frontend
  api/       NestJS API
packages/
  types/     общие TypeScript-типы
  config/    общие константы
```

## Требования

- Node.js >= 22.18
- npm >= 10
- Docker + Docker Compose

## Быстрый запуск

1. Создайте локальный env:

```bash
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

2. Запустите инфраструктуру:

```bash
docker compose up -d
```

3. Установите зависимости:

```bash
npm install
```

4. Сгенерируйте Prisma Client и примените миграции:

```bash
npm run db:generate
npm run db:migrate
```

5. Запустите web + api:

```bash
npm run dev
```

## Локальные адреса

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Health: http://localhost:4000/api/v1/health
- Swagger: http://localhost:4000/api/docs

## Следующий Sprint

DOLG-012—DOLG-025: OTP-аутентификация, access/refresh sessions, профиль и identity model.
