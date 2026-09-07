# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **The app is in Spanish.** All UI strings, user-facing text, error messages, and domain vocabulary (cliente, servicio, visita, personal, sector, informe, notificacion) are in Spanish. Write all user-facing text in Spanish and match the existing Spanish naming conventions in code.

## Documentation

Extended context lives in [`.claude/docs/`](./.claude/docs/) (see [`.claude/docs/README.md`](./.claude/docs/README.md)) to keep this file short. Read the relevant doc before touching that area:

- [Database & migrations](./.claude/docs/base-de-datos-y-migraciones.md) — Neon branches (**never point the local `.env` at production**), migrations applied automatically on deploy, when to hand-write the SQL, and how to verify against real data.
- [Catalog & inventory](./.claude/docs/catalogo-e-inventario.md) — Shopify-style options and variants (bienes only), stock as a movement ledger, product images with the variant picking one, and many-to-many categories.
- [SRI e-invoicing](./.claude/docs/facturacion-sri.md) — the portal issues its own invoices: Ecuador's *offline* scheme and the clave de acceso, emisores and their encrypted `.p12`, per-series numbering, the RIDE, payments, credit notes, and the rules that take an orden to a factura.
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
# eso. Sin --sin-emitir **emite facturas de verdad contra el SRI**, para que
# "Por cobrar" tenga qué mostrar: usar solo con un emisor en ambiente PRUEBAS.
npx tsx --env-file=.env scripts/seed-datos-prueba.ts
npx tsx --env-file=.env scripts/seed-datos-prueba.ts --sin-emitir
npx tsx --env-file=.env scripts/seed-datos-prueba.ts --limpiar

# Borra TODO el movimiento (órdenes, facturas, visitas, suscripciones,
# informes) y deja clientes, personal, grupos, sectores, productos y datos de
# facturación. Sin --ejecutar solo muestra qué haría.
npx tsx --env-file=.env scripts/reset-datos.ts
npx tsx --env-file=.env scripts/reset-datos.ts --ejecutar
```

> Borrar facturas **no retrocede la numeración**: vive en `SecuencialSri`, un
> contador propio y no el máximo local. Así tiene que ser — el SRI ya vio esos
> números y no los acepta dos veces.

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

Core entities: **Cliente** (customer) → **Visita** (a scheduled visit) carried out by **Personal** (organized into **Grupo**s), scoped by **Sector** (geographic; admins are scoped via `SectorAdmin`). A visita covers one or more products via **VisitaProducto**, accumulates **VisitaMedia** (photos/videos, optionally tagged to one of the visita's products), has an in-visit chat (**VisitaMessage**), and rolls up into **Informe**s (PDF reports, rendered with `@react-pdf/renderer` in `src/lib/informes/`; `Informe.fecha` is the date **printed** on the PDF and `generatedAt` the instant it was built — a report for August can be assembled in September). **An informe is edited by making a new version, never in place.** It used to be immutable — correcting it meant deleting it and building another with its own `numero` — because a client holding the old PDF would have a document that no longer matched ours. `InformeVersion` is what dissolves that: every generation keeps its own PDF, so the one they hold still opens. `PUT /api/admin/informes/[id]` re-renders, bumps `versionActual`, replaces the sections wholesale and appends a version row (with an optional note saying what changed); the `numero` never moves, because it is the same informe corrected. **A version is born only when what gets printed changes** — título, fecha impresa, firmantes or secciones, compared against the live version before any rendering. The **visitas are deliberately outside that**: they never reach the PDF, so re-linking them updates the rows and stamps `updatedBy` without creating a version, and saving with nothing changed writes nothing at all. Two traps found while building it: `@db.Date` comes back at midnight UTC while the value is stored at noon, and **Postgres `jsonb` reorders object keys**, so both comparisons need normalising (`mismoJson` sorts keys; array order still counts, because moving a section changes the page). The **PDF is the document**; `InformeSeccion`/`InformeSeccionFoto` are only the *current* version — what the editor reopens — while an old version keeps its file plus, in `contenido`, the request it was built from — which is what lets you **reopen an old version in the wizard** (`/editar?version=N`) and save it as a *new* version. Nothing is rolled back: the history is append-only, so reworking v2 produces a v5 that resembles it. Photo URLs are resolved from ids at reopen time rather than stored, because a photo can be cropped or moved; one whose file is gone simply doesn't come back, and the wizard says how many were missing. The versions the migration backfilled have no `contenido`, so those can only be viewed. Deleting an informe takes every version's PDF with it. The informe carries `generatedById`/`generatedByNombre` and `updatedById`/`updatedByNombre` (null until someone actually edits, which is different from "updated by whoever made it"), each version its own author — the usual id-plus-name-snapshot split. **A half-built informe is an `InformeBorrador`**, not an informe without a PDF: the wizard state as JSON, shared by the team rather than private to whoever opened it, and deleted the moment it becomes a real informe. An **edit** can be left half-done too — the draft carries `informeId`, so resuming it reopens that informe's editor instead of creating a duplicate of the thing being corrected, and it dies with the informe. A draft **has a `numero`, drawn from `Informe`'s own sequence** (`nextval('"Informe_numero_seq"')`, asked for explicitly — `@default(autoincrement())` would give the table a sequence of its own and #17 would name two things): the informe inherits it, so draft #17 becomes informe #17, and discarding a draft leaves a gap, same as with facturas. Drafts and informes are **one list**, ordered by date across both — a raw `UNION` returning ids so the database does the ordering and paging, hydrated per table afterwards — with an estado column and an estado filter. **Which visitas it covers is not part of that**: `InformeVisita` never reaches the PDF — the renderer doesn't look at it — so it is a traceability link, corrected through the same editor without producing a version. Picking visitas is also **optional** when generating: an informe that doesn't come from a visit is a real document, and the list is what fills it in when there are visits, not a requirement. Deleting takes the row, its sections and the PDF in R2 with it. Soft-delete is used on several models. **NotificacionPlantilla/Log/Config** drive WhatsApp + push notifications.

**Producto** is the single catalog — services and retail goods. Its only
classifying axis is `tipo`: `SERVICIO` | `BIEN` — what it *is*. **It changes
nothing at invoicing time** (the SRI's `<detalle>` has no goods/services field);
what it does decide is **who gets variants and stock: only a `BIEN`**.

**A bien splits into variants, Shopify-style.** `OpcionProducto` is an axis
(Color, Tamaño), `ValorOpcion` its values, and a **`Variante`** is one
combination — 3 colors × 2 sizes is 6 variants, each with its own SKU and its
own stock. **A bien with no options still has one variant**, so everything that
asks "how many are there" looks at the same place either way. `Variante.combinacion`
(the value ids joined) is what lets a unique index guarantee no two variants of a
product are the same. Saving options **replaces the whole set** and regenerates
variants, preserving those whose combination didn't change — values travel *with
their id*, or renaming "Rojo" would destroy every red variant and its stock.
Dropping an axis that has stock behind it needs an explicit `descartarVariantes`,
and the 409 names what disappears.

**Stock is a ledger, not a number.** `MovimientoInventario` is the book and
`Variante.stock` is its running balance — never written from anywhere else.
`moverStock()` takes the row `FOR UPDATE` first, or two simultaneous adjustments
both read 10 and both write 12. `INGRESO`/`AJUSTE` say *how much moved*;
`CONTEO` says *how many there are* and the service derives the delta — whoever
counts the shelf doesn't know what the system said. Two switches per variant:
`manejaInventario` (counted at all; turning it off with stock on hand is
refused) and `permiteNegativo` (sellable at zero).

**Media is a library.** `Media` is the file (uploaded once, lives in R2),
`ProductoImagen` says which files a product uses and in what order,
`Variante.imagenId` picks which of those represents a variant, and
`Categoria.mediaId` / `InformeSeccionFoto.mediaId` point at the same library. Removing a photo
from a product doesn't delete it from the library; deleting it for real is
`Restrict`-guarded and the service checks first so it can say *how many* products
use it. Photos hang off the producto rather than the variante because a photo
usually shows a single axis — the color — so per-combination would mean uploading
the same picture once per size. Upload is two-step (presigned URLs, then confirm),
`image/*` only, validated server-side because the content type is what gets
*signed*. **Any of them can be cropped, and cropping never overwrites** — it
writes a new `Media` and the editor re-points at it, because the same file may
be in a product and a category at once. It runs server-side with `sharp`: from
the browser a canvas depends on R2's CORS headers and `toBlob` fails silently on
a tainted one. A visita's photo crops too (`origen: "visita"`), and the crop
lands in the library while the visita keeps its own file — that one is the record
of what was seen in the garden.

**An informe photo has one of three owners, and the owner is who deletes it**:
`visitaMediaId` (the visita), `mediaId` (the library — it may also be on a
product), or neither (the informe itself, how they used to be uploaded). The
schema demands exactly one, and `deleteInforme` removes R2 objects only for the
third kind. New uploads in the wizard go to the library like any other image.

**A product is in several categories** (`ProductoCategoria`). It was one column,
and a rosal is both "Plantas" and "Exterior".

**`Variante.precio` is a list price, not what was charged.** It's what gets
*proposed* when building an order; the truth stays in `OrdenLinea.precioUnitario`,
a snapshot — so raising the list never rewrites what was already sold. It is
**mandatory, and zero means free**; a freshly created variant starts at zero, so
the lists render that as an amber "Gratis" rather than `$0.00` — it almost always
means nobody has priced it yet. Clearing the field doesn't save zero, it restores
what was there. The typed price follows the list only while untouched
(`precioAlCambiarVariante()`); once someone types a number, that wins. The invoice builder proposes nothing: its lines exist to
redistribute what the order already says, and a catalog price would make them
start out of square.

**A bien is sold by variant.** `OrdenLinea.varianteId` and
`FacturaLinea.varianteId` say which one went out — nullable, because a servicio
has none; `ensureVariantes()` is what requires it for a `BIEN`, since only the
service knows the `tipo`. **With a single variant it fills itself in**: a bien
with no options has exactly one, and the drafts the portal builds on its own
have nobody to ask. The variant's `sku` becomes the line's `codigoPrincipal`,
falling back to `Producto.codigo` and then to a code derived from the id.

**Stock moves at invoicing, and the order isn't symmetric.** `ensureStockParaVender()`
runs *before* emitting — the only moment where saying no is still possible, since
an authorized comprobante can't be undone — and `descontarPorVenta()` writes the
`VENTA` *after* the SRI authorized, with `forzar`, because by then the sale is a
fact and refusing to record it would only make the stock lie. A rejected emission
moves nothing. A nota de crédito writes the `DEVOLUCION`, tied to the nota rather
than to the factura.

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
the order can't be created (a product no longer in the catalog), **the visita
still completes** and the work stays in pendientes: finishing a visit in the
field can't depend on catalog config.

**And a billed product can't be removed from its visita.** Deleting it used to
leave the line charging while silently losing where it came from. Now
`updateVisitaInfo` refuses and names the order — annul it first. On a draft it
releases just that `OrdenLineaOrigen` row, and drops the line only if it had no
other origin: a line can pay for several visits, so deleting it whole would take
the other visits' work with it. Editing a **subscription's** products is free by contrast: each
order covers a closed period, so the plan changes going forward and past orders
are history.

**A visita is invoiced from its own page, or picked on the order.** "Crear
orden" opens the order screen with that visit's pending work already loaded; and
**Nueva orden** has a *Visitas* list of the client's visits that still have
unbilled work, with a checkbox each. Either way the assignment *is* loading the
visit's work — the header is derived from the lines' provenance, so an
assignment that brought no lines would be one nothing records.

**An order can cover several visits, and the same product across them is one
line.** Billing someone's whole month in a single order is the normal case, so
the visits list is multi-select. Two visits that both did "control de plagas"
are two `VisitaProducto` rows —each billable exactly once— but **one product**:
they collapse into a single line with the quantity summed and both provenances
(`OrdenLineaOrigen`). Having the same product twice in one order says nothing to
anyone and doubles the pricing decision. Subscription periods stay separate: an
order is visits or a plan, never both. **Scheduled visits count too** — billing before the work happens is
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
block. See [the invoicing doc](./.claude/docs/facturacion-sri.md).

**Órdenes, visitas and suscripciones each have a short `numero`** — a per-table
`autoincrement()`, so #12 can be an orden, a visita and a suscripción at once
and that's fine: nothing ever shows a bare number without saying what it is.
The cuid stays the identity and the URL; the number is what people say out loud.

**The PDF's page breaks are fixed by looking, not by predicting.** A section
title landing at the foot of a page with its photos on the next one is the
classic failure, and react-pdf's `minPresenceAhead` doesn't solve it: how much
room to demand depends on how many lines of the description will fit, which is
only known *after* laying out — ask for too little and orphans slip through, ask
for too much and titles get pushed down, leaving exactly the blank space you
were avoiding. So `renderInformePDF` lays out, reads the resulting tree
(`onRender`'s `_INTERNAL__LAYOUT__DATA_`, guarded: no tree means no correction
and the old behaviour), and re-renders with a forced break on any section whose
title ended its page. It converges in one extra pass and is capped at three.
Two related details: a section is **not** wrapped in its own `View` — inside a
wrapper the title is the first child, and react-pdf refuses to break an element
with no preceding siblings — and photos go out one **row** at a time with
`wrap={false}`, so a break can't split a row. Each section carries its own
`saltoDePagina` and `fotosPorFila` (2/3/4, the density lever). **The wizard previews the real PDF**: `POST
/api/admin/informes/preview` renders it without saving anything, off the same
`armarDatosDelInforme()` as the real thing — two assemblies would mean
previewing a document that isn't the one being filed. There's a preview step
before generating (rebuilt on every entry, since a cached one showing the
pre-correction version is worse than none) and a **live panel beside the section
editor** that refreshes ~700 ms after you stop typing. What makes that viable is
`src/lib/informes/fotos.ts`: photos are downloaded in parallel and shrunk —
**1200 px for the filed PDF, 520 px for a draft**, which is also cached
in-process. A refresh goes from ~3 s / 13 MB to ~0.5 s / 0.15 MB, and the filed
informe went from 13.35 MB to 0.71 MB (1200 px is over 300 dpi at the size a
photo actually prints, and a 13 MB PDF is one nobody can email). **The page
breaks are identical** at either size because layout reads the height in points
the style declares, not the file's pixels; every photo is re-encoded to JPEG and
flattened onto white, or a transparent PNG would come out black. The preview also accepts **zero firmantes** — it's looked at before
the signature step — while generating still demands one.

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

**Who closed a visita is its own pair of columns.** `completadaEl` / `completadaPorId` are stamped on the transition **into** `COMPLETADA` and cleared when it leaves, so re-saving the form to fix an hour doesn't make the corrector the one who completed it. They are not `fechaRealizada` — that is the *day the work happened*, chosen by whoever closes it and often earlier — and not `updatedById`, which any later edit overwrites. Each id is paired with a **name snapshot** (`completadaPorNombre`, `updatedByNombre`), the same split `Factura` and `OrdenLinea` already use: the id is what you filter by, the text is what happened. An id alone can't tell the story — `onDelete: SetNull` empties it when the account is removed, and a rename rewrites history — so the ficha shows the text and the list filters on the id. The filters are `completadaPor` and `completadaDesde`/`completadaHasta`, and the person dropdown only lists people who actually closed something.

**One visita per cliente per day.** `createVisitasBatch` refuses a date the
client already has a live visit on, and names it. The check used to be per
product — the same day with a different product opened a second visita — but
adding a service to a day that's already scheduled is *editing that visita*, not
opening another: two visitas the same day for the same client are two trips, two
chats and two informes for one job. Cancelled ones don't count — neither as
blockers nor when moved. **Moving a date is checked too**: `updateVisitaInfo`
runs the same rule (shared through `visitasDelDia()`, excluding the visita being
moved) when `fechaProgramada` actually changes, because a rule only the create
path enforces is one you get around by editing — the easier road of the two.

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

An order says what it's for in its own tables: **`OrdenVisita`** (several, since
one order can cover several visits) and **`Orden.suscripcionId`** (one, since a
plan's periods renew one at a time). Both are set by `origenDeLaOrden()` from the
lines at creation, never received from outside. Adding extra catalog products
doesn't change it — the order is still *those visits'*. Both are
`onDelete: Restrict`: a visit with an order can't be deleted out from under it.
Without them, "which visits is this order for?" meant walking the lines back
through their provenance, which broke the moment someone added a loose product.

**And what gets billed together gets billed whole.** `ensureTrabajoCompleto`
rejects an order that takes part of a visit or part of a subscription period:
touch one and you take everything that visit/period still owes. The unique
indexes only stop *double* billing, not *partial* billing — two products of the
same visit could land in two different orders and nothing complained. Adding
loose catalog products on top is still fine: the rule is about what's missing,
not what's extra. That keeps a sales report to one query instead of a union per revenue
type, and keeps the history in our own database. **Factura** is the comprobante
the portal itself issued against the SRI — clave de acceso, signed XML, its own
lines — see [the invoicing doc](./.claude/docs/facturacion-sri.md).

**One order, one invoice.** The order's main action is *Registrar cobro*, and
`cobrarOrden()` does whatever steps are missing underneath — emit the invoice,
register the payment. That order can't be inverted: a payment is recorded
against a comprobante, so the invoice has to exist first. Selling on
credit is *Emitir factura sin cobrar* (`facturarOrden()`). Annulling goes the
other way: `anularOrdenCompleta()` annuls the invoice and then the order, and
the order never reopens — to bill that work again you build a new order.

**`EstadoOrden` is `BORRADOR | CONFIRMADA | ANULADA`, and `CONFIRMADA` means
"has a live invoice".** There is no FACTURADA, because confirming and invoicing
became the same moment. **Whether it's been paid is a different axis** and is
derived from the invoice's `saldo` (`estadoCobro()` in
`components/ordenes/formato.ts`), never stored — the balance is recomputed by
summing the payments, never by subtracting from what's saved. A failed emission leaves the
order in `BORRADOR`, the only editable state, which is exactly where you fix the
cause. `/dashboard/ordenes` lists confirmed (and annulled) orders with their
payment status; drafts have their own page at `/dashboard/ordenes/borradores`.

**Annulling an order releases the work it held, and never silently.**
`OrdenLineaOrigen.visitaProductoId` and `[suscripcionItemId, periodoInicio]` are
unique across the whole table regardless of order state, and `listarPendientes` treats any
line as billed — so an annulled order that kept its lines would strand those
visitas and periods forever. `anularOrden` therefore refuses while work is
linked unless `liberarTrabajo` says otherwise, and the dialog lists exactly what
goes back to pending before you can proceed.

**Any catalog product can be sold.** There is no external catalog to link it to
any more: the invoice line carries a `codigoPrincipal` and a description that are
both ours, so `Producto.codigo` (unique, optional) is all a product needs — and
without one the emission derives a code from its id. What the line does need is
a **product from our own catalog**: `OrdenLinea.productoId` and
`FacturaLinea.productoId` are NOT NULL with `RESTRICT`, so a sold product can't
be hard-deleted.

Orders are written **only** through `crearOrden()` in
`src/lib/services/orden.service.ts`. A line's `descripcion` and
`precioUnitario` are a snapshot and are the truth; `productoId` and the
provenance fields (`OrdenLineaOrigen`, or `suscripcionItemId` + `periodoInicio`)
are for traceability and for the unique indexes that stop anything being billed
twice — they are never the source of the price.

## External integrations (admin app)

- **WhatsApp** (Meta Cloud API) — `src/lib/whatsapp/`. Sends OTPs and notifications; receives inbound messages via the webhook at `/api/webhooks/whatsapp`. Env: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Push notifications** (Expo) — `src/lib/push/`. `triggers.ts` is invoked from services on visit state changes. Env: `EXPO_ACCESS_TOKEN`.
- **Object storage** (Cloudflare R2, S3-compatible) — `src/lib/s3.ts`. Uploads use presigned URLs; region is always `auto`. Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL_BASE`.
- **Rate limiting** (Upstash Redis) — `src/lib/mobile/rate-limit.ts`. Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **SRI e-invoicing** — `src/lib/sri/`. The portal builds the XML, signs it with the emisor's `.p12` (XAdES-BES, via `facturacion-electronica-ec`) and talks to the SRI's SOAP services itself; there is no intermediary. Who issues (RUC, establecimiento, punto de emisión, ambiente, certificate) lives in the DB as **Emisor** rows — several are allowed and one is picked at emission time. The only env var is `FIRMA_ENCRYPTION_KEY`, which encrypts the stored `.p12` (AES-256-GCM); **changing it makes every stored certificate unreadable**. **Read [the doc](./.claude/docs/facturacion-sri.md) before touching it.**
- **Cron** — `/api/cron/notificaciones` (scheduled notifications), `/api/cron/renovaciones` (creates BORRADOR orders for due subscription periods; idempotent) and `/api/cron/facturas` (asks the SRI about every invoice that can still change). All gated by `CRON_SECRET` and registered in `apps/admin/vercel.json`. **The SRI never calls us back** — it has 24 h by law to authorize, so without that sweep an invoice that wasn't resolved on the spot sits at `ENVIADO` until someone presses *Consultar al SRI* by hand. **All three run daily, and that's a plan limit, not a preference**: Vercel's Hobby tier rejects at deploy time any cron that would fire more than once a day — `0 * * * *` doesn't fail at runtime, it makes the whole deployment fail. `facturas` wants to be hourly; on Pro it can be, or an external scheduler can hit the endpoint with the `CRON_SECRET`. Those drafts surface as a counted notice on **Por cobrar** (`borradoresSinConfirmar`) rather than as rows, so the cron's output never goes unnoticed without pretending a draft is money owed.

Other env: `DATABASE_URL`, plus `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — **required in production**: without the secret next-auth doesn't sign sessions and nobody can log into the dashboard, and dev auto-generates one so the problem only shows up on deploy. `apps/admin/.env.example` lists every variable with what breaks without it.

## Conventions

- Admin imports use the `@/*` alias → `apps/admin/src/*`. Mobile uses `@/*` → `apps/mobile/*`.
- Validation: Zod schemas shared cross-app live in `@vivero/shared`; admin-web-only schemas live in `src/lib/validations/`. Validate request bodies/queries at the route boundary with `safeParse`.
- Admin UI: shadcn/Base UI components in `src/components/ui/`, Tailwind v4, feature components grouped by domain (`src/components/visitas`, `clientes`, etc.). **Every dashboard route segment has a `loading.tsx`** (`src/components/shared/page-skeletons.tsx`): without one the App Router waits for the server component's queries *before* navigating and the click feels stuck. Add one when you add a route. **List pages follow one layout**: the page root is `flex h-full flex-col` — `h-full`, never `min-h-full`, or the content grows past the viewport and pushes the pager below the fold. The card is a `flex flex-col` holding a `min-h-0 flex-1` scroll area (`<Table containerClassName="h-full overflow-y-auto">` + `<TableHeader sticky>`) and, as its footer, `<TablePagination>` (`src/components/shared/table-pagination.tsx`), which renders even with a single page. So only the rows scroll — filters, header and pager stay put — and the height comes from the container instead of a hand-tuned `calc`. `FILAS_POR_PAGINA` is the one page size for every listing; card grids pass `suelta` to drop the footer styling. **A list's filters, search and page number live in the query string**, via `useFiltroUrl` (`src/lib/filtros-url.ts`) — a drop-in for `useState` that mirrors the value into the URL with `history.replaceState`. Opening a record and pressing back re-creates the page from scratch, so anything held only in React state is lost and has to be typed again; the URL is what the browser actually remembers. **Every row link carries `?from=` built with `aca()`** (or `useAca()` when the href is built during render — `window` doesn't exist on the server and a differing href is a hydration error), and every detail's back arrow honours it via `hrefDeVuelta()` (`src/lib/navegacion.ts`), which rejects anything outside `/dashboard/`. That arrow — not the browser's — is how people actually go back, so a hard-coded `href="/dashboard/x"` there throws the filters away. Only the value that differs from the default is written, so an untouched list keeps a clean URL. The one page whose filters the **server** reads is `/dashboard/visitas`, because its list is a server query — and there the filters must be applied with `router.replace`, not `useFiltroUrl`: rewriting the URL by hand asks the server for nothing, so the table kept showing the previous month's visits while the controls said otherwise. `replace` and not `push` so back leaves the list instead of undoing one filter at a time. Anything else that can outgrow the viewport does the same internally: the visits calendar is a `flex h-full flex-col` card whose month header stays outside the scroll area and whose weekday row is `sticky top-0` with an **opaque** background — a translucent one lets the rows show through as they pass under it. Date filters use `DateRangePicker` (one field, two months, shortcuts for hoy/ayer/mañana/semana/mes) rather than a Desde+Hasta pair — a single day travels as `desde === hasta`. Any calendar heading is a `MonthYearPicker` so jumping to another year is three clicks, not twenty. Mobile UI: react-native-paper, theme primary `#2e7d32` (green).
- Mobile state: Zustand stores in `apps/mobile/lib/` (`auth-store.ts` holds the token pair; `lib/api.ts` is the fetch wrapper that auto-refreshes access tokens on 401). The mobile app reaches the server via `EXPO_PUBLIC_API_BASE_URL` (set to your LAN IP for a real device; defaults to `http://localhost:3001`).
- React 19 across the monorepo; root `package.json` pins shared native/React versions via `overrides`.
