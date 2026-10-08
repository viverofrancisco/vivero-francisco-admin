# Textos de las fichas de las tiendas

Desde el 5-oct-2026 la app es **para clientes y para el equipo**: cualquiera,
sin cuenta, puede ver el catálogo y pedir una visita o una cotización. Apple rechazó la versión que era solo del equipo (regla 3.2).

Para copiar y pegar en App Store Connect y en Google Play Console. Los
límites de caracteres de cada campo van entre paréntesis; todos los textos
de acá entran.

## Capturas

- **App Store**: `capturas/ios-6.5/` (1284×2778, el espacio de 6.5" que pide
  App Store Connect; las de `capturas/ios/` son de 6.9", 1320×2868, por si
  lo pide después).
- **Google Play**: `capturas/android/` (1080×2160).

Las cinco de iPhone sirven, pero conviene **agregar dos del lado del
cliente** (el catálogo y la ficha de un producto) y ponerlas primero: es lo que le
muestra a Apple y a quien busca la app que le sirve a cualquiera.

## Comunes

- **Nombre de la app** (30): Vivero Francisco
- **Política de privacidad**: https://admin.viverofrancisco.com/privacidad
- **Sitio / URL de soporte**: https://admin.viverofrancisco.com
- **Correo de contacto**: info@viverofrancisco.com
- **Categoría**: Negocios (App Store: *Business*; Play: *Empresa*)
- **Precio**: gratis, sin compras dentro de la app ni anuncios.

## App Store (iOS)

**Subtítulo** (30):

> Jardines, plantas y visitas

**Texto promocional** (170):

> Mira el catálogo de plantas y servicios, pide una visita o una cotización y sigue el mantenimiento de tu jardín, con fotos de cada trabajo.

**Palabras clave** (100, separadas por coma, sin espacios):

> jardinería,plantas,vivero,mantenimiento,jardines,paisajismo,cotización,visitas,poda,guayaquil

**Descripción** (4000):

> Vivero Francisco es la app del vivero y empresa de mantenimiento de jardines Vivero Francisco, en Guayaquil.
>
> PARA TI Y TU JARDÍN
> • Mira el catálogo de plantas, productos y servicios, con fotos y precios.
> • Pide una visita o una cotización, sin crear una cuenta, y te contactamos.
> • Si ya eres cliente, sigue tus visitas de mantenimiento: cuándo vamos, qué hicimos y las fotos del trabajo.
> • Califica cada visita.
>
> PARA EL PERSONAL DE CAMPO
> • Las visitas del día y de la semana, con la dirección, el mapa y cómo llegar.
> • Marcar la entrada y la salida de cada visita, incluso sin señal: se envía cuando vuelve la conexión.
> • Registrar las tareas realizadas y subir las fotos del trabajo, etiquetadas por tarea.
> • Reportar una novedad cuando no se pudo hacer la visita.
> • Chats con el equipo, con fotos, videos y documentos.
>
> PARA LA ADMINISTRACIÓN
> • Clientes, propiedades con su ubicación y medidas, y suscripciones.
> • Las solicitudes de visita y de cotización de los clientes, al momento.
> • Agendar visitas y asignar al personal.
> • Armar informes en PDF con las fotos de cada tarea, listos para enviar al cliente.
> • Órdenes, facturación electrónica y cobros.
> • Personal, grupos, usuarios y accesos.

**Novedades de esta versión** (4000):

> Primera versión de la app de Vivero Francisco: mira el catálogo y pide una visita o una cotización.

**Información para la revisión (App Review)**

- Usuario: *(el de la cuenta de prueba)*
- Contraseña: *(la que elegiste)*
- Notas:

> Vivero Francisco es la app de un vivero y empresa de mantenimiento de jardines en Guayaquil, Ecuador. Cualquier persona, sin cuenta, puede tocar “Seguir como invitado” en la pantalla de inicio: ve el catálogo de plantas, productos y servicios con sus precios y puede pedir una visita o una cotización dejando su nombre y teléfono (le llega al vivero al momento). Los clientes del vivero, con la cuenta que el vivero les abre, ven además sus visitas con las fotos del trabajo, y pueden eliminar su cuenta desde Cuenta → Eliminar mi cuenta.
>
> La misma app la usa el equipo del vivero (administradores, staff y jardineros). La cuenta de prueba que les damos tiene rol Staff y muestra esa parte, con datos de demostración: clientes, visitas, informes, órdenes y chats. La ubicación se usa solo mientras la app está en uso, cuando un jardinero marca su entrada o su salida de una visita.

## Google Play (Android)

**Descripción breve** (80):

> Plantas, servicios y el mantenimiento de tu jardín. Pide visitas y cotizaciones.

**Descripción completa** (4000): la misma que la del App Store.

**Acceso a la app** (en *Contenido de la app*): ahora “Parte de la
funcionalidad está restringida” —sin cuenta se ve el catálogo y se piden
visitas, pero la parte del equipo pide su cuenta— → las mismas credenciales de prueba, con la nota de
arriba.

**Seguridad de los datos** — se recopila, no se comparte con terceros para
sus propios fines, va cifrado en tránsito y se puede borrar (el cliente,
desde la app; el equipo, pidiéndolo):

| Tipo de dato | Uso | ¿Obligatorio? |
|---|---|---|
| Nombre, correo, teléfono, ID de usuario | Funcionalidad de la app, administración de la cuenta | Sí |
| Otro contenido generado por el usuario (solicitudes de visita y cotización, con dirección) | Funcionalidad | No |
| Ubicación precisa | Funcionalidad (marcar entrada y salida) | Sí, para el personal |
| Fotos y videos | Funcionalidad | No |
| Archivos y documentos | Funcionalidad (chat, firma electrónica) | No |
| Mensajes en la app | Funcionalidad (chat del equipo) | No |
| ID del dispositivo u otros | Funcionalidad, prevención de fraude | Sí |

Ni publicidad, ni analítica, ni seguimiento.

## Privacidad en App Store Connect (*App Privacy*)

Datos recopilados, **vinculados a la identidad**, **sin rastreo**, uso
*Funcionalidad de la app*:

- Información de contacto: nombre, correo, teléfono.
- Ubicación: precisa.
- Contenido del usuario: fotos o videos, otro contenido (mensajes, informes).
- Identificadores: ID de usuario, ID del dispositivo.
