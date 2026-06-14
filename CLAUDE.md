# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **The app is in Spanish.** All UI strings, user-facing text, error messages, and domain vocabulary (cliente, servicio, visita, personal, sector, informe, notificacion) are in Spanish. Write all user-facing text in Spanish and match the existing Spanish naming conventions in code.

## Documentation

Extended context lives in [`.claude/docs/`](./.claude/docs/) (see [`.claude/docs/README.md`](./.claude/docs/README.md)) to keep this file short. Read the relevant doc before touching that area:

- [Cliente authentication](./.claude/docs/autenticacion-clientes.md) — cliente login (phone/email + password), the invite/set-password flow, and email via the Gmail API.
- [WhatsApp notifications](./.claude/docs/notificaciones-whatsapp.md) — the Meta template system and the two seed scripts (DB rows vs. Meta templates).

## Overview

Vivero Francisco is a landscaping/gardening business management system, built as an **npm workspaces monorepo** with three packages:

- `apps/admin` — Next.js 16 (App Router) web app. Owns the database, all business logic, and **all** HTTP APIs (it serves both the web dashboard and the mobile app).
- `apps/mobile` — Expo / React Native app (expo-router) for field personnel (`PERSONAL`) and clients (`CLIENTE`). It is a thin client that calls the admin app's `/api/mobile/*` endpoints.
- `packages/shared` (`@vivero/shared`) — Zod schemas and shared TypeScript types (auth, visita, servicio, cliente, chat, push). Consumed as TS source by both apps; **no build step**.

## Commands

Run from the repo root:

```bash
npm install                 # installs all workspaces

npm run dev:admin           # next dev (admin, http://localhost:3001)
npm run dev:mobile          # expo start (mobile)
npm run build:admin         # next build
npm run lint:admin          # eslint (admin)
```

Admin-specific (run inside `apps/admin`):

```bash
npx prisma migrate dev --name <desc>   # create + apply a migration
npx prisma generate                    # regenerate client into src/generated/prisma
npx prisma studio                      # inspect the DB
npm run prisma ... # seed is configured as: npx tsx prisma/seed.ts
```

Mobile-specific (run inside `apps/mobile`): `npm run ios`, `npm run android`, `npm run web`, `npm run lint`.

There is no test suite configured.

## Two authentication systems (critical)

The admin app has **two parallel auth mechanisms**, and which API namespace you touch determines which one applies:

1. **Web dashboard** (`/api/*`, server components, `/dashboard/*`): **NextAuth** (`next-auth`, JWT strategy, credentials provider) in `src/lib/auth.ts`. Guard server code with helpers in `src/lib/auth-helpers.ts` (`requireAuth`, `requireAdmin`, `requireRole`). `src/middleware.ts` protects `/dashboard/*`. Web users are always staff (`ADMIN`/`STAFF`), never `CLIENTE`.

2. **Mobile** (`/api/mobile/*`): **custom JWT** (`jose`) with separate access/refresh secrets (`MOBILE_ACCESS_SECRET`, `MOBILE_REFRESH_SECRET`), see `src/lib/mobile/jwt.ts`. Personnel log in with email/password; **clients log in with phone-or-email + a self-set password** delivered via an invite link (see [.claude/docs/autenticacion-clientes.md](./.claude/docs/autenticacion-clientes.md) — the old WhatsApp OTP login is gone). Guard mobile routes with `requireMobileUser` / `requireMobileRole` + the `isMobileUser` type guard from `src/lib/mobile/auth.ts` (these return either a `MobileUser` or a `NextResponse`, so always narrow before use).

Roles (`UserRole` enum): `ADMIN`, `STAFF`, `PERSONAL_ADMIN`, `PERSONAL`, `CLIENTE`. `PERSONAL` is read-only field staff; `PERSONAL_ADMIN` is a lead with write access.

## Service layer & the Viewer pattern

Business logic lives in `src/lib/services/*.service.ts` (visita, cliente, servicio, chat, informe, push, etc.) and is **designed to be shared between both auth systems**. Services never read the session directly — they take a `Viewer` (`{ id, role, personalId, clienteId }`, see `src/lib/services/viewer.ts`) and enforce authorization themselves.

Note: this is the **target** pattern, not yet universal. Mobile routes (`/api/mobile/*`) route through the service layer consistently; some older web routes (`/api/*`) predate it and still do inline `prisma` calls with inline role/sector checks (e.g. `api/clientes/route.ts`). Prefer the service path for new and refactored web routes (via `viewerFromSession()`), but when extending a legacy inline route, preserve its existing sector scoping rather than mixing styles.

Both entry points convert their auth context into a `Viewer` before calling a service:
- Web: `viewerFromSession()` in `auth-helpers.ts` (clienteId is always null).
- Mobile: `viewerFromMobileUser()` in `src/lib/mobile/route-helpers.ts`.

Services throw typed errors from `src/lib/services/errors.ts` (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`). Mobile routes translate these with `serviceErrorResponse()`; preserve this pattern rather than returning ad-hoc status codes. **When adding a feature that both web and mobile need, put the logic in a service and call it from both — do not duplicate.**

## Domain model

Prisma schema: `apps/admin/prisma/schema.prisma` (PostgreSQL via `@prisma/adapter-pg`). The generated client is committed at `apps/admin/src/generated/prisma` — import types from `@/generated/prisma/client`, not `@prisma/client`.

Core entities: **Cliente** (customer) → **ClienteServicio** (a contracted service) → **Visita** (a scheduled visit) carried out by **Personal** (organized into **Grupo**s), scoped by **Sector** (geographic; admins are scoped via `SectorAdmin`). Visits accumulate **VisitaMedia** (photos/videos), an in-visit chat (**VisitaMessage**), and roll up into **Informe**s (PDF reports, rendered with `@react-pdf/renderer` in `src/lib/informes/`). Soft-delete is used on several models. **NotificacionPlantilla/Log/Config** drive WhatsApp + push notifications.

## External integrations (admin app)

- **WhatsApp** (Meta Cloud API) — `src/lib/whatsapp/`. Sends OTPs and notifications; receives inbound messages via the webhook at `/api/webhooks/whatsapp`. Env: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Push notifications** (Expo) — `src/lib/push/`. `triggers.ts` is invoked from services on visit state changes. Env: `EXPO_ACCESS_TOKEN`.
- **Object storage** (Cloudflare R2, S3-compatible) — `src/lib/s3.ts`. Uploads use presigned URLs; region is always `auto`. Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL_BASE`.
- **Rate limiting** (Upstash Redis) — `src/lib/mobile/rate-limit.ts`. Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Cron** — `/api/cron/notificaciones` (scheduled notifications), gated by `CRON_SECRET`.

Other env: `DATABASE_URL`, `MOBILE_OTP_DEV_BYPASS` (skip real OTP in dev).

## Conventions

- Admin imports use the `@/*` alias → `apps/admin/src/*`. Mobile uses `@/*` → `apps/mobile/*`.
- Validation: Zod schemas shared cross-app live in `@vivero/shared`; admin-web-only schemas live in `src/lib/validations/`. Validate request bodies/queries at the route boundary with `safeParse`.
- Admin UI: shadcn/Base UI components in `src/components/ui/`, Tailwind v4, feature components grouped by domain (`src/components/visitas`, `clientes`, etc.). Mobile UI: react-native-paper, theme primary `#2e7d32` (green).
- Mobile state: Zustand stores in `apps/mobile/lib/` (`auth-store.ts` holds the token pair; `lib/api.ts` is the fetch wrapper that auto-refreshes access tokens on 401). The mobile app reaches the server via `EXPO_PUBLIC_API_BASE_URL` (set to your LAN IP for a real device; defaults to `http://localhost:3001`).
- React 19 across the monorepo; root `package.json` pins shared native/React versions via `overrides`.
