# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **The app is in Spanish.** All UI strings, user-facing text, error messages, and domain vocabulary (cliente, servicio, visita, personal, sector, informe, notificacion) are in Spanish. Write all user-facing text in Spanish and match the existing Spanish naming conventions in code.

## Documentation

Extended context lives in [`.claude/docs/`](./.claude/docs/) (see [`.claude/docs/README.md`](./.claude/docs/README.md)) to keep this file short. Read the relevant doc before touching that area:

- [Database & migrations](./.claude/docs/base-de-datos-y-migraciones.md) — Neon branches (**never point the local `.env` at production**), migrations applied automatically on deploy, when to hand-write the SQL, and how to verify against real data.
- [Contífico invoicing](./.claude/docs/facturacion-contifico.md) — the accounting system integration: ownership boundary, the API's traps (product list that hangs, `codigo` as the anti-duplicate key, 15% IVA in a field named `subtotal_12`), and SRI numbering.
- [Passwords & invites](./.claude/docs/autenticacion-clientes.md) — nobody sets anyone else's password: every account starts without one and its owner sets it through a single-use link. Covers cliente login (phone/email + password), portal-user invites and resets, the three link lifetimes, and email via the Gmail API.
- [WhatsApp notifications](./.claude/docs/notificaciones-whatsapp.md) — the Meta template system and the two seed scripts (DB rows vs. Meta templates).

### Keep the docs current

**Whenever you change something these docs describe, update the doc in the same
change.** A stale doc is worse than no doc: the next person trusts it and gets
burned. Concretely, update the relevant doc when you:

- add or change a Prisma model, an enum, or a migration convention;
- learn something non-obvious about an external API (an undocumented parameter,
  a validation it enforces, an endpoint that behaves unexpectedly);
- change an environment variable, a deploy step, or a build script;
- change who owns a piece of data between the portal and an external system.

If a change makes an existing paragraph wrong, fix that paragraph — don't append
a correction below it. And if you discover something the hard way (a request
that fails for a non-obvious reason, an error message that lies), write it down:
that's the highest-value content in these files.

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

Migrations (from the repo root):

```bash
npm run migrate:status      # what's applied, what's pending
npm run migrate:dev         # create + apply a migration (development)
npm run migrate:deploy      # apply pending migrations only (production)
```

`npm run build:admin` runs `prisma migrate deploy` before `next build`, so
**deploys apply pending migrations automatically**. Use
`npm run build:sin-migrar -w apps/admin` to compile without touching the DB.

> The local `.env` must point at a **development** Neon branch, never at
> production. Check with `npm run migrate:status` before running anything that
> writes. See [the database doc](./.claude/docs/base-de-datos-y-migraciones.md).

Admin-specific (run inside `apps/admin`):

```bash
npx prisma generate    # regenerate client into src/generated/prisma
npx prisma studio      # inspect the DB — Prisma 7 picks its own port (it
                       # prints it; it is NOT 5555), and it logs
                       # ERR_STREAM_PREMATURE_CLOSE every time the browser
                       # drops a stream. That's noise, not a failure.
npm run prisma ...     # seed is configured as: npx tsx prisma/seed.ts

# Datos de prueba para ver el portal con actividad (no inventa clientes ni
# personal: usa los que ya están y les genera movimiento). Todo lo que crea
# queda anotado en scripts/.datos-prueba.json, y --limpiar borra exactamente
# eso. Sin --sin-contifico crea los productos faltantes en Contífico y
# **emite facturas de verdad**, para que "Por cobrar" tenga qué mostrar.
npx tsx --env-file=.env scripts/seed-datos-prueba.ts
npx tsx --env-file=.env scripts/seed-datos-prueba.ts --limpiar

# Borra TODO el movimiento (órdenes, facturas, visitas, suscripciones,
# informes) y deja clientes, personal, grupos, sectores, productos y datos de
# facturación. Sin --ejecutar solo muestra qué haría.
npx tsx --env-file=.env scripts/reset-datos.ts
npx tsx --env-file=.env scripts/reset-datos.ts --ejecutar
```

> Después de borrar facturas hay que **subir `CONTIFICO_SECUENCIAL_INICIAL`**
> por encima del último número emitido: los documentos siguen existiendo allá
> (Contífico no tiene DELETE) y el secuencial sale del máximo local, así que sin
> eso la próxima emisión arranca en un número ya usado. `reset-datos.ts` imprime
> el valor exacto.

Mobile-specific (run inside `apps/mobile`): `npm run ios`, `npm run android`, `npm run web`, `npm run lint`.

There is no test suite configured.

## Two authentication systems (critical)

The admin app has **two parallel auth mechanisms**, and which API namespace you touch determines which one applies:

1. **Web dashboard** (`/api/*`, server components, `/dashboard/*`): **NextAuth** (`next-auth`, JWT strategy, credentials provider) in `src/lib/auth.ts`. Guard server code with helpers in `src/lib/auth-helpers.ts` (`requireAuth`, `requireAdmin`, `requireRole`). `src/middleware.ts` protects `/dashboard/*`. Web users are always staff (`ADMIN`/`STAFF`), never `CLIENTE`. **Inviting a user creates no password** — the row is written with `password: null` (both login paths reject that) and the person sets their own through a single-use link that the admin can copy or that goes out by email; the same endpoint reissues one for an existing account. **Revoking access blocks, it doesn't delete** — the account stays because its owner's name signs the visits and informes they made; what gets cut is `User.accesoRevocadoEl` plus their pending links and refresh tokens, and `getCurrentUser()` re-reads the row on every request so a live JWT session dies with it. A revoked person comes back by **using** a link issued after the revocation — setting the password is what clears the flag, not issuing the link, or the account would work again with the old password while the link sat unread. See [the passwords doc](./.claude/docs/autenticacion-clientes.md).

2. **Mobile** (`/api/mobile/*`): **custom JWT** (`jose`) with separate access/refresh secrets (`MOBILE_ACCESS_SECRET`, `MOBILE_REFRESH_SECRET`), see `src/lib/mobile/jwt.ts`. Personnel log in with email/password; **clients log in with phone-or-email + a self-set password** delivered via an invite link (see [.claude/docs/autenticacion-clientes.md](./.claude/docs/autenticacion-clientes.md) — the old WhatsApp OTP login is gone). Guard mobile routes with `requireMobileUser` / `requireMobileRole` + the `isMobileUser` type guard from `src/lib/mobile/auth.ts` (these return either a `MobileUser` or a `NextResponse`, so always narrow before use).

Roles (`UserRole` enum): `ADMIN`, `STAFF`, `PERSONAL_ADMIN`, `PERSONAL`, `CLIENTE`. `PERSONAL` is read-only field staff; `PERSONAL_ADMIN` is a lead with write access **over the sectors they administer** (`SectorAdmin`).

**A `PERSONAL_ADMIN` sees no money.** The line isn't "whose client is this" but "does this leave the office": órdenes, facturas and informes are `ADMIN`/`STAFF` only, enforced in `orden.service`, `factura.service` and `informe.service` themselves (`ensureCanRead` / `ensureInformes`), so it holds for pages, API routes and the global search alike — plus `requireStaff()` on the pages so they get a redirect instead of a crash. They **do** see their clients' subscriptions, because that's what says which plan a visit belongs to when scheduling — but **without prices**: `precio`, `ivaTasa` and the period total are left out on the server, not hidden with CSS, and the subscription's own page opens read-only for them: products with their visits-per-period and nothing else, the visits it covered, and the terms as plain text — no prices, no órdenes card, no save button. Same on a cliente's page: no órdenes card, no billing identity, no prices on their plans. Everything else — clientes, visitas, mensajes — is scoped to their sectors, and that scoping lives in each service.

## Service layer & the Viewer pattern

Business logic lives in `src/lib/services/*.service.ts` (visita, cliente, servicio, chat, informe, push, etc.) and is **designed to be shared between both auth systems**. Services never read the session directly — they take a `Viewer` (`{ id, role, personalId, clienteId }`, see `src/lib/services/viewer.ts`) and enforce authorization themselves.

Note: this is the **target** pattern, not yet universal. Mobile routes (`/api/mobile/*`) route through the service layer consistently; some older web routes (`/api/*`) predate it and still do inline `prisma` calls with inline role/sector checks (e.g. `api/clientes/route.ts`). Prefer the service path for new and refactored web routes (via `viewerFromSession()`), but when extending a legacy inline route, preserve its existing sector scoping rather than mixing styles.

Both entry points convert their auth context into a `Viewer` before calling a service:
- Web: `viewerFromSession()` in `auth-helpers.ts` (clienteId is always null).
- Mobile: `viewerFromMobileUser()` in `src/lib/mobile/route-helpers.ts`.

Services throw typed errors from `src/lib/services/errors.ts` (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`). Mobile routes translate these with `serviceErrorResponse()`; preserve this pattern rather than returning ad-hoc status codes. **When adding a feature that both web and mobile need, put the logic in a service and call it from both — do not duplicate.**

## Domain model

Prisma schema: `apps/admin/prisma/schema.prisma` (PostgreSQL via `@prisma/adapter-pg`). The generated client is committed at `apps/admin/src/generated/prisma` — import types from `@/generated/prisma/client`, not `@prisma/client`.

Core entities: **Cliente** (customer) → **Visita** (a scheduled visit) carried out by **Personal** (organized into **Grupo**s), scoped by **Sector** (geographic; admins are scoped via `SectorAdmin`). A visita covers one or more products via **VisitaProducto**, accumulates **VisitaMedia** (photos/videos, optionally tagged to one of the visita's products), has an in-visit chat (**VisitaMessage**), and rolls up into **Informe**s (PDF reports, rendered with `@react-pdf/renderer` in `src/lib/informes/`; `Informe.fecha` is the date **printed** on the PDF and `generatedAt` the instant it was built — a report for August can be assembled in September). **An informe is immutable**: there is no edit and no PUT, only create and delete. It is a signed document that already went out, so correcting it in place would leave the client holding a PDF that no longer matches ours; the fix is to delete the wrong one and make the right one, which gets its own `numero`. Deleting takes the row, its sections and the PDF in R2 with it. Soft-delete is used on several models. **NotificacionPlantilla/Log/Config** drive WhatsApp + push notifications.

**Producto** is the single catalog — services and (later) retail goods. Its only
classifying axis is `tipo`: `SERVICIO` | `BIEN` — what it *is*, mapped to
Contífico's `SER` / `PRO`.

**Nothing in the catalog says whether something is one-off or recurring.** That
depends on the cliente, not the product: the same desmalezado is a one-off for
one and a monthly plan for another. A product is recurring *for a cliente* when
it sits in one of their subscriptions — there is no `modalidad` column, for the
same reason there is no `periodicidad` one. Anything that needs to know asks per
cliente (`productosSuscritos()` in `suscripcion.service.ts`).

**A visita carries no money.** `VisitaProducto` records what was done and
whether a plan covered it (`suscripcionItemId`), nothing else. Loose work is
priced when it's invoiced, on the order — agendar and cobrar are different
moments, and the price is often only known at the second one. That also keeps
the rule that every peso lives on an `OrdenLinea` without exceptions.

A subscribed product is priced on a **Suscripcion**: one row per cliente
holding *one or more* recurring products, each with its own price, IVA rate and
`visitasPorPeriodo` on **SuscripcionItem**. The billing cadence
(`MENSUAL`/`TRIMESTRAL`/`SEMESTRAL`/`ANUAL`) lives on the Suscripcion header, so
every item in it renews together — and the catalog has **no** periodicity of its
own: the same product is monthly for one cliente and quarterly for another.
`ClienteServicio` — the old one-product contract — is gone;
`VisitaProducto.suscripcionItemId` is what marks a visit as covered (and
therefore *not* separately billable).

**A visita belongs to a plan, or to none — the choice is per visita, not per
product.** `Visita.suscripcionId` is picked in the wizard (and can be unset when
editing); from there `coberturaDelPlan()` derives each product's
`suscripcionItemId` by intersecting what was done with what that plan holds. So
a plan visit that also carries an unrelated product bills only that product, and
unlinking the plan turns the whole visit into loose work. Asking per product was
the earlier design and was wrong: nobody schedules half a visit against a plan,
and the question appeared on every product of every visit, plan or not.

The wizard offers the **whole catalog** to any cliente: a visita carries no
money, so there's nothing to price at scheduling time. The client never sends a
`suscripcionItemId` — only the `suscripcionId`, which the server checks belongs
to that cliente, so nobody can hook a visita onto someone else's plan. Changing
the plan on an existing visita re-derives coverage for its products **except
those already on an order line**: flipping a billed product to "covered" would
leave it charged and covered at once.

A subscription's page has a **Nueva visita** shortcut that pre-fills its plan,
which is how most plan visits get created.

**Nueva orden ends in one of two ways**, and both write the same thing —
`crearOrden` always opens a `BORRADOR`, the only editable state. *Crear y
cobrar* goes straight into the cobro dialog (which emits and charges in one
call); *Guardar borrador* lands on the order's page. The difference that matters
is what each demands first: a draft may have unpriced lines, because pricing is
exactly what it's waiting for; charging may not.

**Completing a visita creates its draft order.** `borradorDeVisita()` runs on
the real transition to `COMPLETADA` (not on re-edits) and opens a `BORRADOR`
with the loose work at **$0** — the visita carries no money, so the draft exists
for someone to price. Not at scheduling time: a scheduled visita still moves,
gets edited or cancelled, and an order would freeze its products too early. If
the order can't be created (a product not linked to Contífico), **the visita
still completes** and the work stays in pendientes: finishing a visit in the
field can't depend on catalog config.

**And a billed product can't be removed from its visita.** `OrdenLinea.visitaProductoId`
is `onDelete: SetNull`, so deleting it left the line charging while silently
losing where it came from. Now `updateVisitaInfo` refuses and names the order —
annul it first. Editing a **subscription's** products is free by contrast: each
order covers a closed period, so the plan changes going forward and past orders
are history.

**A visita is invoiced from its own page, or picked on the order.** "Crear
orden" opens the order screen with that visit's pending work already loaded; and
**Nueva orden** has a *Visita* selector listing the client's visits that still
have unbilled work, which does the same thing from the other side. Either way
the assignment *is* loading the visit's work — `Orden.visitaId` is derived from
the lines' provenance, so an assignment that brought no lines would be one
nothing records. Picking a visit hides the pendientes panel; adding a
subscription period instead greys the selector out, because an order is one or
the other. **Scheduled visits count too** — billing before the work happens is
normal here; the only visita that never becomes billable is a cancelled one. The
trade-off is that you can invoice something that later doesn't happen, and the
way out is annulling the order.

`listarPendientes` takes a separate `hastaVisitas` bound, and the web passes
`VISITAS_SIN_TOPE`: **visits are never cut off by date, subscription periods are**
(end of the current month). A visit scheduled for October is exactly what someone
wants to assign to an order today, while charging a period that hasn't started
stays a deliberate, separate decision.

`SuscripcionItem.visitasPorPeriodo` counts visits **per billing period** — a
quarterly plan's number is visits per quarter — and it is **informative, not a
cap**. Scheduling is never blocked by it, and every visit of a subscribed
product links to its `SuscripcionItem`. Deciding whether extra work gets charged
belongs to whoever builds the order, not to whoever schedules. A subscribed
product **can** be put on an order by hand as an extra; the UI warns, it doesn't
block. See [the invoicing doc](./.claude/docs/facturacion-contifico.md).

**Órdenes, visitas and suscripciones each have a short `numero`** — a per-table
`autoincrement()`, so #12 can be an orden, a visita and a suscripción at once
and that's fine: nothing ever shows a bare number without saying what it is.
The cuid stays the identity and the URL; the number is what people say out loud.

**Files belong to the visita, not to any form.** `ArchivosVisita` lives on the
visita's own page and every change — upload, re-tag, delete — goes out on its
own, in any state. Photos get taken *while* the job happens: whoever is in the
garden uploads what they have and carries on, and making them wait for a save
button on another screen, or for the visit to be closed, is asking them to
remember. So neither *Completar* nor *Editar* touches files.

**Closing a visita is its own page** (`/dashboard/visitas/[id]/completar`), not
a dialog, and it collects what happened and when — nothing else. Each file is
tagged to one of the visit's products so the informe can group them — **that tag
is what makes
the informe wizard work**: on reaching step 3 it builds one section per product
that has photos, titled and described from the product, with those photos
already in it. Sections are still editable and the picker offers the whole
active catalog (visit products first, searchable), because a section can be
about something these visits didn't cover. Photos come from one *Agregar fotos*
dialog that does all three things at once — pick from the visits, drop files,
browse the computer; the old floating photo pool is gone. The tag picker shows even
with a single product — it used to hide below two, so the common case silently
produced untagged media. A file can be tagged with **any active
product**, not only the visit's: in the field you photograph what shows up — a
watering problem during a pruning — and restricting the tag to what was
scheduled left those photos unclassified. Files show grouped by product,
untagged last, and adding happens *inside* a group, so where you drop it is the
tag; there is no separate "which product" field. **`archivoSubibleSchema` in `@vivero/shared` is
the one gate for uploads** (web and mobile): only `image/*` and `video/*`, at
most `MAX_ARCHIVOS_POR_SUBIDA` per call. The content type matters because it is
what gets *signed* — the presigned URL carries it and R2 stores whatever
arrives, and `tipo` is derived as "video" or, for everything else, "imagen".

**Who closed a visita is its own pair of columns.** `completadaEl` / `completadaPorId` are stamped on the transition **into** `COMPLETADA` and cleared when it leaves, so re-saving the form to fix an hour doesn't make the corrector the one who completed it. They are not `fechaRealizada` — that is the *day the work happened*, chosen by whoever closes it and often earlier — and not `updatedById`, which any later edit overwrites. The visitas list filters by both (`completadaPor`, `completadaDesde`/`completadaHasta`), and the person dropdown only lists people who actually closed something.

**A visita is editable in any state**, including `COMPLETADA`. The state records
what happened to the work, not whether the row is right: fixing a wrong date or
product shouldn't mean deleting and rebuilding a visit, which would lose its
photos, its chat and its link to the subscription. Neither `updateVisitaInfo`
nor `updateVisitaPersonal` looks at `estado`, and both go through one PUT to
`/api/visitas/[id]` — the shape is parsed once and each field is applied only if
it came, so a partial PUT can't blank the rest. Editing happens on its own page
(`/dashboard/visitas/[id]/editar`), laid out like the create wizard; the client
is the one thing it won't change, since that would orphan the subscription link.

**DatoFacturacion** holds who an invoice is made out to — identification, razón
social, tipo de persona, address. A cliente can have several (own name vs.
company) and one is the default; the invoice flow picks one or captures new ones
on the spot. `Factura` stores both the id and a snapshot of what was printed, so
editing the record later never rewrites history.

**Orden** / **OrdenLinea** are the single sales ledger: every peso lives on a
line, whether it came from a subscription period, a one-off visita, or (later) a
product. **One order never mixes subscription periods with visit work** —
`ensureNoMezclaOrigenes` rejects it: the plan is what was agreed and renews on
its own, a loose visit is something that happened and gets quoted, and merging
them produced an order whose total you couldn't explain without opening it.
Hand-added lines belong in either. `generarOrden()` therefore returns **several**
orders: one per subscription plus one for the loose visits.

Because an order has exactly one origin, it says so in its own columns:
**`Orden.visitaId` / `Orden.suscripcionId`**, at most one of the two (a `CHECK`
enforces it), set by `origenDeLaOrden()` from the lines at creation. Adding
extra catalog products doesn't change it — the order is still *that visit's*.
Both are `onDelete: Restrict`: a visit with an order can't be deleted out from
under it. Before these existed, "which visit is this order for?" meant walking
the lines back through `visitaProductoId`, which broke the moment someone added
a loose product.

**And what gets billed together gets billed whole.** `ensureTrabajoCompleto`
rejects an order that takes part of a visit or part of a subscription period:
touch one and you take everything that visit/period still owes. The unique
indexes only stop *double* billing, not *partial* billing — two products of the
same visit could land in two different orders and nothing complained. Adding
loose catalog products on top is still fine: the rule is about what's missing,
not what's extra. That keeps a sales report to one query instead of a union per revenue
type, and keeps the history in our own database. **Factura** mirrors the invoice
that lives in Contífico — see [the invoicing doc](./.claude/docs/facturacion-contifico.md).

**One order, one invoice.** The order's main action is *Registrar cobro*, and
`cobrarOrden()` does whatever steps are missing underneath — emit the invoice,
register the payment. That order can't be inverted: a payment is recorded
against a Contífico document, so the invoice has to exist first. Selling on
credit is *Emitir factura sin cobrar* (`facturarOrden()`). Annulling goes the
other way: `anularOrdenCompleta()` annuls the invoice and then the order, and
the order never reopens — to bill that work again you build a new order.

**`EstadoOrden` is `BORRADOR | CONFIRMADA | ANULADA`, and `CONFIRMADA` means
"has a live invoice".** There is no FACTURADA, because confirming and invoicing
became the same moment. **Whether it's been paid is a different axis** and is
derived from the invoice's `saldo` (`estadoCobro()` in
`components/ordenes/formato.ts`), never stored — the payments belong to
Contífico and can be entered from their interface. A failed emission leaves the
order in `BORRADOR`, the only editable state, which is exactly where you fix the
cause. `/dashboard/ordenes` lists confirmed (and annulled) orders with their
payment status; drafts have their own page at `/dashboard/ordenes/borradores`.

**Annulling an order releases the work it held, and never silently.**
`visitaProductoId` and `[suscripcionItemId, periodoInicio]` are unique across
the whole table regardless of order state, and `listarPendientes` treats any
line as billed — so an annulled order that kept its lines would strand those
visitas and periods forever. `anularOrden` therefore refuses while work is
linked unless `liberarTrabajo` says otherwise, and the dialog lists exactly what
goes back to pending before you can proceed.

A product can only be sold once it is **linked to Contífico**
(`Producto.contificoProductoId`, unique). Linking is manual and explicit — you
search their catalog and pick an existing product, because Contífico has no
DELETE and a mistaken creation is permanent. Until it's linked, the product
can't go on an order or a subscription; both services enforce it, and the
pickers grey it out. That's why invoicing never syncs anything.

Orders are written **only** through `crearOrden()` in
`src/lib/services/orden.service.ts`. A line's `descripcion` and
`precioUnitario` are a snapshot and are the truth; `productoId` and the
provenance fields (`visitaProductoId`, or `suscripcionItemId` + `periodoInicio`)
are for traceability and for the unique indexes that stop anything being billed
twice — they are never the source of the price.

## External integrations (admin app)

- **WhatsApp** (Meta Cloud API) — `src/lib/whatsapp/`. Sends OTPs and notifications; receives inbound messages via the webhook at `/api/webhooks/whatsapp`. Env: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Push notifications** (Expo) — `src/lib/push/`. `triggers.ts` is invoked from services on visit state changes. Env: `EXPO_ACCESS_TOKEN`.
- **Object storage** (Cloudflare R2, S3-compatible) — `src/lib/s3.ts`. Uploads use presigned URLs; region is always `auto`. Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL_BASE`.
- **Rate limiting** (Upstash Redis) — `src/lib/mobile/rate-limit.ts`. Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Contífico** (accounting / SRI e-invoicing) — `src/lib/contifico/`. The portal pushes orders as invoices; Contífico signs and transmits to the SRI. Env: `CONTIFICO_API_KEY`, `CONTIFICO_TOKEN`, `CONTIFICO_ESTABLECIMIENTO`, `CONTIFICO_PUNTO_EMISION`, `CONTIFICO_SECUENCIAL_INICIAL`. **Read [the doc](./.claude/docs/facturacion-contifico.md) before touching it** — its API has several traps that cost hours to rediscover.
- **Cron** — `/api/cron/notificaciones` (scheduled notifications), `/api/cron/renovaciones` (creates BORRADOR orders for due subscription periods; idempotent) and `/api/cron/facturas` (re-reads from Contífico every invoice that can still change). All gated by `CRON_SECRET` and registered in `apps/admin/vercel.json`. **Contífico never calls us back** — it signs, transmits and collects on its own, and `url_ride`/`url_xml` only exist once it signs, so without that sweep an invoice sits at "Sin firmar" with no PDF until someone happens to press *Actualizar* by hand. **All three run daily, and that's a plan limit, not a preference**: Vercel's Hobby tier rejects at deploy time any cron that would fire more than once a day — `0 * * * *` doesn't fail at runtime, it makes the whole deployment fail. `facturas` wants to be hourly; on Pro it can be, or an external scheduler can hit the endpoint with the `CRON_SECRET`. Those drafts surface as a counted notice on **Por cobrar** (`borradoresSinConfirmar`) rather than as rows, so the cron's output never goes unnoticed without pretending a draft is money owed.

Other env: `DATABASE_URL`, plus `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — **required in production**: without the secret next-auth doesn't sign sessions and nobody can log into the dashboard, and dev auto-generates one so the problem only shows up on deploy. `apps/admin/.env.example` lists every variable with what breaks without it.

## Conventions

- Admin imports use the `@/*` alias → `apps/admin/src/*`. Mobile uses `@/*` → `apps/mobile/*`.
- Validation: Zod schemas shared cross-app live in `@vivero/shared`; admin-web-only schemas live in `src/lib/validations/`. Validate request bodies/queries at the route boundary with `safeParse`.
- Admin UI: shadcn/Base UI components in `src/components/ui/`, Tailwind v4, feature components grouped by domain (`src/components/visitas`, `clientes`, etc.). **Every dashboard route segment has a `loading.tsx`** (`src/components/shared/page-skeletons.tsx`): without one the App Router waits for the server component's queries *before* navigating and the click feels stuck. Add one when you add a route. **List pages follow one layout**: the page root is `flex h-full flex-col` — `h-full`, never `min-h-full`, or the content grows past the viewport and pushes the pager below the fold. The card is a `flex flex-col` holding a `min-h-0 flex-1` scroll area (`<Table containerClassName="h-full overflow-y-auto">` + `<TableHeader sticky>`) and, as its footer, `<TablePagination>` (`src/components/shared/table-pagination.tsx`), which renders even with a single page. So only the rows scroll — filters, header and pager stay put — and the height comes from the container instead of a hand-tuned `calc`. `FILAS_POR_PAGINA` is the one page size for every listing; card grids pass `suelta` to drop the footer styling. **A list's filters, search and page number live in the query string**, via `useFiltroUrl` (`src/lib/filtros-url.ts`) — a drop-in for `useState` that mirrors the value into the URL with `history.replaceState`. Opening a record and pressing back re-creates the page from scratch, so anything held only in React state is lost and has to be typed again; the URL is what the browser actually remembers. **Every row link carries `?from=` built with `aca()`** (or `useAca()` when the href is built during render — `window` doesn't exist on the server and a differing href is a hydration error), and every detail's back arrow honours it via `hrefDeVuelta()` (`src/lib/navegacion.ts`), which rejects anything outside `/dashboard/`. That arrow — not the browser's — is how people actually go back, so a hard-coded `href="/dashboard/x"` there throws the filters away. Only the value that differs from the default is written, so an untouched list keeps a clean URL. The one page whose filters the **server** reads is `/dashboard/visitas`, because its list is a server query — and there the filters must be applied with `router.replace`, not `useFiltroUrl`: rewriting the URL by hand asks the server for nothing, so the table kept showing the previous month's visits while the controls said otherwise. `replace` and not `push` so back leaves the list instead of undoing one filter at a time. Anything else that can outgrow the viewport does the same internally: the visits calendar is a `flex h-full flex-col` card whose month header stays outside the scroll area and whose weekday row is `sticky top-0` with an **opaque** background — a translucent one lets the rows show through as they pass under it. Date filters use `DateRangePicker` (one field, two months, shortcuts for hoy/ayer/mañana/semana/mes) rather than a Desde+Hasta pair — a single day travels as `desde === hasta`. Any calendar heading is a `MonthYearPicker` so jumping to another year is three clicks, not twenty. Mobile UI: react-native-paper, theme primary `#2e7d32` (green).
- Mobile state: Zustand stores in `apps/mobile/lib/` (`auth-store.ts` holds the token pair; `lib/api.ts` is the fetch wrapper that auto-refreshes access tokens on 401). The mobile app reaches the server via `EXPO_PUBLIC_API_BASE_URL` (set to your LAN IP for a real device; defaults to `http://localhost:3001`).
- React 19 across the monorepo; root `package.json` pins shared native/React versions via `overrides`.
