# Facturación electrónica con el SRI

El portal **emite sus propias facturas**: arma el XML, lo firma con el
certificado del contribuyente y habla directo con los web services del SRI. No
hay ningún intermediario — antes esto lo hacía Contífico, y se sacó entero.

- Código: [`src/lib/sri/`](../../apps/admin/src/lib/sri/) y
  [`src/lib/services/factura.service.ts`](../../apps/admin/src/lib/services/factura.service.ts)
- Librería: [`facturacion-electronica-ec`](https://www.npmjs.com/package/facturacion-electronica-ec)
  (MIT) — arma el XML, lo firma en XAdES-BES y habla SOAP con el SRI.

## El esquema *offline*, en dos párrafos

Ecuador usa el llamado **esquema offline**, que es lo contrario de lo que suena:
el emisor genera y **firma** el comprobante por su cuenta, y recién después se
lo manda al SRI. No hay un paso previo donde el SRI entregue un número.

Lo que hace de identificador es la **clave de acceso**: 49 dígitos que se
calculan acá antes de mandar nada (fecha, tipo de comprobante, RUC, ambiente,
serie, secuencial, código numérico, tipo de emisión y un dígito verificador
módulo 11). **Esa clave *es* el número de autorización**: cuando el SRI
autoriza, devuelve la misma cadena. Por eso `Factura.claveAcceso` y
`Factura.autorizacion` guardan lo mismo — se guardan las dos porque son dos
campos distintos de la respuesta, y confundirlos costaría caro.

## Los dos web services

| | Pruebas | Producción |
|---|---|---|
| Host | `celcer.sri.gob.ec` | `cel.sri.gob.ec` |
| Recepción | `RecepcionComprobantesOffline` | idem |
| Autorización | `AutorizacionComprobantesOffline` | idem |

Emitir son **dos llamadas**: recepción (¿la estructura está bien?) y
autorización (¿el comprobante vale?). La recepción contesta `RECIBIDA` o
`DEVUELTA` con el motivo; la autorización, `AUTORIZADO` o `NO AUTORIZADO`.

**El SRI tiene 24 horas por norma para autorizar**, aunque en la práctica
contesta en segundos. Cuando no contesta enseguida la factura queda en
`ENVIADO` y hay dos formas de resolverla: el botón *Consultar al SRI* de la
ficha de la orden, y el cron diario `/api/cron/facturas`
(`sincronizarPendientesSri()`), que barre todo lo que todavía puede cambiar.

> **El ambiente de pruebas autoriza de verdad.** Un comprobante emitido en
> `PRUEBAS` sale `AUTORIZADO` y se ve idéntico a uno real en el portal, pero
> **no vale como comprobante** y no le sirve al cliente. Por eso el emisor
> guarda su `ambiente`, el armador lo avisa en ámbar antes de emitir, y el RIDE
> lleva el sello *PRUEBAS* cruzado.

## Emisores: quién factura

Un **`Emisor`** es un RUC con todo lo que hace falta para emitir a su nombre:
razón social, nombre comercial, dirección de matriz y de establecimiento,
establecimiento (`001`), punto de emisión (`001`), ambiente, si lleva
contabilidad, y su certificado de firma.

**Se pueden tener varios y se elige al emitir.** Es un requisito del vivero: dos
RUCs, y cuál se usa se decide en el momento de la factura, no en una
configuración global. Uno puede estar marcado como `predeterminado`, que es el
que viene elegido.

Se administran en `/dashboard/configuracion/emisores`
([`emisor.service.ts`](../../apps/admin/src/lib/services/emisor.service.ts)).

### El certificado (.p12)

Un `.p12` firma documentos tributarios a nombre del contribuyente: es lo más
sensible que guarda el sistema.

- Se sube desde la ficha del emisor, con su contraseña. **La contraseña se
  valida en el momento** (`leerCertificado()`, con `node-forge`) y de paso se
  extrae el sujeto y la fecha de vencimiento para poder mostrarlos.
- Se guarda **cifrado con AES-256-GCM** en `Emisor.certificado` (`Bytes`), con
  la clave en `FIRMA_ENCRYPTION_KEY` — 32 bytes en base64 o hex. La contraseña
  del `.p12` va cifrada aparte, igual.
- **Cambiar `FIRMA_ENCRYPTION_KEY` deja ilegibles los certificados ya
  guardados**: habría que volver a subirlos. Generar una:
  `openssl rand -base64 32`.
- El único lugar que descifra es `certificadoParaFirmar()`, y nunca sale de ahí
  hacia una respuesta HTTP.

Un detalle que costó encontrar: `cifrar()` devuelve `Uint8Array<ArrayBuffer>` y
no un `Buffer` de Node. El campo `Bytes` de Prisma 7 rechaza el `Buffer`, que
es un `Uint8Array<ArrayBufferLike>` y no encaja en el tipo generado.

### Dirección de matriz y de establecimiento

Son dos cosas distintas y solo una es obligatoria:

- **`direccionMatriz`** es el domicilio del contribuyente en el RUC. El XSD la
  exige (`obligatorio`).
- **`direccionEstablecimiento`** es la del local desde el que se emite. El XSD
  la tiene como `minOccurs="0"`, así que es **opcional**; sin ella se emite con
  la de la matriz. (La librería la pedía obligatoria en su tipo y copiamos esa
  restricción por error: es más estricta que el SRI.)

## La numeración

Cada serie —emisor + establecimiento + punto de emisión + tipo de comprobante—
tiene su contador en **`SecuencialSri`**, y se pide con
`siguienteSecuencial()`:

```sql
INSERT INTO "SecuencialSri" (...) VALUES (..., 1)
ON CONFLICT ("emisorId", "establecimiento", "puntoEmision", "tipoDocumento")
DO UPDATE SET "valor" = "SecuencialSri"."valor" + 1
RETURNING "valor"
```

Una sola sentencia, así dos emisiones simultáneas se serializan en la fila y
cada una se lleva un número distinto. Un `SELECT` y después un `UPDATE` no daría
esa garantía.

**Un contador propio y no el máximo de `Factura`.** Derivarlo del máximo local
significaría que borrar una factura retrocede la serie, y el SRI no acepta dos
veces el mismo número: el hueco es preferible al choque. Por eso `reset-datos.ts`
ya no imprime ningún "piso" que haya que configurar a mano.

**Un rechazo en recepción devuelve el número** (`devolverSecuencial()`): un
comprobante `DEVUELTO` nunca existió para el SRI, así que su número queda libre.
Solo baja si nadie tomó uno después — si ya avanzó, restarlo entregaría dos
veces el mismo.

La factura y la nota de crédito tienen **series separadas** — la librería pasa
el tipo como `"FACTURA"` / `"NOTA_CREDITO"` y así queda guardado en la fila—,
así que `001-001-000000001` existe una vez de cada. De ahí que `Factura.numero`
sea único **por tipo** y no a secas.

## El RIDE

El RIDE es la representación impresa del comprobante, y **lo genera el portal**
(`src/lib/sri/ride.tsx`, con `@react-pdf/renderer`) desde lo que quedó guardado.
Está disponible apenas el SRI autoriza, en `/api/facturas/[id]/ride`.

No es el mismo PDF que descarga el contribuyente del portal del SRI, y no tiene
por qué serlo: el SRI **no publica ningún RIDE por servicio**. Lo que define la
norma es qué información tiene que salir, no cómo se ve. El nuestro lleva el
logo de la empresa, el desglose por tarifa y el código de barras Code128 de la
clave de acceso (`bwip-js/node`).

Dos cosas aprendidas peleando con el layout:

- **La tarjeta de la derecha mide 280pt** porque la clave de acceso son 49
  dígitos a 8.5pt en Helvetica (0.556 em por dígito ≈ 232pt) y tiene que entrar
  sin achicar la tipografía. Achicarla a 6.5pt "para que entre" fue lo primero
  que se probó y se veía mal. `react-pdf` **no rompe una cadena sin espacios**
  aunque se le metan `U+200B`: se midió contando páginas, no se supuso.
- El total de la línea es su **subtotal sin IVA** (`FacturaLinea.subtotal`).
  Poner el total con IVA hacía que la suma de las líneas no cerrara con el
  subtotal del pie — se descubrió comparando contra el RIDE del propio SRI.

## Lo que se guarda de cada emisión

| Campo | Qué es |
|---|---|
| `claveAcceso` | Los 49 dígitos. Único en la tabla |
| `autorizacion` | Lo que devolvió el SRI como número de autorización (la misma clave) |
| `ambienteSri` | `PRUEBAS` o `PRODUCCION`. Lo de pruebas no vale |
| `estadoSri` | `AUTORIZADO`, `ENVIADO`, `DEVUELTO`… tal cual lo reportó |
| `fechaAutorizacion` | Cuándo lo autorizó |
| `xmlKey` | Dónde quedó el XML firmado, en R2 |
| `mensajesSri` | Lo que dijo al rechazar. Es lo único que dice qué arreglar |

**Se guarda aunque el SRI no autorice.** La clave de acceso y el número ya se
consumieron: perderlos dejaría un hueco en la serie sin forma de averiguar
después qué pasó. Lo que **no** pasa en ese caso es confirmar la orden — sin
autorización no hay comprobante que entregar, y la orden se queda en `BORRADOR`,
que es donde se arregla la causa.

El XML firmado se sube a R2 y se conserva: es el comprobante. Si la subida falla
la emisión no se cae —la factura ya está autorizada, que es lo que importa— y
`xmlKey` queda en `null`.

## Validar el XML antes de mandarlo

`validateXsd: true` valida contra los XSD oficiales que trae la librería, pero
**necesita `xmllint-wasm` instalado o no hace nada** (falla en silencio). Está
en las dependencias por eso. Se comprobó rompiendo un XML a propósito y viendo
que efectivamente lo rechazara.

## Mandarle la factura al cliente

`/api/facturas/[id]/enviar` manda el RIDE y el XML por correo (Gmail API, la
misma que los enlaces de contraseña) y anota `enviadoEl` / `enviadoA`. Sin eso
no hay forma de saber si le llegó, y el reflejo es mandarla de nuevo "por si
acaso".

## Cobros

Los cobros son del portal: **`Cobro`**, con su forma de pago, referencia, fecha
y quién lo anotó ([`cobro.service.ts`](../../apps/admin/src/lib/services/cobro.service.ts)).

No viajan a ningún lado — al SRI la forma de pago se le declara **al emitir**,
en `<pagos>`, y eso ya está firmado. Lo de acá es la cuenta corriente del
vivero.

- El **saldo se recalcula sumando los cobros**, nunca restándole al guardado:
  restar parece más simple hasta que un cobro se borra, se corrige o se
  registran dos a la vez.
- Un cobro **se borra, no se corrige**: o entró esa plata o no. Cambiarle el
  monto sería inventar un estado entre "pasó" y "no pasó".
- No se puede cobrar más que el saldo.

## Notas de crédito

Es la única forma que tiene el portal de corregir una factura ya autorizada.
`emitirNotaCredito()` copia sus líneas, la referencia con `codDocModificado`
(`01`), `numDocModificado` y la fecha de emisión de la factura, la firma y la
manda como comprobante tipo `04`.

Si el SRI la autoriza, la factura queda `anulada` y la orden vuelve a
`BORRADOR`. Si la rechaza, la factura sigue viva: no hay estado intermedio.

Las notas viven en la **misma tabla** que las facturas —son otro comprobante que
se firma, se manda y se consulta igual— y por eso hay una regla explícita de
cuál es "la factura de la orden": `FACTURA_VIGENTE` en
[`factura-vigente.ts`](../../apps/admin/src/lib/services/factura-vigente.ts),
que excluye las anuladas **y** las notas de crédito. Sin eso, la nota recién
emitida pasaba a ser la factura de su propia orden.

## De la orden a la factura

Todas las órdenes nacen en `crearOrden()` —es el único escritor— y siempre como
`BORRADOR`, el único estado editable. Lo que cambia es quién la arma:

| Desde | Cómo | Cuándo conviene |
|---|---|---|
| `/dashboard/ordenes/nueva` | Se elige el cliente, se marcan sus visitas por facturar y se ajusta precio/IVA por línea | Es el camino normal. Sirve igual para algo que no pasó por una visita |
| Completar una visita | `borradorDeVisita()` abre el borrador con el trabajo suelto a **$0** | Automático: la visita no lleva plata, así que el borrador existe para que alguien la ponga |
| `/api/cron/renovaciones` | `generarRenovaciones()` por los períodos vencidos y `generarBorradoresDeVisitas()` como red de seguridad | Diario, sin que nadie apriete nada |
| `generarOrden()` | Barrido: junta todo lo pendiente de un rango de fechas | Facturación de fin de mes de varios clientes |

En `/dashboard/ordenes/nueva`, apenas se elige el cliente aparecen sus **visitas
con trabajo sin facturar**, con una casilla cada una (buscables por número,
fecha o producto), y aparte los **períodos de suscripción** todavía sin orden.
Marcar una visita **carga su trabajo entero** —una visita se factura completa— y
el mismo producto de dos visitas queda en **una sola línea**, con la cantidad
sumada. La procedencia viaja en `OrdenLineaOrigen` (o `suscripcionItemId` +
`periodoInicio`), que es lo que impide facturar dos veces lo mismo: lo garantizan
los índices únicos, no la UI.

El precio de la línea es un **snapshot** y se edita sin tocar el catálogo. El
**nombre no**: la orden registra lo que se hizo, y decidir qué sale impreso es
otra cosa, que se hace al emitir — ahí sí se renombra y se junta.

### La factura no tiene la forma de la orden

Se emite desde **`/dashboard/ordenes/[id]/facturar`**, una pantalla propia con
las líneas de la orden ya cargadas una a una. Ese es el caso común y sigue
siendo un clic. Lo que la pantalla hace posible es lo otro: **cobrar varios
trabajos de un período como una sola línea** de "SERVICIO DE MANTENIMIENTO
AGOSTO 2026", que es como se factura el mantenimiento acá y como el vivero ya lo
hacía a mano.

La descripción de cada línea es **texto libre y va tal cual al XML**: el
`<descripcion>` del detalle es nuestro. El producto de la línea sigue estando,
pero para otra cosa — de ahí sale el `<codigoPrincipal>` y con eso queda
asociada la venta.

Por eso `Factura` guarda **sus propias líneas** (`FacturaLinea`). Mientras la
factura era una copia de la orden se podía reconstruir desde ella; desde que
pueden diferir, esa reconstrucción sería una mentira sobre un documento que ya
se entregó.

Lo que ata las dos caras es que **cuadren, base imponible por tasa**
(`ensureFacturaCuadra()`). Comparar solo el total no alcanza: juntar una línea
al 0% con una al 15% cierra el total y miente el IVA. Comparar por tasa
garantiza las dos cosas de una, y es lo que deja a la orden siendo el libro de
ventas aunque el papel tenga otra forma.

`emitirFactura(viewer, ordenId, opciones)` recibe las líneas en `opciones`. Sin
ellas emite las de la orden una a una, que es como sigue funcionando
`cobrarOrden()` para una factura ya emitida.

### Toda línea sale del catálogo

La línea **necesita un producto del catálogo del portal**. `OrdenLinea.productoId` y `FacturaLinea.productoId` son
**NOT NULL** y la FK es `RESTRICT`, así que un producto ya vendido tampoco se
puede borrar en duro — perder ese vínculo dejaría la línea fuera de todo reporte
por producto y la factura sin con qué reconciliarse. (El portal borra en suave,
así que en el uso normal no cambia nada.)

### Una orden puede cubrir varias visitas

Y el mismo producto de dos visitas es **una sola línea**. Eran dos límites del
esquema, no del negocio: `Orden.visitaId` era una columna y
`OrdenLinea.visitaProductoId` era único, así que una orden era "de una visita" y
un producto hecho dos veces salía como dos líneas.

Ahora son dos tablas puente —`OrdenVisita` y `OrdenLineaOrigen`— y cobrarle a
alguien el mes entero en una orden es un caso normal. Lo que **no** cambió es la
garantía: `OrdenLineaOrigen.visitaProductoId` sigue siendo único en toda la
tabla, así que un trabajo se factura una sola vez y lo impide la base, no una
validación.

### Lo que se factura junto se factura entero

`ensureTrabajoCompleto()` rechaza una orden que se lleve **parte** de una visita
o **parte** de un período: si toca una visita, entran todos los productos que a
esa visita le falten cobrar; si toca un período de un plan, entran todos los
ítems de ese plan para ese período.

Los índices únicos no alcanzaban. Garantizan que nada se cobre **dos veces**
—`OrdenLineaOrigen.visitaProductoId` es único y `[suscripcionItemId, periodoInicio]` también—
pero no que se cobre **junto**: dos productos de la misma visita podían terminar
en dos órdenes distintas y nadie se quejaba. Media visita facturada es una
conversación a medias con el cliente y una segunda factura por el resto que
nadie esperaba.

Agregar productos sueltos del catálogo sigue permitido: **la regla es sobre lo
que falta, no sobre lo que sobra.**

Al editar una orden, sus propias líneas no cuentan como "facturadas en otra": si
no, ninguna orden con procedencia se podría volver a guardar.

Del lado de la interfaz no hay que acordarse: agregar un pendiente del panel
**arrastra a sus hermanos** —la visita completa, el período completo— y lo
avisa. La validación del servidor está para que no entre por otra puerta.

Verificado el 25/08/2026: media visita y medio período rechazados; la visita
completa entra sin problema.

### Una orden no mezcla plan con visitas

`ensureNoMezclaOrigenes()` rechaza una orden que tenga a la vez líneas con
`suscripcionItemId` y líneas con procedencia de visita. Son dos conversaciones
distintas con el cliente: el plan es lo pactado y se renueva solo; la visita
suelta es algo que pasó y se cotiza. Juntarlas daba una orden cuyo total no se
podía explicar sin abrirla, y una factura que mezclaba la mensualidad con
trabajos puntuales.

**Lo agregado a mano entra en cualquiera de las dos** —es el extra sobre lo que
ya está— y una orden de puro trabajo a mano también vale.

Por eso `generarOrden()` devuelve **varias** órdenes: una por suscripción (sus
períodos agrupados por la cabecera del plan, no todos juntos) y otra con las
visitas sueltas. En *Nueva orden*, agregado un período de plan la lista de
visitas queda deshabilitada con el motivo escrito, y al revés un pendiente que
no combina se rechaza diciendo en qué orden va: la regla se explica donde se
está por romper, en vez de dejar apretar y fallar al guardar.

### Lo que cubre un plan entra por procedencia, o a mano como extra

Un producto que **este cliente** tiene en una suscripción activa llega a una
orden de tres formas:

- `suscripcionItemId` + período → la renovación del plan;
- una fila de `OrdenLineaOrigen` → trabajo de visita que **no** quedó cubierto;
- a mano desde el catálogo → un extra, sin procedencia.

**La tercera estuvo prohibida y ya no.** El argumento era que una línea a mano
no choca contra ningún índice único y el mismo trabajo podría cobrarse dos
veces. Pero esa protección **ninguna línea a mano la tiene**: dos órdenes con
"Poda" escrita a mano tampoco chocan contra nada. La regla no evitaba una clase
de error, evitaba un caso de un error que igual es posible en todos los demás —
y a cambio hacía imposible algo legítimo, como cobrarle un saco de más a alguien
que tiene ese producto en su plan.

Lo que sí protege la base sigue protegido: un período no se cobra dos veces
(`[suscripcionItemId, periodoInicio]`) y un trabajo de visita tampoco
(`OrdenLineaOrigen.visitaProductoId`).

El selector lo ofrece con la aclaración *"El cliente ya lo tiene en un plan.
Agregalo solo si es un extra"*. Nada queda en gris.

### El plan se elige por visita, no por producto

Al agendar hay un campo **Suscripción** con los planes activos del cliente y la
opción *Ninguna · se cobra aparte*. Lo que se elija queda en
`Visita.suscripcionId`, y de ahí `coberturaDelPlan()` deduce, producto por
producto, cuáles caen dentro del plan: los que ese plan tiene como ítem quedan
cubiertos, el resto es trabajo suelto que se cobra. Editando la visita se puede
cambiar el plan o sacarlo, y la cobertura se recalcula sola.

Antes la pregunta era **por producto** —*Cubre el plan* / *Se cobra aparte*, sin
default— y estaba mal planteada. Nadie agenda media visita contra un plan: si la
visita es del plan, lo que el plan tiene lo cubre. Preguntarlo por producto
aparecía en toda visita de todo cliente con plan, y la respuesta correcta era
siempre la misma; a cambio, la relación visita↔suscripción no existía en ningún
lado y no había manera de ver las visitas de un plan.

A qué ítem corresponde cada producto lo sigue resolviendo el servidor: el
cliente manda un `suscripcionId`, nunca un `suscripcionItemId`, y se verifica que
ese plan sea del cliente de la visita. No hay ambigüedad posible dentro del plan
—`crearSuscripcion` impide que un producto esté en dos suscripciones activas del
mismo cliente.

Un detalle que sí importa: **cambiar el plan no toca los productos que ya están
en una orden**. Marcarlos como cubiertos los dejaría cobrados y cubiertos a la
vez. Se recalcula solo lo que todavía no se facturó.

Desde la ficha de una suscripción, **"Nueva visita"** abre el alta con ese plan
ya elegido; es el camino normal para las visitas de un plan.

Desde la ficha de una visita, **"Crear orden"** abre la pantalla de alta con su
trabajo pendiente ya cargado (`?cliente=…&visita=…`). Sirve también con la visita
apenas **agendada**: cobrar por adelantado es normal, y lo único que nunca entra
es una visita cancelada. Los ids no se toman de la URL a ciegas: se preselecciona
solo lo que ya devolvió `listarPendientes`, que filtra por cliente y por viewer.

Y al revés: **Nueva orden** tiene una lista de *Visitas* con las del cliente que
todavía tienen trabajo sin facturar, con **casillas**: se marcan varias, porque
cobrarle a alguien el mes entero en una orden es lo normal. Marcar carga el
trabajo entero de esa visita —la asignación *es* eso: `OrdenVisita` se deduce de
la procedencia de las líneas, así que marcar sin traer trabajo no quedaría
registrado en ningún lado— y esconde los períodos pendientes, que a esa altura
solo mostrarían cosas que van en otra orden. Si en cambio se agregó un período de
suscripción, la lista queda deshabilitada con el motivo: una orden es de visitas
**o** de un plan.

La misma lista aparece al **editar un borrador**, con sus propias visitas ya
marcadas: desmarcar una saca sus productos. Por eso una línea que viene de una
visita **no se puede sacar sola** —dejaría la orden a medias, que el servidor
rechaza—; se saca desmarcando la visita.

Los períodos de plan **no** se asignan a mano. Son por período y los crea la
renovación (`/api/cron/renovaciones`); ofrecerlos en un selector era invitar a
armar a dedo lo que se genera solo.

El tope de fechas es distinto para cada origen (`hastaVisitas`, aparte de
`hasta`): las **visitas no se cortan** —el web pasa `VISITAS_SIN_TOPE`, porque
una visita agendada para octubre es justo la que alguien quiere asignarle a una
orden hoy— y los **períodos de suscripción sí**, hasta fin del mes actual.
Cobrar un período que todavía no arrancó sigue siendo una decisión aparte.

Una orden **sí puede mezclar** un período de suscripción con ventas sueltas: eso
es una sola factura para el cliente. Separarlas en dos facturas es armar dos
órdenes.

### Las suscripciones se renuevan solas, en borrador

`/api/cron/renovaciones` (diario, 12:00 UTC, gated por `CRON_SECRET`) crea una
orden **en BORRADOR** por cada suscripción y período ya vencido, con todos sus
ítems adentro — la periodicidad es del contrato, así que lo que contiene se
cobra junto.

Deja todo en borrador a propósito: el cron arma el trabajo, la decisión de
cobrar sigue siendo de una persona, y hasta confirmar se puede ajustar el precio
o sumar un adicional.

Además de comodidad, resuelve un problema real: el período pendiente lee el
precio **vigente** de la suscripción, así que subir el precio con meses sin
facturar los cobraría todos al precio nuevo. Con la orden ya creada,
`OrdenLinea.precioUnitario` es un snapshot y el cambio rige desde el ciclo
siguiente.

Es **idempotente** — lo que ya tiene línea se saltea, y el índice único atrapa
las carreras — así que correrlo de más no rompe nada. Lo único que omite es una
suscripción **sin productos activos**, y lo reporta en la respuesta.

El mismo cron corre `generarBorradoresDeVisitas()`, la red de seguridad para
visitas completadas que quedaron sin su borrador —lo normal es que nazca al
completar la visita— y que también deja lo suyo en `omitidas` con el motivo.

### Dónde se ven las facturas

**No hay una pantalla de facturas.** La había y se sacó: con una orden por
factura, era la misma lista de órdenes con otro nombre y otra columna. Una
factura se mira desde su orden, que es donde está todo lo demás.

- Detalle de la orden — número, clave de acceso, estado, saldo, a nombre de
  quién salió, sus cobros, y el menú para ver el RIDE, mandársela al cliente,
  consultarle al SRI o emitirle una nota de crédito
- Ficha del cliente — las suyas
- Ficha de la suscripción — las que salieron de sus períodos

La de una suscripción **no es una relación directa**: se llega por las líneas de
orden que citan alguno de sus ítems. Es el precio de tener un solo libro de
ventas, y a cambio una factura mixta —período más venta suelta— aparece en las
dos vistas, que es lo correcto.

### Dónde se ve lo que falta cobrar

`/dashboard/ordenes/por-cobrar` lista las facturas emitidas con saldo, una fila
por factura, con lo que falta de cada una y el total. Antes era *Por facturar* y
listaba lo contrario —órdenes sin factura—; dejó de tener sentido cuando
confirmar pasó a emitir: lo que hoy queda sin factura es un borrador, y un
borrador es trabajo por aprobar, no plata por entrar.

Lo que **no** es deuda pero necesita que alguien mire va como aviso arriba de la
tabla: los **borradores** esperando revisión (`borradoresSinConfirmar`), que
crean el cron de renovaciones y el completar una visita. Van contados y no como
filas, para que la salida del cron no pase desapercibida sin por eso hacer pasar
un borrador por plata a cobrar.

Hubo un segundo aviso, de *órdenes confirmadas sin factura*, para las emisiones
que fallaban. Dejó de existir junto con ese estado: hoy una emisión que falla
deja la orden en `BORRADOR`, así que ya está contada en el primero.

Una factura nace con el total como saldo, así que "cuánto falta" se sabe desde
el primer día. La rama de *sin sincronizar* sigue en `estadoCobro()` como red
para filas viejas: no saber cuánto falta no es lo mismo que saber que no falta
nada, y suponer lo segundo es el error caro.

### El borrador se edita, lo confirmado no

`actualizarOrden()` acepta cambios solo en `BORRADOR`: agregar o quitar líneas,
ajustar precios y cantidades, cambiar de cliente, cambiar **qué visitas** cubre
y las notas. Confirmada la orden es lo que se le va a cobrar al cliente, y
facturada el comprobante ya está firmado y en el SRI — mover los números después
sería mentirle al historial.

Al editar, `lineas` **reemplaza el conjunto entero** y la procedencia viaja
intacta aunque cambie el precio. Sacar una línea libera su procedencia: ese
período o esa visita vuelven a aparecer como pendientes, que es justo lo que se
espera. Y valen las mismas reglas que al crear —una sola función las aplica a las
dos— así que por la puerta de atrás no entra nada.

Lo que no se edita en la orden es el **nombre** de la línea: eso se decide al
emitir. Y una línea con procedencia de visita no se saca sola —se desmarca la
visita— porque una visita se factura completa.

### Tres estados, y cobrar no es uno de ellos

`EstadoOrden` es `BORRADOR | CONFIRMADA | ANULADA`. **No hay `FACTURADA`**:
confirmar y facturar pasaron a ser el mismo momento, así que `CONFIRMADA`
significa exactamente *"tiene factura viva"* —invariante verificada en la
migración— y un cuarto estado solo describía un paso que ya no existe.

**Si está cobrada o no es otro eje.** Sale del `saldo` de la factura, con
`estadoCobro()` en `components/ordenes/formato.ts`: sin cobrar / cobrada en
parte / cobrada / sin sincronizar. El `saldo` **se recalcula sumando los cobros**, nunca restándole al valor
guardado: restar parece más simple hasta que un cobro se borra, se corrige o se
registran dos a la vez. Cruzar los dos ejes en un solo enum hubiera pedido un
estado por combinación.

**Una emisión que falla deja la orden en `BORRADOR`**, el único estado editable
—`actualizarOrden()` solo acepta cambios ahí—, que es donde se arregla la causa:
cargarle los datos al cliente, corregir una línea. Por eso los borradores
tienen página propia (`/dashboard/ordenes/borradores`): son trabajo por revisar,
no plata por entrar. `/dashboard/ordenes` lista las confirmadas y las anuladas,
con la columna de cobro.

### Una orden, una factura

La acción principal de una orden **cambia con lo que le falta**. Sin documento
emitido dice **"Emitir factura"** y lleva al armador; con uno emitido y saldo
pendiente, **"Registrar cobro"**. Ofrecer "Registrar cobro" sobre un borrador
prometía un paso que en realidad empezaba por otro lado: un cobro se registra
**contra** un comprobante, así que la factura tiene que existir antes.

De ahí salen las dos funciones del servicio:

- `facturarOrden()` — emite y nada más. Es la venta a crédito, y también lo que
  usa *Emitir* en el armador.
- `cobrarOrden()` — emite si hace falta y registra el cobro. Sobre una orden que
  ya tiene factura cobra contra esa, así que reintentar después de una falla a
  mitad de camino es seguro. Es lo que hay detrás de *Emitir y cobrar*.

**Si emitir falla, la orden se queda en `BORRADOR`** y el motivo vuelve en
`errorFactura` con HTTP 200 en vez de tirarse. Borrador es el único estado
editable, o sea exactamente donde hay que estar para arreglar la causa:
cargarle los datos al cliente, corregir lo que el SRI rechazó. (Antes confirmar y emitir
eran dos pasos y una emisión fallida dejaba la orden `CONFIRMADA` sin factura;
`confirmarYFacturar()` ya no existe.)

A nombre de quién sale la factura vive en `Orden.datoFacturacionId` y se elige
mientras la orden es borrador, pero **el armador lo vuelve a preguntar** y puede
cambiarlo para esa emisión: `opciones.datoFacturacionId` gana, después el de la
orden, y por último el predeterminado del cliente.

**Sin datos de facturación cargados, *Emitir factura* queda apagado y lo dice**,
en vez de dejar descubrirlo dentro del armador con la orden ya creada. En
*Nueva orden* eso no apaga nada: *Guardar borrador* es justamente donde se
arregla.

Emitir **manda el comprobante al SRI en el momento**: se arma el XML, se firma
con el certificado del emisor y se espera la autorización, que casi siempre
llega en segundos.

### Anular una orden, y corregir una factura

Son dos cosas distintas desde que el portal emite contra el SRI.

**Una orden sin factura se anula.** `anularOrdenCompleta()` corta si hay una
factura viva y dice por qué: un comprobante que el SRI ya autorizó no se borra
desde acá. Anular es el final del camino igual — la orden no se reabre ni se
vuelve a facturar, y para cobrar ese trabajo se arma una orden nueva.

**Una factura autorizada se corrige con una nota de crédito**, que es lo único
que el portal puede hacer solo. `emitirNotaCredito()` copia las líneas de la
factura, la referencia por clave de acceso y número, la firma y la manda. Si el
SRI la autoriza, la factura queda `anulada` y la orden vuelve a `BORRADOR`; si
la rechaza, la factura sigue viva y hay que emitir otra nota.

**Anular el comprobante en el SRI existe pero es un trámite manual de su
portal**, no un web service: hay plazo hasta el día 7 del mes siguiente, el
receptor tiene 5 días hábiles para aceptarlo, y desde 2026 no se puede sobre
facturas a consumidor final. Por eso la orden no puede decidirlo por su cuenta.

**Y acá está la trampa que casi nos comemos.** `OrdenLineaOrigen.visitaProductoId` y
`[suscripcionItemId, periodoInicio]` son únicos **en toda la tabla, sin mirar el
estado de la orden**, y `listarPendientes` da por facturado cualquier trabajo
que tenga línea. Una orden anulada que se llevara sus líneas dejaría esas
visitas y esos períodos reservados por un muerto: invisibles en pendientes e
imposibles de meter en otra orden. Para siempre.

Por eso anular una orden con trabajo enlazado **exige un sí explícito**
(`liberarTrabajo`): sin él responde 409 diciendo cuántas líneas hay, y el
diálogo las lista una por una antes de dejar seguir. Con el sí,
`liberarProcedencia()` pone en null los tres campos y el trabajo vuelve a
pendientes. Se pierde el vínculo, no el historial: `descripcion` y
`precioUnitario` son la verdad de la línea y quedan intactos.

Verificado el 24/08/2026 sobre la orden #90 —dos líneas enlazadas—: sin
`liberarTrabajo` se negó; con él quedó `ANULADA`, su factura `anulada: true`,
las descripciones intactas y los dos trabajos de vuelta en la lista de
pendientes del cliente.


## Flujo de emisión

```
Orden BORRADOR
  ↓  resolver con qué emisor se emite (el elegido, o el predeterminado)
  ↓  resolver con qué datos se factura (los del armador, los de la orden, el predeterminado del cliente)
  ↓  validar cédula/RUC (módulo 10)
  ↓  armar las líneas del documento (las de la orden 1:1, o las del armador)
  ↓  verificar que cuadren con la orden, base imponible por tasa
  ↓  reservar secuencial y fechar el comprobante con hoy (Ecuador)
  ↓  calcular la clave de acceso (49 dígitos, módulo 11)
  ↓  armar el XML y validarlo contra el XSD
  ↓  firmarlo con el .p12 del emisor (XAdES-BES)
  ↓  RecepcionComprobantesOffline  →  RECIBIDA | DEVUELTA
  ↓  AutorizacionComprobantesOffline  →  AUTORIZADO | NO AUTORIZADO
  ↓  guardar el XML firmado en R2
  ↓  crear Factura + FacturaLinea, en una transacción
  ↓  si quedó AUTORIZADO: Orden → CONFIRMADA
```

Si algo falla después de reservar el secuencial, la factura **se guarda igual**
con lo que el SRI haya dicho: el número ya se consumió. Lo que no pasa es
confirmar la orden.

### "Hoy" es en Ecuador, no en UTC

El SRI solo autoriza comprobantes fechados el día de su emisión, y el servidor
corre en UTC. De 19:00 a 24:00 hora de Ecuador (UTC-5) el `new Date()` del
servidor ya es el día siguiente, así que una factura emitida a las 20:00 salía
fechada mañana y el SRI la rechazaba. `hoyEnEcuador()` en `src/lib/fechas.ts` es
la única fuente de la fecha del comprobante.

### El cron que cierra lo que quedó abierto

`/api/cron/facturas` corre `sincronizarPendientesSri()`: le pregunta al SRI por
toda factura que todavía pueda cambiar de estado. **Corre una vez por día, y eso
es un límite del plan, no una preferencia** — el Hobby de Vercel rechaza *en el
deploy* cualquier cron que dispare más seguido, y el deploy entero falla. Querría
ser horario; en Pro puede serlo, o un scheduler externo puede pegarle al endpoint
con el `CRON_SECRET`.

Mientras tanto, el botón *Consultar al SRI* de la ficha de la orden hace lo
mismo para una factura puntual, que es lo que sirve cuando hay alguien esperando
el comprobante.

## Anular en el SRI: se puede, pero no por acá

Existe el trámite de **anulación de comprobantes electrónicos**, en el portal
del SRI (SRI en Línea → Comprobantes electrónicos → Anulación). No es un web
service: es un formulario, con reglas propias.

- Plazo: hasta el **día 7 del mes siguiente** al de la emisión.
- El **receptor tiene 5 días hábiles** para aceptar la solicitud. Si no la
  acepta, no se anula.
- **Desde 2026 no se puede** sobre comprobantes emitidos a consumidor final.

Por eso el portal no lo ofrece: no puede prometer algo que depende de otra
persona y de un formulario. Lo que sí puede hacer solo —y hace— es la **nota de
crédito**.

## Pendiente

- **Pasar el emisor a producción.** Lo que hay probado es contra el ambiente de
  pruebas, con el RUC y la firma reales. Cambiar `ambiente` a `PRODUCCION` es un
  campo, pero antes hay que tener el punto de emisión declarado en el SRI y
  decidir desde qué secuencial arranca la serie.
- **Detectar una anulación hecha del lado del SRI.** Si alguien anula un
  comprobante por el trámite manual, el portal no se entera: habría que ver si
  la consulta de autorización lo reporta y, en ese caso, reflejarlo como hace la
  nota de crédito.
- **Los libros del contador.** Contífico también era el sistema contable; eso no
  lo reemplaza el portal, y es una decisión que no es de código.
