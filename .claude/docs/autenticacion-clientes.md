# Contraseñas: invitaciones y restablecimientos

Nadie elige la contraseña de otro. Todas las cuentas —clientes y personal— nacen
sin contraseña y la establece su dueño abriendo un **enlace de un solo uso**. Es
el mismo mecanismo, la misma tabla (`SetPasswordToken`) y la misma página
pública para los dos; lo que cambia es a quién apunta el token y cuánto vive.

Los **clientes** inician sesión en la app móvil con **teléfono o correo +
contraseña**. (El flujo anterior por OTP de WhatsApp fue retirado.) El
**personal** usa correo + contraseña, en el portal (NextAuth) o por
`/api/mobile/auth/login` (ver `CLAUDE.md`).

## Flujo

1. **Solicitar acceso** — el cliente (en la app, pantalla `solicitar-acceso`) o un
   admin (botón "Enviar invitación" en la ficha del cliente) dispara la invitación.
   - Mobile: `POST /api/mobile/auth/cliente/request-invite` `{ identifier }` →
     responde **siempre 200 genérico** (no revela si el cliente existe).
   - Web/admin: `POST /api/clientes/[id]/invitar` (requiere sesión, no read-only).
2. **Envío del enlace** — `createAndSendInvite()` genera un token (`randomBytes(32)`,
   se guarda solo el `sha256` en `SetPasswordToken`, caduca a 24 h, un solo uso e
   invalida los anteriores) y manda `…/establecer-contrasena?token=…` por **correo
   (Gmail API)** al correo de la ficha. **Solo correo** — no se usa WhatsApp para
   esto. Si el cliente no tiene correo, no se envía nada (el admin debe agregarle uno).
   Solo el dueño del correo recibe el enlace → eso es la prueba de propiedad.
3. **Establecer contraseña** — el enlace abre la página pública
   `/establecer-contrasena` (fuera de `/dashboard`, sin NextAuth). Valida el token
   (`GET /api/auth/set-password?token=…`) y guarda la contraseña
   (`POST /api/auth/set-password`). Crea/enlaza un `User` (rol `CLIENTE`, bcrypt 12).
4. **Login** — `POST /api/mobile/auth/cliente/login` `{ identifier, password }`.
   `identifier` es teléfono **o** correo (resuelto contra la ficha del cliente; debe
   haber exactamente una coincidencia). El mismo flujo de invitación sirve como
   **restablecimiento de contraseña**.

## Usuarios del portal (staff y admins de sector)

Invitar a alguien **no crea una contraseña temporal**. El usuario se crea con
`password: null` —los dos caminos de login rechazan a un usuario sin
contraseña, así que la cuenta existe pero no entra— y se emite un enlace que el
admin puede copiar y mandar por donde quiera. El correo se envía además
automáticamente; el enlace se muestra en pantalla igual, porque el correo puede
demorar, caer en spam o ir a una casilla que nadie mira.

- **Invitar**: `POST /api/users/invite` `{ name, apellido?, email, role, sectorIds? }`
  → crea el usuario, emite el enlace, manda el correo y devuelve
  `{ enlace, expiraEl, correoEnviado }`.
- **Restablecer**: `POST /api/users/[id]/enlace-acceso` → lo mismo para una
  cuenta que ya existe. Sirve igual para quien perdió su contraseña y para quien
  nunca abrió su invitación.
- Ambos son **solo para ADMIN**, y ambos **anulan el enlace anterior** que
  siguiera sin usar.

### Revocar el acceso

**Revocar no borra la cuenta.** El nombre de esa persona firma las visitas y
los informes que hizo; borrarla dejaría huecos en el historial. Lo que se corta
es todo lo que sirve para entrar (`revocarAcceso()`):

- se marca `User.accesoRevocadoEl` — una fecha, no un booleano, para que
  "¿desde cuándo?" ya esté respondido;
- se anulan sus enlaces de contraseña pendientes, para que uno viejo no reabra
  la puerta;
- se anulan sus refresh tokens, para que la app móvil deje de renovar sola.

La contraseña **no** se toca: si vuelve, *Quitar el bloqueo* alcanza.

Se comprueba en tres lugares, y hacen falta los tres: `authorize()` de NextAuth
y `validateCredentials()` impiden iniciar sesión, y **`getCurrentUser()` relee
la fila en cada request** porque la sesión es un JWT que vive semanas — sin eso,
revocar no sacaría a nadie hasta que su token venciera solo.

*Volver a invitar* a alguien bloqueado le devuelve el acceso en el mismo paso:
mandarle un enlace a alguien que sigue bloqueado sería darle una contraseña que
no sirve para entrar.

Un admin **no puede revocarse a sí mismo**: dejarse afuera no tiene arreglo
desde adentro.

**Las vigencias son distintas a propósito** (`VIGENCIA_MS` en
`acceso.service.ts`):

| Enlace | Dura | Por qué |
|---|---|---|
| Invitación de usuario | 7 días | La cuenta todavía no entra a ningún lado; la respuesta normal a "te invitamos" es "lo hago el lunes". |
| Restablecer contraseña | 1 hora | La cuenta ya funciona: el enlace es una llave que la abre. |
| Invitación / restablecimiento de cliente | 24 h | Lo pide la propia persona desde la app, pero puede tener que abrir el correo en otro dispositivo. |

El token **no se puede volver a ver**: en la base solo queda su `sha256`. Si se
pierde, se genera otro (y eso anula el perdido, que es justo lo que se quiere
cuando se mandó a la persona equivocada).

## Piezas clave

| Pieza | Ruta |
|---|---|
| Ciclo del token (emitir, leer, consumir) — clientes y usuarios | `apps/admin/src/lib/services/acceso.service.ts` |
| Servicio de cliente (resolver por teléfono/correo, invitar, login) | `apps/admin/src/lib/services/cliente-invite.service.ts` |
| Invitar / restablecer usuarios del portal | `apps/admin/src/app/api/users/{invite,[id]/enlace-acceso}/route.ts` |
| Rutas mobile | `apps/admin/src/app/api/mobile/auth/cliente/{login,request-invite}/route.ts` |
| Rutas públicas set-password | `apps/admin/src/app/api/auth/set-password/route.ts` |
| Invitación desde admin | `apps/admin/src/app/api/clientes/[id]/invitar/route.ts` |
| Página pública | `apps/admin/src/app/establecer-contrasena/` |
| Modelo del token | `SetPasswordToken` en `prisma/schema.prisma` — apunta a **un** `clienteId` **o** a **un** `userId`, nunca a los dos (`CHECK`) |
| Pantallas móviles | `apps/mobile/app/(auth)/{onboarding,solicitar-acceso}.tsx` |

Nota: `User.email` de un cliente siempre es un placeholder (`cliente+{id}@…`). El login
resuelve por la **ficha del cliente**, no por `User.email`, para evitar choques con
correos del personal.

## Correo: Gmail API (OAuth2 con refresh token)

El correo se envía con la **Gmail API** usando **OAuth2 con un refresh token**.
Se usa OAuth2 (y no una cuenta de servicio) porque la organización bloquea la
creación de claves de cuentas de servicio (`iam.managed.disableServiceAccountKeyCreation`).
El correo se envía **como la cuenta que autorizó el refresh token** (`users/me`).
Implementación: `apps/admin/src/lib/email/index.ts`.

Variables (`apps/admin/.env`): `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
`GMAIL_REFRESH_TOKEN`, `EMAIL_FROM`, `APP_BASE_URL`. Si faltan, el correo se imprime
en la consola del servidor (bypass de desarrollo).

- `EMAIL_FROM` debe ser la **cuenta que autorizó** el refresh token (o un alias
  "enviar como" de ella); Gmail rechaza un From arbitrario.
- El refresh token de cuentas internas de Workspace normalmente **no expira**.

### Obtener el refresh token (una vez)

1. Google Cloud → proyecto → habilitar **Gmail API**.
2. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**,
   tipo **"Aplicación web"**. Agrega como *URI de redirección autorizado*
   `https://developers.google.com/oauthplayground`. Guarda el `client_id` y `client_secret`.
3. Abre el **[OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)** →
   engranaje (⚙) → marca *"Use your own OAuth credentials"* y pega tu `client_id` / `client_secret`.
4. En *"Input your own scopes"* pon `https://www.googleapis.com/auth/gmail.send` →
   **Authorize APIs** → inicia sesión **con el buzón remitente** (el de `EMAIL_FROM`) y acepta.
5. **Exchange authorization code for tokens** → copia el **refresh token** a `GMAIL_REFRESH_TOKEN`.
6. Reinicia el dev server.

## Nota: solo correo (no WhatsApp)

La invitación se envía **únicamente por correo** (Gmail API). Se evaluó enviarla
también por WhatsApp, pero Meta rechaza la plantilla con un botón URL como
`INCORRECT_CATEGORY` (un enlace de "crear contraseña" no encaja en sus categorías
UTILITY/AUTHENTICATION). Por eso el canal es solo correo. El `APP_BASE_URL` debe
apuntar a la URL pública en producción para que el enlace del correo sea válido
(en local usa `http://localhost:3001`).
