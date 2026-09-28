# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **The app is in Spanish — Ecuador's Spanish, with *tuteo*.** All UI strings, user-facing text, error messages, and domain vocabulary (cliente, servicio, visita, personal, sector, informe, notificacion) are in Spanish. Write every user-facing string with **tú**: *crea*, *elige*, *prueba*, *agrega*, *escribe*, *pon*, *puedes*. **Never voseo** (*creá*, *elegí*, *probá*, *ponele*, *vos*, *podés*): the vivero is Ecuadorian and its clientes and jardineros are the ones reading it. Match the existing Spanish naming conventions in code. **The UI never says "la oficina" for the admin/staff side**: name the role (*Administrador*, *Staff*, *Personal* — `ETIQUETA_DE_ROL` in `@vivero/shared`) or say *un administrador*; "oficina" in this file is shorthand for the docs, not a word the screens use, and "Campo" for a gardener went the same way.

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

# Propiedades y visitas para *mirar la interfaz*: le pone pin y medidas a las
# que ya están —dejando una de cada tres **sin ubicación** a propósito, que es
# el estado que hay que poder ver—, le agrega una segunda propiedad a uno de
# cada seis clientes, y siembra ~22 visitas repartidas en el tiempo y en todos
# los estados, con el jardinero que **puede iniciar sesión** en la mitad de
# ellas. Las visitas que ya estaban se **archivan** (`deletedAt`), no se borran:
# 81 están citadas por una orden y 75 por un informe, y borrarlas se llevaría
# esos vínculos para siempre. `--limpiar` las devuelve, borra lo creado y
# deshace pin por pin lo que tocó.
npx tsx --env-file=.env scripts/seed-propiedades-y-visitas.ts
npx tsx --env-file=.env scripts/seed-propiedades-y-visitas.ts --limpiar

# Dos visitas cerradas, con partes de dos personas y **fotos reales en R2**,
# etiquetadas por tarea: el escenario mínimo para probar que el asistente de
# informes arma sus secciones solo. El jardinero que **puede iniciar sesión**
# va en las dos, y el cliente se elige sin visita viva en esos días, para
# correrlo encima de `seed-propiedades-y-visitas` sin chocar con su regla. Sube las imágenes de verdad porque el PDF
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

1. **Web dashboard** (`/api/*`, server components, `/dashboard/*`): **NextAuth** (`next-auth`, JWT strategy, credentials provider) in `src/lib/auth.ts`. Guard server code with helpers in `src/lib/auth-helpers.ts` (`requireAuth`, `requireAdmin`, `requireRole`). `src/middleware.ts` protects `/dashboard/*`. Never `CLIENTE` — they log in on the app. **The login field takes a usuario *or* a correo**, in one box: `buscarCuentaPorIdentificador()` (`acceso.service.ts`) looks for an `@` and picks the column, and both login paths call it, because asking the same question in two places is how they started answering differently. That exists because **`User.email` is nullable**: a gardener has no email, so their account carries `User.usuario` instead — lowercase, no `@`, dictated over the phone. Postgres allows many nulls under a unique index, so accounts without email coexist without a sentinel value. **Inviting a user creates no password** — the row is written with `password: null` (both login paths reject that) and the person sets their own through a single-use link that the admin can copy or that goes out by email; the same endpoint reissues one for an existing account. **The link is for whoever *cannot* get in**; someone already inside changes their own password by typing the one they are using (`cambiarContrasenaPropia`, `POST /api/mobile/auth/cambiar-password`, in the app's Cuenta screen). That is the same proof of identity without depending on a channel a gardener does not have — no email means no link to send. It changes only your own: setting somebody else's is still issuing them a link from their ficha. It also **revokes your other sessions**, keeping the phone that made the change, because the usual reason to change a password is that someone else knew it. **Revoking access blocks, it doesn't delete** — the account stays because its owner's name signs the visits and informes they made; what gets cut is `User.accesoRevocadoEl` plus their pending links and refresh tokens, and `getCurrentUser()` re-reads the row on every request so a live JWT session dies with it. A revoked person comes back by **using** a link issued after the revocation — setting the password is what clears the flag, not issuing the link, or the account would work again with the old password while the link sat unread. See [the passwords doc](./.claude/docs/autenticacion-clientes.md).

2. **Mobile** (`/api/mobile/*`): **custom JWT** (`jose`) with separate access/refresh secrets (`MOBILE_ACCESS_SECRET`, `MOBILE_REFRESH_SECRET`), see `src/lib/mobile/jwt.ts`. **One login for the four roles**: `POST /api/mobile/auth/login` takes one identifier — the gardener's dictated `usuario`, an email, or the cliente's phone — and `autenticarEnLaApp` (`services/login-app.service.ts`) works out who it is, trying the team account (`User`) first and the cliente's ficha second, returning the role with the `personalId` or `clienteId` that scopes the session. There were two routes and two screens, so the first thing a freshly installed app asked was which side of the business you are on — our question, not theirs: a gardener does not know a clients screen exists, and a cliente landing on the team's typed their phone and got "Credenciales inválidas" without learning they were in the wrong place. Only an email can exist on both sides, and there the one whose password validates wins. Clients' passwords are still self-set through an invite link (see [.claude/docs/autenticacion-clientes.md](./.claude/docs/autenticacion-clientes.md) — the old WhatsApp OTP login is gone). Guard mobile routes with `requireMobileUser` / `requireMobileRole` + the `isMobileUser` type guard from `src/lib/mobile/auth.ts` (these return either a `MobileUser` or a `NextResponse`, so always narrow before use).

**The gardener has three screens, in both apps: Visitas, Chats and Cuenta.** No *Más*, no panel: `/dashboard` sends a `PERSONAL` straight to Visitas (`redirect` in `dashboard/page.tsx`), the phone bar lists exactly those three (`HREFS_TAB_PERSONAL` in `mobile-nav.tsx`, `roles` on everything else) and the desktop sidebar lists Visitas and Chats, with Cuenta being the **block with the name at its foot** — for every role: that block used to open a menu holding the name again and *Cerrar sesión*, which the Cuenta page already has, so now it simply links there and is highlighted while you are on it (a gardener has no email, so under the name goes the role), and *Cuenta* (`/dashboard/cuenta`) is the app's account screen brought over — name and role, usuario/email, *Cambiar contraseña* through `POST /api/auth/cambiar-password` (the web twin of the mobile route: same `cambiarContrasenaPropia`, no refresh token to keep, so every app session gets revoked) and *Cerrar sesión*. The old **gardener's panel is gone.** `/dashboard` branches on the role and returns early for `PERSONAL` (`components/dashboard/panel-jardinero.tsx`): *Visitas de hoy*, *Próximas visitas* and *Mensajes*, and nothing else. It used to show the office's cards — "Mis visitas de septiembre", a completion ring — and none of them were his to act on: a gardener doesn't schedule and doesn't close, so a completion percentage measures him against something he can't move, and it took the top half of the screen. Mensajes is a section there rather than a nav entry, with *Ver todas* into the full inbox, so his menu is two items that get used instead of three where one repeats what's already on screen. That section is also why `visibleVisitaIdsForViewer` (`chat.service.ts`) now answers for `PERSONAL` — the visitas he is assigned to. It threw `ForbiddenError` for him while the menu offered him Mensajes, a leftover from when the chat was between the office and the cliente; since each gardener files his own parte, the visit's chat is where he's told the gate is locked.

Roles (`UserRole` enum): `ADMIN`, `STAFF`, `PERSONAL`, `CLIENTE`. **Every gardener has their own account**: `PERSONAL` sees the visitas they are *assigned to* and writes exactly one thing in them — their own parte (their hours and the tareas they did). There used to be a `PERSONAL_ADMIN`, a lead who ran their whole group's visitas and closed them on everyone's behalf, scoped to sectors through `SectorAdmin`. It went when each gardener started filing their own part: with that, there is nothing left to delegate. Scheduling and closing are `ADMIN`/`STAFF`. `SectorAdmin` went with the role — it existed only to scope it — while `Sector` stays, because that is how clientes are grouped. **A gardener's account is born with their ficha**, in the same transaction — `POST /api/personal` calls `crearCuentaPersonal(tx, …)`, and a migration backfilled everyone who was already loaded. It used to be a separate button on the ficha, and a separate button is a step somebody skips: people ended up loaded but unable to open the app, and nobody found out until a parte was due. Creating it always opens nothing — an account with no password gets in nowhere — and whoever shouldn't be in there gets revoked. The `usuario` is **generated**, not typed: first initial plus first surname, accents and ñ stripped (`Fernando Herrera` → `fherrera`), numbered on collision (`fherrera2`), because two Fernando Herreras in one cuadrilla is ordinary and the unique index would otherwise reject the second one right as their ficha is being saved, where nobody is thinking about usernames. On `/dashboard/personal/[id]` the usuario is **the first row of Información General**, above the name — it is what you dictate to get them in, and what someone opens the ficha to look up — and it is edited there with everything else: `personalSchema` carries it, `PUT /api/personal/[id]` applies it only when it **changed** and only for an ADMIN, and the form surfaces the server's message (`ya está tomado` says what to fix; `Error al guardar` sends you guessing). It had its own card and its own save, which meant two saves to correct one typo. *Editar*, *Restablecer contraseña* and *Revocar acceso* live together in one **Acciones** dropdown in the header: all three are rare enough that a button each spent a whole header on something done once per person. Under the data sits a **Visitas** card — the visits where that person is *assigned* (`removedAt: null`, not their grupo: the grupo says who they usually work with, the assignment says where they actually went), newest first, paginated eight at a time through `?vpag=` in the URL, because opening a visit and coming back rebuilds the ficha from scratch and a page held in React state would be lost. The link is **not** issued at creation — that would burn its week of validity the day the ficha is loaded, usually before the person starts. Renaming is `PATCH /api/personal/[id]/usuario`, kept because the generator sometimes gets it wrong and deleting the account to fix it would take the history of who filed which parte. Nobody types anybody's password, here either. Usuarios lists **only the office** (`ADMIN`/`STAFF`) for the same reason: the gardener's name, phone and grupo live on their ficha, and a second screen for the same person is how two screens start disagreeing. The list shows a four-state *Acceso* column (`estadoDeAcceso`), because "sin cuenta", "falta que elija su contraseña" and "revocado" are fixed three different ways. **Archiving someone revokes their access** — their ficha leaves the lists but the account kept letting them in, chat included. **The Personal and Grupos lists are one query each, in the service**: `listPersonal` computes `acceso` (`estadoDeAcceso`) and carries the cuadrillas, `listGrupos` carries `_count.visitas`, and the portal's pages read them instead of querying on their own — they each had their own `include` while the app asked for the same people through `/api/mobile/*`, so the two lists showed different fields of the same person. The password hash is selected only to answer "falta que elija su contraseña" and is swapped for that word before the row leaves the service. **Both delete in bulk**, and deleting here is archiving: `archivarVariosPersonal` / `archivarVariosGrupos` (`POST /api/personal/eliminar`, `/api/grupos/eliminar`, and their `/api/mobile/*` twins) go **one at a time**, because each row has its own to check — a persona's account also gets revoked — and one that fails must not cancel the rest; the response says how many went and **names** each one that stayed, with its reason, which is what lets the screen tell you which to retry (`ResultadoEnLote` in `services/lote.ts`, `useEliminarEnLote` on the portal, `lib/lote.ts` in the app). Repeated ids are collapsed first, or the second pass would report "not found" for something it had just archived. Picking follows the *Selección múltiple* shape below — on grupos' desktop the bar shares the search row instead of covering a header row, because a card grid has none and a strip of its own would push the cards down just as someone is aiming at one.

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

Core entities: **Cliente** (customer) → **Propiedad** (where the work happens) → **Visita** (a scheduled visit) carried out by **Personal** (organized into **Grupo**s), scoped by **Sector** (geographic; it groups **propiedades**).

**The address belongs to the property, not to the client.** `Propiedad` holds ciudad, sector, dirección, número de casa, referencia, a `lat`/`lng` pin, and what there is to maintain: `m2Total`, `m2Cesped`, `numeroArboles`, `mlVegetacionBaja`/`Media`/`Alta` and `jardinerasPlantaAlta`. A client with two houses has two addresses and neither of them is "theirs" — and those numbers are what a quote is built from: how much lawn to cut, how many linear metres of hedge and at what height. Every number is optional, because they get measured over time and a freshly loaded property is already good enough to schedule against. **The sector moved with the address** because it is geographic: it belongs to the place, not the person — somebody with a house in Isla Mocolí and an office in Vía a la Costa is in two sectors, and with the sector on the client you had to pick one and the other was miscounted. `/dashboard/sectores` therefore lists propiedades, each carrying its client's name. What stays on `Cliente` is who gets billed and who gets notified. **A cliente can be marked inactive** (`Cliente.inactivoDesde`, `null` = active; `marcarClienteInactivo`, `POST /api/clientes/[id]/inactivo` and its mobile twin, from the ⋯ on the ficha in both apps): it is not archiving — the client stays in the lists and keeps every visita, orden and informe, with an *Inactivo* badge — what changes is that `createVisitasBatch` refuses them and the scheduling wizard shows them dimmed and unselectable in both apps, with *Inactivo* under the name, rather than hiding them: seeing why someone can't be picked beats not finding them. It is for the one who stopped contracting but may come back, which is the usual case; archiving is for the record that shouldn't exist. The lists show *Activo* / *Inactivo* beside every name (an *Estado* column on the desktop table, where it replaced *Propiedades*; a pill by the name on the phone and in the app — `EstadoDelCliente` on each side, one pill so that an active client isn't the one with nothing said), filter by it (`?estado=activos|inactivos`, the same param on `/api/mobile/clientes`, applied in the query), and the selection bar changes it in bulk (`marcarVariosClientesInactivos`, `POST /api/clientes/inactivo` and its mobile twin — an `updateMany`, since there is nothing to check per row; reversible, so no confirmation). **A cliente is born with its first propiedad**, in the same transaction — same reason a gardener is born with their account: loading it in two steps guarantees somebody skips the second. **And the alta asks for the whole propiedad**, the same fields as the propiedad's own page — sector, the pin on the map (the portal) or *Usar mi ubicación* (the app), the six measurements, jardineras and its notes — through one set of fields shared by both forms (`campos-de-propiedad.tsx` on the portal, read through `FormProvider` with `propiedad.` as the prefix; `useCamposDePropiedad` + `CamposDePropiedad` in `PropiedadForm.tsx` in the app). It used to ask for the address and the total area and nothing else, so the propiedad was born half loaded and had to be reopened to finish it — the second step being born together exists to avoid. There the name may be left empty and becomes *Principal* (`clienteConPropiedadSchema` relaxes the `min(1)`; with it, an empty name silently blocked the submit, because the field showed no error). **`Visita.propiedadId` is NOT NULL**: a visit happens in a place, and the place is what says how much lawn there is. The migration gave every client a "Principal" property with what they already had and assigned it to their existing visits, so the column was born required with no in-between state every screen has to handle forever. Deleting a propiedad is refused while visits point at it (those visits happened there); if the work stopped, stop scheduling it. **The app loads them too**, not only the portal: `/api/mobile/clientes/[id]/propiedades` (POST, PUT, DELETE) is the same service behind the same rules, the cliente's ficha lists them with an *Agregar*, and the scheduling wizard asks which one — `Visita.propiedadId` is NOT NULL and the phone was not sending it, so scheduling from the app was failing on a validation message that named nothing. With a single propiedad it is picked for you, which is the usual case, but it still has to travel. Editing a cliente from the phone no longer shows the address: those fields were there and `updateClienteSchema` has no `propiedad`, so Zod dropped them and the correction silently did nothing. **An informe and an orden say which propiedad they are about, and neither stores it**: the informe counts the work of some visitas and the orden bills it, and the visita is the one that knows where it happened — so it is derived from `InformeVisita` / `OrdenVisita` (`propiedadesDeVisitas` in `@vivero/shared`). A stored column would be a second answer to the same question, and it is the one that goes stale the day somebody fixes the visit; it also could not hold the normal case, which is **several** — billing a whole month for a client with two houses is one orden covering visits at both. When there are none, nothing is shown rather than a dash: an informe can be assembled with no visitas at all — and an orden of a plan's period takes the **plan's** propiedad (`propiedadesDeLaOrden` in `orden.service.ts`), since a plan is of a garden. The lists put it under the client's name instead of in a column of its own — it is the same "where" as the client, and a column is paid for in width all the time — and each visita row names its own propiedad only when the record spans more than one, since repeating the same house on every row distinguishes nothing. **Searching an address from the app goes through the server too** (`/api/mobile/lugares`, Places API New on the same `GOOGLE_MAPS_SERVER_KEY`, which has to allow that API as well) and, like the portal's, it **never sets the pin** — it fills in the street and the city. What Google answers for "Blue Bay, Isla Mocolí" is the centre of the urbanización: two hundred houses share that point, which is the very datum the pin exists to replace, and storing it as if it were the door is worse than having no pin because nobody can tell afterwards that it was approximate. The app's search carries a session token so Google bills a whole search as one query, and the field disappears when the route answers 404, so a server without the key still loads properties. **The app shows a Google Maps stamp, and the server is the one that asks for it** (`/api/mobile/mapa`, `GOOGLE_MAPS_SERVER_KEY`): a key is protected by its website restriction, and a native app has no website to send — a key shipped inside the bundle would be both unrestricted and extractable. So it is a **second key**, restricted by API to **Maps Static API** (enabled separately) and never leaving the server, with the route requiring a mobile session so it is not an open proxy that bills our account, and an in-process cache because a property's pin does not move. Without the variable the route answers 404 and the app draws its own striped panel — the card still works, what is missing is the photo. It is a still image on purpose: in the visit's ficha what you need is to recognise the block and drive off (*Llegar*), not to explore with a thumb; an interactive one is `react-native-maps` — native module, one more key for Android, rebuilding the app — for a 150 px postcard. **The app has the same map, native** (`MapaDePropiedad`, `react-native-maps` with `PROVIDER_GOOGLE` on both platforms and `mapType="hybrid"`): tap to place the pin, drag to move it, *Usar mi ubicación* stamps the reading and flies there with a zoom picked by its precision (over 150 m it says so, since that reading is a WiFi cloud), and the search moves the map to the block and never sets the pin. Placing by hand doesn't recentre, like the portal. Google on iOS too, and not Apple Maps (which needs no key), because the two satellite layers don't line up to the metre and a pin placed on one and read on the other lands on the neighbour — exactly the error the pin exists to remove. It used to be *Usar mi ubicación* alone, with the map left to the portal to avoid two more keys, so the fine correction waited for a desk. The keys are per platform and per app — `GOOGLE_MAPS_IOS_KEY` (restricted to the bundle id and Maps SDK for iOS) and `GOOGLE_MAPS_ANDROID_KEY` (package + SHA-1 and Maps SDK for Android) in `apps/mobile/.env`, never committed — and `app.config.ts` feeds them to `ios.config.googleMapsApiKey` / `android.config.googleMaps.apiKey`, which Expo's prebuild bakes into the binary (`react-native-maps` 1.20 ships no config plugin of its own); a key change or the first install needs `npx expo prebuild --clean` and a new native build. The visita's ficha keeps the static stamp (`/api/mobile/mapa`): there the point is looked at, not chosen. **The map pin is Google Maps** (`@vis.gl/react-google-maps`, satellite+labels), set by tapping and dragging. It started on Leaflet over OpenStreetMap — no key, no billing — and the street map was fine for the city but not inside the private urbanizaciones, which is where nearly every property is. It needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, with **Maps JavaScript API** and **Places API** enabled on a project that has a billing account (required even under the free allowance), and the key restricted by website and by those two APIs — the key reaches the browser because that is where the map is drawn, so the domain restriction is what protects it, not hiding it. Without the variable the section says so instead of drawing a grey box, and the rest of the property still saves. Searching an address moves the map but **never sets the pin**: the result for "Blue Bay, Isla Mocolí" is the centre of the urbanización, which is exactly the datum the pin exists to replace. **The search suggests as you type** (Places `AutocompleteSuggestion`), which is affordable because of the **session token**: every keystroke of one search carries the same token and Google bills them as a single query, and the session *closes* when the chosen place’s `fetchFields` is called — so a fresh token is minted after each pick, or every query goes back to being billed on its own. It began as a *Buscar* button for exactly that cost, and the button also forced you to take one of the results. Everything that **finds** a place moves the map to it — the search, *Usar mi ubicación*, opening a property that already has a pin — while placing the pin **by hand does not**: tapping or dragging leaves the point where the finger put it, and recentring there slides away the corner and the neighbouring roof being used to aim. It is also what will finally let the office compare a mark against the site: until now `entradaLat/Lng` had nothing to be measured against. A visita may demand certain **Tarea**s (**VisitaTareaObligatoria**) and records what each assigned person actually did (**VisitaPersonal** + **VisitaPersonalTarea**), accumulates **VisitaMedia** (photos/videos, each optionally tagged to a tarea — which is what lets the informe place it), collects the client's **CalificacionVisita**, and rolls up into **Informe**s (PDF reports, rendered with `@react-pdf/renderer` in `src/lib/informes/`; `Informe.fecha` is the date **printed** on the PDF and `generatedAt` the instant it was built — a report for August can be assembled in September). **An informe is edited by making a new version, never in place.** It used to be immutable — correcting it meant deleting it and building another with its own `numero` — because a client holding the old PDF would have a document that no longer matched ours. `InformeVersion` is what dissolves that: every generation keeps its own PDF, so the one they hold still opens. `PUT /api/admin/informes/[id]` re-renders, bumps `versionActual`, replaces the sections wholesale and appends a version row (with an optional note saying what changed); the `numero` never moves, because it is the same informe corrected. **The heading is written, not assembled.** `Informe.encabezado` holds it as HTML and it is what prints: `<h2>` is a line in the título style (green, 14 pt) and `<p>` one in the subtítulo style (blue, 12 pt), with `<strong>`/`<em>`/`<u>` on top and `<br>` cutting inside a line. It used to be `titulo` plus a second line the renderer built by itself — `ACTIVIDADES REALIZADAS PARA <cliente>` — which nobody could touch: a long urbanización name wrapped and hyphenated mid-word and there was no way to move the break. What the editor offers is **size (in points, typed or picked), font, colour of the text and of its background, bold/italic/underline and alignment** — the toolbar shape Shopify's product description uses, minus everything a heading has no use for. **The fonts are the three the PDF carries inside plus seven shipped with the app** — Helvetica, Times New Roman and Courier New are the standard PDF families, each a name per face (`FAMILIA` in `render.tsx`); Roboto, Open Sans, Lato, Montserrat, Poppins, Merriweather and Playfair Display are OFL files under `src/lib/informes/fuentes/` (four static TTF faces each, fetched from the Google Fonts CSS endpoint with an old `User-Agent`, since the `google/fonts` repo mostly holds variable fonts that fontkit can't read) that `fuentes.ts` registers with `Font.register` before every render, by absolute path — which is why the folder is in `outputFileTracingIncludes`, like sharp's libvips, and why the render falls back to Helvetica if the folder isn't there. The editor pulls the same families from Google Fonts with a `<link>` so what you pick is what you see. The list is `FUENTES_DEL_INFORME` in `encabezado.ts` and the sanitiser's `font-family` regex names them too. Helvetica is the document's own, so picking it *unsets* the mark and the HTML stays clean. Two traps in reading `font-family` back: the parser doesn't decode attributes and `sanitize-html` writes the quotes as `&quot;`, which carries a `;` inside and split the declaration when cutting by semicolon — `estiloDe` decodes the quotes first — and the browser appends fallbacks after a comma (`"Times New Roman", serif`), so `fuenteDesdeCss` reads only the first name. Points, not pixels: the number chosen is the number the PDF prints. `encabezado.ts` translates that HTML to react-pdf (`htmlparser2`, never a DOM — see `html-seguro.ts` for why), reading `font-size`, `font-family`, `color`, `background-color` and `text-align` off the tags with an inner-most-wins stack, and `encabezado-texto.ts` holds the string helpers the **browser** also needs, so importing them into the wizard doesn't drag the parser into the bundle. `sanitizarEncabezado` is its own allowlist because this is the one place where `style` has to survive — only those four properties, each validated against a regex. The colour menu is a real picker (`components/ui/color-picker.tsx`: saturation square, hue bar, hex field and swatches, in about a hundred lines and no dependency) with **Texto/Fondo** tabs — `input[type=color]` was there first and opens the operating system's own window, which is not where the colour was asked to be chosen. The toolbar reads the cursor through **`useEditorState`**, never `editor.getAttributes()` straight in the render: Tiptap 3's `useEditor` does **not** re-render on a bare selection change, so the controls kept showing the previous cursor's values — click a 12 pt line and the box still said 14. The heading block must **not** be `alignItems: "center"`: that shrinks every line to its text width and centres it, so `textAlign: right` moved nothing; stretched full width, the line's own alignment decides. `titulo` survives as the plain first line — it is what the list shows and what the search matches — derived server-side from the heading, because two names for one thing drift apart. **Null means the old shape**: an informe from before the field prints exactly as it did, and reopening one seeds the editor with that same default (`encabezadoPorDefecto`), marks included, so nothing changes appearance by being re-saved. Helvetica is why the marks are resolved with a table instead of accumulated styles: bold and italic are *different families*, and asking Helvetica-Oblique for `fontWeight: bold` gets you nothing. **A section is written in one field, with the same editor** (`EditorDeTextoRico` in `components/informes/editor-de-texto.tsx`; `EncabezadoEditor` is now that editor centred and tall): the first line is the title and what follows is the description — the editor dresses the first paragraph as a title (`primeraLineaComoTitulo`) so the field says what it is, and on every change `partirPrimerBloque` cuts the HTML after the first top-level block (counting nested lists, so a list is never cut in half) into the two columns of always, `titulo` and `descripcion`; there was a field for each, and two toolbars per section said the same thing twice. The app's edit sheet is one multiline field split at the first line break, for the same reason. The editor also does **lists** — bullets and numbered, `<ul>`/`<ol>`/`<li>` that `parsearEncabezado` turns into lines carrying a `vineta` and a `sangria`, and that `render.tsx` draws as a row with the bullet in its own column so a two-line item wraps beside the bullet, not under it; the editor wraps an item's text in its own `<p>`, which the parser folds into the item's line instead of opening a second, empty one. **What gets stored is the simplest thing that represents it** (`simplificarHtml`, `limpiarTextoRico` in `html-seguro.ts`, applied in the service at save and at preview): no formatting at all means plain text with one line break per paragraph — exactly what was typed before the editor existed — and any mark, style or list means HTML. That is what keeps an old informe reopened and saved untouched from spawning a version: "Poda de césped" enters the editor as `<p>Poda de césped</p>` and leaves as "Poda de césped". In the PDF a plain title or description prints exactly as it always did; a formatted one is drawn line by line like the heading — **with the editor's spacing**: half a body between blocks (paragraph to paragraph, paragraph to list), a quarter between items of one list, and a blank paragraph kept as a blank line one line tall (`parsearEncabezado(…, { conservarVacias: true })`, description only; the heading still drops empty lines), because the gap someone typed before a list is a gap they meant. **A section title's bold and underline are marks, offered by default and removable.** A plain title — the tarea's name, or any informe from before — is shown and printed through `tituloDeSeccionEnHtml` (`@vivero/shared`), which wraps it in `<strong><u>`, so both editors open it bold and underlined and the PDF prints it as it always did; a title that carries formatting prints exactly its own marks (`estiloDelTrozo` no longer takes a forced base). On save `simplificarTitulo` keeps the round trip honest: exactly that wrapper collapses back to plain text, so an old informe reopened untouched compares equal and spawns no version (the version comparison resolves titles through the same wrapper on both sides, `conTitulosResueltos`); any other formatting stays HTML; and a title with **no** mark at all is stored as `<p>…</p>` rather than plain, because plain means "the usual" and would print the bold just removed. That last rule is for what the *editor* returns, which is always HTML: a title that already arrives plain — a tarea's name in a section nobody opened, or one typed in the app — stays plain, since plain *is* "the usual"; `simplificarTitulo` used to turn it into `<p>…</p>`, so every untouched title printed without its marks while the editor showed both. The server cleans titles with `limpiarTitulo`, not `limpiarTextoRico`, for that distinction. It used to be a fixed base — pressing B on the first line changed nothing visible — and capitals still come from the renderer either way. One react-pdf trap surfaced there: with `textDecoration: underline` on the title's container *and* on the trozos, the underline came out **inverted** (drawn under trozos without `<u>`, missing under those with it), so the container style carries neither bold nor underline and the trozos alone decide. **The sections list is rows, and one thing is edited at a time** (`abiertaId` in `Step3Secciones`): the heading is the first row — its plain first line under an *Encabezado* label — and opens in the same panel as a section with its own *Listo*, because it is written once per informe and sat open eating a quarter of the column; a section row is the number, the plain title (`textoPlanoDeHtml`), the photo count and the start of the description, with the grip to reorder and the bin; tapping it opens the section — from `xl` **in the preview panel**, which the editor takes over until *Listo* brings the preview back, and below that in place of the list with *Volver a la lista* (`useEsAncho` in `lib/use-es-movil.ts` decides, since `xl:hidden` would mount the editor twice). The panel's header has the previous/next arrows, *Ver cómo queda* for the fullscreen preview the editor is covering, and the bin, and under it two tabs, **Texto** and **Fotos**: the text alone with the whole panel to itself, and the photos with their layout (per row, alignment, new page) and grid — stacked, half the section was always out of view. A file dropped on a row opens that section on *Fotos*; a section added from the picker opens on *Texto*. **Choosing photos is Shopify's *Select file*** (`PhotoPickerModal`): a search box with a source filter (*Todas* / *De las visitas* / *Biblioteca*), the drop zone with *Agregar fotos* on top, a grid of tiles each with a checkbox, the name and the type under it, an eye on hover that opens a preview pane beside the grid — two fifths of the modal, the image with its name, type and pixel size, and nothing to tick, since marking is done on the tile — and *Cancelar* / *Listo* at the foot. The tiles are a **fixed width** (`grid-cols-[repeat(auto-fill,9.25rem)]`), so when the preview opens they wrap into fewer columns instead of growing, and the modal is a fixed height on the desktop (`md:h-[min(85vh,40rem)]`, not `max-h` — two rows of tiles under the drop zone, since at 90vh it was more window than photos): switching the source filter to one with three photos used to shrink the modal around them, and the filter that had just been pressed jumped out from under the pointer. The library is in the grid itself, not behind a second modal stacked on the first as it was; what you upload lands in the library and comes back already marked, with a toast, because it was uploaded for this section. **The photos the section already has come marked** (`enLaSeccion`), so unticking one there removes it from the section — it is the same question, which ones go, answered in one place — and *Listo* hands back the final list, the ones that stay in their order and the new ones behind, taken from the section's own drafts rather than the grid because the library arrives capped and searched; a visit photo held by another section is not offered. The thumbnails in the section carry no *Agregada* badge any more: where a photo came from is not something anyone acts on there. **On the phone the picker is Shopify's *Select files* in both apps** (`SelectorDeFotos` in the app, the same `PhotoPickerModal` below `md` on the portal): ✕, the title and two round buttons — the **camera**, which opens the phone's (`ImagePicker.launchCameraAsync` in the app, an `<input capture="environment">` on the portal), and **+**, which opens the *Agregar fotos* sheet with *Fotos del teléfono* and *Cámara* — the search box with the source filter as an icon that opens a sheet (a menu becomes a drawer), a four-per-row grid with the checkbox over each photo and no names, and nothing at the foot: once something is marked, Shopify's dark **floating bar** appears with the count and a ⊗ that clears the selection, plus *Ver marcadas*, which filters the grid to the marked ones; and once the selection *differs* from what came in, *Cancelar* and *Listo* pills replace the ✕ and the camera in the header (`hayCambios`), so confirming is offered exactly when there is something to confirm. The desktop keeps its *Cancelar* / *Listo* footer. The drop zone is desktop-only. **The app uploads to the library too** (`/api/mobile/media`, the twin of `/api/media`: list, presign, confirm), not to informe-owned keys as it used to (`/api/mobile/informes/uploads` is left for what already exists), so a photo taken for an informe can be reused and cropped like any other. The single *Agregar fotos* button on the section replaced the *De las visitas* / *Subir* pair, because the picker now offers every source. **The app edits the heading too**: an *Encabezado* row above the sections, like the portal's, opening the **same rich editor centred** (`EditorDeEncabezado`), so the default heading enters with its sizes and colours and leaves untouched if nobody edits it; `encabezadoPorDefecto` and `primeraLineaPlana` live in `@vivero/shared` (`informe.ts`, which the admin re-exports from `encabezado-texto.ts`; `encabezadoDesdeLineas` / `lineasDelEncabezado` are there from the plain-lines field that preceded it). It used to be a *Título del informe* field on the visits step, which the portal never had. **The sections list is the portal's, rows** — grip, number, plain title, photo count and the start of the description, chevron; long-press drags — and tapping one opens `FichaDeSeccion`, the portal's panel as a screen: *Sección N de M* with the previous/next arrows, the bin and *Listo*, and two tabs, **Texto** (the rich editor with the whole screen) and **Fotos** (per row, alignment, new page — the app sends `saltoDePagina`, `fotosPorFila` and `fotosAlineacion` now, the last only when it isn't the left — plus the grid, tap to crop, and *Agregar fotos*). Photos and layout apply on tap; the text is read from the editor when leaving the tab, switching section or pressing *Listo*, because the WebView doesn't report keystrokes, and ✕ leaves it as it was. It was an accordion of cards with the description box and the photos inline, which read badly and was not the portal's shape. **The app's informe ficha is the portal's**: the client's name with a ⋯ beside it holding *Editar informe*, *Ver PDF* and *Eliminar informe* (they were two full-width buttons for two things done once), then a card with a **thumbnail of the PDF's first page** (`MiniaturaDePdf`: the same WebView, narrow and untouchable, which draws the page fitted to its width — no rasterising on the server) beside the number, version, title, printed date and who generated and last updated it, and under it *Visitas* (the period and the propiedades that come from them, then each visita, opening its ficha), the sections with their photo counts, and the firmantes. `GET /api/mobile/informes/[id]` returns all of that, in the shape the app's wizard needs to **reopen** the informe — encabezado, printed `fecha`, sections with their photos and layout, firmantes, visita ids — and `PUT` is the twin of the portal's, making a new version through `editarInforme`. **The app edits too**: `informes/nuevo?id=` loads the informe into the same wizard, starts on the sections step with the client fixed (the first step is the visitas), keeps the printed date, and its last action reads *Guardar*. The old line saying to use the web to edit is gone with the reason for it. **The portal's ficha below `md` is that same screen** (`InformeDetail` branches on `useEsMovil` — by the hook and not by classes, because both trees carry an `<iframe>` with the PDF and `md:hidden` would load it twice): the sticky header with the client's name and the ⋯, the thumbnail card (the PDF in a 110 px iframe with `pointer-events: none` — **without `scrollbar=0`**, which makes Chrome's viewer paint black at that size; and on Android through Google's viewer, since Chrome there offers to download a PDF instead of drawing it in a frame, decided with `useSyncExternalStore` so the server never sees `navigator`), the *Visitas*, *Secciones* and *Firmantes* blocks in `SeccionFichaMovil`, and *Ver PDF* as a full-screen dialog with ✕ and the number; the desktop keeps its big PDF beside the cards and its versions list. The PDF — the preview and the informe's own — opens in **`VisorDePdf`**, a WebView in a full-screen modal with *Abrir* for the system browser, instead of the in-app browser sheet that read as leaving the app (only a ✕ on it — the archived informe is shared from its ficha); on Android the WebView can't draw PDFs, so it goes through Google's viewer, which works because the URL is public. **The app writes a section with a rich editor too** (`EditorDeSeccion`, on `@10play/tentap-editor` — Tiptap inside a WebView, with `react-native-webview` underneath): Shopify's description editor on the phone, the text filling the screen and the toolbar pinned over the keyboard. **It runs our own web bundle**, not TenTap's stock one: the stock editor has no font size, font family, background colour or alignment, so `apps/mobile/editor-web/` (the page, the React entry and a Vite config, per TenTap's *advanced setup*) is compiled with `npm run editor:build -w apps/mobile` into `editor-web/editorHtml.js` — **committed**, like the generated Prisma client, and rebuilt whenever `puentes.ts` changes — and loaded as `customSource`. `components/informes/puentes.ts` holds the four bridges (`FontSizeBridge`, `FontFamilyBridge`, `BackgroundColorBridge`, `TextAlignBridge`) and is imported by **both sides**: a bridge is the Tiptap extension for the WebView plus the messages the native side sends and the state it reads back, built on the same `@tiptap/extension-text-style` / `text-align` the portal uses, so the HTML is identical (`font-size: 14pt`, `font-family`, `color`, `background-color` in a `<span style>`, `text-align` on the paragraph) and `TextAlign` again has **no `defaultAlignment`**. Three traps in that build: the Vite aliases must be **exact regexes** (`/^@10play\/tentap-editor$/`), because the prefix form rewrote the web entry itself to `/web/web` and pulled the native side in; TenTap's web bundle does `require("expo-constants")` inside a try/catch to detect Expo, which resolves here and drags React Native (Flow syntax Vite can't parse) into the bundle, so `expo-constants` is `external`; and the root `.gitignore` drops `build/`, which is why the artifact is written next to it rather than inside. The toolbar is ours, not TenTap's `Toolbar` (which only draws images), and it is Shopify's: white, a hairline on top, thin separators between groups. Size (`N pt`, a sheet with `TAMANOS_DEL_INFORME` and *Como el documento*), font (a sheet with `FUENTES_DEL_INFORME`, Helvetica unsetting the mark as in the portal), bold, italic, underline, colour, then **alignment and lists folded** each into one button showing the current value with a chevron, which opens a small **dropdown anchored above it** with the options stacked (`Desplegado`), closed by choosing or by tapping elsewhere — so the bar fits the phone's width instead of scrolling to reach the end. The dropdown is drawn inside the editor screen, never in a `Modal`: a modal takes the focus off the text and drops the keyboard. The keyboard-avoiding wrapper gets a transparent `box-none` band above the bar for the card to live in, because on Android a child outside its parent's box receives no touches. The colour sheet has *Texto* / *Fondo* tabs and a **real picker** (`SelectorDeColor`): the saturation square with the hue bar standing beside it, the hex field and the portal's swatches. It draws no gradient — React Native has none without a native module — so the square is thirty-two saturation strips under thirty-two increasingly opaque black strips and the bar thirty-six hues, banded up close and plenty to pick from; the colour is applied on release and on typing, not per pixel. The swatch lists, the font names and the Google Fonts sheet moved to `@vivero/shared`; the cursor is read through `useBridgeState`. **The toolbar shows only while the keyboard is up**, like Shopify's, and sits at the keyboard's height read from the keyboard events — not from a `KeyboardAvoidingView`, which measures its own frame against its parent but the keyboard against the window, so with the editor under a header and tabs (or inside a page sheet) it fell short by exactly that distance and the bar hid behind the keyboard; the editor body reaches the bottom of the window, so `bottom: keyboard height` is exact on iOS, and on Android the window itself resizes. **Alignment has a default per place**: centre in the heading (centred by CSS, as in the portal) and on a section's **first line** — dressed as the PDF prints the title, bold, green, underlined, centred and in capitals, the portal's first-line classes — and left everywhere else; `TextAlignBridge` reports `activeEnPrimerBloque` (`selection.$from.index(0) === 0`) so the bar knows which default applies. Choosing the default *unsets* the mark while any other alignment is written — the left included where centre is the default, which without the mark would stay centred; that is what made *Izquierda* look dead in the heading. One field, first line as title, split on *Listo* with `partirPrimerBloque` and stored through `simplificarHtml` — those helpers, with `esHtml`, `aHtml` and `textoPlanoDeHtml`, moved to `@vivero/shared` (`informe.ts`) so both apps cut and simplify by the same rules; the section card shows the plain text. **The app previews the PDF** from an **eye beside the step's title** on the sections and firmantes steps (`TituloConVistaPrevia`; it sat in a ⋯ on the header, and a ⋯ with one option is a door hiding a button — the sections step also puts *Agregar sección* there as a **+**, in place of the outlined button at the foot of the list, and the firmantes step does the same with *Agregar firmante* — the + opens a drawer with *Firmante nuevo* first and the saved firmantes under it, greyed when already on the informe, instead of a menu hanging off a button (a drawer, per the phone convention, since it is a list) and it disappears at three, which is the limit, and lost the *N fotos disponibles* line under the title, which answered nothing anyone asked): `POST /api/mobile/informes/preview` takes the same body as generating, renders it (`borrador`, shrunk photos) and — unlike the portal's route, which returns bytes to an iframe — **uploads it to R2 under one key per person** (`informes/previas/<userId>.pdf`, `subirVistaPreviaDelInforme`) and returns the URL with a timestamp, because the phone's viewer opens an address and cannot send the token; one key per person so nothing accumulates. **The app crops too, with a screen of its own** (`RecortarFoto`): Shopify's — *Cancelar* and *Guardar* on top with undo and redo between them, the photo in the middle with a frame dragged by its corners or as a whole (gesture-handler + reanimated, the frame kept in **fractions** of the image like the portal's editor), and *girar*, *voltear* and the shape pill below (the portal's shapes plus *Original*, minus the circle). It draws the frame and nothing else: *Guardar* posts to `/api/mobile/media/[id]/editar`, the twin of the web route, and sharp applies it through the same `editarImagen` / `editarFotoDeVisita` — so the original is untouched, a visit's photo stays the visit's, and there is no native cropper to maintain (one was tried first: its toolbar is fixed at the bottom). For that the edit service learned **`rotar` (quarter turns) and `voltear`**, in `edicionDeImagenSchema` (`validations/producto.ts`, shared by both routes): **sharp's order is flip, then rotate, then extract** whenever they are asked for before the crop (`rotateBefore` in its pipeline), so the rectangle travels in pixels of the flipped-and-rotated image — the one on screen — and the phone draws it in that same order, the mirror inside the rotation. `react-native-webview` and the editor are native: **the app needs a new native build** before the rich editor runs. **A `pageSheet` modal already starts under the status bar on iOS**, so its content takes a fixed 12 pt on top and the notch inset only on Android (`ARRIBA_DE_LA_HOJA`); adding `insets.top` left a finger of white above every sheet in the wizard. Edits apply as you type, so *Listo* only closes. Inside the panel the editor **fills the height** (`llenar`): the toolbar stays at the top and the text area takes the rest, scrolling inside when the text overflows, with no card around it — the panel is the frame. Elsewhere the text area has a height cap (`altoMaximo`) and scrolls inside it, since without one a long description pushed everything under it off the screen. Every section used to sit open in the column under the heading editor, and at 900 px that showed one section and never two; the step now owns both columns (`panel` prop) so it can swap what the aside shows. The detail page's section list uses the same plain text. The zod limits grew (títle 4000, descripción 20000): a `<span style>` per piece is heavy. **The editor has no `defaultAlignment`**: in Tiptap 3 `TextAlign`'s `renderHTML` writes `style="text-align: …"` whenever the attribute has a value, the default included, so with `"left"` as default every paragraph left `getHTML()` carrying `text-align: left` the moment anything was typed — a title printed left in the PDF after any edit, and no text was ever plain again. With `null` the style travels only when someone chose an alignment; the default is CSS in the editor (`text-left` / `text-center` on the root, and the first paragraph centred when it plays title) and the place's own in the PDF. The app still writes sections as plain text — it has no rich editor — and that keeps working because plain is what the server stores for unformatted text.

**A version is born only when what gets printed changes** — encabezado, fecha impresa, firmantes or secciones, compared against the live version before any rendering (the encabezado is compared **resolved**: an old informe re-saved untouched must not spawn a version identical to the last one). The **visitas are deliberately outside that**: they never reach the PDF, so re-linking them updates the rows and stamps `updatedBy` without creating a version, and saving with nothing changed writes nothing at all. Two traps found while building it: `@db.Date` comes back at midnight UTC while the value is stored at noon, and **Postgres `jsonb` reorders object keys**, so both comparisons need normalising (`mismoJson` sorts keys; array order still counts, because moving a section changes the page). The **PDF is the document**; `InformeSeccion`/`InformeSeccionFoto` are only the *current* version — what the editor reopens — while an old version keeps its file plus, in `contenido`, the request it was built from — which is what lets you **reopen an old version in the wizard** (`/editar?version=N`) and save it as a *new* version. Nothing is rolled back: the history is append-only, so reworking v2 produces a v5 that resembles it. Photo URLs are resolved from ids at reopen time rather than stored, because a photo can be cropped or moved; one whose file is gone simply doesn't come back, and the wizard says how many were missing. The versions the migration backfilled have no `contenido`, so those can only be viewed. Deleting an informe takes every version's PDF with it. The informe carries `generatedById`/`generatedByNombre` and `updatedById`/`updatedByNombre` (null until someone actually edits, which is different from "updated by whoever made it"), each version its own author — the usual id-plus-name-snapshot split. **A half-built informe is an `InformeBorrador`**, not an informe without a PDF: the wizard state as JSON, shared by the team rather than private to whoever opened it, and deleted the moment it becomes a real informe. An **edit** can be left half-done too — the draft carries `informeId`, so resuming it reopens that informe's editor instead of creating a duplicate of the thing being corrected, and it dies with the informe. A draft **has a `numero`, drawn from `Informe`'s own sequence** (`nextval('"Informe_numero_seq"')`, asked for explicitly — `@default(autoincrement())` would give the table a sequence of its own and #17 would name two things): the informe inherits it, so draft #17 becomes informe #17, and discarding a draft leaves a gap, same as with facturas. Drafts and informes are **one list**, ordered by date across both — a raw `UNION` returning ids so the database does the ordering and paging, hydrated per table afterwards — with an estado column and an estado filter. **Which visitas it covers is not part of that**: `InformeVisita` never reaches the PDF — the renderer doesn't look at it — so it is a traceability link, corrected through the same editor without producing a version. Picking visitas is also **optional** when generating: an informe that doesn't come from a visit is a real document, and the list is what fills it in when there are visits, not a requirement. Deleting takes the row, its sections and the PDF in R2 with it. Soft-delete is used on several models. **NotificacionPlantilla/Log/Config** drive WhatsApp + push notifications.

**Tarea** is the catalogue of gardening work — *what gets done on a visit*, as opposed to what gets sold. "Poda de setos" is a tarea; the monthly plan that includes it is a producto. So a tarea carries **no price, no IVA, no variants and no stock**, and nothing about it ever reaches an orden. It is a closed list the office maintains (`/dashboard/visitas/tareas`) rather than free text, because free text gives you "poda de setos", "Poda setos" and "podar los setos" for one thing, and with that you can neither group the informe's photos nor answer "was it done or not". **Deleting is always soft**: a deleted tarea keeps naming the work of every visita where it was done — visitas already printed into informes the cliente is holding — so what deletion removes is the tarea from the pickers, nothing else. Its name is unique **among the living ones**, a partial unique index (`WHERE "deletedAt" IS NULL`) written by hand in the migration because Prisma can't express one, so deleting "Poda de palmas" and creating it again works and the two coexist. **Renaming rewrites history on purpose**: visitas point at the tarea by id and keep no copy of the name, so fixing a typo fixes every visita at once — the opposite of `Factura`, where the name is frozen because the document was already issued. Replacing a tarea with a different one is deleting and creating, not renaming. `orden` spaces the list by tens so one can be slipped between two without renumbering, and `reordenarTareas` takes the **whole** list and rewrites it rather than "move this one up", so two tabs moving at once can't leave two tareas in the same place. **How the catalogue is sorted is saved, not a view of the admin screen**: `EmpresaConfig.tareasOrden` (`PERSONALIZADO` | `ALFABETICO_AZ` | `ALFABETICO_ZA`) is what `listTareas` orders by, so the gardener's checkboxes come out in the order the office chose — sorting A–Z on one screen and leaving the phone showing something else would be two lists. Switching to alphabetical **does not touch `Tarea.orden`**: the hand-made arrangement survives and going back to Personalizado restores it exactly, because renumbering on a dropdown click would destroy the work of dragging seventeen rows. Dragging *is* choosing Personalizado, so `reordenarTareas` sets the mode itself — saving positions while still rendering alphabetically would make the row snap back. Reordering is **drag and drop** (`@dnd-kit`), by a grip handle on the desktop row — the row itself opens the tarea, so a full-row handle would fight the click — and by **press-and-hold** on the phone, a `TouchSensor` with a 300 ms delay and a movement tolerance, which is how the OS reorders and what leaves the list still scrolling (`touch-action: manipulation`, never `none`). The grip is `cursor-grab` and `cursor-grabbing` while dragging, and the grabbing cursor is pushed onto `document.body` for the duration: `active:` on the button stops applying the moment the pointer leaves it, which is the first thing dragging does. **Nothing about the order saves by itself — neither the arrangement nor the mode — and both leave in one request.** `reordenarTareas(viewer, ids, modo?)` writes the positions and `EmpresaConfig.tareasOrden` in the same transaction, so either both land or neither does; `setOrdenTareas` is for when only the mode changed. Picking a mode used to write on the click, so glancing at the list alphabetically rewrote what every gardener sees, with no way back but remembering which mode it was. And the arrangement is saved **even when the mode being saved is alphabetical**: arranging by hand and displaying A–Z don't contradict each other — `Tarea.orden` keeps the arrangement and going back to Personalizado shows it intact — so "order them, then leave it sorted by name" is one decision, not two. **On the phone that whole decision is its own screen** (`OrdenarTareasMovil` in the portal, `OrdenarTareas` in the app): the sort type at the top, where it can be changed again without leaving — an **anchored dropdown**, Shopify's, never a bottom drawer: a drawer opened from inside that sheet stacks on top of the only thing that could dismiss it, so it had no way out but picking an option; the tareas below with their grip and their checkbox while the mode is Personalizado; the selection bar floating when something is marked; ✕ and *Guardar* in its header. It was all inside the list, and there each piece took another's place — the Cancelar/Guardar bar sat in the header, which is where the ⋯ that turned checkboxes on lived, so you had to save before you could go on arranging. The list behind it is a list again: one tap opens the tarea. It is Shopify's *View items* sheet, and it is the same screen in both apps. On the desktop none of that is needed: the table has room for a grip column, a checkbox column and the sort dropdown at once, so there it stays inline, with the header turning into *Cancelar* / *Guardar* while something is pending. Besides dragging there is Shopify's **Mover** menu: rows have checkboxes and their position number, and the selection goes *Al principio*, *Al final* or *A la posición N* (`moverEnOrden` in `@vivero/shared`, with `ordenarTareas` and the mode list beside it — the app has the same screen, so writing the rules twice would mean fixing them twice). Dragging is for nudging a row two places; sending five rows to the top of a long list is a long trip with the button held, and letting go early starts it over. The selected rows travel **as a block, in the order they already had between them** — relocating them one at a time gives a different answer depending on which is processed first — and the position is counted against the *final* list and clamped, so asking for 20 of 17 means the end. It is a `Popover` and not a `DropdownMenu` because one option holds a field, and typing a number in a menu closes it; on the phone it is a drawer, per the convention above. The move is applied to the **whole** list rather than the visible page: within a page the relative order is the full list's, so dropping a row onto another's position means the same thing either way, and pagination stops mattering — the position shown on a row is its place in the full list, so on page 2 the first row is 26. Dragging, checkboxes and numbers are all off while a search filter is on, where dropping "between these two" really means between two others that aren't on screen. Selecting rows swaps the table's header row for the selection bar; on the phone the checkboxes are simply **there**, inside the ordering screen, because marking is half of what that screen is for — the selection bar shows up with the first row marked (`BarraSeleccionMovil` takes a `className` so it can sit at the foot of the sheet instead of above the nav). **The app is the same screen**, down to the gestures: press-and-hold to drag (`react-native-reorderable-list`, the same 300 ms, wrapped in its own `GestureHandlerRootView` because gestures inside an RN `Modal` need one), and the same three destinations in a drawer (`MoverTareas`). The list has **no actions column**: clicking the row opens the tarea and **Eliminar** lives inside that dialog — a column of icons repeated on every row spends permanent width on something done once in a while, and puts a bin next to the line you want to press in order to read it. Writing is `ADMIN`/`STAFF`; reading is also open to `PERSONAL`, who need the list to mark what they did, and closed to `CLIENTE`, who sees the tareas *of their visita* through the visita itself. A tarea is also what a **photo** is tagged with and what an **informe section** comes from — see the informe wizard below. A tarea reaches a visita in two ways and they mean different things: **`VisitaTareaObligatoria`** is what the visit *demands* — picked when scheduling, never a blocker, and the thing the office checks afterwards — while **`VisitaPersonalTarea`** is what one person *did*, hanging off their `VisitaPersonal` and not off the visit, because the question worth answering is "who did the weeding?" and a table on the visit only answers "was it done?". What the visit did in total is the union of those, computed (`tareasHechas` in `lib/visita-tareas.ts`), and an obligatoria counts as covered when **anyone** did it. Both relations are `onDelete: Restrict`, which is another reason deleting a tarea is always soft. The initial seventeen are seeded **from the migration** (`20260914160957_tareas_de_visita`), not from a script someone has to remember to run: the build does `prisma migrate deploy` before `next build`, so they land in production the same minute as the screen that uses them; `scripts/seed-tareas.ts` re-seeds the same list in development.

**Producto** is the single catalog — services and retail goods. Its only
classifying axis is `tipo`: `SERVICIO` | `BIEN` — what it *is*. **It changes
nothing at invoicing time** (the SRI's `<detalle>` has no goods/services field);
what it does decide is **who gets variants and stock: only a `BIEN`**.

**Archiving a producto is `archivarProducto`**, and it is always soft: `OrdenLinea` and `FacturaLinea` cite its variants, and those are documents already issued. It used to be refused while the product sat in somebody's plan; a plan no longer names products, so that rule went. `archivarVariosProductos` still walks a selection one at a time so one that fails comes back **named** without cancelling the rest. **Every product has *at least* one variant; only a `BIEN` can have several.** No options means exactly one; options mean one per combination (3 colours × 2 sizes = 6). A servicio has one too — created with it, `manejaInventario: false`. The variant is not "where stock is counted", it is **what gets sold**, so every line with a product has a `varianteId` and never has to ask the `tipo` to know where the SKU, the price or the stock live (the only line without one is a plan's period, which sells no product — see *Orden* below). It used to be bienes-only, which meant a line pointed at a producto or at a variante depending on the type — two shapes for the same thing, and a branch in every place that asked. **The catalog code lives on `Variante.sku`**, not on the producto: it is what prints as `codigoPrincipal`. With a single variant it is edited in the card under the photos, which is also where a bien's price and stock live; with several, each combination has its own on its page. **A servicio shows only the SKU there** — no price, no IVA switch: a poda is quoted each time, so both are decided on the order or the plan. The columns exist on its variant anyway, so showing them later is adding a block, not changing the model. And **the type is chosen before the create form**, because it is the one thing that can never change afterwards and it decides which fields the screen even has. **A bien's variant also carries `costo` and `peso`**, Shopify's two: the cost per unit sits beside the list price and the ficha shows *Ganancia* and *Margen* computed from the pair (`gananciaDeVenta` in `@vivero/shared`), never stored; `costo` is nullable because *unknown* is not *free*, so clearing the field saves null where clearing the price restores it. The weight travels with its `pesoUnidad` (`G`/`KG`/`LB`/`OZ`), stored as typed rather than converted to grams, and sits with the SKU because nothing here ships by post. Both are refused on a servicio by `actualizarVariante`, and neither reaches an orden. **The single-variant card and the variant's own page save from the header bar** like the rest of the ficha (pending changes plus the pending stock movement, shown as what it will become, in amber); they used to save each field on blur without a word. **The app has the product ficha and form in full**: `GET /api/mobile/servicios/[id]` returns what the portal's page assembles (estado, IVA, categorías, galería, ejes, variantes with everything), the ficha shows every row with "—" when empty and *Ajustar* moves stock through `POST /api/mobile/variantes/[id]/movimientos`, and `ServicioForm` edits the product plus its single variant through `PATCH /api/mobile/variantes/[id]`, the portal's twin. **Options and variants are Shopify's mobile screens** (`components/productos/`): the ficha shows each option with its values as pills and *Editar* opens `EditorDeOpciones` (a `pageSheet` with `CabeceraDeHoja`, one row per option opening `EditorDeOpcion` with draggable values and *Agregar valor*, plus *Agregar opción* with suggestions), saved whole through `PUT /api/mobile/servicios/[id]/opciones` with the 409 confirmed in a dialog; with options, an *N variantes* row opens `ListaDeVariantes` and each row `FichaDeVariante`, whose *Precio* rows open `HojaPrecioDeVariante`, *Inventario · Editar* opens `HojaInventarioDeVariante` and the stock pill opens *Ajustar stock*. A bien without options renders that same `CuerpoDeVariante` on the product ficha. Fotos (`FotosDeProducto`, Shopify's *Media* strip with a **+**, and per-photo *Ver*, *Poner como primera*, *Quitar*), categorías (`SelectorDeCategorias`, the *Collections* list with checkboxes, applied on ✕) and the variant's photo (`SelectorDeFotoDeVariante`, the product's photos as a grid with a check, plus camera/⊕ to upload one that lands on the product and gets picked) are edited from the app too, each gesture saved at once through the mobile twins `…/servicios/[id]/imagenes`, `…/imagenes/[imagenId]`, `/api/mobile/categorias` and the variant `PATCH`; the portal's variant page picks its photo from the library dialog instead of a numbered dropdown. **Below `md` the portal's product ficha is the app's** (`components/servicios/movil/`, chosen by `useEsMovil()` in `ServicioDetail`): the same sections and full-screen sheets, each saving at once through the portal's own API and `router.refresh()`, with no header bar; the desktop tree is untouched. And the portal's price, cost and weight fields publish **on every keystroke** through `useTextoNumerico`, which keeps the typed text and only resyncs when the number no longer matches it, so "12." keeps its point.

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

**Nothing in the catalog says whether something is one-off or recurring**, and
a plan names no products at all: the same desmalezado is a one-off for one
cliente and part of somebody else's monthly plan, and the plan says only what
that plan costs. There is no `modalidad` column, for the same reason there is
no `periodicidad` one.

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
(`VisitaPersonal` + `VisitaPersonalTarea`). **The two ends are marked, not
typed**: *Marcar entrada* and *Marcar salida* stamp `entradaEl` / `salidaEl` —
the instant, decided by the **server**, because an hour the client sends is an
hour the client picks. **The one exception is a mark made without signal**: there the phone stamps `marcadaEl` when the button is pressed and sends it when the network is back — the only true hour there is — and the server keeps, beside it, `entradaRecibidaEl`/`salidaRecibidaEl` (when it actually arrived) and `entradaSinConexion`/`salidaSinConexion`. With signal the two instants are the same and nothing is shown; without it they drift apart, and the portal prints *"sin conexión, llegó HH:MM"* next to the mark (`NotaDeMarcaSinConexion`) so the office can judge it. A phone clock set by hand is the obvious trick and this is its only trace — evidence, not a lock, like the location. The server accepts a client instant only within five minutes of the future (clock skew) and a week of the past, checks the visit's day against **that** instant rather than against today (an entrada made on the visit's day can arrive the next morning), refuses a salida before its entrada, and treats a retry carrying the same `marcadaEl` as the same mark — the connection cut after saving is the normal case, not a second entrada. Photo batches are idempotent by R2 key for the same reason. They were `"HH:MM"` text; an instant needs a date, or
whoever enters at 23:50 and leaves at 00:30 has an exit before their entry, and
the visit's own derived `horaEntrada`/`horaSalida` (still text, still derived —
now the earliest and latest *marks*, registered or not, because someone who
clocked in is already in the garden) sorted them wrong. Marking salida is the
moment the tareas are asked for: that is when they are known. **Marking happens only in the app.** Marking means "I was here at this hour",
and that is worth exactly what the location backing it is worth — in a browser
that location is faked in three clicks (Chrome's DevTools ship a location
override, nothing to install), so a mark made from the web says nothing that
typing the hour wouldn't, while looking like it does. On the phone the
permission is asked for real, the reading is far better, and Android exposes
mock providers. So `POST /api/visitas/[id]/marca` is gone and only the mobile
route remains; `ensureQuienMarca` refuses anyone who isn't the assigned
`PERSONAL`, the office included. When someone's phone died, what the office does
is **correct** the instant through `registrarParte` — a different thing with a
different name, because "he told me he was there from 8 to 12" is not a mark.
From the portal the assigned person corrects *what they did* (tareas, which have
nothing to do with where they stood) and reads their hours in *Detalles*; where
the button would be, the header says the marking happens in the app. They had a *Mi
parte* card of their own above everything, which spent half a screen showing two
dashes and a button; the marks are read in *Detalles* now, as `Entrada` /
`Salida` followed by their own `Duración` — and for the assigned person those
**replace** `Horario`, which is the whole visit's window (earliest entry, latest
exit, across everyone) and next to their own hours said almost the same thing
while meaning something else. The office still sees `Horario`. **The location is
the office's**: a gardener sees neither his own nor anyone's, because he is not
reviewing anybody, and it cost a second line on every row. Marking twice is
refused and correcting is the office's, since the first mark is the one that
says when they arrived. **Where they were is recorded and never required**:
`entradaLat/Lng/Precision/Simulada` and the same four for salida, `null` when
permission was denied or there was no signal. Refusing the mark for that leaves
someone unable to record work they actually did — the real datum lost chasing a
fake one — and the signal is spoofable anyway: three clicks in Chrome's
DevTools, a mock app on Android (which `simulada` exposes, when the OS says so;
iOS doesn't, so `null` there means "we don't know", not "not faked"). So this is
evidence the office looks at, not a lock. Each mark also carries
`entradaDispositivo`/`salidaDispositivo`, an id for the app **installation** —
not the person — answering one question: did two people on the same visita mark
from the same phone? That is somebody logging in with a coworker's account to
clock them in, and it is the only part of that trick that leaves a trace by
itself, precisely because the id belongs to the handset: a borrowed session
arrives carrying the device of whoever used it. `marcaronDesdeElMismoAparato`
flags them for the office. It proves nothing — the client generates the id, so
anyone who knows about the check clears the app's data and comes back with
another — and it blocks nothing; what it does is make the easy shortcut leave a
mark. Note what does *not* help here: device biometrics authenticate the phone's
owner, not the account's, so on a coworker's phone their own face unlocks it
just fine. `Cliente` has no coordinates yet, so
there is nothing to compare against: the point is shown and opens in a map, and
the "3 km away" warning waits for the client's pin. The browser needs HTTPS
(localhost excepted); the app declares `expo-location` when-in-use only, since
the reading happens at the press. **Marking is tied to today's date; correcting the
office's way is not.** `marcarEntrada` refuses a visit that isn't today
(`ensureEsElDiaDeLaVisita`) — the screen already hid the button, and a screen is
a suggestion: the app can sit open for hours showing yesterday's visit, and the
route takes any POST. `marcarSalida` is deliberately free of it: it demands an
entrada, which already passed that gate, and a shift that ends at 00:20 is one
that began yesterday. A `PERSONAL` correcting their own tareas gets the same
window (`ensureSePuedeCorregir`: the visit's day, or the day they marked their
salida) — a parte left open forever is one that gets tidied up when the office
asks; the photos stay open, because a photo added on Tuesday doesn't change what
was done on Monday. The office corrects any day through `registrarParte`, which
checks only that the visita isn't `CANCELADA`, that the person is assigned
(`removedAt: null`) and that the tareas are alive, so a visit from last month
that nobody filed still gets filed, which is exactly when it's needed. Two date
shapes get confused here and the service keeps them apart: `esElDiaDeHoy` for a
`@db.Date` (it arrives as midnight UTC, so its trimmed ISO *is* the stored day)
and `esInstanteDeHoy` for a mark (20:00 in Guayaquil is 01:00 UTC the next day,
so trimming its ISO would say tomorrow). It is filed from the app and from the portal: `components/visitas/mi-parte.tsx`
is the card at the top of the visita's own page, shown only to the assigned
person (the assignment, not the role — a gardener opening another cuadrilla's
visit sees it and has no parte to file there). The web endpoint existed from the
start and nothing called it: the form was only ever built for the phone, so on
the portal a gardener saw that his parte was missing and had no way in. The first parte moves the visit from
`PROGRAMADA` to `EN_CURSO` on its own; from there an `ADMIN`/`STAFF` marks it
`COMPLETADA` or `INCOMPLETA`, looking at what was filed and what is missing.
**A gardener sees the visit in the state of *his own* marks** —
`estadoParaMi` in the app, a rendering rule and not a column. While the visit
is open, what the row stores is the sum of everybody: a coworker's entrada
puts it `EN_CURSO` before he arrives, and showing him "En curso" after he
left because a coworker hasn't filed yet tells him something of his is
half-done. So he sees *Programada* with nothing marked, *En curso* with his
entrada, *Completada* with his salida, and *Con novedad* when he reported
(the `NOVEDAD` pseudo-state). It only overrides `PROGRAMADA` and `EN_CURSO`:
an office `INCOMPLETA`, `NO_REALIZADA` or `CANCELADA` still shows as what it
is. It
does **not** close itself when the last person files: someone may never file,
and deciding that the work is nonetheless finished is a judgement, not a count.
`tareaIds` replaces that person's set rather than adding to it — the form is a
list of checkboxes, so what arrives *is* the final state, and adding would leave
no way to untick something filed by mistake — and it carries **at least one**
(`ensureAlMenosUnaTarea`, plus `.min(1)` on the SALIDA schema and a disabled
button on both screens). A parte with none says nothing: the informe places its
photos by tarea and the office reads what got covered, so an empty one is a
salida stamped and nothing more — and leaving without ticking was the shortest
path through the screen, which is the one that gets taken. The office is exempt
when correcting someone else's parte: emptying one is the escape valve, and the
office is who decides whether the visit is nonetheless finished. The visit's own
`horaEntrada`/`horaSalida` are **derived**: the earliest entry and the latest
exit across the filed partes, recomputed on every change, which is why neither
the edit form nor the close form asks for them. Fixing an hour means fixing the
parte of whoever filed it. Removing someone from the visit marks the assignment
`removedAt` and leaves their parte hanging off it: everything that counts what
was done filters `removedAt: null`, so it stops counting, and re-assigning them
brings it back exactly as they left it. **Someone who already marked their
entrada cannot be removed** — the mark is a fact (they were there, at that hour,
with that location and that device), and removing them hides it from everything
that counts and recomputes the visit's hours without them. If they really
shouldn't have been there, what gets corrected is their parte, not their
existence. Whoever hasn't marked anything leaves without a fuss: scheduling the
wrong person happens every day.

**A Suscripcion is a price for a garden.** It says of which `propiedadId` of
the cliente it is (NOT NULL, `onDelete: Restrict`), what is charged per period
(`precio` without IVA plus `ivaTasa`), how often
(`MENSUAL`/`TRIMESTRAL`/`SEMESTRAL`/`ANUAL`) and how many `visitasPorPeriodo`
it includes. **It names no products.** It used to be a list of catalog items
(`SuscripcionItem`), each with its own price, IVA and visits, and building a
plan meant picking three products and pricing each one so the sum landed on
the monthly figure that had already been agreed with the client; what is agreed
is one number for keeping *that* garden, so that is what is stored. The
migration (`20260924200000_suscripcion_por_propiedad_sin_productos`) folded
the items into the header — the sum of their prices with a single rate, and
**what the client paid is what was preserved** when the rates were mixed: the
rate of the dearest item, and the base backed out of the total, so the total
didn't move; visits per period are the *max* across items, not the sum — and
gave each plan the propiedad of its visits, or the client's oldest live one.
Two active plans on one propiedad aren't refused — the form warns *"Ya tiene
la suscripción #N activa"* on that propiedad — and a propiedad with a live
plan can't be deleted (`eliminarPropiedad`), since a plan that renews on its
own can't point at a garden that is gone. **The app has the same screens as
the portal on a phone** — list with filters and the ⋯ (*Nueva suscripción*,
*Generar órdenes*), the editable ficha with the propiedad's location under the
selector, its visitas and órdenes, and the alta from the cliente's ficha —
and **the ficha saves from the header, never from a button at its foot**:
with something changed, the app swaps the chevron and the name for *Cancelar*
/ *Guardar* (`EncabezadoDeFormulario`, the visit ficha's shape) and the portal
publishes the change to the Shopify bar (`useRegistrarCambios`, which
replaces the search box with *Descartar* / *Guardar* and says what is
missing); a *Guardar cambios* at the bottom of a long form is one you have to
go looking for —
through `/api/mobile/suscripciones` (`GET`/`POST`, `[id]` `GET`/`PUT`,
`[id]/renovar` and `renovar`), the same services behind the same rules; the
zod schemas live in `@vivero/shared` (`suscripcion.ts`, with
`PERIODICIDAD_LABEL`, `describirPlan` and `totalDelPeriodo`, which both apps
print) and the admin's `validations/suscripcion.ts` re-exports them. The app's
scheduling wizard offers the cliente's active plans after the propiedad
(`ClienteListItem.suscripciones`), choosing one sets the propiedad, and
`?suscripcion=` pre-fills it from the plan's ficha, as the portal's does.

**A visita belongs to a plan, or to none, and a plan's visita happens at the
plan's propiedad.** `Visita.suscripcionId` is picked in the wizard and can be
unset when editing, and that is the whole of it: it says which contract the
visit counts against. `validarPlanDelCliente` checks the plan is the
cliente's **and** that `visita.propiedadId` is the plan's — a monthly plan for
the house doesn't cover a visit to the office; that one goes without a plan or
under the office's own. In both wizards choosing a plan **sets** the propiedad,
and picking another propiedad drops a plan that isn't of it, so the pair is
never wrong on screen; on edit the pair is validated only when it *changed*, so
an old visit whose plan was later moved to another propiedad can still have its
date fixed. That edit path is also where the portal's `PUT /api/visitas/[id]`
started applying `propiedadId`: the form sent it and Zod silently dropped it,
so moving a visit to another house did nothing.

A subscription's page has a **Crear visita** shortcut that pre-fills its plan
(and with it the propiedad), which is how most plan visits get created.

**Nueva orden has one button, *Crear*.** `crearOrden` always opens a
`BORRADOR`, the only editable state, and the screen lands on the order's page;
invoicing is the next step, from there. There used to be *Guardar borrador*
and *Crear y facturar* side by side, and the second jumped straight into the
document builder: emitting has its own decisions (what gets printed, which
RUC, to whose name) and offering it on the create button made an order without
an invoice look half done. For the same reason neither *Nueva orden* nor the
order's page asks for the datos de facturación — the emit screen does, with
the cliente's data in front, and once emitted the factura card on the order
says to whose name it went out — and the emit screen itself has a single
*Emitir*: it returns to the order, where *Registrar cobro* (no icon) appears
once there is a comprobante to register the payment against. A draft may have unpriced lines, because
pricing is exactly what it's waiting for. **On the phone, the portal's *Nueva
orden* is the app's screen** — `nueva-orden-page.tsx` draws two trees over one
state, the desktop's untouched: *Cancelar* · *Nueva orden* · *Crear* in the
header, then white bands on the grey ground in the app's order. Cliente is a
row opening a bottom sheet with search (`SelectorClienteMovil`; the inactive
dimmed and unpickable, and the desktop's dropdown now marks them the same
way); Productos has the two buttons — *Agregar producto* opens
`SelectorProductos`, the app's Shopify multi-select at full screen (casillas,
the guion for a product with some variants marked, the chevron into its
variants, Cancelar/Guardar, and a small centred *Tienes cambios sin guardar*
with *Volver* / *Descartar* side by side), and *Ítem personalizado* opens
`HojaItemPersonalizado` (name, price with its `$` and `inputMode="decimal"`,
quantity with −/+, *Cobra IVA* revealing the rate) — then Pago, Visitas as
tappable rows, and Notas. The picker shares **one** `useCatalogo` with the
desktop's dropdown, so whatever was picked on either side is in `conocidos`
for its line; and each sheet keeps its state in an inner component mounted
with the popup, because `react-hooks/set-state-in-effect` forbids resetting
it in an effect and unmounting resets it for free. **The order's ficha on the
phone is the app's too** (`orden-detail.tsx`, a second tree under `md`): the
chevron beside *Orden #N* with the ⋯ on the right, the cliente and the date
under it, the dark green card with the total and whether it came in (*Falta
cobrar*), a full-width *Emitir factura* while there is no comprobante, and
then *Detalle*, *Factura*, *Cobros*, *Visitas*/*Suscripción* and *Notas* as
the app's sections — `SeccionFichaMovil` in `components/shared`, the rótulo in
small caps over a white rounded body, which is the ficha's shape and not the
form's bands. The ⋯ lists **everything** by name: the factura's actions and
*Editar* / *Anular orden*, which on the desktop sit in *Acciones* while the
factura keeps its own menu. *Registrar cobro* rises as a bottom sheet with the
saldo already typed (`CobroDialog` picks by `useEsMovil()` in `lib`, since
`md:hidden` would mount both), and editing shows the desktop tree, which at
that width stacks its cards — the app doesn't edit orders, so there is no
screen to copy. The app's money card now says *Borrador* for an order without
factura: `estadoCobro` without a saldo answers *Sin sincronizar*, which is what
an old factura without one is, not a draft. **The app emits and charges too**,
from the order's ficha, with the same two-step shape: `POST
/api/mobile/ordenes/[id]/facturar` (the order's lines as they are — regrouping
them into one printed line stays in the portal, where the cuadre is visible)
with the emisor (`GET /api/mobile/emisores`, `emisoresParaEmitir`: ADMIN and
STAFF see only what it takes to pick one; the full list, `emisoresDisponibles`,
is ADMIN configuration — the portal's emit screen uses the narrow one too,
since it used to 403 a STAFF before showing anything) and the datos de facturación (`/api/mobile/clientes/[id]/facturacion`,
list and create, including *Usar otros datos* saved archived for a one-off
name); then, with the factura emitted, the ⋯ in the ficha's header carries
what the portal's factura card menu does — *Registrar cobro*
(`POST /api/mobile/facturas/[id]/cobro`), *Ver factura (RIDE)* (`GET
…/ride`, which renders the PDF into R2 beside the XML and returns its public
URL, because the phone's viewer can't send the token the portal's inline
route relies on), *Enviar al cliente* (`…/enviar`, with the correo prefilled
from the cliente), *Consultar al SRI* (`…/consultar-sri`, now
`consultarFacturaAlSri` in `factura.service` — it lived inline in the web
route until the app needed it) and *Emitir nota de crédito*
(`…/nota-credito`). **Building the order happens in the app too**
(`ordenes/nueva`, from the list's ⋯): the same screen as the portal's *Nueva
orden* — cliente, catalog lines with their variants and list prices
(`GET /api/mobile/ordenes/catalogo`, the same `productosVendibles`), the
pending plan periods (`GET /api/mobile/ordenes/pendientes`), the visitas it
covers (`GET /api/mobile/visitas?clienteId=`, every date and not from today,
since billing last month is the normal case) and notas, into
`POST /api/mobile/ordenes` → `crearOrden`. Fixing that route is what showed
`crearOrdenSchema` had no `visitaIds`: the portal marked visitas on *Nueva
orden* and never sent them, so the order was born without saying what it was
for. It carries them now, on both sides. The ficha's header on the phone is `EncabezadoDeFicha` —
the back chevron beside the name, fixed while the body scrolls — which is
the visit ficha's header made shared, so orders, plans and the cliente's ficha no
longer show the native bar with "index" as the back label (the cliente's had a
hero block under it — avatar, name, an *Editar* button and the ⋯ — two headers
for one ficha; *Editar* now lives in the ⋯, and the estado pill, empresa and
"cliente desde" sit under the header, on the portal's phone tree too). The create screens (*Nueva
orden*, *Nueva suscripción*, *Emitir*, and the cliente and propiedad forms — *Nuevo cliente*, *Editar cliente*, *Nueva propiedad*, the propiedad's own screen — with `headerShown: false` in the clientes layout) use `EncabezadoDeFormulario` instead:
*Cancelar* on the left, the action (*Crear*, *Emitir*) on the right, the
title between — the portal's header on the same screens (*Nueva orden*, and
*Nuevo cliente*, *Nuevo personal* and *Nuevo grupo* below `md` through
`EncabezadoFormularioMovil` in `components/shared`, with `StickyFormActions`
kept for the desktop), and the only thing that stays put while a long form scrolls, so
there is no button at the foot.

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
total you couldn't explain without opening it. A period is **one line** now —
the plan has a price, not a list — so there is no "whole period" rule left
(`ensureTrabajoCompleto` went with the items); the unique index is all it takes.

Deleting a visita is refused while a **live** order says it covers it
(`softDeleteVisita` names it, annul first): an issued document citing a visit
that doesn't exist can't be explained. A draft just loses the link.

`listarPendientes` returns **subscription periods only**, cut off at the end of
the current month: charging a period that hasn't started stays a deliberate,
separate decision. Visits stopped being "pending" when they stopped carrying
products — there is nothing about one that is waiting to be billed.

`Suscripcion.visitasPorPeriodo` counts visits **per billing period** — a
quarterly plan's number is visits per quarter — and it is **informative, not a
cap**. Scheduling is never blocked by it. Deciding whether extra work gets
charged belongs to whoever builds the order, not to whoever schedules: any
catalog product can be added by hand on top of a period line as an extra. See
[the invoicing doc](./.claude/docs/facturacion-sri.md).

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
`saltoDePagina`, `fotosPorFila` (2 to 6, a dropdown, the density lever — `MEDIDA_FOTO` and `LADO_FINAL` carry a size per count) and
`fotosAlineacion` (`IZQUIERDA` | `CENTRO` | `DERECHA`, where the last row's
photos go when it isn't full — three per row with two photos leaves a gap, and
centring them is usually what is wanted; full rows look the same either way).
The wizard sends `fotosAlineacion` **only when it isn't the left**, and the
schema gives it no default, so an informe from before the field, reopened and
saved untouched, compares equal to its version instead of spawning one. **The wizard previews the real PDF**: `POST
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

**The app keeps a local copy of the visits it has shown** (`lib/cache-de-visitas.ts`, AsyncStorage): every day opened in the list — with each visit's full ficha, since the list already carries it — plus every ficha opened, and the tareas catalogue. It is painted first and replaced by the server's answer; without signal it stays (the list used to *empty* itself offline, and "hoy no tienes visitas" in a garden without coverage is a lie with consequences). Nothing explains the cache to the person: what they see is WhatsApp's **"Conectando…"** line under the header (`components/ui/Conectando.tsx` in the app, `components/shared/conectando.tsx` on the portal), on the chats and the visits alike. The app has no NetInfo — one more native module — so `lib/conexion.ts` derives it from the requests themselves: the first one that doesn't arrive turns it on and starts polling `GET /api/mobile/ping` (no session, says nothing) every 5 s until something answers; any request that lands turns it off, and the chat queue sends on that flip. The portal listens to `navigator.onLine`. It is JSON only, never photos, and it prunes itself to the 21 most recent days and 300 fichas, so it stays around a megabyte. **And the work itself waits for signal too**: marking entrada, marking salida with the parte, and saving photos go through `lib/cola-de-visitas.ts`, a persisted queue like the chat's — the ficha shows them done at once (`aplicarCola` lays the queue over the server's visit: the entrada marked, the button already offering the salida, the deleted photos gone) with a ✓ *"se envía cuando haya señal"*, and they leave in order when the connection returns; a 4xx leaves the item *fallido* with the server's reason and Reintentar/Descartar, and holds back the later items of that visit, since sending the salida of a rejected entrada only adds a second rejection. **Files belong to the visita, not to any form.** `ArchivosVisita` lives on the
visita's own page and every change — upload, re-tag, delete — goes out on its
own, in any state. Photos get taken *while* the job happens: whoever is in the
garden uploads what they have and carries on, and making them wait for a save
button on another screen, or for the visit to be closed, is asking them to
remember. So neither *Completar* nor *Editar* touches files.

**Closing a visita is its own page** (`/dashboard/visitas/[id]/completar`), not
a dialog, and it is **office-only**: it shows what every assigned person filed,
which obligatorias nobody covered and who hasn't filed at all, and asks only
whether the work is done, with what date, and — if it isn't — why. It no longer
asks for hours or for what was done: the gardeners already said both. The
*Completar* button shows for `PROGRAMADA` **and `EN_CURSO`**: it was programada
only, and a visit goes en curso the moment somebody marks entrada, so the one
that needed closing was exactly the one without a button.

**When the visit can't be done, the gardener reports a novedad, and the office
closes it as `NO_REALIZADA`.** Arriving to find nobody home, a locked gate, or
the client cancelling at the door had no honest path: the salida demands a
tarea, cancelling is the client's or the office's and only from `PROGRAMADA`,
and what was left was the chat, which leaves nothing on the visit. Now the app
offers *No pude hacer la visita* under the primary button, on the visit's day,
while the person hasn't marked salida and hasn't reported yet: a bottom sheet
(`HojaNovedad`) with the motivo from a closed list (`MotivoNovedad`:
`NADIE_EN_CASA`, `SIN_ACCESO`, `CLIENTE_CANCELO`, `OTRO` — `OTRO` requires the
note; the labels are `MOTIVO_NOVEDAD_LABEL` in `@vivero/shared`), an optional
note and optional photos — up to `MAX_FOTOS_NOVEDAD`, gathered like the chat's
attachments (camera and gallery **add**, each thumbnail has its ✕; it was one
photo and the second replaced the first), stored in `VisitaNovedadFoto`. It
goes through the same offline queue as
the marks (`tipo: "NOVEDAD"` in `cola-de-visitas.ts`; `aplicarCola` shows it
reported at once) and lands in **`VisitaNovedad`** with the evidence of a mark —
`marcadaEl`/`recibidaEl`/`sinConexion`, lat/lng/precision/simulada, the device
— because "we were there at 8:12 and nobody opened" is what gets answered to
the client who says nobody came. `reportarNovedad` (`POST
/api/mobile/visitas/[id]/novedad`, **app only**, like marking) is accepted with
or without an entrada; with entrada and no salida it **also stamps the salida**
with no tareas, since "got in and was sent away" has hours but no work, and the
normal salida can't say that. After a salida it is refused: the parte is filed.
One per person per visita (unique index), idempotent by `marcadaEl` like a mark,
and it does **not** change the visit's estado: it pushes `pushNovedadDeVisita`
to every ADMIN/STAFF **in the moment** — with the crew still at the gate is when
calling the client is worth something — and the lists show an amber *Novedad*
pill beside the estado while the visit is still open (`conNovedad` on the
portal's rows, the `NOVEDAD` pseudo-state of `estadoParaMi` in the app, which
reads *Con novedad*). In the portal's *Cronología* the report sits on that
person's own row — amber dot, *No pudo hacerla*, the hour and the motivo —
instead of *Sin marcar*, and the close page doesn't list them among those who
"haven't filed": reporting is their parte for that day. With several
reporters the card is titled *N novedades* and lists each. **A gardener sees
only the novedad they reported** (`novedadesQueLeTocan`, the same cut as
`fotosQueLeTocan`, applied in the service and in the portal's detail page): a
coworker's report belongs to that coworker and to the office, which is who
resolves it. The photos go to
`novedades/<visitaId>/` in R2, their own
prefix (`/novedad/upload-url`, a signed batch like the calificación's), never
to `VisitaMedia`: those are the work photos and they build the informe handed
to the client. The portal's ficha and
the close page show `TarjetaNovedades` on top, with the hour, the point on a
map and the *Resolver* button, which opens the close page with *No realizada*
and the reported motivo preselected (`?resultado=no-realizada`). **`NO_REALIZADA`
is the fourth way to close** (`markVisitaNoRealizada`, the `NO_REALIZADA`
branch of `POST /api/visitas/[id]/completar`, `/api/mobile/visitas/[id]/no-realizada`):
the crew went and there was no work. It is not `CANCELADA` — decided before,
nobody travelled — nor `INCOMPLETA` — work was started. It stores the motivo in
`Visita.motivoNoRealizada` (cleared if the visit leaves that state) and the
text in `notasIncompleto`, like the other two; it **does not occupy the
client's day** (`visitasDelDia` skips it, so the crew can go back that same
afternoon), it **is offered when building an orden** (the wasted trip is a
legitimate line; a cancelada is not), it cannot be deleted (`softDeleteVisita`
counts it as worked: somebody went), it refuses partes like a cancelada
(`ensureHuboOPuedeHaberTrabajo`), and it notifies the admins like an incompleta
plus a push to the **client** with the hour (`pushVisitaNoRealizada`). The
close page's *Reprogramar para* creates the new visit in the same gesture —
same people, plan, obligatorias and notes, linked through
`Visita.reprogramadaDeId` (self-relation; the ficha shows *Repite a* and
*Reprogramada* rows) — and everything that alta could refuse (the day taken,
the client inactive, the plan not of that propiedad) is checked **before**
closing, so it never leaves one visit closed and the other uncreated.

**The app's gallery is its own, like WhatsApp's** (`SelectorDeGaleria`, on
`expo-media-library`): the chat's *Multimedia*, the novedad's *Galería* and
the visit's *Galería* in `ArchivosVisita` open it instead of the system picker
(a pending visit photo is an `ArchivoLocal` now, from the camera or the
gallery alike, and a gallery one keeps its tarea when the gallery is reopened). The system picker starts blank every
time and has no way to be told what is already chosen, so with three photos in
the tray you could neither see which ones nor unmark one from there, and
picking one again duplicated it. This one opens with the chosen ones **marked
with their number** (the order tapped is the order sent), unmarking there
removes them, and what comes back **replaces** what had come from the gallery
while camera shots and documents stay put — `assetId` on `FotoEnCola` /
`FotoElegida` is the link. It is the informe picker's shape (Shopify's *Select
files*: ✕ and title, four per row, the floating dark bar with the count and ⊗,
*Ver marcadas*, *Cancelar* / *Listo* once the selection changed), paginated
eighty at a time newest first, with a duration label on videos. It returns
**files ready to upload** (`archivoDeAssetDeGaleria` in `lib/galeria.ts`): a
gallery `ph://` / `content://` is not a file, so `getAssetInfoAsync` gives the
real one, and every **photo is re-encoded to JPEG** with
`expo-image-manipulator` — an iPhone shoots HEIC, which sharp can't read
without libheif and browsers other than Safari can't show, and the original
is the 12-megapixel one; the system picker used to do both silently. Videos go
as they are. The price is a native module and the photo permission the system
picker never asked for (`photosPermission` in `app.json`, granular
photo/video on Android): a new native build, and with **limited** access
(iOS, Android 14) the grid shows what was allowed and offers *Elegir más*
through the system's own limited-library picker.

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
something nobody filed. **On the phone that picker is a drawer** in both apps
(`SelectorDeSeccion` in the app, a bottom `Sheet` under `md` in the portal's
`Step3Secciones`): the empty *Sección personalizada* **first** — it depends on
nothing and is what you pick when what there is to tell is not a tarea — then
*De estas visitas* and *Otras tareas*, with what already has a section greyed
out, and a search box over the tareas (the desktop dropdown already searched;
the drawers filter as you type and hide the empty groups) — seventeen tareas
hanging off a button is a list, and a list gets a drawer. The app used to offer only *Personalizada*:
it still read `productoId` off rows that carry `tareaId`, and never loaded the
catalogue. And `informeSeccionSchema` still declared `productoId`, so
`z.object` **stripped** the `tareaId` both clients sent and every section was
saved without its tarea — fixed with the field renamed; a section's tarea is
what the reopen dedupes on, so older informes just show every tarea as
available again.

**Photos are not part of any form.** On the phone they live in the visita's own
*Archivos* section — camera or gallery, uploaded the moment they are picked, in
any state. They used to sit inside the salida form, where they arrived late: the
photo is taken *while* the work happens, and saving it for the end is asking
someone to remember. That form now asks one thing, which tareas they did. **The tag is
required, and chosen per photo before anything uploads**: picking opens a review
sheet listing each file with its own tarea selector, and the *Subir* button says
what is missing until nothing is. One tag for the whole batch was the obvious
shape and the wrong one — a single trip to the gallery brings the pruning and
the broken sprinkler together, so a batch tag would be a lie half the time —
but *Aplicar a todas* sits in that sheet, because the other half of the time
they really are all of one thing and tagging eight one by one is a punishment.
Closing the sheet keeps the batch (a stray drag must not cost eight tagged
photos); a line under the buttons offers to reopen it. **The tag is not written
on the photo**: it was a 10 pt bar burnt over the bottom edge, covering the
third of the image anyone looks at, truncating any long name and painting the
untagged ones amber — a code nobody was taught. The grid **groups by tarea**
instead, the name as the group's heading, so the category reads from across the
screen and *Sin tarea* is a group to fix rather than a colour. **The photo
itself is the tap target**: the only tappable thing used to be that label, with
a permanent ✕ on every thumbnail — three photos, three delete buttons staring
at you, for something done once in a while. Tapping opens the photo's sheet,
where the three things one asks of a photo live: see it full screen, change its
tarea, delete it. The server enforces it too (the mobile confirm route requires
`tareaId`), because a rule only the screen keeps is a suggestion; `PATCH` still
accepts `null`, since older photos have no tag and the office has to be able to
move them. **Each gardener sees and touches only the photos they uploaded**
(`VisitaMedia.subidaPorId`, `fotosQueLeTocan`): on a three-person visit the grid
mixed everyone's work and anyone could delete the photo somebody else had just
taken. The office sees all of them, because it builds the informe, and so does
the cliente, because they are of their garden; rows from before the column have
no owner, so the gardener does not see them either — we don't know they are
theirs. **Nothing saves until confirmed, and it all confirms together**: adding,
removing and re-tagging are local until someone presses *Guardar*, and one `PUT`
carries the three (`files` in, `eliminar` out, `etiquetar` for the ones that
changed tarea — deletions first, then re-tags, then the new ones). Deleting used
to be one call per photo and re-tagging another — removing five was five trips,
five chances for one to fail and nowhere to change your mind — and a mixed batch
of your own plus someone else's is refused whole rather than half-applied. The
two buttons live in the **screen's own header**, replacing the back arrow and
the client's name while there are changes: that header is the only thing that
stays put while the page scrolls, and a confirmation you have to scroll to find
is one that gets lost. Taking the arrow with it is the point — leaving means
deciding first. The tag can be **any live tarea** and not only
what that person ticked: in the field you photograph what shows up — a
watering problem during a pruning — and restricting the tag to your own tareas
leaves exactly those photos unclassified, which is what stops the informe from
placing them. From the portal,
`ArchivosVisita` groups files by tarea with the visit's own first, untagged last,
and adding happens *inside* a group, so where you drop it is the tag; there is no
separate "which tarea" field. Re-tagging accepts **any live tarea**, not only the
ones filed. **`archivoSubibleSchema` in `@vivero/shared` is
the one gate for uploads** (web and mobile): only `image/*` and `video/*`, at
most `MAX_ARCHIVOS_POR_SUBIDA` per call. The content type matters because it is
what gets *signed* — the presigned URL carries it and R2 stores whatever
arrives, and `tipo` is derived as "video" or, for everything else, "imagen".

**Who closed a visita is its own pair of columns.** `completadaEl` / `completadaPorId` are stamped on the transition **into** `COMPLETADA` and cleared when it leaves, so re-saving the form to fix a date doesn't make the corrector the one who completed it. They are not `fechaRealizada` — that is the *day the work happened*, chosen by whoever closes it and often earlier — and not `updatedById`, which any later edit overwrites. Each id is paired with a **name snapshot** (`completadaPorNombre`, `updatedByNombre`), the same split `Factura` and `OrdenLinea` already use: the id is what you filter by, the text is what happened. An id alone can't tell the story — `onDelete: SetNull` empties it when the account is removed, and a rename rewrites history — so the ficha shows the text and the list filters on the id. The filters are `completadaPor` and `completadaDesde`/`completadaHasta`, and the person dropdown only lists people who actually closed something.

**The team has chats; the client does not.** `Chat` / `ChatMiembro` / `ChatMensaje` / `ChatAdjunto` are conversations **between vivero accounts** — the office and the field, which is what happens on WhatsApp today and stays nowhere. Two permissions and no more: **creating a chat and deciding who is in it is the ADMIN's**, and **reading and writing is the members'**, ADMIN, STAFF or PERSONAL alike. Being in it is the only thing that grants access — an admin who is not a member doesn't see it either, because a conversation anyone can look into is not a conversation. Removing someone marks `ChatMiembro.salioEl` instead of deleting the row (every access question filters `salioEl: null`, so it cuts access just the same) and re-adding clears it and hands back the whole conversation, the way returning to a group works. Unread is `leidoEl`, an instant and not a counter: messages have dates, so "unread" is counting from there and two open screens can't desync a number. A message carries its author's id **plus a copy of the name** — the same pair `Factura` and `OrdenLinea` use — because renaming an account can't rewrite what somebody said yesterday; deleting one crosses it out and strips its text, in the reply quote too. **Replying is a relation, never a copy of the quoted text**, so the quote shows what happened to the original. Photos live in their own table under their own R2 prefix rather than in the `Media` library: that one is the catalogue products pick from, and what someone sent in a chat has no business there. **A chat has a photo, like a WhatsApp group** (`Chat.imagenKey`/`imagenUrl`): the ADMIN sets it from the same form that names the chat, in both apps, and it shows in the list, the header and the search results, with the initials (portal) or the chat icon (app) as the fallback. It is uploaded *after* the chat exists — the presigned URL is per chat (`/chats/[id]/fotos`), so there is nowhere to put it before — and `updateChat` accepts only a key under that chat's own prefix (or `null` to remove it), deleting the previous object from R2. The portal shrinks it to a 512 px centred square on a canvas before uploading; the app uses the picker's own 1:1 crop. **Tapping the chat's name opens its info**, WhatsApp's group info, in both apps (`InfoDelChat` on the portal, one dialog with views; `chats/detalle/[id]` in the app): the photo and name, *Grupo · N miembros*, the row *Multimedia, documentos y enlaces* with its total (`getChat` returns `medios`), and the members — with *Agregar miembros* and a per-row *Quitar* for the ADMIN, since people are added and removed one at a time from here, the way one thinks about it, while *Editar* (the pencil that used to sit in the header) is now only the name and the photo. `mediosDelChat` (`/api/chats/[id]/medios?tipo=archivos|enlaces`, paginated) feeds the grid and the list: the grid is every `ChatAdjunto` of a live message, newest first; the links are the messages whose text carries `http(s)://` or `www.`, with the URLs extracted server-side (`enlacesEn`) and *Ver mensaje* opening the conversation around them. **Documents travel in the chat too** — PDF, Word, Excel, PowerPoint, text and ZIP, the allowlist in `esContenidoPermitidoEnChat`, enforced where the upload is *signed* (`chatUploadUrlsSchema`), and `tipoDeArchivo` decides `imagen`/`video`/`documento` from the content type server-side. `ChatAdjunto.tamano` keeps the bytes for the "1,7 MB · PDF" line; the bubble draws a document as a card (name, size, extension) that opens the R2 URL, the composer's **+** opens WhatsApp's attach panel (`PanelAdjuntar`, in both apps) — a grid of coloured circles, four per row: *Cámara* (phone only), *Multimedia* (the same word the info screen uses for photos and videos), *Documento*, *Visita*, and *Cliente* / *Producto* for the office — hanging off the button on the desktop (WhatsApp Desktop's popover, opening upward) and rising as a bottom sheet on the phone, with a **camera button beside the field** on the phone, because the shot of the garden is taken in the moment and a menu is a step in the way. The clip and the image button it replaced were two because the OS picker filters by type, which is still why the portal keeps two hidden inputs, plus a third with `capture` for the camera. With images and videos both requested, iOS's system camera offers photo or video while Android's shoots photos only (expo-image-picker's `toCameraIntentAction` picks the video intent only when *videos alone* are asked), so on Android a video goes in through the gallery; and in the app the native pickers launch a beat after the sheet closes, since one presented while the modal is still dismissing is dropped by iOS without a word — and the info's single row *Multimedia, documentos y enlaces* opens the three tabs, in that order. Each tab's first page is cached locally (`leerMedios`/`guardarMedios`) and painted before the server answers, like the conversation. **Every chat photo gets three versions** (`lib/chats/variantes.ts`): after the send is answered — `after()` from `next/server` in the two POST routes, so the ✓ never waits — the server pulls the original from R2, applies the EXIF rotation and writes móvil (480 px), tablet (1024) and escritorio (2048) JPEGs beside it, stored as `ChatAdjunto.urlMovil/urlTablet/urlEscritorio`; the original stays untouched. `urlParaMiniatura` (bubbles, grids, quotes, search rows) and `urlParaVerGrande` (the viewer, by screen width) in `@vivero/shared` pick the one that fits and fall back to the original until the versions exist, which the next poll brings. **Videos get a 720p** (H.264 main + AAC 96k, CRF 28, `faststart`, `yuv420p` so a 10-bit iPhone clip doesn't play black on Android) stored as `urlMovil`, and a **poster** JPEG of second one (`posterUrl`) that the bubble and the grid draw behind the play triangle; the desktop still plays the original. It is `ffmpeg-static` spawned with `execFile` and a four-minute cap, the binary traced into the function through `outputFileTracingIncludes`, and the two POST routes declare `maxDuration = 300` because `after()` work counts against the function's time. Documents aren't compressed (a PDF needs Ghostscript; Office and ZIP already are). In the app the chat images are `expo-image` with `cachePolicy="disk"`, so a photo seen once is not downloaded again. **A message can carry a ficha** — a visita, a cliente or a producto, shared like a contact in WhatsApp: the **+** panel offers them beside *Documento*, a picker with search (`compartibles`: visitas and clientes through `globalSearch`, so numbers and nombre-apellido already work, productos through `listServicios`; without text, the week's visits and the first clients and products) puts the card above the composer like a photo, and it leaves with the message. The client sends only `{ tipo, id }`: `tarjetaDeReferencia` builds the card **server-side** through each thing's own service — which is what applies who can share what — and stores it in `ChatMensaje.referencia` (JSON: tipo, id, titulo, detalle) as a *copy*, like `autorNombre`, so the card says what was shared that day even if the ficha changes or is archived later; tapping it opens a **read-only preview without leaving the chat** — a dialog on the desktop, a bottom sheet on the phone (`VistaPreviaDeFicha` in both apps), fed by `vistaPreviaDeReferencia` (`/api/chats/referencia`, `/api/mobile/chats/referencia`): the server goes through each thing's own service and returns generic label/value rows already formatted, so one screen serves the three types, with a *Ver ficha* link to the full page for whoever does want to leave (it used to open the ficha itself, and coming back was losing the thread) — and **whether they may see it is decided in two places**: by role, before tapping (`puedeAbrirReferencia` in `@vivero/shared`: a cliente or a producto is the office's, so for a `PERSONAL` tapping that card shows an alert — `toast` on the portal, `Alert.alert` in the app — instead of navigating; the card itself looks like any other, since dimming it and explaining it before the tap was noise on a message that is mostly read, not opened — and it costs no query, which is why the visita case is not decided here: knowing whether *this* visita is theirs is a lookup per card per poll), and by the server, on opening (a visita they were not assigned to answers 403, and the screen says so: `SinAcceso` on the portal, `AvisoDeCarga` in the app — which also tells a 404 and a lost connection apart, since the three used to read "No pudimos cargar" — with the words in `SIN_ACCESO_A`). That last part is what made the **portal's visita, cliente and producto pages gate by role themselves**: they only asked for a session and fetched by id, so a gardener holding a card — or any pasted URL — opened the whole ficha of a visita that wasn't theirs or of any client, while a producto crashed into Next's English error page. The lists and the API scoped correctly; the detail pages didn't. `dashboard/not-found.tsx` and `dashboard/error.tsx` replace Next's English defaults inside the panel, and the card link carries `?from=` so the ficha's arrow returns to the chat. **Photos wait and leave with their caption, in one message.** Picking them puts a thumbnail above the composer with its ✕; sending uploads them and posts a single message with the text — a photo used to upload and send on the spot, so it could never carry a caption or travel with another one. Each attachment stores **the file name it was sent with** (`ChatAdjunto.nombre`), because its R2 key is a uuid: without it an image has no word by which to find it. That is what `buscarMensajes` searches, alongside the message text — scoped to the chats the person is a member of **today**, so being removed from a group also removes it from the search. **Videos travel the same road as photos** (`tipo` is decided server-side from the signed content type, never by the screen), and a video draws as a dark box with a play triangle until it is opened — it has no image of its own without playing it. **A reply quote carries a thumbnail** of the first attachment of what it quotes, because "📷 Foto" doesn't say which one. **Copiar copies the whole message** the way WhatsApp does: on the web, text and first image go out together in one `ClipboardItem` (the image re-encoded to PNG through a canvas — the browser accepts nothing else, and R2 allows CORS so the canvas isn't tainted); on the phone the clipboard holds one thing, so it's the text if there is one, else the image bytes (`setImageAsync`). Three things about that web path were learned the hard way: the image goes into the `ClipboardItem` as a **promise**, not awaited first, because Safari only accepts `write` inside the user's gesture and awaiting the download leaves it; the download is `cache: "no-store"`, because an image the browser already drew in an `<img>` without `crossorigin` is cached without CORS headers and the CORS `fetch` fails against that cache even though R2 sends them; and when the image can't be had, what *can* be copied still goes — the text, or the photo's URL — with the reason in the console. It said "No hay nada para copiar" in exactly that case, with the photo on screen. Without HTTPS (the portal opened by IP from another machine) `navigator.clipboard` doesn't exist and text falls back to `execCommand("copy")`. Videos are never copied — no clipboard takes them. A result opens the conversation **around** that message (`listMensajes({ alrededorDe })` brings the ones before and after, and the screen highlights it), not at the end, which can be a hundred messages from what they came to read. Pushes are two: a new message to every member **except its author**, and "te agregaron" to **the person added only** — the ones already there didn't have anything change. **Both screens poll every 5 seconds** and only while visible (the tab in the portal, the focus in the app): there are no websockets here, and standing them up is far more than what fifteen people agreeing on a time need — the push covers the closed screen, the polling the open one. **Sending is optimistic and queued** (`components/chats/cola-de-envio.ts` on the portal, `lib/cola-de-envio.ts` in the app, the shapes and `mezclarConLaCola` in `@vivero/shared`): a message is drawn the instant it is written, carrying a client-generated `idCliente`, and leaves from a module-level queue that outlives the screen — persisted in `localStorage` on the web (text only: a `File` doesn't survive a reload) and in `AsyncStorage` in the app (everything, since the photos are files on the phone) — retried on `online`, on coming to the foreground and every 5 s. The server makes the retry safe: `ChatMensaje.idCliente` is unique per chat, so a send cut after being saved comes back as the message already stored instead of a duplicate, and the poll confirms arrivals by the same id. Not reaching the server (a throwing `fetch`, `ApiError` status 0, a 5xx) is *waiting*; a 4xx is *fallido*, shown under the bubble with its reason and Reintentar/Eliminar. **The ticks are WhatsApp's**: one ✓ while it waits, ✓✓ once the server has it, ✓✓ blue when every other *current* member has read it — `estado` on each message, derived from `ChatLectura`, one row per message and reader, written in batches by `registrarLecturas` (only what is newer than the member's `leidoEl`, which now sits on the newest message *seen* rather than on `now()`, so a message landing between the read and the write can't slip under the mark). There is no "delivered": nothing here can know it, and a state that can't be known lies. **Info del mensaje** (`infoDeMensaje`, own messages only) lists who read it and when, and who hasn't — a dialog on the desktop, a screen on the phone. **Two gestures, in both apps**: swipe any message right to reply, swipe your own left for its info (`FilaDeslizable` in the app, `Gesture.Pan` + Reanimated with `failOffsetY` so the list still scrolls; pointer events under `touch-action: pan-y` on the portal, deciding by the first direction the finger moves); the desktop gets *Info* in the ⋯ instead. **Both apps keep a local snapshot of each chat** — the newest 30 messages, the header and the cursor to go further back (`lib/cache-de-chats.ts` in AsyncStorage, `components/chats/cache-de-chats.ts` in localStorage; the app caches the chat list too, the portal's comes with the HTML) — painted the instant the chat opens and replaced by the server's answer right after. It is stale-while-revalidate, never the truth: the receipts and everything else about a message come from the server on every poll, so nothing has to be kept in sync by hand, and older messages are always fetched (infinite scroll upward in both, the portal's button is gone). WhatsApp stores everything on the phone because with end-to-end encryption its server can't hold the history; ours can, and a local copy of everything would be a second database to keep honest. On the portal the trick is `[id]/loading.tsx`: while Next fetches the page it renders the cached conversation read-only (`soloVista`: no polling, no sending), so switching chats on the desktop doesn't blink a skeleton — read through `useSyncExternalStore` with a `null` server snapshot, because the HTML has to carry the skeleton or it's a hydration error. **On the desktop the chats are two panes**, like WhatsApp Desktop: `chats/layout.tsx` loads the list once and `ChatsMarco` keeps it beside the open conversation (the list polls `/api/chats` on its own to keep the unread counts honest); on the phone the same layout shows one or the other by route segment, so nothing has to be kept in sync with the URL. Chats sit in the phone's tab bar in both apps, the gardener's included — **and Clientes came out of it** to make room: a chat is opened many times a day, while a cliente's ficha is reached from their visita or by searching, not from the bottom bar, and the two together made six tabs fighting over 375 px. Clientes stays one tap away, in *Más*. **The client rates the visit; there is no chat with them.** `VisitaMessage` and its two tables are gone — the chat asked for someone to be on the other end, an office inbox being watched, and in practice nobody used it: it was built, seeded in development, and never reached production, which is why dropping it cost no real history. **CalificacionVisita** asks one thing at the one moment the client has something to say — when the work is done: stars (1–5, the only required part), optional text and optional photos, taken with the camera or picked from the gallery. Most people write nothing, and demanding a comment to accept the rating is how you end up without the stars either. **One per visita**, enforced by the unique index, and the client can change it — it is their opinion, and changing your mind about a garden happens. Only the client can write it (an office-written rating of itself is not a rating) and only on a `COMPLETADA` visit: an incomplete or cancelled one has no finished work to judge. **The office reads it; the assigned gardener does not** — a bad rating gets talked about, not read alone on a phone. The photos live in `CalificacionVisitaFoto` and under their own R2 prefix rather than in `VisitaMedia`, because those are the work photos, tagged by tarea, and they are what builds the informe: a complaint photo would end up printed in the document handed to the person who complained. Completing a visita fires `pushPedirCalificacion`, which opens the rating screen directly — the notification already asked, so landing them on the ficha to hunt for the button charges a step they had agreed to take.

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
query filters `deletedAt: null`, so what disappears is the listings. **A visita anyone worked
is not deleted at all**: deleting is for the one scheduled wrong that hasn't
happened yet — wrong client, wrong day, the duplicate — and the moment someone
marks their entrada there is a fact on record, with their parte, their photos
and the informe that uses them behind it. What fits there is *cancelling*, which
says it didn't happen and why. So `softDeleteVisita` refuses `EN_CURSO`,
`COMPLETADA` and `INCOMPLETA`, and also a `CANCELADA` where somebody had already
marked — cancelling a visit that had started is ordinary. It is also
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

**A line is of a product, of a plan's period, or personalizada.** The period
line carries `suscripcionId` + `periodoInicio`/`periodoFin` and **no
product** — a plan sells no catalog item — so `OrdenLinea.productoId` and
`varianteId` are nullable. A **línea personalizada** has neither product nor
plan: Shopify's *custom item*, a one-off job typed by hand (*Ítem
personalizado* beside the catalog picker, on both *Nueva orden* and the draft
editor, and in the app), the only line whose description is edited on the
order, since there is no catalog to take it from; it prints
`CODIGO_LINEA_PERSONALIZADA` (`PERSONALIZADO`) as its `codigoPrincipal`, and
the emit screen shows *Ítem personalizado* where the product picker would be.
The lines migrated from the old items keep their product *and* their period:
that is history. The line is born as
*"Plan mensual · Casa · septiembre 2026"* (`descripcionDePeriodoDePlan`, the
propiedad named only when the cliente has more than one — "Principal" says
nothing on an invoice) at the plan's price, editable like any snapshot. Its
`codigoPrincipal` is `SUS-<numero>` (`codigoDePlan`), and **`FacturaLinea.codigo`
now freezes whatever code was printed**: it used to be derived from the SKU at
read time, so a nota de crédito months later printed today's SKU rather than
the comprobante's, and the plan line had nothing to derive it from. The unique
index is `[suscripcionId, periodoInicio]`, one line per period; the migration
kept the link on **one** of the old per-item lines per period (the oldest
order, first position) and left the siblings with their product and dates but
no link. Renewals (`generarRenovaciones`) now also stamp `Orden.suscripcionId`
on the header — the cron used to leave it null, so the order's ficha didn't
show the plan — and the migration backfilled it. Adding loose catalog products
on top of a period line is fine. That keeps a sales report to one query instead
of a union per revenue type, and keeps the history in our own database.
**Factura** is the comprobante the portal itself issued against the SRI — clave
de acceso, signed XML, its own lines — see
[the invoicing doc](./.claude/docs/facturacion-sri.md).

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
`[suscripcionId, periodoInicio]` is unique across the whole table regardless
of order state, and `listarPendientes` treats any linked line as billed — so an
annulled order that kept its period would strand it forever. `anularOrden`
therefore refuses while a period or a visit is linked unless `liberarTrabajo`
says otherwise, and the dialog names what gets released before you can proceed.
`liberarProcedencia` nulls only `suscripcionId` and keeps the period dates: the
annulled order still reads "Suscripción · septiembre" as history, and without
the plan the dates collide with nothing. The visits are the softer half — they
reserve nothing — but they go in the same gesture, because the order stops
saying why it exists.

**Any catalog product can be sold.** There is no external catalog to link it to
any more: the invoice line carries a `codigoPrincipal` and a description that are
both ours, so `Variante.sku` (unique, optional) is all a product needs — and
without one the emission derives a code from its id. What a product line does
need is a **product from our own catalog**, and the FKs on `OrdenLinea` and
`FacturaLinea` are `RESTRICT`, so a sold product can't be hard-deleted. The
invoice builder shows a plan's line with *"Suscripción #N · propiedad"* where
the product picker would be; a hand-added line still picks a product.

Orders are written **only** through `crearOrden()` in
`src/lib/services/orden.service.ts`. A line's `descripcion` and
`precioUnitario` are a snapshot and are the truth; `productoId` and the
provenance fields (`suscripcionId` + `periodoInicio`) are for traceability
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

- **`buttonVariants` cannot be called from a server component.** `components/ui/button.tsx` is a `"use client"` module, so from a server component its exports are client references: rendering `<Button>` works, but *calling* `buttonVariants()` to style a `<Link>` throws *Attempted to call buttonVariants() from the server*. It only shows at runtime — `next build` passes — and the page falls into `error.tsx`. A page that needs it is `"use client"` (`sin-acceso.tsx`, `dashboard/not-found.tsx`), and the classes go through `cn()`, or the variant's border loses to the base's `border-transparent`.
- **Nothing on the server may pull in `jsdom`.** Its dependency chain ends in a `require()` of an ESM module, which throws *while loading the file*, so any page importing it 500s before running a line. That is why `src/lib/html-seguro.ts` sanitizes with `sanitize-html` (no DOM) instead of DOMPurify.
- **`sharp` opens `libvips-cpp.so` with `dlopen`**, which file tracing cannot see, so the lambda got the binary without the library it needs. `outputFileTracingIncludes` asks for `node_modules/@img/**` explicitly, and `outputFileTracingRoot` points at the monorepo root because npm workspaces installs there.

Other env: `DATABASE_URL`, plus `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — **required in production**: without the secret next-auth doesn't sign sessions and nobody can log into the dashboard, and dev auto-generates one so the problem only shows up on deploy. `apps/admin/.env.example` lists every variable with what breaks without it.

## Conventions

- Admin imports use the `@/*` alias → `apps/admin/src/*`. Mobile uses `@/*` → `apps/mobile/*`.
- **A date with no time never goes through a clock.** `Visita.fechaProgramada`, `Informe.fecha`, `Orden.fecha`, `Factura.fechaEmision` and the rest of the `@db.Date` columns are calendar days: Prisma hands them back as a `Date` at **midnight UTC**, so `new Date(iso).toLocaleDateString("es-EC")` in Guayaquil (UTC-5) prints 19:00 of *the day before* — today's visit read "miércoles 16" on the gardener's phone while the list, which compares raw `YYYY-MM-DD`, had it right under "Hoy". Print them with **`fechaSola`** (`@vivero/shared`), which slices the `YYYY-MM-DD` and formats it in UTC, and compare them as strings (`diaISO`, `sumarDias` — in that format text sorts like dates, so `>=` is enough); the same shift is what dropped the client's today visit into *Historial*. It bit the PDF's printed date, the WhatsApp reminder and the push too, where it only looked fine because Vercel runs in UTC. An **instant** — `generatedAt`, a clock-in mark — is the opposite case: there the hour is the datum and it is formatted in Ecuador's zone (`hora12De`, `fechaYHora12`).
- Validation: Zod schemas shared cross-app live in `@vivero/shared`; admin-web-only schemas live in `src/lib/validations/`. Validate request bodies/queries at the route boundary with `safeParse`.
- Admin UI: shadcn/Base UI components in `src/components/ui/`, Tailwind v4, feature components grouped by domain (`src/components/visitas`, `clientes`, etc.). **Every dashboard route segment has a `loading.tsx`** (`src/components/shared/page-skeletons.tsx`): without one the App Router waits for the server component's queries *before* navigating and the click feels stuck. Add one when you add a route. **List pages follow one layout**: the page root is `flex h-full flex-col` — `h-full`, never `min-h-full`, or the content grows past the viewport and pushes the pager below the fold. The card is a `flex flex-col` holding a `min-h-0 flex-1` scroll area (`<Table containerClassName="h-full overflow-y-auto">` + `<TableHeader sticky>`) and, as its footer, `<TablePagination>` (`src/components/shared/table-pagination.tsx`), which renders even with a single page. So only the rows scroll — filters, header and pager stay put — and the height comes from the container instead of a hand-tuned `calc`. `FILAS_POR_PAGINA` is the one page size for every listing; card grids pass `suelta` to drop the footer styling. **A list's filters, search and page number live in the query string**, via `useFiltroUrl` (`src/lib/filtros-url.ts`) — a drop-in for `useState` that mirrors the value into the URL with `history.replaceState`. Opening a record and pressing back re-creates the page from scratch, so anything held only in React state is lost and has to be typed again; the URL is what the browser actually remembers. **Every row link carries `?from=` built with `aca()`** (or `useAca()` when the href is built during render — `window` doesn't exist on the server and a differing href is a hydration error), and every detail's back arrow honours it via `hrefDeVuelta()` (`src/lib/navegacion.ts`), which rejects anything outside `/dashboard/`. That arrow — not the browser's — is how people actually go back, so a hard-coded `href="/dashboard/x"` there throws the filters away. Only the value that differs from the default is written, so an untouched list keeps a clean URL. The pages whose filters the **server** reads are `/dashboard/visitas` and `/dashboard/informes`, because their lists are server queries — and there the filters must be applied with `router.replace`, not `useFiltroUrl`: rewriting the URL by hand asks the server for nothing, so the table kept showing the previous month's visits while the controls said otherwise. `replace` and not `push` so back leaves the list instead of undoing one filter at a time — and it matters twice over for the search box, where `push` would leave one history entry per keystroke. **Both search by client with a text box instead of a client dropdown**, and the search runs in the query (`ILIKE` over nombre/apellido/empresa, plus the título on informes): the list is paginated, so filtering in the browser would only search inside the page you can already see. **The text is matched word by word, never as one phrase** — `filtroClientePorTexto` (`src/lib/services/busqueda.ts`) for the Prisma queries, `palabrasParaIlike` for the raw SQL of the informes list: every word has to appear in *some* field, so "Maria Luisa" finds both the woman whose first name is that and the Maria whose surname is Luisa, and the order stops mattering. The phrase-against-each-field version failed at the most ordinary thing anyone types — a first name and a surname — and you had to search one or the other. That rule lives in one place because it was written three times and two of them were wrong; the clientes list adds the teléfono to the same per-word question. **The same box also takes the record's own `numero`, with or without `#`** (`numeroBuscado`), because "#194" is how a visita or an informe gets named out loud — OR'd with the text search, so a cliente called "Grupo 24" or a título with a year in it keeps working, except for a single digit, which is a number and nothing else (`esSoloNumero`, the same rule the global search uses: "1" as text matches every phone and half the titles). Both text inputs go through **`useBusquedaEnUrl`** (`src/lib/filtros-url.ts`), which debounces ~300 ms and, crucially, tells the **echo** of what it just sent apart from a change that came from elsewhere: it remembers the last value it pushed, adopts the URL only when it differs (back/forward, *Limpiar filtros*, a link that arrives filtered), and otherwise lets what is being typed stand. Deriving the field from the URL — the obvious version — loses every letter typed while the query was in flight: the request for `?q=Jor` comes back half a second later, the field snaps to "Jor", and the "ge" typed meanwhile is gone, which is what "I can't type continuously" turns out to mean. And **the list must not be replaced while the new one loads** — swapping it for a "Cargando..." or letting `loading.tsx` take over makes the page look like it reloads itself on every keystroke — so both pages navigate inside `startTransition` and dim the old rows until the new ones arrive. Anything else that can outgrow the viewport does the same internally: the visits calendar is a `flex h-full flex-col` card whose month header stays outside the scroll area and whose weekday row is `sticky top-0` with an **opaque** background — a translucent one lets the rows show through as they pass under it. Date filters use `DateRangePicker` (one field, two months, shortcuts for hoy/ayer/mañana/semana/mes) rather than a Desde+Hasta pair — a single day travels as `desde === hasta`. Any calendar heading is a `MonthYearPicker` so jumping to another year is three clicks, not twenty. **Anything that floats — a calendar, a dropdown — goes in a portal**, never in an `absolute` hung off its field: `DatePicker` did the latter and got cut in half on short screens (the wizard's scroll area clipped whatever stuck out above the field, leaving the last two rows of the month and no header), and it decided up-vs-down by measuring only the space *below*, so it would flip up into a place where it didn't fit either. The same bug is why `CustomSelect` renders `fixed` in a portal. `Popover` (Base UI) already flips, shifts and stays on screen; give the content a `max-h` so a very short window scrolls inside the popup instead of clipping it. **The app and the portal on a phone are the same product, and must look and behave the same** — layout, controls, wording, gestures, what each screen can do. When one of them gets a screen right, the other copies it rather than inventing its own; when a rule is written down for one (a list's shape, a drawer, a selection bar), it applies to both, and logic they share goes to `@vivero/shared` instead of being written twice. The **one** exception is **Visitas**, where the app is the gardener's working screen and the portal is the office's. That is why the ordering screen, the filter panel, the bottom drawer and the row shapes below are described once and built twice, and why a change to either side is a change to both. **A short menu hangs off its button; a drawer is for more than that.** The header's ⋯ and the sort picker are anchored dropdowns in both apps — two or three lines, one tap, no reason to cover half the screen with a sheet that animates in and drags to close. In the app that means measuring the button (`measureInWindow`, never a fixed offset — the header grows with the safe area and the system font size) and drawing the card inside a transparent `Modal`, or the header clips it. What still earns a drawer is what needs big rows and options that explain themselves — the filter panel, *Mover* with its position field. **Everything a list can do lives behind that ⋯ on the phone, creating included** — in both apps, and even when it is the only action. The app had a green *Crear* beside the title and the portal did for a while too: it competes with the title for the row and spends permanent width on something touched now and then, while the menu costs one tap and leaves the header with the screen's name and a single control. On the desktop they go back to being buttons in a line, and there the ⋯ lists only what is *not* a button ("Seleccionar personal", resolved by the table's checkboxes). **On the phone everything is tighter than on the desktop**, WhatsApp-tight: the page's padding is 12 (`p-3`, `md:p-6`), a list row is 10 vertical (`FILA_MOVIL` / `FILA_LISTA`), the screen's title is 20/22 rather than 24/26, and a search box and the buttons beside it are 40. What the phone is for is the list, not the air around the title — and with the old numbers a 390 px screen fitted six rows where it now fits nine. Chat goes further: messages are two pixels apart and bubbles are 10×6, because what separates one from the next is *who is speaking*, not the gap. **What a message can do opens differently depending on what you're holding**: on the desktop, the ⋯ that appears when the mouse passes over it; on the phone, holding the message down — the app's gesture, and the one fingers coming from WhatsApp already know. The ⋯ makes no sense there: with no hover it had to stay visible, a grey dot beside every message of yours. Holding down opens the same three things in a bottom sheet (`Responder`, `Copiar texto`, `Borrar`), and the bubble turns off text selection on touch so iOS's magnifier doesn't cover the message it is about to act on. **On the phone, a menu becomes a drawer and a form becomes the screen.** A control that opens a short list of choices — a sort order, a bulk *Mover* — is an anchored popover on the desktop and, below `md`, an icon beside the search box (or a plain button, *without* the dropdown chevron, which promises an anchored menu that isn't what happens) opening a bottom `Sheet` with rows big enough for a thumb: the desktop dropdown spent a whole line on something almost never changed, and a menu pinned to the top of a 375px screen is the far end from the hand. Both presentations live in **one** component (`SelectorOrden`, `MoverSeleccion`/`MoverSeleccionMovil`) sharing the option list, so which one is chosen can't drift between screens. A **form** goes the other way: `DialogContent` takes `pantallaCompletaEnMovil`, which below `md` makes it fill the viewport (`h-dvh`, not `h-screen` — `100vh` counts the address bar even while it's showing) as a flex column, so the body scrolls (`min-h-0 flex-1`) and the buttons stay put. A centred box with a text field fights the keyboard: the keyboard takes half the screen, the box shifts to avoid being covered, and Guardar ends up out of view. Confirmations are the exception and stay centred — two lines read better that way. **A step wizard's action lives in its header too.** On the phone, *Continuar* — and the last step's verb, *Generar*, *Crear* — sits at the right of *Paso N de M*, with the ✕ (first step) or the ‹ (later ones) on the left and the progress bar underneath: `EncabezadoDePasos` in the app (the informe and visita wizards) and the same row hand-drawn under `md` in the portal's `informe-wizard.tsx`, where the desktop keeps its steps strip and its Atrás / Guardar borrador / Continuar footer. The button used to be a wide bar at the foot, which with a client list or a calendar filling the screen sat far from the thumb and covered the last row — and in the portal the footer's three buttons didn't fit in 375 px, so *Continuar* was cut off. What the footer also held — *Guardar borrador*, *Vista previa*, leaving an edit — goes behind a ⋯ beside the action, as everything that is not a button does on the phone. **Selección múltiple** follows one shape wherever it appears (visitas, tareas, personal, grupos, clientes, productos). On the desktop table every row has a checkbox and, with something marked, a bar **covers the header row** — the count, the select-all box (indeterminate: clicking it clears) and the actions. It covers rather than sits above because a strip above the table pushes every row down at the moment someone is aiming at one, and it is rendered **outside** the `<table>` rather than in a `<th>` because the table scrolls horizontally and the button went off screen with it; aligning its checkbox over the column's is a matter of spacers carrying the same width classes as the `<th>`s before it. The phone has no room for a checkbox column, so selection is a **mode**: a `soloMovil` header action ("Seleccionar visitas", "Seleccionar tareas") turns the rows into checkboxes and floats `BarraSeleccionMovil` (`components/shared/barra-seleccion-movil.tsx`) over the nav with the count, a ✕ to leave, and the actions — with more than one, the rest go behind a ⋯ beside it, since about four controls is the ceiling at 375px. The bar shows even with nothing marked: it is what says the mode is on, and how to get out. A row that would open the record must not sometimes navigate and sometimes mark, so while selecting it is a `button`, not a `Link`, and the checkbox is `pointer-events-none` — the row is the touch target, and letting the box take the tap too marks and unmarks in one gesture. A spacer the height of the bar goes at the foot of the list, or it covers the last row. **Actions on that bar are never `destructive`**: the house variant is a 10% wash made for a light card and vanishes on the dark pill, so they use `ACCION_BARRA_MOVIL` (light on dark); the red belongs to the confirm dialog, which is where the decision is made. Header actions render their `icon` **only on the desktop buttons**; the phone's ⋯ menu lists them by name alone. Mobile UI: react-native-paper, theme primary `#2e7d32` (green).
- Mobile state: Zustand stores in `apps/mobile/lib/` (`auth-store.ts` holds the token pair; `lib/api.ts` is the fetch wrapper that auto-refreshes access tokens on 401). **In development the app finds the server through Metro**: `lib/config.ts` reads the IP out of `Constants.expoConfig.hostUri` — the machine the phone is already connected to — and swaps in port 3000, so it follows the network on its own, on the simulator and on a real phone alike. It used to be a LAN IP typed into `apps/mobile/.env`, and the router hands out a new one every so often: the app ended up pointing at an address where nobody answers, which does not read as a network error but as a button that does nothing. `EXPO_PUBLIC_API_BASE_URL` still rules in **production** (there is no Metro) and stays as the way to aim at *another* server on purpose — a staging, somebody else's machine.
- React 19 across the monorepo; root `package.json` pins shared native/React versions via `overrides`.
