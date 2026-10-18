# Contraseñas: invitaciones y restablecimientos

Nadie elige la contraseña de otro. Todas las cuentas —clientes y personal— nacen
sin contraseña y la establece su dueño abriendo un **enlace de un solo uso**. Es
el mismo mecanismo, la misma tabla (`SetPasswordToken`) y la misma página
pública para los dos; lo que cambia es a quién apunta el token y cuánto vive.

Los **clientes** inician sesión en la app móvil con **correo + contraseña**. El
teléfono también servía y se quitó (oct-2026): quien se registra en la app prueba
su correo con un código, pero nadie prueba que un teléfono es suyo: cualquiera
puede registrarse con el número de otra persona. Vuelve con el código por WhatsApp. (El flujo anterior por OTP de
WhatsApp fue retirado.) Todos los
demás —oficina y jardineros— entran con **usuario o correo + contraseña**, en el
portal (NextAuth) o por `/api/mobile/auth/login`.

## Un solo campo: usuario o correo

`User.email` **admite nulo** y existe `User.usuario` al lado. Con uno de los dos
se entra, y la pantalla de login tiene un único campo para los dos casos:
`buscarCuentaPorIdentificador()` (`acceso.service.ts`) mira si hay arroba y
busca por la columna que corresponde.

Esto es porque **un jardinero no tiene correo**. La mayoría no usa uno, y
exigirlo para crearle la cuenta obligaba a inventar direcciones que después nadie
lee y que ensucian cualquier intento de mandar algo de verdad. El usuario es un
nombre corto —minúsculas, sin espacios ni arroba, de 3 a 30 caracteres— porque
se lo dicta un administrador por teléfono o WhatsApp: todo lo que no se pueda
deletrear sin dudar sobra. Se guarda y se busca normalizado, así que `JPerez` y
`jperez` son la misma cuenta.

En Postgres un índice único admite **muchos nulos**, así que todas las cuentas
sin correo conviven sin necesidad de un valor centinela. El campo del formulario
de login es `type="text"`, no `type="email"`: el navegador rechazaría un usuario
sin arroba antes de que el formulario llegue a enviarse. El body de
`/api/mobile/auth/login` sigue llamándose `email` por compatibilidad con la app
publicada, y por eso su Zod ya **no** valida como dirección.

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
   **Con la app instalada, ese mismo enlace abre en la app** (ver
   [El enlace abre en la app](#el-enlace-abre-en-la-app)).
4. **Login** — `POST /api/mobile/auth/login` `{ email, password }`, **la misma
   ruta para todos**. El campo se llama `email` por historia y acepta cualquier
   cosa: el usuario dictado del jardinero o un correo.
   `autenticarEnLaApp` (`services/login-app.service.ts`) prueba primero la cuenta
   del equipo (`User`, por usuario o correo) y después la ficha del cliente
   (solo por correo; con varias fichas con ese correo, la que valida la
   contraseña), y devuelve el rol junto
   con el `clienteId` o el `personalId` que acota la sesión.

   Había una ruta aparte —`/api/mobile/auth/cliente/login`— y con ella dos
   pantallas: lo primero que la app le preguntaba a alguien recién instalada era
   de qué lado del negocio está, que es una pregunta nuestra y no suya. El
   jardinero no sabe que existe una pantalla de clientes, y el cliente que
   aterrizaba en la del equipo escribía su teléfono y recibía "Credenciales
   inválidas" sin enterarse de que estaba en el lugar equivocado. **Quién es lo
   sabe el servidor**, que es el único que puede saberlo antes de preguntar.

   El único identificador que puede estar de los dos lados es un correo; ahí gana
   el que valide la contraseña. El mismo flujo de invitación sirve como
   **restablecimiento de contraseña**.

## Modo invitado

**Quien abre la app sin cuenta puede mirar el catálogo y pedir una visita** (*Seguir como invitado*, al pie del login →
`apps/app-clientes/app/(invitado)/`). Es lo que hace que la app le sirva a alguien
que todavía no es cliente, y lo que Apple pidió para publicarla: la rechazó
por la regla 3.2 mientras solo se podía entrar con una cuenta creada por el
vivero. `useAuthGate` deja pasar `(invitado)` sin sesión.

- El catálogo sale de `/api/mobile/publico/catalogo` (y `/[id]`), **sin
  sesión**: es la misma vidriera que ve un cliente (`catalogo.service.ts`), y
  no muestra nada que no esté ya a la vista. Las pantallas son las del cliente
  (`components/catalogo/`), con `publico`.
- La solicitud va a `POST /api/mobile/publico/solicitudes`
  (`crearSolicitudDeInvitado`): como no hay cuenta, trae **nombre y teléfono**
  —el correo es opcional— y queda en `SolicitudCliente` **sin `clienteId`**,
  con los tres `contacto*`. No crea un cliente: un pedido no es un cliente, y
  una ficha por cada curioso llenaría la lista. Límite: 10 por hora por IP
  (`enforceSolicitudInvitadoLimit`), porque cada una le suena a un
  administrador en el teléfono. Las listas la marcan *Sin cuenta*.

## Registro desde la app

*Crear cuenta*, al pie del login junto a *Seguir como invitado*
(`apps/app-clientes/app/(auth)/registro.tsx`), **con el correo**; el teléfono es
opcional. Se activó así (12-oct-2026) para que la app tenga registro propio
mientras falta el número de WhatsApp dedicado: la versión con el **teléfono** y un
código por **WhatsApp** (una plantilla *AUTHENTICATION* de Meta, que
`meta-provider.ts` ya sabe crear; la cuenta de prueba de Meta no deja crearla y la
del vivero necesita un número propio conectado) queda para después, y ahí el
teléfono sí podrá vincular la cuenta a la ficha.

Como el teléfono no vincula, **quien ya estaba cargado por el vivero con su
teléfono y se registra con su correo queda en dos fichas**. Para eso está la
**fusión de clientes** (abajo).

Son dos pasos (`registro-cliente.service.ts`):

1. `POST /api/mobile/auth/registro` `{ nombre, apellido?, email, telefono?,
   password }` → guarda todo en **`RegistroPendiente`** (una fila por correo,
   la contraseña ya en bcrypt, el código solo como `sha256`) y manda un
   **código de seis dígitos** por correo, que vence a los 15 minutos. Pedirlo
   otra vez reescribe la fila. Límite: 5 por correo y 20 por IP por hora
   (`enforceRegistroLimit`). La ficha **no** nace todavía: quien escribe un
   correo ajeno o se arrepiente no deja un cliente en la lista.
2. `POST /api/mobile/auth/registro/confirmar` `{ email, codigo }` → con el
   código correcto crea la cuenta y responde **lo mismo que el login**, con
   la sesión abierta. Cinco códigos equivocados descartan el pendiente.

**El código es lo que permite vincular.** Si el correo ya está en la ficha de
un cliente, la cuenta se cuelga de **esa ficha** y entra viendo sus visitas
(lo que escribió de nombre y teléfono no pisa lo que cargó el vivero); si esa
ficha ya tenía cuenta, el código vale como restablecer la contraseña. Si hay
dos fichas con el mismo correo se rechaza —elegir una a ciegas podría mostrar
las visitas de otra persona— y si el acceso está revocado, también. **El
teléfono no vincula**: no hay cómo probar que es de quien lo escribe.

Por eso puede haber **dos fichas con el mismo teléfono** mientras nadie las
fusiona, y es la razón de que el teléfono ya no sirva para entrar
(`clientesPorIdentificador` solo busca por correo): con el teléfono repetido,
entrar dependía de cuál de las dos tuviera esa contraseña. Con varias fichas con
el **mismo correo**, `validateClienteCredentials` entra con aquella cuya
contraseña valida, y *¿Primera vez o olvidaste tu contraseña?* manda el enlace a
cada una (es el mismo buzón). Vincular, en cambio, exige una sola
(`resolveClienteByIdentifier`).

**La pantalla valida mientras se escribe**, y el servidor lo vuelve a exigir.
El correo: la forma con `correoDeRegistro` (`@vivero/shared`, la misma regla que
`registroSchema`) y, medio segundo sin tipear, si ya tiene cuenta con `POST
/api/mobile/auth/registro/correo` → `correoParaRegistro` (sin sesión, limitado a
60 por IP cada 10 minutos porque dice si un correo tiene cuenta). Ya tiene
cuenta si es de cualquier `User` —del equipo o de un cliente que ya se
registró: ese entra o recupera su contraseña, no se registra otra vez— o de
una ficha con cuenta; el de una ficha **sin** cuenta está libre, porque el
código la une a ella. La contraseña, con `contrasenaDeRegistro` (8 a 72; bcrypt
ignora lo que pase de 72 bytes). Nombre y apellido son **los dos obligatorios**
(`nombreDeRegistro`, `apellidoDeRegistro`): dos letras como mínimo y solo
letras —con tildes y ñ—, espacios, guion y apóstrofo, así que pasan *Li*,
*María José*, *Pérez-Ruiz* y *D'Angelo* y no *J* ni *Jorge2*. Cada error va **debajo de su campo**, en rojo
—al pie, con el teclado abierto, no se veía—; el del código, debajo de las
casillas (un 400: no coincide, venció, demasiados intentos), y lo que no es de
ningún campo (el correo que no sale, demasiados pedidos, sin conexión, acceso
bloqueado) en una alerta.

El código y no un enlace porque quien se registra está mirando la app: ir al
correo, tocar un enlace y volver es perderlo a mitad de camino. El enlace de
un solo uso sigue siendo el camino para quien el vivero invita y para
*¿Olvidaste tu contraseña?*.

### Eliminar la cuenta

Apple exige que una app donde uno se registra permita **eliminar la cuenta
desde la app**. El cliente lo hace en *Cuenta → Eliminar mi cuenta*
(`DELETE /api/mobile/auth/cuenta`, `eliminarCuentaDeCliente`). Lo que se
elimina es **la forma de entrar**: el `User`, y con él sus sesiones y sus
avisos. La ficha se va también **si no tiene historia** —ni visitas, ni
órdenes, ni planes, ni informes, ni datos de facturación: alguien que se
registró y nunca llegó a ser cliente—; si la tiene, queda sin cuenta, porque
las facturas se guardan por ley y las visitas las firmó quien las hizo. La
política de privacidad lo dice así (`/privacidad#eliminar-tu-cuenta`). Las
cuentas del equipo no se eliminan desde la app: las abre y las cierra el
vivero.

### Lo que hace un cliente nuevo

- **Catálogo** (pestaña propia del cliente con sesión): `GET /api/mobile/catalogo` y
  `/api/mobile/catalogo/[id]` (`catalogo.service.ts`), la vidriera aparte de
  la herramienta de la oficina: solo productos `ACTIVO` y vivos, el precio
  **con IVA**, sin costo ni stock. Solo **bienes**: los servicios no están en
  el catálogo, se marcan en la solicitud. Un bien con precio cero dice
  *Gratis* (`textoDePrecio`).
- **Solicitudes** (`SolicitudCliente`, `solicitud.service.ts`): *Solicitar
  una visita* desde Mis visitas, con los servicios que necesita (al menos uno,
  `SolicitudServicio`).
  Les llega a ADMIN y STAFF como notificación en el momento
  (`pushSolicitudDeCliente`) y queda en *Solicitudes* —ítem propio del menú
  del portal— y en *Más → Solicitudes* de la app hasta que alguien la marca
  atendida. Desde ella, *Crear visita* abre el asistente con su cliente y su
  propiedad puestos; la visita queda enlazada (`Visita.solicitudId`) y la
  solicitud, atendida. El cliente ve las de visita en su pestaña *Visitas* y las cotizaciones en *Pedidos*, y cada una abre su ficha.

### Fusionar clientes duplicados

*Fusionar con otro cliente*, en el ⋯ de la ficha del cliente en el portal (solo
ADMIN; `cliente-fusion.service.ts`, `POST /api/clientes/[id]/fusion`). La ficha
abierta **se conserva** y la elegida se absorbe: pasan sus propiedades, visitas,
planes, órdenes, informes y borradores, solicitudes, obras y datos de facturación,
y la ficha que queda toma de la otra los datos de contacto que no tenía (correo,
teléfono, cédula…). Primero muestra qué se mueve (`confirmar: false`) y después lo
hace, en una transacción, porque **no se deshace**.

- **Datos de facturación con el mismo RUC o cédula** en las dos: el índice único
  `[clienteId, identificacion]` no deja tenerlos dos veces, así que las órdenes y
  facturas que citaban el del duplicado pasan a citar el de la ficha que queda, y el
  repetido se borra. Los demás se mueven sin robarle el predeterminado.
- **La cuenta de la app:** si solo el duplicado tiene (el caso típico: el que se
  registró con el correo), pasa a la ficha que queda y entra con la misma
  contraseña; si las dos tienen, queda la de la ficha que se conserva y la otra se
  elimina.
- El duplicado queda **archivado** (`deletedAt`) con `Cliente.fusionadoEnId`
  apuntando a la que quedó: un enlace viejo a su ficha redirige ahí. Se deja una
  línea en las notas.

## Usuarios del portal (la oficina)

Invitar a alguien **no crea una contraseña temporal**. El usuario se crea con
`password: null` —los dos caminos de login rechazan a un usuario sin
contraseña, así que la cuenta existe pero no entra— y se emite un enlace que el
admin copia o comparte, **como el del personal**. **Nada sale por correo solo**:
el diálogo del enlace tiene *Enviar por correo a …*, que manda **ese mismo**
enlace (`POST /api/users/[id]/enlace-acceso/enviar` `{ enlace, tipo }` →
`enviarEnlacePorCorreo`, que comprueba que el token sea de esa cuenta y siga
vivo, para que la ruta no mande cualquier enlace a cualquier casilla). Emitir
otro para mandarlo anularía el que ya se copió. Antes el correo salía siempre,
y eso obligaba a tener una casilla de verdad para dar de alta a alguien que
igual recibía el enlace por WhatsApp.

- **Invitar**: `POST /api/users/invite` `{ name, apellido?, email, role }`
  → crea el usuario, emite el enlace y lo devuelve
  `{ id, enlace, expiraEl, correoEnviado: false, correoIntentado: false }`.
- `PUT /api/users/[id]` **no acepta `password`**. Lo aceptaba, y la ficha tenía
  un campo para tipearle una contraseña al otro: una puerta de servicio abierta
  contra la regla que el resto del portal sostiene. Restablecer es emitir un
  enlace, ahí también.
- **Restablecer**: `POST /api/users/[id]/enlace-acceso` (`enviarCorreo` por
  defecto `false`) → lo mismo para una
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

A alguien bloqueado **sí** se le puede emitir un enlace, y **usarlo es lo que
le devuelve el acceso**: `establecerContrasena()` limpia `accesoRevocadoEl` al
guardar la contraseña nueva. El desbloqueo no ocurre al *generar* el enlace,
porque entre generarlo y que la persona lo abra pasan horas y en el medio la
cuenta volvería a servir con la contraseña vieja —sin que haya hecho nada—,
que es justo lo que revocar quería evitar.

Eso es seguro porque revocar anula los enlaces que hubiera, así que el único
que puede llegar a usarse es uno emitido *después* de la revocación: una
decisión deliberada de un admin.

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

## Personal de campo: la cuenta nace en su ficha

Un jardinero no se invita desde *Usuarios* —no tiene correo al que mandarle
nada—: **su cuenta nace con su ficha**, en la misma transacción. Era un botón
aparte en la ficha, y un botón aparte es un paso que alguien se saltea: quedaba
gente cargada que no podía entrar a la app, y nadie se enteraba hasta que había
que cargar un parte. Crearla siempre no abre nada —una cuenta sin contraseña no
entra a ningún lado— y al que no deba entrar se le revoca.

El `usuario` se **genera**, no se escribe: inicial del nombre más el primer
apellido, sin tildes ni eñes (`Fernando Herrera` → `fherrera`). Si ya está
tomado se numera (`fherrera2`): dos Fernando Herrera en la misma cuadrilla no es
raro, y el único de la base rechazaría al segundo justo al guardar su ficha,
donde nadie está pensando en usuarios.

En `/dashboard/personal/[id]` el usuario es la **primera fila de Información
General**, arriba del nombre: es lo que hay que dictarle para que entre, y lo
que alguien viene a buscar cuando llama preguntando. Se edita ahí, con el resto
de la ficha —tenía tarjeta propia y guardado propio, o sea dos guardados para
corregir un tipeo—. *Restablecer contraseña* y *Revocar acceso* están en el menú
**Acciones** del encabezado, junto a *Editar*: las tres se usan una vez por
persona, y una tarjeta o un botón para cada una gastaba una columna entera.

El enlace **no** se emite al crear la cuenta: quemaría su semana de vigencia el
día que se carga la ficha, que suele ser antes de que la persona empiece.

`personal-acceso.service.ts`:

- `usuarioSugerido(nombre, apellido)` — el usuario que le toca. `usuarioLibre()`
  le agrega el número si hace falta.
- `crearCuentaPersonal(tx, personal)` — recibe el `tx` porque va dentro de la
  transacción de la ficha: un `User` de rol `PERSONAL` suelto no se ve desde
  ningún lado del portal —*Usuarios* lista solo la oficina— y quedaría ocupando
  el usuario. No emite enlace.
- `cambiarUsuarioPersonal(personalId, usuario)` — existe porque el generador a
  veces se equivoca —un apodo cargado como nombre, o un `fherrera2`— y borrar la
  cuenta para arreglarlo se llevaría el historial de quién cargó cada parte. No
  toca la contraseña ni los enlaces vivos. Lo llaman dos caminos: `PATCH
  /api/personal/[id]/usuario` y el `PUT` de la ficha, que lo aplica **solo si
  cambió** —guardar la ficha sin tocarlo no tiene por qué pasar por acá— y solo
  si quien edita es `ADMIN`.
- `setAccesoPersonal(personalId, revocado)` — el mismo `revocarAcceso()` /
  `restaurarAcceso()` de la oficina, con la ficha de por medio para que la
  pantalla no tenga que saber el id del usuario.
- `estadoDeAcceso()` — `SIN_CUENTA | PENDIENTE | ACTIVO | REVOCADO`. Son cuatro
  y no dos porque los dos del medio se arreglan distinto: a quien nunca abrió su
  enlace hay que mandárselo otra vez, y a quien fue revocado hay que devolverle
  el acceso. Es la columna *Acceso* de la lista de personal; en móvil solo se
  muestran `PENDIENTE` y `REVOCADO`, porque "sin cuenta" es lo normal para la
  mayoría y llenaría la lista de etiquetas que no dicen nada.

Para **restablecer** y para **revocar** se reusan los endpoints de usuario
(`/api/users/[id]/enlace-acceso` con `enviarCorreo: false`, y
`/api/users/[id]/acceso`): es la misma mecánica, y duplicarla era garantizar que
las dos copias se separaran.

**Archivar a alguien le corta el acceso.** `DELETE /api/personal/[id]` llama a
`revocarAcceso()`: su ficha sale de las listas y la app no le muestra nada, pero
la cuenta seguía entrando —y con ella el chat de las visitas—. La cuenta no se
borra: su nombre firma los partes que cargó, y devolverle el acceso es un clic
si vuelve.

## El enlace abre en la app

El enlace es uno solo —`https://admin.viverofrancisco.com/establecer-contrasena?token=…`—
y **quien tiene la app instalada lo abre en la app; quien no, en el
navegador**, sin que el enlace cambie ni haya que elegir. Son los *Universal
Links* de iOS y los *App Links* de Android: la app declara qué ruta del
dominio reclama y el dominio publica que esa app es suya, y con las dos
mitades el sistema entrega el enlace a la app sin preguntar.

- **La mitad del portal** son dos archivos bajo `/.well-known/`, servidos por
  rutas (`src/app/.well-known/*/route.ts`) y no desde `public/`, porque el de
  Apple no lleva extensión y saldría como binario: `apple-app-site-association`
  (el `teamId.bundleId` y la ruta) y `assetlinks.json` (el paquete y los
  **SHA-256 de los certificados de firma**). La identidad está en
  `src/lib/enlaces-a-la-app.ts`. Ahí están las dos huellas: la del keystore de EAS (los apk de prueba) y la
  de **Play App Signing** (lo que se instala desde Play, que Play refirma con
  su clave; en la consola está en *Protegido con Play › Firma de apps*). Solo se reclama
  `/establecer-contrasena`: reclamar el dominio entero mandaría a la app a un
  administrador que toque cualquier enlace del portal desde el teléfono.
- **La mitad de la app** es `ios.associatedDomains` e `android.intentFilters`
  (con `autoVerify`) en `app.json` —cambiarlos pide un build nativo nuevo, y
  en iOS EAS enciende la capacidad *Associated Domains* en el App ID solo— y
  la pantalla `apps/app-*/app/establecer-contrasena.tsx`, a la que expo-router
  enruta la URL por el camino. Es la página del portal en la app: las mismas
  rutas públicas, los mismos estados (válido, caducado, usado, reemplazado),
  y al terminar *Iniciar sesión*, que cierra la sesión que hubiera —un
  administrador puede abrir el enlace de un jardinero desde su propio
  teléfono— y lleva al login. Vive fuera de `(auth)` y de los grupos por rol,
  y `useAuthGate` la deja pasar, porque vale con o sin sesión.
- **La página del portal ayuda cuando el navegador se queda con el enlace**
  (el navegador interno de un correo o de un chat a veces no lo cede): en un
  teléfono ofrece *Continuar en la app*, por el esquema propio
  (`viverofrancisco://establecer-contrasena?token=…`), y al terminar *Abrir
  la app*. En una computadora ninguno de los dos aparece.

También ahí se decidió que **el jardinero entra por la app**: `destino` era
"portal" para todo `User`, y a alguien sin correo la página le decía "entra al
portal con tu correo". Ahora es "app" para `PERSONAL` y para los clientes, y
"portal" solo para ADMIN y STAFF (`destinoDeUsuario` en `acceso.service.ts`).

## Piezas clave

| Pieza | Ruta |
|---|---|
| Ciclo del token (emitir, leer, consumir) — clientes y usuarios | `apps/admin/src/lib/services/acceso.service.ts` |
| Servicio de cliente (resolver por correo, invitar, login) | `apps/admin/src/lib/services/cliente-invite.service.ts` |
| Invitar / restablecer usuarios del portal | `apps/admin/src/app/api/users/{invite,[id]/enlace-acceso}/route.ts` |
| Cuenta del personal de campo (generar usuario, renombrar, revocar) | `apps/admin/src/lib/services/personal-acceso.service.ts` + `apps/admin/src/app/api/personal/[id]/{usuario,acceso}/route.ts` |
| Alta de la ficha, que crea la cuenta | `apps/admin/src/app/api/personal/route.ts` |
| Tarjeta *Acceso a la app* en la ficha | `apps/admin/src/components/personal/acceso-personal.tsx` |
| Rutas mobile | `apps/admin/src/app/api/mobile/auth/cliente/{login,request-invite}/route.ts` |
| Rutas públicas set-password | `apps/admin/src/app/api/auth/set-password/route.ts` |
| Invitación desde admin | `apps/admin/src/app/api/clientes/[id]/invitar/route.ts` |
| Página pública | `apps/admin/src/app/establecer-contrasena/` |
| El enlace abre en la app: identidad y los dos `.well-known` | `apps/admin/src/lib/enlaces-a-la-app.ts` + `apps/admin/src/app/.well-known/{apple-app-site-association,assetlinks.json}/route.ts` |
| La misma pantalla en la app | `apps/app-*/app/establecer-contrasena.tsx` (+ `associatedDomains` / `intentFilters` en `app.json`) |
| Modelo del token | `SetPasswordToken` en `prisma/schema.prisma` — apunta a **un** `clienteId` **o** a **un** `userId`, nunca a los dos (`CHECK`) |
| Pantallas móviles | `apps/app-clientes/app/(auth)/{login,registro,solicitar-acceso}.tsx` |
| Registro, código y eliminar la cuenta | `apps/admin/src/lib/services/registro-cliente.service.ts` + `apps/admin/src/app/api/mobile/auth/{registro,registro/confirmar,cuenta}/route.ts` |

## El cliente cambia su correo

Desde *Cuenta → Cambiar correo* (solo el cliente; el del equipo lo cambia un
administrador en el portal), **probando que el nuevo es suyo**:
`POST /api/mobile/auth/correo` revisa que esté libre (`ensureCorreoLibre`),
guarda el pendiente en `CambioDeCorreoPendiente` (uno por cuenta, código en
sha256, 15 minutos, cinco intentos) y manda el código **al correo nuevo**;
`POST /api/mobile/auth/correo/confirmar` lo compara, vuelve a revisar que siga
libre, cambia la ficha y la cuenta en una transacción y le avisa al correo
**anterior** (`sendAvisoDeCorreoCambiadoEmail`): si no lo cambió su dueño, es la
única forma de que se entere. Sin código, cualquiera con el teléfono
desbloqueado pondría su correo y se quedaría con la cuenta, porque es con lo
que se entra y adonde llegan los enlaces de contraseña. Servicio:
`cambio-de-correo.service.ts`.

## Un correo, una persona (por lado)

**Un correo es de una sola persona dentro de su lado** (oct-2026): el
**equipo** (ADMIN, STAFF, PERSONAL) por un lado y los **clientes** por otro,
como en Shopify, donde el staff y los *customers* son mundos aparte. Dentro de
los clientes no lo comparten dos fichas, ni una ficha y la cuenta de otro
cliente; dentro del equipo, no lo comparten dos cuentas. **Entre lados sí**:
quien trabaja en el vivero puede comprarle plantas con su mismo correo. Fue un
correo único en todo el sistema hasta el 17-oct-2026, y eso hacía que el
correo de alguien del staff no sirviera para comprar como invitado.

Todas las cuentas siguen en `User`, porque todo el acceso —sesiones de la app,
refresh tokens, push, enlaces de contraseña, revocación— cuelga de esa tabla y
duplicarlo para los clientes sería mantener dos copias; **la cuenta de un
cliente lleva el correo de su ficha**. La base lo garantiza con índices únicos
parciales escritos a mano, porque Prisma no los expresa (un `prisma migrate
dev` futuro va a querer borrarlos: hay que sacar esos `DROP INDEX` del SQL que
genere, como con el de las tareas):

- `User_email_equipo_key` y `User_email_cliente_key`, sobre `lower(email)` de
  las cuentas de cada lado (migración `20261017150000_correo_unico_por_lado`,
  que quitó el `@unique` de `User.email`; por eso se busca con `findFirst` y el
  rol, nunca `findUnique({ email })`);
- `Cliente_email_vivo_key`, sobre `lower(email)` de las fichas **vivas** (la
  fusionada queda archivada con el suyo; migración `20261014120000_correo_unico`).

Antes de escribir lo pregunta `ensureCorreoLibre(email, lado)`
(`services/correo-unico.ts`) y responde *"Ese correo ya está registrado."*
—**sin decir de quién**—. Del lado `"cliente"` lo llaman crear y editar una
ficha (`createCliente`, `updateCliente`, que también llevan el correo a la
cuenta de la ficha y no dejan borrarlo si tiene cuenta), la importación por
CSV, *Cambiar correo*, el cliente nuevo del alta de visita y el registro, que
solo mira cuentas de clientes (`correoParaRegistro`: *"Este correo ya tiene una
cuenta. Inicia sesión con él."*); del lado `"equipo"`, las cuentas del equipo
(`usuario.service`). La fusión alinea el correo de la cuenta con el de la ficha
que queda.

**El login con un correo que está en los dos lados**: `buscarCuentasPorIdentificador`
devuelve las cuentas que responden, la del equipo primero, y el login de la app
(`validateCredentials`) entra a la que coincida la contraseña. Con la misma
contraseña en las dos, entra siempre como equipo: para entrar como cliente
necesita otra. El portal se queda con la del equipo y sigue rechazando a un
`CLIENTE`.

**El checkout de invitado acepta cualquier correo**, como Shopify: si es de
una ficha, el pedido va a esa ficha (ver `crearPedidoDeInvitado`).

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

**Cuando deja de salir el correo.** El registro anota en la consola del portal
la respuesta de Google (`[registro] no se pudo enviar el código`). Dos que ya
pasaron (oct-2026): `401 deleted_client` —alguien borró el cliente OAuth en Google
Cloud: se crea otro (pasos de arriba) y se cambian las tres variables, en el
`.env` **y en Vercel**— y `403 SERVICE_DISABLED` —la Gmail API no está habilitada
en el proyecto del cliente nuevo—. El consentimiento OAuth del proyecto tiene que
ser **Interno** (la organización `viverofrancisco.com`): como *Externo* queda en
modo de prueba y Google vence el refresh token cada 7 días.

## Nota: solo correo (no WhatsApp)

El único envío automático es por correo (Gmail API), y desde que el enlace se
genera para copiarlo es un botón, no un paso obligado. Se evaluó enviarla
también por WhatsApp, pero Meta rechaza la plantilla con un botón URL como
`INCORRECT_CATEGORY` (un enlace de "crear contraseña" no encaja en sus categorías
UTILITY/AUTHENTICATION). Por eso el canal es solo correo. El `APP_BASE_URL` debe
apuntar a la URL pública en producción para que el enlace del correo sea válido
(en local usa `http://localhost:3001`).
