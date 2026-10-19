# Textos de las fichas de las tiendas

Esta es la ficha de **Vivero Francisco Admin, la app del equipo**
(`com.viverofrancisco.admin`): administradores, staff y jardineros. En el App
Store es **no listada** (se pide aparte, ver abajo); en Google Play va con
ficha normal, al lado de la de clientes. La de clientes es
[`apps/app-clientes/tienda/textos.md`](../../app-clientes/tienda/textos.md).

Para copiar y pegar en App Store Connect y en Google Play Console. Los
límites de caracteres van entre paréntesis.

## Comunes

- **Nombre de la app** (30): Vivero Francisco Admin
- **Política de privacidad**: https://admin.viverofrancisco.com/privacidad
- **Sitio / URL de soporte**: https://admin.viverofrancisco.com
- **Correo de contacto**: info@viverofrancisco.com
- **Categoría**: Negocios (App Store: *Business*; Play: *Empresa*)
- **Precio**: gratis, sin compras dentro de la app ni anuncios.

## App Store (iOS)

**Subtítulo** (30):

> Visitas, pedidos y el equipo

**Texto promocional** (170):

> La app del equipo de Vivero Francisco: las visitas del día, la marca de entrada y salida, las fotos del trabajo, los chats del equipo, los clientes y los pedidos.

**Palabras clave** (100):

> vivero,jardinería,mantenimiento,visitas,equipo,jardineros,pedidos,clientes,informes,guayaquil

**Descripción** (4000):

> Vivero Francisco Admin es la app interna del equipo de Vivero Francisco, vivero y empresa de mantenimiento de jardines en Guayaquil. Solo pueden entrar las personas del equipo, con la cuenta que les crea un administrador.
>
> PARA EL PERSONAL DE CAMPO
> • Las visitas del día y las próximas, con la dirección, el mapa y cómo llegar.
> • Marcar la entrada y la salida en cada visita, y las tareas que hiciste.
> • Subir las fotos y videos del trabajo, por tarea.
> • Avisar una novedad cuando la visita no se pudo hacer.
> • Funciona sin señal: lo que marcas se envía cuando vuelve la conexión.
>
> PARA LA ADMINISTRACIÓN
> • Programar visitas y cerrarlas, con lo que registró cada persona.
> • Clientes con sus propiedades, suscripciones, pedidos y facturación electrónica.
> • Solicitudes de los clientes, informes en PDF, productos e inventario.
> • Chats del equipo, con fotos, documentos y visitas compartidas.

**Novedades de esta versión** (4000):

> Primera versión de la app del equipo de Vivero Francisco.

**Información para la revisión (App Review)**

- Usuario: *(el de la cuenta Staff de prueba)*
- Contraseña: *(la que elegiste)*
- Notas:

> Vivero Francisco Admin is the internal app for the staff and field crew of Vivero Francisco, a plant nursery and garden maintenance company in Guayaquil, Ecuador. It is not meant for the public: accounts are created by an administrator, there is no self sign-up, and customers use our separate public app, "Vivero Francisco". We are requesting unlisted distribution for it.
>
> The demo account above is a Staff account with sample data: scheduled visits, customers, orders, requests and team chats. Location is used only while the app is in use, when a gardener clocks in or out of a visit or marks a property on the map. Photos are the pictures of the work done at each visit.
>
> Accounts are created and deleted by the company's administrators, not by the user, so the in-app account deletion requirement does not apply.

## Solicitud de distribución no listada (Apple)

Se pide en https://developer.apple.com/contact/request/unlisted-app/ **después
de** que la app quede aprobada (o lista para enviar). Respuestas:

- **App name**: Vivero Francisco Admin
- **Apple ID**: *(el número de App Information en App Store Connect)*
- **App URL**: *(el de la ficha en App Store Connect)*
- **Description / who will use it**:

> Internal app for the employees of Viverofrancisco S.A.S. (about 15 people: administrators, office staff and gardeners) to manage garden maintenance visits, clock-ins, photos of the work, team chats, customers and orders. It is useless to the general public, since accounts are created only by our administrators, and our customers already have our public app "Vivero Francisco". We will share the link directly with our employees.

## Google Play (Android)

**Descripción breve** (80):

> La app del equipo de Vivero Francisco: visitas, fotos, chats y pedidos.

**Descripción completa** (4000): la misma que la del App Store.

**Acceso a la app** (en *Contenido de la app*): “Toda la funcionalidad está
restringida” → las credenciales de la cuenta Staff de prueba, con la nota de
arriba (en español o inglés).

**Seguridad de los datos** — se recopila, no se comparte con terceros, va
cifrado en tránsito; las cuentas las crea y elimina un administrador:

| Tipo de dato | Uso | ¿Obligatorio? |
|---|---|---|
| Nombre, correo, teléfono, ID de usuario | Funcionalidad de la app, administración de la cuenta | Sí |
| Ubicación precisa | Funcionalidad (marcar entrada y salida, el punto de una propiedad) | No |
| Fotos y videos | Funcionalidad (fotos del trabajo, chats) | No |
| Mensajes en la app | Funcionalidad (chats del equipo) | No |
| ID del dispositivo u otros | Funcionalidad, prevención de fraude | Sí |

Ni publicidad, ni analítica, ni seguimiento.

## Privacidad en App Store Connect (*App Privacy*)

Datos recopilados, **vinculados a la identidad**, **sin rastreo**, uso
*Funcionalidad de la app*:

- Información de contacto: nombre, correo, teléfono.
- Ubicación: precisa.
- Contenido del usuario: fotos o videos, mensajes en la app, otro contenido (partes de visita, novedades).
- Identificadores: ID de usuario, ID del dispositivo.

## Capturas

- **App Store**: `capturas/ios-6.5/` (1284×2778, el espacio de 6.5").
- **Google Play**: `capturas/android/` (1080×2160; el iPhone es más alto que
  2:1, que es el máximo de Play, así que van con un margen blanco a los lados).

Sacadas del simulador (iPhone 17 Pro, barra de estado a las 9:41) con datos de
desarrollo, por deep link (`xcrun simctl openurl … viverofrancisco-admin://chats/<id>`):
la ficha de una visita, el chat de una cuadrilla, Clientes, Pedidos, Informes y
Productos.
