# Textos de las fichas de las tiendas

Esta es la ficha de **Vivero Francisco, la app de clientes** (`com.viverofrancisco.app`),
la que aparece en las tiendas. Desde el 17-oct-2026 el equipo tiene su propia app,
**Vivero Francisco Admin** (`com.viverofrancisco.admin`), no listada: la versión que
mezclaba las dos fue la que se armó porque Apple rechazó una app solo del equipo
(regla 3.2). Cualquiera, sin cuenta, puede ver el catálogo, comprar y pedir una visita.

Para copiar y pegar en App Store Connect y en Google Play Console. Los
límites de caracteres de cada campo van entre paréntesis; todos los textos
de acá entran.

## Capturas

- **App Store**: `capturas/ios-6.3/` (1206×2622, *iPhone with Dynamic Island
  (medium display)*, que es lo que acepta ahora App Store Connect).
- **Google Play**: `capturas/android/` (1080×2160: recortadas por abajo a 2:1,
  sin margen blanco, que Play toma por «gráficos de marketing»).

Sacadas el 19-oct en modo invitado, sin datos de nadie: el login y *Solicitar
visita*. Las de la app unida (con pantallas del equipo) se fueron con la
separación y quedan en el historial de git. **Faltan el catálogo y la ficha de
un producto**, y no se pueden sacar todavía: el catálogo de producción está
vacío (`/api/mobile/publico/catalogo` devuelve `items: []` el 19-oct) y el de
desarrollo no tiene fotos. Se sacan cuando el vivero cargue sus productos con
foto y precio en producción, apuntando la app del simulador a producción
(`EXPO_PUBLIC_API_BASE_URL`), que para el invitado solo lee.

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

> Mira el catálogo de plantas y productos, pide una visita eligiendo los servicios que necesitas y sigue el mantenimiento de tu jardín, con fotos de cada trabajo.

**Palabras clave** (100, separadas por coma, sin espacios):

> jardinería,plantas,vivero,mantenimiento,jardines,paisajismo,cotización,visitas,poda,guayaquil

**Descripción** (4000):

> Vivero Francisco es la app del vivero y empresa de mantenimiento de jardines Vivero Francisco, en Guayaquil.
>
> PARA TI Y TU JARDÍN
> • Crea tu cuenta con tu correo en un minuto, o entra como invitado.
> • Mira el catálogo de plantas y productos, con fotos y precios, y haz tu pedido: lo retiras en el vivero o te lo llevamos. El vivero te contacta para confirmarlo y coordinar el pago.
> • Pide una visita, sin crear una cuenta: cuéntanos qué necesitas, elige los servicios (poda, riego, diseño, control de plagas…) y un asesor te contacta.
> • Si ya eres cliente, sigue tus visitas de mantenimiento: cuándo vamos, qué hicimos y las fotos del trabajo.
> • Califica cada visita.

**Novedades de esta versión** (4000):

> Primera versión de la app de Vivero Francisco: mira el catálogo y pide una visita con los servicios que necesitas.

**Información para la revisión (App Review)**

- Usuario: *(el de la cuenta de prueba)*
- Contraseña: *(la que elegiste)*
- Notas:

> Vivero Francisco es la app de un vivero y empresa de mantenimiento de jardines en Guayaquil, Ecuador. Cualquier persona puede crear una cuenta desde la pantalla de inicio (“Crear cuenta”): recibe un código en su correo y entra como cliente, con el catálogo de plantas y productos con sus precios, sus solicitudes de visita (con los servicios que elige) y sus visitas. También puede entrar sin cuenta con “Seguir como invitado”, ver el catálogo y pedir una visita dejando su nombre y teléfono. La cuenta se elimina desde Cuenta → Eliminar mi cuenta.
>
> La cuenta de prueba que les damos es de un cliente, con datos de demostración: visitas con sus fotos e informes, pedidos y solicitudes. La ubicación se usa solo mientras la app está en uso, cuando el cliente marca en el mapa dónde es su jardín o adónde llevar su pedido.

## Google Play (Android)

**Descripción breve** (80):

> Plantas y el mantenimiento de tu jardín. Pide una visita con los servicios.

**Descripción completa** (4000): la misma que la del App Store.

**Acceso a la app** (en *Contenido de la app*): “Parte de la funcionalidad
está restringida” —sin cuenta se ve el catálogo, se compra y se piden visitas;
sus visitas y pedidos piden su cuenta— → las mismas credenciales de prueba (de
un cliente), con la nota de arriba.

**Seguridad de los datos** — se recopila, no se comparte con terceros para
sus propios fines, va cifrado en tránsito y se puede borrar desde la app
(*Cuenta → Eliminar mi cuenta*):

| Tipo de dato | Uso | ¿Obligatorio? |
|---|---|---|
| Nombre, correo, teléfono, ID de usuario | Funcionalidad de la app, administración de la cuenta | Sí |
| Otro contenido generado por el usuario (solicitudes de visita, pedidos, calificaciones, con la dirección) | Funcionalidad | No |
| Ubicación precisa | Funcionalidad (marcar el punto de su jardín o de la entrega) | No |
| Fotos y videos | Funcionalidad | No |
| ID del dispositivo u otros | Funcionalidad, prevención de fraude | Sí |

Ni publicidad, ni analítica, ni seguimiento.

## Privacidad en App Store Connect (*App Privacy*)

Datos recopilados, **vinculados a la identidad**, **sin rastreo**, uso
*Funcionalidad de la app*:

- Información de contacto: nombre, correo, teléfono.
- Ubicación: precisa.
- Contenido del usuario: fotos o videos, otro contenido (solicitudes, pedidos, calificaciones).
- Identificadores: ID de usuario, ID del dispositivo.
