# Autenticación de clientes (app móvil)

Los **clientes** inician sesión en la app móvil con **teléfono o correo + contraseña**.
La contraseña la establece el propio cliente mediante un **enlace de invitación** de
un solo uso. (El flujo anterior por OTP de WhatsApp fue retirado.) El **personal**
sigue usando correo + contraseña por `/api/mobile/auth/login` (ver `CLAUDE.md`).

## Flujo

1. **Solicitar acceso** — el cliente (en la app, pantalla `solicitar-acceso`) o un
   admin (botón "Enviar invitación" en la ficha del cliente) dispara la invitación.
   - Mobile: `POST /api/mobile/auth/cliente/request-invite` `{ identifier }` →
     responde **siempre 200 genérico** (no revela si el cliente existe).
   - Web/admin: `POST /api/clientes/[id]/invitar` (requiere sesión, no read-only).
2. **Envío del enlace** — `createAndSendInvite()` genera un token (`randomBytes(32)`,
   se guarda solo el `sha256` en `SetPasswordToken`, caduca a 24 h, un solo uso e
   invalida los anteriores) y manda `…/establecer-contrasena?token=…` por **correo
   (Gmail API)** y **WhatsApp** a los datos en la ficha. Solo el dueño del
   correo/teléfono recibe el enlace → eso es la prueba de propiedad.
3. **Establecer contraseña** — el enlace abre la página pública
   `/establecer-contrasena` (fuera de `/dashboard`, sin NextAuth). Valida el token
   (`GET /api/auth/set-password?token=…`) y guarda la contraseña
   (`POST /api/auth/set-password`). Crea/enlaza un `User` (rol `CLIENTE`, bcrypt 12).
4. **Login** — `POST /api/mobile/auth/cliente/login` `{ identifier, password }`.
   `identifier` es teléfono **o** correo (resuelto contra la ficha del cliente; debe
   haber exactamente una coincidencia). El mismo flujo de invitación sirve como
   **restablecimiento de contraseña**.

## Piezas clave

| Pieza | Ruta |
|---|---|
| Servicio (resolver, invitar, set-password, login) | `apps/admin/src/lib/services/cliente-invite.service.ts` |
| Rutas mobile | `apps/admin/src/app/api/mobile/auth/cliente/{login,request-invite}/route.ts` |
| Rutas públicas set-password | `apps/admin/src/app/api/auth/set-password/route.ts` |
| Invitación desde admin | `apps/admin/src/app/api/clientes/[id]/invitar/route.ts` |
| Página pública | `apps/admin/src/app/establecer-contrasena/` |
| Modelo del token | `SetPasswordToken` en `prisma/schema.prisma` |
| Pantallas móviles | `apps/mobile/app/(auth)/{onboarding,solicitar-acceso}.tsx` |

Nota: `User.email` de un cliente siempre es un placeholder (`cliente+{id}@…`). El login
resuelve por la **ficha del cliente**, no por `User.email`, para evitar choques con
correos del personal.

## Correo: Gmail API (service account)

El correo se envía con la **Gmail API** usando una **cuenta de servicio de Google con
delegación a nivel de dominio** que impersona un buzón de Workspace (`GMAIL_SENDER`,
scope `gmail.send`). No se guarda contraseña de buzón. Implementación:
`apps/admin/src/lib/email/index.ts`.

Variables (`apps/admin/.env`): `GMAIL_CLIENT_EMAIL`, `GMAIL_PRIVATE_KEY`,
`GMAIL_SENDER`, `EMAIL_FROM`, `APP_BASE_URL`. Si faltan, el correo se imprime en la
consola del servidor (bypass de desarrollo). Pasos de configuración: ver `.env.example`.

- `GMAIL_PRIVATE_KEY`: pega el `private_key` del JSON con los `\n` literales, entre comillas.
- `EMAIL_FROM` debe coincidir con `GMAIL_SENDER` (o ser un alias "enviar como" de ese buzón).
- Delegación a nivel de dominio: Admin console → Seguridad → Controles de API →
  Delegación de todo el dominio → agregar el Client ID con scope `…/auth/gmail.send`.

## WhatsApp

El enlace por WhatsApp usa el template `INVITACION_CUENTA`. Ver
[notificaciones-whatsapp.md](./notificaciones-whatsapp.md) para cómo se siembra y se
aprueba en Meta. Sin template aprobado, el envío por WhatsApp cae al bypass de consola.
