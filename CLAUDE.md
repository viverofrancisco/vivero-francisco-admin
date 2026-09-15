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

# Pasos sueltos, que **se suman** a una base ya sembrada sin tocar sus órdenes
# ni sus facturas: anotan lo suyo en el mismo manifiesto, así que --limpiar
# después se lleva todo junto. El catálogo saltea por nombre lo que ya está,
# y los informes se generan de verdad —con su PDF en R2— a partir de las
# visitas completadas que el seed creó.
npx tsx --env-file=.env scripts/seed-datos-prueba.ts --catalogo
npx tsx --env-file=.env scripts/seed-datos-prueba.ts --informes

# Dos visitas cerradas, con partes de dos personas y **fotos reales en R2**,
# etiquetadas por tarea: el escenario mínimo para probar que el asistente de
# informes arma sus secciones solo. Sube las imágenes de verdad porque el PDF
# las descarga; una URL inventada rompe la vista previa. Manifiesto propio
# (`scripts/.visita-con-fotos.json`) y `--limpiar` que borra también los
# objetos de R2.
npx tsx --env-file=.env scripts/seed-visita-con-fotos.ts
npx tsx --env-file=.env scripts/seed-visita-con-fotos.ts --limpiar

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

1. **Web dashboard** (`/api/*`, server components, `/dashboard/*`): **NextAuth** (`next-auth`, JWT strategy, credentials provider) in `src/lib/auth.ts`. Guard server code with helpers in `src/lib/auth-helpers.ts` (`requireAuth`, `requireAdmin`, `requireRole`). `src/middleware.ts` protects `/dashboard/*`. Never `CLIENTE` — they log in on the app. **The login field takes a usuario *or* a correo**, in one box: `buscarCuentaPorIdentificador()` (`acceso.service.ts`) looks for an `@` and picks the column, and both login paths call it, because asking the same question in two places is how they started answering differently. That exists because **`User.email` is nullable**: a gardener has no email, so their account carries `User.usuario` instead — lowercase, no `@`, dictated over the phone. Postgres allows many nulls under a unique index, so accounts without email coexist without a sentinel value. **Inviting a user creates no password** — the row is written with `password: null` (both login paths reject that) and the person sets their own through a single-use link that the admin can copy or that goes out by email; the same endpoint reissues one for an existing account. **Revoking access blocks, it doesn't delete** — the account stays because its owner's name signs the visits and informes they made; what gets cut is `User.accesoRevocadoEl` plus their pending links and refresh tokens, and `getCurrentUser()` re-reads the row on every request so a live JWT session dies with it. A revoked person comes back by **using** a link issued after the revocation — setting the password is what clears the flag, not issuing the link, or the account would work again with the old password while the link sat unread. See [the passwords doc](./.claude/docs/autenticacion-clientes.md).

2. **Mobile** (`/api/mobile/*`): **custom JWT** (`jose`) with separate access/refresh secrets (`MOBILE_ACCESS_SECRET`, `MOBILE_REFRESH_SECRET`), see `src/lib/mobile/jwt.ts`. Staff and gardeners log in with **usuario-or-correo + password** (the same single field as the web; the route's body field is still named `email` for compatibility); **clients log in with phone-or-email + a self-set password** delivered via an invite link (see [.claude/docs/autenticacion-clientes.md](./.claude/docs/autenticacion-clientes.md) — the old WhatsApp OTP login is gone). Guard mobile routes with `requireMobileUser` / `requireMobileRole` + the `isMobileUser` type guard from `src/lib/mobile/auth.ts` (these return either a `MobileUser` or a `NextResponse`, so always narrow before use).

Roles (`UserRole` enum): `ADMIN`, `STAFF`, `PERSONAL`, `CLIENTE`. **Every gardener has their own account**: `PERSONAL` sees the visitas they are *assigned to* and writes exactly one thing in them — their own parte (their hours and the tareas they did). There used to be a `PERSONAL_ADMIN`, a lead who ran their whole group's visitas and closed them on everyone's behalf, scoped to sectors through `SectorAdmin`. It went when each gardener started filing their own part: with that, there is nothing left to delegate. Scheduling and closing are `ADMIN`/`STAFF`. `SectorAdmin` went with the role — it existed only to scope it — while `Sector` stays, because that is how clientes are grouped. **A gardener's account is born with their ficha**, in the same transaction — `POST /api/personal` calls `crearCuentaPersonal(tx, …)`, and a migration backfilled everyone who was already loaded. It used to be a separate button on the ficha, and a separate button is a step somebody skips: people ended up loaded but unable to open the app, and nobody found out until a parte was due. Creating it always opens nothing — an account with no password gets in nowhere — and whoever shouldn't be in there gets revoked. The `usuario` is **generated**, not typed: first initial plus first surname, accents and ñ stripped (`Fernando Herrera` → `fherrera`), numbered on collision (`fherrera2`), because two Fernando Herreras in one cuadrilla is ordinary and the unique index would otherwise reject the second one right as their ficha is being saved, where nobody is thinking about usernames. On `/dashboard/personal/[id]` the usuario is **the first row of Información General**, above the name — it is what you dictate to get them in, and what someone opens the ficha to look up — and it is edited there with everything else: `personalSchema` carries it, `PUT /api/personal/[id]` applies it only when it **changed** and only for an ADMIN, and the form surfaces the server's message (`ya está tomado` says what to fix; `Error al guardar` sends you guessing). It had its own card and its own save, which meant two saves to correct one typo. *Editar*, *Restablecer contraseña* and *Revocar acceso* live together in one **Acciones** dropdown in the header: all three are rare enough that a button each spent a whole header on something done once per person. Under the data sits a **Visitas** card — the visits where that person is *assigned* (`removedAt: null`, not their grupo: the grupo says who they usually work with, the assignment says where they actually went), newest first, paginated eight at a time through `?vpag=` in the URL, because opening a visit and coming back rebuilds the ficha from scratch and a page held in React state would be lost. The link is **not** issued at creation — that would burn its week of validity the day the ficha is loaded, usually before the person starts. Renaming is `PATCH /api/personal/[id]/usuario`, kept because the generator sometimes gets it wrong and deleting the account to fix it would take the history of who filed which parte. Nobody types anybody's password, here either. Usuarios lists **only the office** (`ADMIN`/`STAFF`) for the same reason: the gardener's name, phone and grupo live on their ficha, and a second screen for the same person is how two screens start disagreeing. The list shows a four-state *Acceso* column (`estadoDeAcceso`), because "sin cuenta", "falta que elija su contraseña" and "revocado" are fixed three different ways. **Archiving someone revokes their access** — their ficha leaves the lists but the account kept letting them in, chat included.

**Money is `ADMIN`/`STAFF`, and that cut is enforced in the services.** The line isn't "whose client is this" but "does this leave the office": órdenes, facturas and informes are staff-only, enforced in `orden.service`, `factura.service` and `informe.service` themselves (`ensureCanRead` / `ensureInformes`), so it holds for pages, API routes and the global search alike — plus `requireStaff()` on the pages so they get a redirect instead of a crash. A `PERSONAL` sees **only the visitas they are assigned to** — every list, the detail, the global search and the dashboard scope to `personal: { some: { personalId, removedAt: null } }`, the assignment and not the grupo: the grupo says who they usually work with, the assignment says where they actually went. Inside one they upload photos and file their parte; everything else is read-only. A cliente sees their own visitas, as before.

## Service layer & the Viewer pattern

Business logic lives in `src/lib/services/*.service.ts` (visita, cliente, servicio, chat, informe, push, etc.) and is **designed to be shared between both auth systems**. Services never read the session directly — they take a `Viewer` (`{ id, role, personalId, clienteId }`, see `src/lib/services/viewer.ts`) and enforce authorization themselves.

Note: this is the **target** pattern, not yet universal. Mobile routes (`/api/mobile/*`) route through the service layer consistently; some older web routes (`/api/*`) predate it and still do inline `prisma` calls with inline role/sector checks (e.g. `api/clientes/route.ts`). Prefer the service path for new and refactored web routes (via `viewerFromSession()`), but when extending a legacy inline route, preserve its existing sector scoping rather than mixing styles.

Both entry points convert their auth context into a `Viewer` before calling a service:
- Web: `viewerFromSession()` in `auth-helpers.ts` (clienteId is always null).
- Mobile: `viewerFromMobileUser()` in `src/lib/mobile/route-helpers.ts`.

Services throw typed errors from `src/lib/services/errors.ts` (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`). Mobile routes translate these with `serviceErrorResponse()`; preserve this pattern rather than returning ad-hoc status codes. **When adding a feature that both web and mobile need, put the logic in a service and call it from both — do not duplicate.**

## Domain model

Prisma schema: `apps/admin/prisma/schema.prisma` (PostgreSQL via `@prisma/adapter-pg`). The generated client is committed at `apps/admin/src/generated/prisma` — import types from `@/generated/prisma/client`, not `@prisma/client`.

Core entities: **Cliente** (customer) → **Visita** (a scheduled visit) carried out by **Personal** (organized into **Grupo**s), scoped by **Sector** (geographic; it groups clientes, and nothing else since `PERSONAL_ADMIN` went). A visita may demand certain **Tarea**s (**VisitaTareaObligatoria**) and records what each assigned person actually did (**VisitaPersonal** + **VisitaPersonalTarea**), accumulates **VisitaMedia** (photos/videos, each optionally tagged to a tarea — which is what lets the informe place it), has an in-visit chat (**VisitaMessage**), and rolls up into **Informe**s (PDF reports, rendered with `@react-pdf/renderer` in `src/lib/informes/`; `Informe.fecha` is the date **printed** on the PDF and `generatedAt` the instant it was built — a report for August can be assembled in September). **An informe is edited by making a new version, never in place.** It used to be immutable — correcting it meant deleting it and building another with its own `numero` — because a client holding the old PDF would have a document that no longer matched ours. `InformeVersion` is what dissolves that: every generation keeps its own PDF, so the one they hold still opens. `PUT /api/admin/informes/[id]` re-renders, bumps `versionActual`, replaces the sections wholesale and appends a version row (with an optional note saying what changed); the `numero` never moves, because it is the same informe corrected. **The heading is written, not assembled.** `Informe.encabezado` holds it as HTML and it is what prints: `<h2>` is a line in the título style (green, 14 pt) and `<p>` one in the subtítulo style (blue, 12 pt), with `<strong>`/`<em>`/`<u>` on top and `<br>` cutting inside a line. It used to be `titulo` plus a second line the renderer built by itself — `ACTIVIDADES REALIZADAS PARA <cliente>` — which nobody could touch: a long urbanización name wrapped and hyphenated mid-word and there was no way to move the break. What the editor offers is **size (in points, typed or picked), colour of the text and of its background, bold/italic/underline and alignment** — the toolbar shape Shopify's product description uses, minus everything a heading has no use for. Points, not pixels: the number chosen is the number the PDF prints. `encabezado.ts` translates that HTML to react-pdf (`htmlparser2`, never a DOM — see `html-seguro.ts` for why), reading `font-size`, `color`, `background-color` and `text-align` off the tags with an inner-most-wins stack, and `encabezado-texto.ts` holds the string helpers the **browser** also needs, so importing them into the wizard doesn't drag the parser into the bundle. `sanitizarEncabezado` is its own allowlist because this is the one place where `style` has to survive — only those four properties, each validated against a regex. The colour menu is a real picker (`components/ui/color-picker.tsx`: saturation square, hue bar, hex field and swatches, in about a hundred lines and no dependency) with **Texto/Fondo** tabs — `input[type=color]` was there first and opens the operating system's own window, which is not where the colour was asked to be chosen. The toolbar reads the cursor through **`useEditorState`**, never `editor.getAttributes()` straight in the render: Tiptap 3's `useEditor` does **not** re-render on a bare selection change, so the controls kept showing the previous cursor's values — click a 12 pt line and the box still said 14. The heading block must **not** be `alignItems: "center"`: that shrinks every line to its text width and centres it, so `textAlign: right` moved nothing; stretched full width, the line's own alignment decides. `titulo` survives as the plain first line — it is what the list shows and what the search matches — derived server-side from the heading, because two names for one thing drift apart. **Null means the old shape**: an informe from before the field prints exactly as it did, and reopening one seeds the editor with that same default (`encabezadoPorDefecto`), marks included, so nothing changes appearance by being re-saved. Helvetica is why the marks are resolved with a table instead of accumulated styles: bold and italic are *different families*, and asking Helvetica-Oblique for `fontWeight: bold` gets you nothing.

**A version is born only when what gets printed changes** — encabezado, fecha impresa, firmantes or secciones, compared against the live version before any rendering (the encabezado is compared **resolved**: an old informe re-saved untouched must not spawn a version identical to the last one). The **visitas are deliberately outside that**: they never reach the PDF, so re-linking them updates the rows and stamps `updatedBy` without creating a version, and saving with nothing changed writes nothing at all. Two traps found while building it: `@db.Date` comes back at midnight UTC while the value is stored at noon, and **Postgres `jsonb` reorders object keys**, so both comparisons need normalising (`mismoJson` sorts keys; array order still counts, because moving a section changes the page). The **PDF is the document**; `InformeSeccion`/`InformeSeccionFoto` are only the *current* version — what the editor reopens — while an old version keeps its file plus, in `contenido`, the request it was built from — which is what lets you **reopen an old version in the wizard** (`/editar?version=N`) and save it as a *new* version. Nothing is rolled back: the history is append-only, so reworking v2 produces a v5 that resembles it. Photo URLs are resolved from ids at reopen time rather than stored, because a photo can be cropped or moved; one whose file is gone simply doesn't come back, and the wizard says how many were missing. The versions the migration backfilled have no `contenido`, so those can only be viewed. Deleting an informe takes every version's PDF with it. The informe carries `generatedById`/`generatedByNombre` and `updatedById`/`updatedByNombre` (null until someone actually edits, which is different from "updated by whoever made it"), each version its own author — the usual id-plus-name-snapshot split. **A half-built informe is an `InformeBorrador`**, not an informe without a PDF: the wizard state as JSON, shared by the team rather than private to whoever opened it, and deleted the moment it becomes a real informe. An **edit** can be left half-done too — the draft carries `informeId`, so resuming it reopens that informe's editor instead of creating a duplicate of the thing being corrected, and it dies with the informe. A draft **has a `numero`, drawn from `Informe`'s own sequence** (`nextval('"Informe_numero_seq"')`, asked for explicitly — `@default(autoincrement())` would give the table a sequence of its own and #17 would name two things): the informe inherits it, so draft #17 becomes informe #17, and discarding a draft leaves a gap, same as with facturas. Drafts and informes are **one list**, ordered by date across both — a raw `UNION` returning ids so the database does the ordering and paging, hydrated per table afterwards — with an estado column and an estado filter. **Which visitas it covers is not part of that**: `InformeVisita` never reaches the PDF — the renderer doesn't look at it — so it is a traceability link, corrected through the same editor without producing a version. Picking visitas is also **optional** when generating: an informe that doesn't come from a visit is a real document, and the list is what fills it in when there are visits, not a requirement. Deleting takes the row, its sections and the PDF in R2 with it. Soft-delete is used on several models. **NotificacionPlantilla/Log/Config** drive WhatsApp + push notifications.

**Tarea** is the catalogue of gardening work — *what gets done on a visit*, as opposed to what gets sold. "Poda de setos" is a tarea; the monthly plan that includes it is a producto. So a tarea carries **no price, no IVA, no variants and no stock**, and nothing about it ever reaches an orden. It is a closed list the office maintains (`/dashboard/visitas/tareas`) rather than free text, because free text gives you "poda de setos", "Poda setos" and "podar los setos" for one thing, and with that you can neither group the informe's photos nor answer "was it done or not". **Deleting is always soft**: a deleted tarea keeps naming the work of every visita where it was done — visitas already printed into informes the cliente is holding — so what deletion removes is the tarea from the pickers, nothing else. Its name is unique **among the living ones**, a partial unique index (`WHERE "deletedAt" IS NULL`) written by hand in the migration because Prisma can't express one, so deleting "Poda de palmas" and creating it again works and the two coexist. **Renaming rewrites history on purpose**: visitas point at the tarea by id and keep no copy of the name, so fixing a typo fixes every visita at once — the opposite of `Factura`, where the name is frozen because the document was already issued. Replacing a tarea with a different one is deleting and creating, not renaming. `orden` spaces the list by tens so one can be slipped between two without renumbering, and `reordenarTareas` takes the **whole** list and rewrites it rather than "move this one up", so two tabs moving at once can't leave two tareas in the same place. **How the catalogue is sorted is saved, not a view of the admin screen**: `EmpresaConfig.tareasOrden` (`PERSONALIZADO` | `ALFABETICO_AZ` | `ALFABETICO_ZA`) is what `listTareas` orders by, so the gardener's checkboxes come out in the order the office chose — sorting A–Z on one screen and leaving the phone showing something else would be two lists. Switching to alphabetical **does not touch `Tarea.orden`**: the hand-made arrangement survives and going back to Personalizado restores it exactly, because renumbering on a dropdown click would destroy the work of dragging seventeen rows. Dragging *is* choosing Personalizado, so `reordenarTareas` sets the mode itself — saving positions while still rendering alphabetically would make the row snap back. Reordering is **drag and drop** (`@dnd-kit`), by a grip handle on the desktop row — the row itself opens the tarea, so a full-row handle would fight the click — and by **press-and-hold** on the phone, a `TouchSensor` with a 300 ms delay and a movement tolerance, which is how the OS reorders and what leaves the list still scrolling (`touch-action: manipulation`, never `none`). The grip is `cursor-grab` and `cursor-grabbing` while dragging, and the grabbing cursor is pushed onto `document.body` for the duration: `active:` on the button stops applying the moment the pointer leaves it, which is the first thing dragging does. **A new order is not saved until it is confirmed** — dragging and moving only touch local state, and a bar offers *Cancelar* / *Guardar orden*, so five rows get arranged and committed once instead of one write per row with no way to back out. While there are unsaved changes the sort selector is disabled, since switching to A–Z would silently throw the arrangement away. Besides dragging there is Shopify's **Mover** menu: rows have checkboxes and their position number, and the selection goes *Al principio*, *Al final* or *A la posición N* (`moverA` in `components/tareas/orden-tareas.ts`). Dragging is for nudging a row two places; sending five rows to the top of a long list is a long trip with the button held, and letting go early starts it over. The selected rows travel **as a block, in the order they already had between them** — relocating them one at a time gives a different answer depending on which is processed first — and the position is counted against the *final* list and clamped, so asking for 20 of 17 means the end. It is a `Popover` and not a `DropdownMenu` because one option holds a field, and typing a number in a menu closes it; on the phone it is a drawer, per the convention above. The move is applied to the **whole** list rather than the visible page: within a page the relative order is the full list's, so dropping a row onto another's position means the same thing either way, and pagination stops mattering — the position shown on a row is its place in the full list, so on page 2 the first row is 26. Dragging, checkboxes and numbers are all off while a search filter is on, where dropping "between these two" really means between two others that aren't on screen. Selecting rows swaps the table's header row for the selection bar, and on the phone selection is a mode turned on from the header's ⋯ — both through the shared pieces described under *Selección múltiple*. The list has **no actions column**: clicking the row opens the tarea and **Eliminar** lives inside that dialog — a column of icons repeated on every row spends permanent width on something done once in a while, and puts a bin next to the line you want to press in order to read it. Writing is `ADMIN`/`STAFF`; reading is also open to `PERSONAL`, who need the list to mark what they did, and closed to `CLIENTE`, who sees the tareas *of their visita* through the visita itself. A tarea is also what a **photo** is tagged with and what an **informe section** comes from — see the informe wizard below. A tarea reaches a visita in two ways and they mean different things: **`VisitaTareaObligatoria`** is what the visit *demands* — picked when scheduling, never a blocker, and the thing the office checks afterwards — while **`VisitaPersonalTarea`** is what one person *did*, hanging off their `VisitaPersonal` and not off the visit, because the question worth answering is "who did the weeding?" and a table on the visit only answers "was it done?". What the visit did in total is the union of those, computed (`tareasHechas` in `lib/visita-tareas.ts`), and an obligatoria counts as covered when **anyone** did it. Both relations are `onDelete: Restrict`, which is another reason deleting a tarea is always soft. The initial seventeen are seeded **from the migration** (`20260914160957_tareas_de_visita`), not from a script someone has to remember to run: the build does `prisma migrate deploy` before `next build`, so they land in production the same minute as the screen that uses them; `scripts/seed-tareas.ts` re-seeds the same list in development.

**Producto** is the single catalog — services and retail goods. Its only
classifying axis is `tipo`: `SERVICIO` | `BIEN` — what it *is*. **It changes
nothing at invoicing time** (the SRI's `<detalle>` has no goods/services field);
what it does decide is **who gets variants and stock: only a `BIEN`**.

**Every product has *at least* one variant; only a `BIEN` can have several.** No options means exactly one; options mean one per combination (3 colours × 2 sizes = 6). A servicio has one too — created with it, `manejaInventario: false`. The variant is not "where stock is counted", it is **what gets sold**, so `OrdenLinea.varianteId` and `FacturaLinea.varianteId` are NOT NULL and a line never has to ask the `tipo` to know where the SKU, the price or the stock live. It used to be bienes-only, which meant a line pointed at a producto or at a variante depending on the type — two shapes for the same thing, and a branch in every place that asked. **The catalog code lives on `Variante.sku`**, not on the producto: it is what prints as `codigoPrincipal`. With a single variant it is edited in the card under the photos, which is also where a bien's price and stock live; with several, each combination has its own on its page. **A servicio shows only the SKU there** — no price, no IVA switch: a poda is quoted each time, so both are decided on the order or the plan. The columns exist on its variant anyway, so showing them later is adding a block, not changing the model. And **the type is chosen before the create form**, because it is the one thing that can never change afterwards and it decides which fields the screen even has.

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

**Everything is sold by variant.** `OrdenLinea.varianteId` and
`FacturaLinea.varianteId` say which one went out, and both are NOT NULL.
**With a single variant `ensureVariantes()` fills it in**: a servicio and a bien
with no options have exactly one, and the drafts the portal builds on its own
have nobody to ask. With several it refuses — nobody can guess which of six
pots was sold. The variant's `sku` becomes the line's `codigoPrincipal`, falling
back to a code derived from the id.

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

**A visita carries no money, and no longer carries products either.** What gets
done on a visit are **tareas**, filed by each gardener when they finish; a tarea
has no price and is never sold. Scheduling a visit picks the cliente, the dates,
the people, optional notes and — optionally — which tareas are **obligatorias**.
Products used to live on the visit (`VisitaProducto`), and an order line pointed
back at the exact row it billed; that whole chain is gone, along with the draft
order that was opened on completion. Charging for the work is building an order
by hand with catalog products, and saying which visits it covers
(`OrdenVisita`) — traceability, not provenance. That also keeps the rule that
every peso lives on an `OrdenLinea` without exceptions.

**Closing a visita is the office's call, and filing a parte is the gardener's.**
Each assigned person opens the visit and records *their own* part: their
`horaEntrada`, their `horaSalida` and the tareas **they** did
(`VisitaPersonal` + `VisitaPersonalTarea`). The first parte moves the visit from
`PROGRAMADA` to `EN_CURSO` on its own; from there an `ADMIN`/`STAFF` marks it
`COMPLETADA` or `INCOMPLETA`, looking at what was filed and what is missing. It
does **not** close itself when the last person files: someone may never file,
and deciding that the work is nonetheless finished is a judgement, not a count.
`tareaIds` replaces that person's set rather than adding to it — the form is a
list of checkboxes, so what arrives *is* the final state, and adding would leave
no way to untick something filed by mistake. The visit's own
`horaEntrada`/`horaSalida` are **derived**: the earliest entry and the latest
exit across the filed partes, recomputed on every change, which is why neither
the edit form nor the close form asks for them. Fixing an hour means fixing the
parte of whoever filed it. Removing someone from the visit marks the assignment
`removedAt` and leaves their parte hanging off it: everything that counts what
was done filters `removedAt: null`, so it stops counting, and re-assigning them
brings it back exactly as they left it.

A subscribed product is priced on a **Suscripcion**: one row per cliente
holding *one or more* recurring products, each with its own price, IVA rate and
`visitasPorPeriodo` on **SuscripcionItem**. The billing cadence
(`MENSUAL`/`TRIMESTRAL`/`SEMESTRAL`/`ANUAL`) lives on the Suscripcion header, so
every item in it renews together — and the catalog has **no** periodicity of its
own: the same product is monthly for one cliente and quarterly for another.
`ClienteServicio` — the old one-product contract — is gone.

**A visita belongs to a plan, or to none.** `Visita.suscripcionId` is picked in
the wizard and can be unset when editing, and that is the whole of it: it says
which contract the visit counts against. Coverage used to be derived per product
(`VisitaProducto.suscripcionItemId`, via `coberturaDelPlan()`), so a plan visit
carrying an unrelated product billed only that product. With no products on the
visit there is nothing to bill and nothing to cover: the question disappeared
rather than being answered. Editing what a plan includes therefore no longer
touches any visit — the plan changes going forward, and which plan a past visit
belonged to is history.

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

**Nothing about a visita becomes an order by itself.** Completing one used to
open a `BORRADOR` with its loose work at $0, and a nightly cron swept up the
visits that had slipped through. Both are gone: a visita leaves tareas behind,
tareas have no price, and there is nothing an automatism could put on a line.
Charging for that work is someone building an order. A subscription period still
renews automatically, because there the price was agreed in advance.

**An order says which visits it covers, and that is all it says.** `OrdenVisita`
is still a list — billing someone's whole month in one order is the normal case,
so the picker is multi-select — but it is now **chosen, not derived**. It used to
be computed from the lines' provenance, because every line pointed at the exact
`VisitaProducto` it billed (`OrdenLineaOrigen`); with no products on the visit
there is no such pointer, and the table went with it. So marking a visit loads
nothing: it records why the order exists and lets you walk from one to the other.
Cancelled visits aren't offered; everything else is, scheduled included, because
billing before the work happens is normal here.

**An order is a plan's period or some visits, never both.** `ensureNoMezclaOrigenes`
rejects the mix, the UI refuses it before the server does, and the reason is
unchanged: the plan is what was agreed and renews on its own, loose work is
something that happened and gets quoted, and merging them produced an order whose
total you couldn't explain without opening it. The rule about billing *whole*
units now applies only to subscription periods — a visit has no parts left to
take half of.

Deleting a visita is refused while a **live** order says it covers it
(`softDeleteVisita` names it, annul first): an issued document citing a visit
that doesn't exist can't be explained. A draft just loses the link.

`listarPendientes` returns **subscription periods only**, cut off at the end of
the current month: charging a period that hasn't started stays a deliberate,
separate decision. Visits stopped being "pending" when they stopped carrying
products — there is nothing about one that is waiting to be billed.

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

**The gap above the signature line is where the electronic signature is stamped.** Those 90 pt of empty space are not decoration: the seal people paste there is a QR plus three lines of text, some 60 pt tall, and with the old 32 pt it landed across the line and over the name.

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
`src/lib/informes/fotos.ts`: photos are downloaded in parallel and shrunk. A
draft goes to a flat 520 px and is cached in-process (a refresh drops from ~3 s
/ 13 MB to ~0.5 s / 0.15 MB); the filed PDF is sized **per density**, because
what a photo needs is what it measures printed — `LADO_FINAL` is 1200 px at two
per row, 800 at three and 600 at four, all around 350 dpi at their box, and
sending 1200 for all three pays four times the pixels the four-per-row one can
show. The same photo in two densities is downloaded once, at the larger — **not one copy per section**, which is the obvious move and the wrong one: react-pdf reuses an image when the bytes are identical, embedding it once and referencing it twice, so two sizes mean two embedded images (measured: 86 KB shared at 1200 px against 115 KB as 1200 + 600). The library always keeps the original; the shrinking happens in memory while the PDF is built, which is why changing a section from three per row to two prints the next one with more resolution. The
filed informe went from 13.35 MB to 0.71 MB when the shrinking arrived, and
another 18% (two per row) to 73% (four per row) when the sizes split and
`mozjpeg` came in — same q82, encoded better, and only on the filed PDF because
it is slower and the draft exists to refresh fast. **The page breaks are
identical** at any of these sizes because layout reads the height in points the
style declares, not the file's pixels; every photo is re-encoded to JPEG and
flattened onto white, or a transparent PNG would come out black. The preview also accepts **zero firmantes** — it's looked at before
the signature step — while generating still demands one.

**Files belong to the visita, not to any form.** `ArchivosVisita` lives on the
visita's own page and every change — upload, re-tag, delete — goes out on its
own, in any state. Photos get taken *while* the job happens: whoever is in the
garden uploads what they have and carries on, and making them wait for a save
button on another screen, or for the visit to be closed, is asking them to
remember. So neither *Completar* nor *Editar* touches files.

**Closing a visita is its own page** (`/dashboard/visitas/[id]/completar`), not
a dialog, and it is **office-only**: it shows what every assigned person filed,
which obligatorias nobody covered and who hasn't filed at all, and asks only
whether the work is done, with what date, and — if it isn't — why. It no longer
asks for hours or for what was done: the gardeners already said both.

Each file is tagged to a **tarea** (`VisitaMedia.tareaId`) — a photo of a garden
shows work done, not something sold — and **that tag is what makes the informe
build itself**: on reaching step 3 the wizard opens one section per tarea that
was done across the selected visits (`listTareasParaInforme`), titled from the
tarea's name and described from its `descripcion`, with every photo carrying
that tag already inside it. A tarea done in two visits is **one** section with
both visits' photos; a tarea done with no photos still gets its section, because
that is where photos get added; and a tarea that appears *only* as a photo tag
gets one too — in the field you photograph what shows up, a watering problem
during a pruning, and that photo needs somewhere to land. Sections stay editable
and the picker offers the whole tarea catalog, because a section can be about
something nobody filed.

**The tag is asked for at upload, on the phone**, choosing among the tareas that
person just ticked — that is the only moment anyone remembers what each photo
was of, and it is what lets the wizard place it without asking again. With one
tarea ticked it is preselected and no picker appears. From the portal,
`ArchivosVisita` groups files by tarea with the visit's own first, untagged last,
and adding happens *inside* a group, so where you drop it is the tag; there is no
separate "which tarea" field. Re-tagging accepts **any live tarea**, not only the
ones filed. **`archivoSubibleSchema` in `@vivero/shared` is
the one gate for uploads** (web and mobile): only `image/*` and `video/*`, at
most `MAX_ARCHIVOS_POR_SUBIDA` per call. The content type matters because it is
what gets *signed* — the presigned URL carries it and R2 stores whatever
arrives, and `tipo` is derived as "video" or, for everything else, "imagen".

**Who closed a visita is its own pair of columns.** `completadaEl` / `completadaPorId` are stamped on the transition **into** `COMPLETADA` and cleared when it leaves, so re-saving the form to fix a date doesn't make the corrector the one who completed it. They are not `fechaRealizada` — that is the *day the work happened*, chosen by whoever closes it and often earlier — and not `updatedById`, which any later edit overwrites. Each id is paired with a **name snapshot** (`completadaPorNombre`, `updatedByNombre`), the same split `Factura` and `OrdenLinea` already use: the id is what you filter by, the text is what happened. An id alone can't tell the story — `onDelete: SetNull` empties it when the account is removed, and a rename rewrites history — so the ficha shows the text and the list filters on the id. The filters are `completadaPor` and `completadaDesde`/`completadaHasta`, and the person dropdown only lists people who actually closed something.

**One visita per cliente per day.** `createVisitasBatch` refuses a date the
client already has a live visit on, and names it. Two visitas the same day for
the same client are two trips, two chats and two informes for one job; if they
really are two jobs, they go on different days. Cancelled ones don't count — neither as
blockers nor when moved. **Moving a date is checked too**: `updateVisitaInfo`
runs the same rule (shared through `visitasDelDia()`, excluding the visita being
moved) when `fechaProgramada` actually changes, because a rule only the create
path enforces is one you get around by editing — the easier road of the two.

**A visita is editable in any state**, including `COMPLETADA`. The state records
what happened to the work, not whether the row is right: fixing a wrong date
shouldn't mean deleting and rebuilding a visit, which would lose its photos, its
chat and everyone's partes. Neither `updateVisitaInfo`
nor `updateVisitaPersonal` looks at `estado`, and both go through one PUT to
`/api/visitas/[id]` — the shape is parsed once and each field is applied only if
it came, so a partial PUT can't blank the rest. Editing happens on its own page
(`/dashboard/visitas/[id]/editar`), laid out like the create wizard; the client
is the one thing it won't change, since that would orphan the subscription link.

**Deleting a visita marks it, and says who did it.** `deletedAt` +
`deletedById`/`deletedByNombre` (the usual id-plus-name-snapshot split): the row
stays because the photos, the chat and everyone's partes hang off it, and every
query filters `deletedAt: null`, so what disappears is the listings. It is
**refused while a live order says it covers it** — `softDeleteVisita` names the
orden and asks for it to be annulled first, since an issued document citing a
visit that doesn't exist can't be explained. A **draft** is different: it is
still editable, so its `OrdenVisita` row is simply released — an order in firme
keeps its own, which is its history. The informes that cite
it keep their `InformeVisita`: it never reaches the PDF, and an issued document
doesn't change. Nothing in the portal brings it back, and the dialog doesn't
promise otherwise. **Deleting in bulk is one visita at a time**
(`softDeleteVisitas`, `POST /api/visitas/eliminar`): each one has to check its
own orders, and one that can't be deleted doesn't cancel the rest — the response
says how many went and names each one that stayed, with the reason. **How you pick follows the shared
shape** — see *Selección múltiple* under Conventions, the screen it was written
for; here the action is *Eliminar*, which carries neither a trash icon nor the
colour red.

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

**And a subscription period gets billed whole.** `ensureTrabajoCompleto` rejects
an order that takes part of one: touch it and you take everything that period
still owes. The unique index only stops *double* billing, not *partial* billing —
two items of the same period could land in two different orders and nothing
complained. The rule used to cover visits too; with no products on a visit there
are no parts left to take half of. Adding loose catalog products on top is still
fine: the rule is about what's missing, not what's extra. That keeps a sales report to one query instead of a union per revenue
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

**Annulling an order releases what it held, and never silently.**
`[suscripcionItemId, periodoInicio]` is unique across the whole table regardless
of order state, and `listarPendientes` treats any line as billed — so an annulled
order that kept its period would strand it forever. `anularOrden` therefore
refuses while a period or a visit is linked unless `liberarTrabajo` says
otherwise, and the dialog names what gets released before you can proceed. The
visits are the softer half — they reserve nothing — but they go in the same
gesture, because the order stops saying why it exists.

**Any catalog product can be sold.** There is no external catalog to link it to
any more: the invoice line carries a `codigoPrincipal` and a description that are
both ours, so `Variante.sku` (unique, optional) is all a product needs — and
without one the emission derives a code from its id. What the line does need is
a **product from our own catalog**: `OrdenLinea.productoId` and
`FacturaLinea.productoId` are NOT NULL with `RESTRICT`, so a sold product can't
be hard-deleted.

Orders are written **only** through `crearOrden()` in
`src/lib/services/orden.service.ts`. A line's `descripcion` and
`precioUnitario` are a snapshot and are the truth; `productoId` and the
provenance fields (`suscripcionItemId` + `periodoInicio`) are for traceability
and for the unique index that stops a period being billed twice — they are never
the source of the price.

## External integrations (admin app)

- **WhatsApp** (Meta Cloud API) — `src/lib/whatsapp/`. Sends OTPs and notifications; receives inbound messages via the webhook at `/api/webhooks/whatsapp`. Env: `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Push notifications** (Expo) — `src/lib/push/`. `triggers.ts` is invoked from services on visit state changes. Env: `EXPO_ACCESS_TOKEN`.
- **Object storage** (Cloudflare R2, S3-compatible) — `src/lib/s3.ts`. Uploads use presigned URLs; region is always `auto`. Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL_BASE`.
- **Rate limiting** (Upstash Redis) — `src/lib/mobile/rate-limit.ts`. Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **SRI e-invoicing** — `src/lib/sri/`. The portal builds the XML, signs it with the emisor's `.p12` (XAdES-BES, via `facturacion-electronica-ec`) and talks to the SRI's SOAP services itself; there is no intermediary. Who issues (RUC, establecimiento, punto de emisión, ambiente, certificate) lives in the DB as **Emisor** rows — several are allowed and one is picked at emission time. The only env var is `FIRMA_ENCRYPTION_KEY`, which encrypts the stored `.p12` (AES-256-GCM); **changing it makes every stored certificate unreadable**. **Read [the doc](./.claude/docs/facturacion-sri.md) before touching it.**
- **Cron** — `/api/cron/notificaciones` (scheduled notifications), `/api/cron/renovaciones` (creates BORRADOR orders for due subscription periods; idempotent — it used to also sweep up completed visits that had no order, and that half went with the visita's products: a visit leaves tareas, which have no price) and `/api/cron/facturas` (asks the SRI about every invoice that can still change). All gated by `CRON_SECRET` and registered in `apps/admin/vercel.json`. **The SRI never calls us back** — it has 24 h by law to authorize, so without that sweep an invoice that wasn't resolved on the spot sits at `ENVIADO` until someone presses *Consultar al SRI* by hand. **All three run daily, and that's a plan limit, not a preference**: Vercel's Hobby tier rejects at deploy time any cron that would fire more than once a day — `0 * * * *` doesn't fail at runtime, it makes the whole deployment fail. `facturas` wants to be hourly; on Pro it can be, or an external scheduler can hit the endpoint with the `CRON_SECRET`. Those drafts surface as a counted notice on **Por cobrar** (`borradoresSinConfirmar`) rather than as rows, so the cron's output never goes unnoticed without pretending a draft is money owed.

**Two things break only in the deployed runtime, never in `next build` or in dev** — both were found the hard way, from Vercel's runtime logs, and both are guarded in `next.config.ts` / the code:

- **Nothing on the server may pull in `jsdom`.** Its dependency chain ends in a `require()` of an ESM module, which throws *while loading the file*, so any page importing it 500s before running a line. That is why `src/lib/html-seguro.ts` sanitizes with `sanitize-html` (no DOM) instead of DOMPurify.
- **`sharp` opens `libvips-cpp.so` with `dlopen`**, which file tracing cannot see, so the lambda got the binary without the library it needs. `outputFileTracingIncludes` asks for `node_modules/@img/**` explicitly, and `outputFileTracingRoot` points at the monorepo root because npm workspaces installs there.

Other env: `DATABASE_URL`, plus `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — **required in production**: without the secret next-auth doesn't sign sessions and nobody can log into the dashboard, and dev auto-generates one so the problem only shows up on deploy. `apps/admin/.env.example` lists every variable with what breaks without it.

## Conventions

- Admin imports use the `@/*` alias → `apps/admin/src/*`. Mobile uses `@/*` → `apps/mobile/*`.
- Validation: Zod schemas shared cross-app live in `@vivero/shared`; admin-web-only schemas live in `src/lib/validations/`. Validate request bodies/queries at the route boundary with `safeParse`.
- Admin UI: shadcn/Base UI components in `src/components/ui/`, Tailwind v4, feature components grouped by domain (`src/components/visitas`, `clientes`, etc.). **Every dashboard route segment has a `loading.tsx`** (`src/components/shared/page-skeletons.tsx`): without one the App Router waits for the server component's queries *before* navigating and the click feels stuck. Add one when you add a route. **List pages follow one layout**: the page root is `flex h-full flex-col` — `h-full`, never `min-h-full`, or the content grows past the viewport and pushes the pager below the fold. The card is a `flex flex-col` holding a `min-h-0 flex-1` scroll area (`<Table containerClassName="h-full overflow-y-auto">` + `<TableHeader sticky>`) and, as its footer, `<TablePagination>` (`src/components/shared/table-pagination.tsx`), which renders even with a single page. So only the rows scroll — filters, header and pager stay put — and the height comes from the container instead of a hand-tuned `calc`. `FILAS_POR_PAGINA` is the one page size for every listing; card grids pass `suelta` to drop the footer styling. **A list's filters, search and page number live in the query string**, via `useFiltroUrl` (`src/lib/filtros-url.ts`) — a drop-in for `useState` that mirrors the value into the URL with `history.replaceState`. Opening a record and pressing back re-creates the page from scratch, so anything held only in React state is lost and has to be typed again; the URL is what the browser actually remembers. **Every row link carries `?from=` built with `aca()`** (or `useAca()` when the href is built during render — `window` doesn't exist on the server and a differing href is a hydration error), and every detail's back arrow honours it via `hrefDeVuelta()` (`src/lib/navegacion.ts`), which rejects anything outside `/dashboard/`. That arrow — not the browser's — is how people actually go back, so a hard-coded `href="/dashboard/x"` there throws the filters away. Only the value that differs from the default is written, so an untouched list keeps a clean URL. The pages whose filters the **server** reads are `/dashboard/visitas` and `/dashboard/informes`, because their lists are server queries — and there the filters must be applied with `router.replace`, not `useFiltroUrl`: rewriting the URL by hand asks the server for nothing, so the table kept showing the previous month's visits while the controls said otherwise. `replace` and not `push` so back leaves the list instead of undoing one filter at a time — and it matters twice over for the search box, where `push` would leave one history entry per keystroke. **Both search by client with a text box instead of a client dropdown**, and the search runs in the query (`ILIKE` over nombre/apellido/empresa, plus the título on informes): the list is paginated, so filtering in the browser would only search inside the page you can already see. **The text is matched word by word, never as one phrase** — `filtroClientePorTexto` (`src/lib/services/busqueda.ts`) for the Prisma queries, `palabrasParaIlike` for the raw SQL of the informes list: every word has to appear in *some* field, so "Maria Luisa" finds both the woman whose first name is that and the Maria whose surname is Luisa, and the order stops mattering. The phrase-against-each-field version failed at the most ordinary thing anyone types — a first name and a surname — and you had to search one or the other. That rule lives in one place because it was written three times and two of them were wrong; the clientes list adds the teléfono to the same per-word question. **The same box also takes the record's own `numero`, with or without `#`** (`numeroBuscado`), because "#194" is how a visita or an informe gets named out loud — OR'd with the text search, so a cliente called "Grupo 24" or a título with a year in it keeps working, except for a single digit, which is a number and nothing else (`esSoloNumero`, the same rule the global search uses: "1" as text matches every phone and half the titles). Both text inputs go through **`useBusquedaEnUrl`** (`src/lib/filtros-url.ts`), which debounces ~300 ms and, crucially, tells the **echo** of what it just sent apart from a change that came from elsewhere: it remembers the last value it pushed, adopts the URL only when it differs (back/forward, *Limpiar filtros*, a link that arrives filtered), and otherwise lets what is being typed stand. Deriving the field from the URL — the obvious version — loses every letter typed while the query was in flight: the request for `?q=Jor` comes back half a second later, the field snaps to "Jor", and the "ge" typed meanwhile is gone, which is what "I can't type continuously" turns out to mean. And **the list must not be replaced while the new one loads** — swapping it for a "Cargando..." or letting `loading.tsx` take over makes the page look like it reloads itself on every keystroke — so both pages navigate inside `startTransition` and dim the old rows until the new ones arrive. Anything else that can outgrow the viewport does the same internally: the visits calendar is a `flex h-full flex-col` card whose month header stays outside the scroll area and whose weekday row is `sticky top-0` with an **opaque** background — a translucent one lets the rows show through as they pass under it. Date filters use `DateRangePicker` (one field, two months, shortcuts for hoy/ayer/mañana/semana/mes) rather than a Desde+Hasta pair — a single day travels as `desde === hasta`. Any calendar heading is a `MonthYearPicker` so jumping to another year is three clicks, not twenty. **Anything that floats — a calendar, a dropdown — goes in a portal**, never in an `absolute` hung off its field: `DatePicker` did the latter and got cut in half on short screens (the wizard's scroll area clipped whatever stuck out above the field, leaving the last two rows of the month and no header), and it decided up-vs-down by measuring only the space *below*, so it would flip up into a place where it didn't fit either. The same bug is why `CustomSelect` renders `fixed` in a portal. `Popover` (Base UI) already flips, shifts and stays on screen; give the content a `max-h` so a very short window scrolls inside the popup instead of clipping it. **On the phone, a menu becomes a drawer and a form becomes the screen.** A control that opens a short list of choices — a sort order, a bulk *Mover* — is an anchored popover on the desktop and, below `md`, an icon beside the search box (or a plain button, *without* the dropdown chevron, which promises an anchored menu that isn't what happens) opening a bottom `Sheet` with rows big enough for a thumb: the desktop dropdown spent a whole line on something almost never changed, and a menu pinned to the top of a 375px screen is the far end from the hand. Both presentations live in **one** component (`SelectorOrden`, `MoverSeleccion`/`MoverSeleccionMovil`) sharing the option list, so which one is chosen can't drift between screens. A **form** goes the other way: `DialogContent` takes `pantallaCompletaEnMovil`, which below `md` makes it fill the viewport (`h-dvh`, not `h-screen` — `100vh` counts the address bar even while it's showing) as a flex column, so the body scrolls (`min-h-0 flex-1`) and the buttons stay put. A centred box with a text field fights the keyboard: the keyboard takes half the screen, the box shifts to avoid being covered, and Guardar ends up out of view. Confirmations are the exception and stay centred — two lines read better that way. **Selección múltiple** follows one shape wherever it appears (visitas, tareas). On the desktop table every row has a checkbox and, with something marked, a bar **covers the header row** — the count, the select-all box (indeterminate: clicking it clears) and the actions. It covers rather than sits above because a strip above the table pushes every row down at the moment someone is aiming at one, and it is rendered **outside** the `<table>` rather than in a `<th>` because the table scrolls horizontally and the button went off screen with it; aligning its checkbox over the column's is a matter of spacers carrying the same width classes as the `<th>`s before it. The phone has no room for a checkbox column, so selection is a **mode**: a `soloMovil` header action ("Seleccionar visitas", "Seleccionar tareas") turns the rows into checkboxes and floats `BarraSeleccionMovil` (`components/shared/barra-seleccion-movil.tsx`) over the nav with the count, a ✕ to leave, and the actions — with more than one, the rest go behind a ⋯ beside it, since about four controls is the ceiling at 375px. The bar shows even with nothing marked: it is what says the mode is on, and how to get out. A row that would open the record must not sometimes navigate and sometimes mark, so while selecting it is a `button`, not a `Link`, and the checkbox is `pointer-events-none` — the row is the touch target, and letting the box take the tap too marks and unmarks in one gesture. A spacer the height of the bar goes at the foot of the list, or it covers the last row. **Actions on that bar are never `destructive`**: the house variant is a 10% wash made for a light card and vanishes on the dark pill, so they use `ACCION_BARRA_MOVIL` (light on dark); the red belongs to the confirm dialog, which is where the decision is made. Header actions render their `icon` **only on the desktop buttons**; the phone's ⋯ menu lists them by name alone. Mobile UI: react-native-paper, theme primary `#2e7d32` (green).
- Mobile state: Zustand stores in `apps/mobile/lib/` (`auth-store.ts` holds the token pair; `lib/api.ts` is the fetch wrapper that auto-refreshes access tokens on 401). The mobile app reaches the server via `EXPO_PUBLIC_API_BASE_URL` (set to your LAN IP for a real device; defaults to `http://localhost:3001`).
- React 19 across the monorepo; root `package.json` pins shared native/React versions via `overrides`.
