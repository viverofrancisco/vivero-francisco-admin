# Facturación con Contífico

Contífico es el sistema contable que ya usa Vivero Francisco. El portal empuja
las ventas hacia allá; **Contífico genera el XML, firma electrónicamente y
transmite al SRI**. El portal no implementa nada de facturación electrónica.

- Docs oficiales: <https://contifico.github.io/>
- Base: `https://api.contifico.com/sistema/api/v1/`
- Código de la integración: [`src/lib/contifico/`](../../apps/admin/src/lib/contifico/)

## Frontera de responsabilidades

| | Dueño | Por qué |
|---|---|---|
| Clientes | **Portal** | Ya tiene visitas, chat y acceso a la app |
| Catálogo de servicios | **Portal** → Contífico | Se usa en el celular, en el campo, sin red |
| Bienes de mostrador | **Contífico** → Portal | Ahí están el stock, el POS y la caja |
| **Órdenes** | **Portal** | Existen desde que se hizo el trabajo, antes de la factura |
| Facturas | **Contífico** | Numeración, XML, firma, autorización SRI |
| Pagos y saldos | **Contífico** | Solo se espejan; **no duplicar** |

Una orden y una factura no son lo mismo: la orden existe desde que se completó
la visita o renovó la suscripción; la factura existe cuando alguien decide
facturar. Por eso las órdenes viven en el portal — y por eso, si algún día se
deja de usar Contífico, el historial de ventas completo sigue siendo propio.

## Autenticación

```
Authorization: <CONTIFICO_API_KEY>     ← el key crudo, SIN "Bearer"
```

`CONTIFICO_TOKEN` es otra cosa: es el campo **`pos`** que va dentro del cuerpo
de cada documento. Verificado — la respuesta del documento lo devuelve con el
mismo valor.

Variables en `.env` (ver `.env.example`):

| Variable | Para qué |
|---|---|
| `CONTIFICO_API_KEY` | Header `Authorization` |
| `CONTIFICO_TOKEN` | Campo `pos` del documento |
| `CONTIFICO_ESTABLECIMIENTO` | Por defecto `001` |
| `CONTIFICO_PUNTO_EMISION` | Serie propia del portal, por defecto `002` |
| `CONTIFICO_SECUENCIAL_INICIAL` | Piso del secuencial (ver *Numeración*) |

## Trampas de la API

Todo esto está verificado contra la API real. Ahorra varias horas.

### El nombre de la factura sale de Contífico, no del portal

Lo que sale impreso como **nombre del ítem** es el nombre que Contífico tiene
guardado para ese producto, y no hay forma de pisarlo desde la API. Verificado
sobre el XML autorizado de una factura real (`001-001-000002354`):

```xml
<detalle>
  <codigoPrincipal>MANT-000001</codigoPrincipal>
  <descripcion>SERVICIO DE MANTENIMIENTO</descripcion>   <!-- el producto -->
  <detallesAdicionales>
    <detAdicional nombre="Detalle" valor="AREAS VERDES"/> <!-- nombre_manual -->
  </detallesAdicionales>
</detalle>
```

Consecuencia: editar la descripción de una línea en el editor de órdenes cambia
lo que muestra el portal, no lo que sale en el papel.

**Pero sí hay texto libre por línea**, en dos campos que la documentación
oficial no menciona y que el POST acepta y guarda (probado en el sandbox el
27/08/2026):

| Campo de `detalles[]` | Se guarda | Dónde aparece |
|---|---|---|
| `nombre_manual` | sí | RIDE, columna *Detalles Adicionales*, como `Detalle: <valor>`. **No reemplaza el nombre** |
| `descripcion` | sí | no se pudo confirmar en el RIDE: ninguna factura real lo usa y el RIDE del sandbox pide sesión |

Y a nivel documento, `descripcion` sale en *Información Adicional* como
`<campoAdicional nombre="Descripción">` — es donde el vivero pone
`"MANT. AREAS VERDES 01 AL 15 AGOSTO 2026"`.

Así que para facturar varios trabajos como una sola línea de "servicios de
mantenimiento" hay que **elegir el producto de Contífico que se quiere imprimir**
(ellos tienen `MANT-000001 SERVICIO DE MANTENIMIENTO`) y mandar el detalle
específico en `nombre_manual`. No alcanza con renombrar la línea.

### Lo que la API **no** deja hacer en una línea

En la interfaz de Contífico un documento puede tener líneas contables —pestaña
*Cuentas*, sin producto, con cuenta contable y centro de costo— y así están
hechos varios documentos del vivero: 44 de los 104 del último trimestre. El
`MANT. 202607-0009`, por ejemplo, son $180 contra `4.1.2.1 Ingresos por Servicio
de Mantenimiento`, centro de costo `VIVERO S.A.S. AURORA`.

**Por API no se pueden crear.** El GET las devuelve dentro de `detalles` (con
`producto_id: null`, `porcentaje_iva: null` y el monto en `base_no_gravable`),
pero el POST rechaza cualquier forma de mandarlas. Probado en el sandbox el
27/08/2026, agotando las variantes:

| Lo que se manda | Resultado |
|---|---|
| `cuenta_id` sin `producto_id` | `400` · `1055` · *Falta campo producto_id* |
| `cuenta_id` **+ `centro_costo_id`**, sin producto | igual: `400` · `1055` |
| lo mismo con `tipo_documento: "DNA"` (el de esos documentos) | igual: `400` · `1055` |
| `producto_id: null` o `producto_id: ""` presentes | igual: `400` · `1055` — valida el valor, no la clave |
| `detalles: []` y las líneas en `cuentas` o `detalles_cuentas` | `400` · `1003` · *Falta campo detalle* |
| `detalles[].tipo: "C"` como discriminador | `400` · `1055` |
| `cuenta_id` junto al `producto_id` | acepta, pero lo ignora: vuelve en `null` |
| `centro_costo_id` por línea | se ignora: Contífico asigna el suyo por defecto |

No es cuestión del tipo de documento —un `DNA` con producto entra sin
problema—, sino de que `detalles[]` es obligatorio y **cada elemento exige
`producto_id`**.

Y no son solo documentos internos: **42 de las 151 facturas electrónicas** del
último trimestre están hechas así. En el XML autorizado la línea contable sale
con el código y el nombre de la cuenta en lugar del producto
(`001-001-000002359`):

```xml
<detalle>
  <codigoPrincipal>4.1.2.1</codigoPrincipal>
  <descripcion>Ingresos por Servicio de Mantenimiento</descripcion>
  <precioUnitario>260.000000</precioUnitario>
</detalle>
```

O sea que hoy facturan de dos formas: unas facturas imprimen el **nombre de la
cuenta** y otras el **nombre del producto** con el detalle al lado. El portal
solo puede hacer la segunda. Para que el papel diga algo en particular, se elige
el producto de Contífico que lo diga —ellos ya tienen
`MANT-000001 SERVICIO DE MANTENIMIENTO`—, no se escribe la línea.

### `cruce_cuenta` no sirve para esto: cruza saldos, no arma líneas

`POST /documento/<id>/cruce_cuenta/?tipo=CTA` ([docs][cruces]) suena a la puerta
que falta —"cruce de un documento con una cuenta contable"— pero es de la parte
de **cobros**: sus campos son `monto`, `fecha`, `descripcion` y `cuenta_id`, y
lo que hace es bajar el saldo del documento contra esa cuenta. Los otros `tipo`
son giftcards y plataformas de delivery (Uber, Rappi, Glovo), lo que confirma
para qué está pensado.

Probado en el sandbox el 28/08/2026 sobre una factura de $100: un cruce de $40
dejó el `saldo` en `60.0` y **no tocó nada más** — mismo `total`, misma línea de
producto, y ni siquiera aparece en `cobros`. Sirve para saldar una factura
contra una cuenta contable; no para decidir qué se imprime en ella.

[cruces]: https://contifico.github.io/registro/cruces/

Es decir: **toda línea emitida desde el portal es una línea de producto**. Y eso
no pierde nada contablemente, porque **el producto ya lleva su cuenta de
ingreso**: `GET /producto/<id>/` devuelve `cuenta_venta_id`, y en
`MANT-000001 SERVICIO DE MANTENIMIENTO` vale `4LmavvlyKfJJMa3N`, que es
**exactamente la misma cuenta** que usan las líneas contables a mano
(`4.1.2.1 Ingresos por Servicio de Mantenimiento`).

O sea que vender ese producto y escribir la línea contra esa cuenta registran el
ingreso en el mismo lugar; la línea contable no agrega nada, es otra forma de
tipear lo mismo. Lo confirma el propio uso: de los 95 DNA del último trimestre,
**29 ya están hechos con línea de producto** y no con cuenta.

Si algún día hace falta separar ingresos por cuenta, se hace con productos
distintos —cada uno con su `cuenta_venta_id`—, no con `cuenta_id` en la línea.

### Dos tasas de IVA en el mismo documento se aceptan

También verificado en el sandbox: un documento con una línea al 0% y otra al 15%
entra sin problema, siempre que cada línea lleve su `base_cero` / `base_gravable`
y los subtotales del encabezado cierren. Es lo que ya hacen en producción —14 de
142 facturas mezclan servicios al 15% con bienes agrícolas al 0%.

Por eso, al vincular, si el nombre de allá difiere del nuestro el diálogo ofrece
**renombrarlo en Contífico** (marcado por defecto). Verificado contra la API
real:

```
PATCH /producto/<id>/  {"nombre": "..."}   →  200 con CUERPO VACÍO
```

Devuelve 200 pero **no devuelve el producto**: hay que releerlo con
`?codigo=` para confirmar. Es `actualizarNombreEnContifico()`.

Es un cambio sobre su catálogo y afecta a cualquier otro uso de ese producto en
Contífico, así que el aviso lo dice explícitamente. Renombrar en el portal
*después* no se propaga solo: hay que volver a vincular.

### Todos los endpoints llevan barra final

Sin ella la API responde `301` a la misma URL con `/`. En código no molesta
—`contificoRequest()` siempre la pone— pero en Postman o curl sí: al seguir la
redirección, un `POST` se convierte en `GET` y pierde el cuerpo, y
`GET /documento/` sin filtros **se cuelga** (ver abajo). El síntoma es una
request que nunca vuelve, en vez de un error.

```
POST /documento   → 301 → /documento/   (y el cuerpo se pierde)
POST /documento/  → responde al instante
```

### `GET /producto/` sin filtro se cuelga

No es un problema de permisos: intenta devolver el catálogo entero y **hace
timeout a los 240s**. Con cualquier filtro responde en ~1s.

| Query | Resultado |
|---|---|
| *(sin filtro)* | timeout |
| `?filtro=jardin` | 57 items · 1s — busca por **nombre**, código o categoría |
| `?filtro=ja` | por eso el buscador exige 3 letras: menos es demasiado amplio |
| `?codigo=PV-000035` | exacto · 1s |
| `?categoria_id=<id>` | 30 items · 1s |
| `?fecha_inicial=2026-08-20` | 14 items · 1s — modificados desde esa fecha |

Lo mismo vale para **`GET /documento/`**: sin filtros no responde (medido: 60s
sin un solo byte); con `fecha_inicial` y `tipo_registro` vuelve en segundos.

`fecha_inicial` va en **`YYYY-MM-DD`**, al revés que el resto de la API, que usa
`DD/MM/YYYY`. Mandarlo en `DD/MM/YYYY` devuelve 400.

Ese parámetro es lo que hace barato el pull incremental de bienes: "dame lo que
cambió desde la última vez" es **una llamada rápida**, no un job pesado.

### Sincronizar es **vincular**, no crear

Contífico ya tiene catálogo cargado, así que lo normal es **vincular** un
producto del portal con uno que ya existe allá. Crear es el último recurso: no
hay DELETE de productos, así que uno creado por error queda para siempre.

Nada se sincroniza solo. **El vínculo es un paso manual y explícito**, desde el
alta del producto (opcional) o desde su ficha:

```
buscar en Contífico (mín. 3 letras) → elegir → POST /api/servicios/<id>/contifico
                                                 { contificoProductoId, codigo,
                                                   actualizarNombre? }
                       └── si de verdad no existe → POST sin cuerpo = crear
DELETE del mismo endpoint deshace el vínculo (no toca nada en Contífico).
```

*Cambiar* de producto es el mismo POST: pisa el vínculo anterior.

**Ojo con "crear nuevo" sobre un producto ya vinculado.** El código para crear
se deriva **del id del portal** (`VF-…`) y nunca de `producto.codigo`: si estaba
vinculado, ese campo tiene el código de Contífico, y reusarlo devolvería por 409
el mismo producto al que ya estaba vinculado en vez de crear uno. Por eso
`sincronizarProducto()` toma un `forzar` para ese caso.

`Producto.contificoProductoId` es **único**: dos productos del portal apuntando
al mismo de Contífico harían ambigua la lectura hacia atrás de una factura. El
buscador marca como *Tomado* lo que ya está vinculado en vez de esconderlo, y
`vincularProducto()` corta con un 409 que **nombra** al que lo tiene, antes de
tocar Contífico.

**Salvo que quien lo tenga esté archivado.** Archivar no suelta el vínculo —el
producto sigue existiendo con su historia—, así que sin excepción un producto de
Contífico quedaba tomado para siempre por una ficha que ya no se ve en ninguna
pantalla, y no había forma de liberarlo. Vincular se lo saca al archivado (junto
con su `codigo`, que también es único) y se lo da al vivo, todo en una
transacción.

### El vínculo se exige al emitir, no antes

Un producto sin `contificoProductoId` **entra igual en una orden y en una
suscripción**: la orden registra lo que se vendió y el plan lo que se acordó,
que son datos del portal. Lo que tiene que existir allá es lo que **sale
impreso**, y eso se decide al emitir — es lo que permite facturar diez trabajos
como una sola línea, donde los otros nueve nunca tocan Contífico. La validación
vive en `emitirFactura()` (`factura.service.ts`), que rechaza nombrando el
producto.

Antes se exigía en `orden.service.ts` y `suscripcion.service.ts`, y bloqueaba
registrar trabajo hecho por una configuración de catálogo pendiente. Hoy los
selectores lo **avisan** en vez de deshabilitarlo, y avisan también antes:
*Nueva orden* deja guardar el borrador pero apaga **Crear y facturar**, y la
ficha de una orden con productos sin vincular lista cuáles son —linkeados a su
ficha, que es donde se vinculan— y apaga **Emitir factura**.

Lo que no cambió: `emitirFactura` **no sincroniza nada**. Sincronizar al emitir
escondía la decisión de escribir en el catálogo ajeno detrás del botón de
facturar — el peor momento para descubrir un problema.

### `GET /producto/` solo lista lo que está marcado "para POS"

Y esto es un **bloqueante para producción**, medido el 31/08/2026 leyendo las
dos cuentas.

En producción, `GET /producto/` devuelve `[]` con **todos** los filtros:
`filtro`, `codigo`, `categoria_id`, `fecha_inicial`/`fecha_final`, y con
`result_size`/`result_page`. No es que no haya productos: `GET /producto/<id>/`
devuelve el producto sin problema —`HELECHO ALAMBRE`, código `HE-000005`,
`estado: "A"`— y sus facturas lo venden todos los meses.

El sospechoso es **`para_pos`**, aunque **no está probado**. En el sandbox, los
cientos de productos que sí aparecen en el listado —incluidos los ajenos— tienen
`para_pos: true`; el de producción tiene `para_pos: false`. El token *es* el id
de un POS (`GET /pos/` lo confirma), así que el listado atado a lo que ese punto
de venta tiene habilitado explicaría todo. Nosotros nunca mandamos el campo:
Contífico se lo pone en `true` a lo que se crea por API, y por eso los productos
del portal sí aparecen.

Lo que **sí** está comprobado (31/08/2026, creando `VF-S6UAYWW9CD` por el
camino del portal): **un producto creado por la API nace con `para_pos: true`**
y aparece en el listado en el acto. O sea que el problema es solo del catálogo
viejo, cargado a mano en su interfaz; lo que cree el portal de acá en adelante
se lista solo, sin ir a tildar nada.

La prueba que faltó es la inversa: apagarlo en el sandbox y ver si desaparece de
la búsqueda. **`PATCH /producto/<id>/ {para_pos: false}` no lo cambia**
—responde 200 y el producto sigue en `true`, y el campo no figura entre los que
el PATCH acepta—, así que la relación quedó como correlación fuerte y no como
causa demostrada. Antes de rediseñar nada por esto, conviene
preguntárselo a soporte de Contífico: *¿por qué `GET /producto/` devuelve vacío
para esta cuenta si `GET /producto/<id>/` funciona?*

Dos consecuencias, las dos importantes:

- **El buscador de "vincular con Contífico" no va a encontrar nada en
  producción** hasta que del lado de ellos se marquen los productos para ese
  POS.
- **El catálogo no se puede enumerar** por la lista. Lo que sí se puede es
  recorrer las facturas: `GET /documento/` acepta `fecha_inicial`/`fecha_final`
  en **DD/MM/YYYY** y pagina con `result_size` + `result_page`, y de sus
  `detalles[]` salen `producto_id` y `producto_nombre`. Así se recogieron los
  231 productos distintos que vendieron entre enero y agosto de 2026, en 521
  documentos.

### Una factura por API no mueve el inventario

Probado el 31/08/2026 en el sandbox con `VF-S6UAYWW9CD`, un producto creado por
el portal y con **"Para control STOCK" activado a mano** en su interfaz:

- el portal emitió la factura `001-002-000900139` por **3 unidades**;
- no falló, no pidió bodega — `POST /documento/` no tiene campo de bodega;
- `cantidad_stock` quedó en **0**, el mismo valor de antes: ni bajó a −3, ni
  nada.

La explicación es que el inventario tiene su propia puerta: Contífico expone
**`/movimiento-inventario/` (GET, POST)** y `/bodega/` (GET), aparte de los
documentos. En el sandbox compartido `/movimiento-inventario/` hace timeout
—como todo listado sin filtro en esa cuenta—, así que no se pudo mirar el
detalle.

Lo que **sí** quedó descartado: **la falta de stock no bloquea la emisión.** Se
repitió la prueba con el producto ya marcado *Inventario* en Contabilidad y
*Para control STOCK* en Configuraciones, con `cantidad_stock: 0`, y la factura
salió igual (`001-002-000900140`).

**Lo que no se pudo probar es si con stock disponible la factura lo descuenta**,
y no por falta de intentos: cargar stock con `POST /movimiento-inventario/`
(`ING`, 10 unidades a *Bodega Principal*) crea el movimiento —`ING
202608000250`— pero queda en **`estado: "G"`** y `cantidad_stock` sigue en 0. El
movimiento además se asoció al POS de **otro integrador**, porque en esa cuenta
compartida hay 319 bodegas mezcladas y la "principal" no es nuestra.

O sea: **el sandbox compartido no sirve para probar inventario.** La forma de
contestarlo sin escribir nada es mirar producción: un producto con stock —el
helecho tenía 584— antes y después de una factura que ellos emitan por su
camino normal.

Mientras tanto, el borde sigue siendo el mismo: **el inventario es de
Contífico**. Lo que el portal puede hacer sin discutirle a nadie es *mostrarlo*
—`cantidad_stock` viene en el producto— y nunca escribirlo.

### Variantes: existen en la API, no las usan

`tipo_producto` acepta `SIM` (simple), `VAR` (variante), `COM` (combo) y `COP`
(compuesto), y hay `producto_base_id`, `variantes` y `detalle_variantes` para
armarlas.

**Los 231 productos que producción vendió en 2026 son todos `SIM`**, ninguno con
`producto_base_id` ni `detalle_variantes`. No hay nada que espejar, y el portal
no las implementa: sería construir para un caso que todavía no existe.

### El código es la llave, el nombre no

```
mismo código  → 409 {"mensaje":"Producto ya existe","cod_error":1123,"id":"<el existente>"}
mismo nombre  → 201, lo crea igual
```

Contífico **sí deja crear dos productos con el mismo nombre**. Solo el código es
único. Y como el 409 **devuelve el id del que ya existe**, la sincronización es
idempotente sin necesidad de buscar primero:

```
POST /producto/ con codigo = "VF-XXXXXXXXXX"
  201 → guardar el id devuelto
  409 → guardar el id que viene en el error
```

Ver `sincronizarProducto()` en `src/lib/contifico/productos.ts`. Es el camino de
*crear*; el preferido es `vincularProducto()`, que no escribe en su catálogo.

### Un producto necesita precio o `pvp_manual`

Sin eso, rechaza con *"El producto debe tener minimo un pvp registrado o
pvp_manual"*. Como los precios viven en cada contrato o visita y no en el
catálogo, el portal manda **`pvp_manual: true`**.

### No hay DELETE de productos

Solo `PATCH {estado: "I"}`. Todo lo que se sincroniza queda para siempre — por
eso importa el código determinístico, para no ensuciarles el catálogo.

### Qué datos exige para el cliente

Verificado leyendo una persona real de su API (`GET /persona/?cedula=…`). De
todo lo que devuelve, esto es lo que el portal escribe:

| Campo suyo | De dónde sale |
|---|---|
| `cedula` / `ruc` | `DatoFacturacion.identificacion`, según el tipo |
| `razon_social` | `DatoFacturacion.razonSocial` |
| `tipo` | `N` / `J` desde `tipoPersona` |
| `direccion`, `telefonos`, `email` | los homónimos del dato |
| `es_extranjero` | siempre `false` |

Lo demás que guarda —`placa`, `es_proveedor`, `adicionalN_cliente`,
`banco_codigo_id`, `pvp_default`…— es interno suyo y no se toca.

**Por eso los datos de facturación son una entidad aparte** (`DatoFacturacion`),
no campos del Cliente: un mismo contacto puede facturar a nombre propio y al de
su empresa, y la razón social del SRI no tiene por qué ser el nombre con el que
figura en el portal. Al emitir se elige cuál usar, o se cargan nuevos y quedan
guardados. `Factura` guarda el id **y** un snapshot de razón social e
identificación: editar el dato después no cambia el papel que ya recibió el
cliente.

### Los clientes NO se sincronizan

El objeto `cliente` va **embebido dentro del documento**. Contífico crea la
persona sola y devuelve `persona_id`. Verificado: cédula inexistente antes → 0
resultados; después del POST → 1, con `es_cliente: true`.

Y si la cédula ya existe, **reusa la persona en vez de duplicar**. Ojo con un
detalle: **no actualiza** los datos. Si mandás otro nombre o dirección, la
persona conserva los originales. Corregirlos es un `PUT /persona/` aparte.

### El teléfono no se valida

Contífico guarda `telefonos` como texto libre. La persona de prueba del sandbox
tiene `"998502472"` — nueve dígitos, sin el cero inicial: si validara formato
ecuatoriano, ese valor no estaría ahí.

No pudo confirmarse por escritura porque **`PUT /persona/<id>/` devuelve 404
"No existe"** aunque el `GET` al mismo id funcione. Es otra rareza suya: los
datos de una persona solo se corrigen desde su interfaz.

El portal usa el mismo `PhoneInput` que la ficha del cliente, así que en la base
queda un único formato (`0XXXXXXXXX`). Es una decisión del portal, no un
requisito de Contífico.

### La cédula se valida

Una cédula inventada devuelve `{"mensaje":"Cedula Incorrecta","cod_error":1508}`.
Por eso el portal valida el módulo 10 antes de emitir
(`src/lib/contifico/cedula.ts`): si no, el error aparece recién al facturar, que
es el peor momento para descubrirlo.

### El IVA es 15%, pero el campo se sigue llamando `subtotal_12`

Los docs muestran `porcentaje_iva: 12` y `subtotal_12` — nombres heredados del
IVA viejo. Hoy se manda `porcentaje_iva: 15` y la base gravada va en
`subtotal_12`. Verificado en una factura real: `subtotal_12 = 110.00`,
`iva = 16.50` (110 × 0.15). **No existe `subtotal_15`.**

**La tasa es por línea, no por factura.** Una misma factura real mezcla líneas
al 0% (plantas, tierra) y al 15% (maceteros). Por eso `ivaTasa` vive en
`OrdenLinea`.

### Un documento se toca solo antes de que Contífico lo firme

`PATCH /documento/<id>/` → 405 y `PUT /documento/<id>/` → 400: las dos formas
obvias no existen. La que sí es **`PUT /documento/`** a la colección, con el
`id` y el cuerpo completo adentro — sirve para anular y (en teoría) para
actualizar, y **deja de aceptarse en cuanto Contífico firma**, cosa que hace
sola dentro de la hora.

Todo el detalle está abajo, en [Anular sí se puede](#anular-sí-se-puede-y-el-campo-es-anulado):
el PUT borra lo que no le mandes, el bloque `cliente` se ignora, y pasada la
firma la única vía es la nota de crédito. En la práctica **una factura emitida
se corrige anulándola rápido o no se corrige**, así que la UI pide confirmación
explícita antes de emitir.

### `estado` del documento ≠ `GET /documento/<id>/estado/`

Dos cosas distintas con el mismo nombre, y confundirlas cuesta caro.

**El campo `estado` del documento** es el estado de cobro, y es donde se ve la
anulación. Verificado sobre 41 documentos del sandbox (20260823), la correlación
es exacta:

| `estado` | `anulado` | `saldo` | Qué es |
|---|---|---|---|
| `P` | `false` | `= total` | Pendiente de cobro |
| `C` | `false` | `0` | Cobrado |
| `A` | `true` | `0` | **Anulado** |

El documento trae además un booleano `anulado` redundante con `estado === "A"`, y
un `saldo` que es lo que falta cobrar. El portal manda `estado: "P"` al crear.

**`GET /documento/<id>/estado/`** es otra cosa: el avance de la firma
electrónica —`No se ha firmado` / `Firmado` / `Enviado SRI` / `Autorizado`—, que
es lo que mapea `mapearEstado()`.

**La trampa:** ese endpoint **no delata una anulación**. Consultado sobre un
documento con `estado: "A"` devolvió `"No se ha firmado"`, igual que uno recién
creado. Por eso `sincronizarFactura()` hace **dos** llamadas: `/estado/` para la
firma y `GET /documento/<id>/` para leer `anulado` y `saldo`. Con una sola, el
portal nunca se enteraría de que anularon la factura desde la interfaz.

La lista completa de estados, según su documentación: `P` pendiente, `C`
cobrado, `G` pagado, `A` anulado, `E` generado, `F` facturado.

### Una factura se puede cobrar en cuotas

`saldo` es lo que falta, y baja con cada cobro de `POST /documento/<id>/cobro/`.
`estado` recién pasa a `C` cuando llega a cero. Verificado en el sandbox: hay un
documento con total 2.30 y saldo 2.20 (un cobro de 0.10), y cuatro con más de un
cobro.

Eso es **pago** parcial, no **facturación** parcial: la factura sale por el total
y se cobra de a poco. El portal espeja `saldo` en `Factura.saldo` al sincronizar
y no lleva cobros propios — de eso es dueño Contífico.

Los cobros se registran con `POST /documento/<id>/cobro/`. Campos según la forma:

| `forma_cobro` | Qué es | Obligatorios además de `monto` |
|---|---|---|
| `EF` | Efectivo | — |
| `CQ` | Cheque | — (`numero_cheque` opcional) |
| `TRA` | Transferencia | `cuenta_bancaria_id` |
| `TC` | Tarjeta de crédito | `tipo_ping` (`D` datafast, `M` medianet, `E` dataexpress, `P` placetopay, `A` alignet) |

`fecha` es opcional en todas. El portal lo expone en el menú de cada factura
("Registrar cobro") y después relee el `saldo` del documento en vez de restarlo
localmente: si alguien cargó otro cobro por la interfaz, la resta daría un
número que no existe.

`TRA` exige `cuenta_bancaria_id`: una cuenta **de la propia empresa** —dónde
cayó la transferencia—, no del cliente. Se listan con
**`GET /banco/cuenta/`, en singular**; en plural (`/banco/cuentas/`) devuelve
404, igual que `/cuenta-bancaria/`, `/bancos/` y varias otras variantes. Devuelve
`id`, `nombre`, `numero`, `tipo_cuenta` (`CC`/`CA`) y `estado` (`A`/`I`); el
portal ofrece solo las activas.

**`numero_comprobante` solo está documentado para transferencia**, y es el único
caso donde se respeta: en efectivo Contífico lo pisa con su propia etiqueta
("Efectivo") y en cheque lo llena con "CHEQUE" si no se manda. Por eso el
formulario lo muestra solo en transferencia.

Un cobro en **efectivo** no acepta nada más que `monto` y `fecha`: no hay
descripción, observación ni referencia. Se buscó a propósito en su doc.

Y una rareza del ida y vuelta: **los códigos de lectura no son los de
escritura.** Un cobro mandado como `EF` vuelve como `forma_cobro: "CAJA"`.
`CQ`, `TRA` y `TC` vuelven igual.

Verificado de punta a punta: factura de 1325.95 → cobro en efectivo de 530.38
(saldo 795.57, sigue en `P`) → cobro con tarjeta de 795.57 → saldo 0 y Contífico
la pasa sola a `C`.

### Un número repetido **no** siempre da error

Y esta es la trampa cara. `POST /documento/` con un `documento` que ya existe
puede responder **200 con el documento existente** en vez de fallar. Sin
chequearlo, el portal adoptaba esa factura como si la hubiera creado: llegó a
marcar una orden como facturada apuntando a una factura vieja **y anulada**.

Por eso `emitirFactura()` no confía en el POST: mira lo que volvió y, si el
documento está anulado o su total no coincide con el de la orden, considera el
número tomado y avanza al siguiente. Atrapar el error de duplicado no alcanza.

Esto se dispara cuando el secuencial local queda por detrás del de Contífico
—`siguienteSecuencial()` lo saca de la tabla `Factura` local— por ejemplo si se
borran filas a mano.

### Anular sí se puede, y el campo es `anulado`

Probado de punta a punta contra el sandbox (23/08/2026, factura
`001-002-000900003`):

`PUT /documento/` —a la **colección**, con el `id` dentro del cuerpo y **todos**
los campos de creación— anula el documento. Los intentos que fallan y por qué:

| Intento | Resultado |
|---|---|
| `PATCH /documento/<id>/` | 405 |
| `PUT /documento/<id>/` | 400 |
| `PUT /documento/` con `{id, estado:"A"}` | `Campo id incorrecto` — exige el cuerpo completo |
| `PUT /documento/` con el documento tal cual lo devuelve el GET | `Llenar un solo campo subtotal` |
| `PUT /documento/` con el cuerpo del POST + `id` + `estado:"A"` | **200, pero no anula**: responde `estado:"P"` |
| `PUT /documento/` con el cuerpo del POST + `id` + `anulado:true` | **200 y anula**: queda `estado:"A"`, `anulado:true` |

O sea: **`estado` es de solo lectura, lo que manda es `anulado`.** Mandar
`estado:"A"` no hace nada; `estado` lo deriva Contífico.

#### El PUT es un reemplazo completo, y muerde dos veces

**No manda `anulado: true` → desanula.** Pasó en la prueba: una llamada de
control que solo cambiaba `descripcion` dejó el documento otra vez en
`estado:"P"`.

**No manda `cobros` → borra los cobros.** Peor, porque es silencioso y es plata.
La `001-002-000900011` tenía un cobro de $144.54 registrado; después de anularla
—con un PUT que no mandaba la clave— quedó con `cobros: []` y `saldo: 0`. Por
eso `anularDocumento` arrastra los cobros del documento, remapeando `CAJA` a
`EF`, que es el código que acepta la escritura.

Regla general: cualquier PUT sobre un documento tiene que arrastrar **todo** lo
que no quiere perder.

#### La firma cierra la puerta, no la autorización

`PUT /documento/` sobre un documento **firmado** responde:

```json
{"mensaje": "El documento ya se encuentra firmado o autorizado, no es posible realizar cambios.", "cod_error": 1045}
```

Verificado el 24/08/2026: la `001-002-000900007` (`firmado: true`) rechazó el PUT
con 1045; la `001-002-000900010` (`firmado: false`) lo aceptó con 200.

Esto vale para **todo** PUT, anulación incluida. Y como Contífico firma sola en
su tanda horaria, **la ventana para anular una factura es corta y no la maneja
nadie de este lado**. Por eso `anularFactura` relee el estado y rechaza
cualquier cosa que no sea `PENDIENTE`, con un mensaje que distingue firmada de
autorizada; y la UI ni siquiera ofrece *Anular orden* cuando la factura ya está
firmada. Pasada la firma, la vía es la nota de crédito.

#### Actualizar un documento existe, pero casi no sirve

La documentación tiene una sección
[Actualización](https://contifico.github.io/registro/documento/#actualizacion):
es el mismo `PUT /documento/` con el `id` en el cuerpo, y solo para documentos
creados por API.

Dos límites que la doc no menciona y lo dejan casi inútil:

1. **Solo antes de la firma** (el 1045 de arriba), o sea minutos impredecibles.
2. **El bloque `cliente` se ignora.** Sobre la `001-002-000900010`, sin firmar,
   se mandó un `razon_social` distinto: respondió **200** y la persona quedó
   **igual**, con el mismo `persona_id`. La persona se ata al crear el
   documento y no se cambia después.

Conclusión práctica: **a nombre de quién sale una factura se decide al emitir y
no se corrige.** Por eso `Factura` guarda `razonSocial` e `identificacion` como
snapshot, y el portal los muestra en la card "Facturado a" en vez del dato
editable del cliente. Para corregirlo hay que anular —si todavía se puede— y
armar una orden nueva.

En la interfaz web sí se pueden borrar cobros y mover el estado de "Cobrado" a
"Pendiente" (queda en la pestaña *Historial* del documento). Eso es de su
interfaz, no de la API: por API el único mecanismo es este mismo PUT, con los
mismos límites.

#### Enterarse de una anulación hecha del otro lado

El portal también **anula desde acá** (`anularOrdenCompleta`), pero una
anulación puede venir de la interfaz de Contífico. Se detecta al sincronizar:
marca `Factura.anulada`, pone
`saldo` en 0, la factura sale tachada, deja de sumar al total facturado, y **la
orden vuelve de `CONFIRMADA` a `BORRADOR`**: sin factura viva no puede seguir
confirmada, y borrador es el único estado editable, que es justo lo que hace
falta si la anularon porque algo estaba mal.
Ese último paso hay que hacerlo a mano: `listarOrdenesPorFacturar` filtra por
estado *antes* de mirar las facturas, así que sin devolver la orden a
`CONFIRMADA` quedaba facturada para siempre y no había forma de reemitirla.

Ojo con el id: el número que aparece en la URL de la interfaz de Contífico
(`/documento/consultar/408826552/`) **no** es el id de la API. Ese es un hash
tipo `xgepglRKYkt36d1p`, y pedir el de la URL devuelve `id incorrecto`. Para
encontrar un documento sin tener su id hay que listar con
`GET /documento/?tipo_registro=CLI&fecha_emision=DD/MM/YYYY`.

### `DNA` no es "consumidor final", y no lleva IVA

Contífico tiene varios `tipo_documento` además de `FAC`. El que más usa el
vivero es **`DNA` (Documento No Autorizado)**: 95 en el último trimestre contra
152 facturas. Es un registro interno de una venta —con su cliente, su saldo y
sus cobros— que **nunca toca el SRI**: no tiene autorización, ni XML, ni RIDE
(la API devuelve `url_ride` y `url_xml` en `null`), y `GET /documento/<id>/estado/`
dice siempre "No se ha firmado".

Es fácil confundirlo con el comprobante a consumidor final. No lo es, y los
datos lo confirman: **los 95 DNA tienen persona identificada** con cédula o RUC,
ninguno es anónimo.

Lo que sí se puede y no se puede, probado en el sandbox el 28/08/2026:

| | Resultado |
|---|---|
| Crear un `DNA` por API, con producto | ✅ igual que una `FAC` |
| Registrar cobros contra él | ✅ mismo endpoint, el saldo baja igual |
| Anularlo | ✅ mismo `PUT` con `anulado: true` |
| **Ponerle IVA** | ❌ `400` · `1016` · *No se permite Impuestos IVA/ICE en DNA* |
| **Número repetido** | ⚠️ **lo acepta y crea un segundo documento** — no hay unicidad, al revés que en `FAC` |
| PDF para el cliente | ❌ no hay: `url_ride`, `url_xml` y `url_` vienen los tres en `null` |

El documento **existe** —número, cliente, líneas, saldo, cobros, todo
consultable por API—; lo que no existe es el comprobante del SRI, que es
justamente lo que significa *No Autorizado*. Si hay que darle un papel al
cliente, **lo renderiza el portal**, como ya hace con los informes.

**Por qué no se puede reusar la impresión de ellos.** Su interfaz sí imprime un
*Comprobante de Compra/Venta* del DNA, pero por una ruta de la **aplicación
web**, no de la API:
`/sistema/registro/documento/consultar/<id numérico>/?imprimir=1`. Dos cosas la
hacen inservible desde acá, las dos medidas el 30/08/2026:

- pide sesión de navegador — sin cookie devuelve **302 al login**;
- ese id numérico (`413986495`) **no aparece en ningún campo** de
  `GET /documento/<id>/`: la API solo conoce el alfanumérico
  (`MEeg5NVA11FZQbQ5`), así que la URL ni siquiera se puede armar.

Comparado con una `FAC` ya firmada, donde el propio documento trae
`url_ride` (`…/documento/ride/<hash>.pdf`) y `url_xml`, y ese link **sí es
público**: verificado el mismo día, `200 application/pdf` sin sesión. Es el que
el portal guarda en `Factura.urlRide` y ofrece como *Ver factura*. Además, el
comprobante que imprime la web del DNA incluye el **asiento contable**: es un
papel interno, no uno para darle al cliente.

Las dos últimas filas son las que muerden. Un servicio gravado al 15% **no puede
ir en un DNA**, y la numeración la tiene que garantizar el portal solo, sin la
red de seguridad que sí existe en las facturas. La numeración actual, hecha a
mano, ya muestra el problema: conviven `MANT. 202608-0015`, `MANT.202608-0011`,
`Mant. …`, `MANT202606-00002`, `ADIC.`, `ADC.`, `VNTS`, `VENTA`.

**El portal los emite** desde la misma pantalla que las facturas, eligiendo
***Consumidor final*** en el tipo de documento (`Factura.tipo = NO_AUTORIZADO`).

Ojo con ese nombre: en la pantalla dice *Consumidor final* porque es como se lo
nombra en el vivero —el cliente que no pide comprobante—, pero **no** es la
factura a consumidor final del SRI, que es una `FAC` con trece nueves y tope de
$50 (la sección siguiente). Por eso la opción lleva pegada la aclaración *"no va
al SRI y no lleva IVA"*: es lo que separa las dos cosas en el momento de elegir.
Adentro del código el tipo se sigue llamando `NO_AUTORIZADO`, que es lo que es.

Tres consecuencias de las reglas de arriba, todas en `factura.service.ts`:

- La opción **se bloquea si la orden tiene IVA**, con el motivo. Dejar quitarle
  el IVA al emitir haría que la orden y el documento digan números distintos
  para la misma venta.
- La numeración es una **serie propia y corrida** (`CONTIFICO_SERIE_DNA`, por
  defecto `VF-000000001`), y `Factura.numero` es único: es la única garantía que
  hay. Los números que ellos emiten a mano quedan como están.
- La sincronización **no le pregunta al SRI**: `/estado/` devuelve "No se ha
  firmado" para siempre, así que se relee solo el saldo y la anulación, y el
  corte del cron es `saldo = 0` en vez de "autorizada y saldada".

Lo que **no** hace el portal todavía es el PDF. Cuando toque, lo renderiza él
—como los informes—: la API de Contífico no expone ninguno.

### Consumidor final: es una `FAC` con trece nueves, y tope de $50

El comprobante a consumidor final **sí** existe y es una factura electrónica
normal, con `cliente.cedula: "9999999999999"`. Contífico normaliza la persona
solo (queda como `Consumidor Final`, `cedula 9999999999`, `ruc 9999999999999`)
y **hace cumplir el tope del SRI**:

```
total 115.00 → 400 · 1015 · El valor total del documento no puede exceder 50USD
               para Consumidor Final
total  34.50 → 201
```

Ojo con `validarIdentificacion()` en `contifico/cedula.ts`: `9999999999999` no
pasa el módulo 10, así que si algún día se factura a consumidor final hay que
exceptuarlo explícitamente.

Hoy el vivero **no emite ninguno**: cero documentos a consumidor final en el
último trimestre.

### `electronico`

- `true` → Contífico firma, transmite y genera `url_ride` y `url_xml`. La
  `autorizacion` va vacía: la genera él.
- `false` → **exige** `autorizacion` (régimen de factura física).

## Numeración

El formato es la estructura del SRI:

```
001    -    002    -    000900001
estab.      punto        secuencial (9 dígitos)
            de emisión
```

**El número lo manda el portal, Contífico no lo asigna.** Y no hay forma de
consultar el último de una serie: `GET /documento/` no acepta filtros útiles
(`?tipo_documento`, `?documento` y `?filtro` dan timeout; `?fecha_inicial` da
400).

Por eso la numeración tiene tres capas (`src/lib/services/factura.service.ts`):

1. El secuencial se deriva del máximo que **emitió el portal**.
2. `CONTIFICO_SECUENCIAL_INICIAL` actúa de **piso**, para cuando la serie ya
   tiene documentos cargados por fuera.
3. Si Contífico responde *"Documento ya existe"*, se avanza al siguiente y se
   reintenta (hasta 25 veces).

> **Al pasar a producción hay que fijar el piso.** Si la serie del portal ya
> tiene documentos emitidos a mano, arrancar en 1 va a chocar y no hay forma
> de averiguar el último por API.

**Conviene un punto de emisión propio para el portal.** Si comparte serie con lo
que emiten manualmente en Contífico, los secuenciales se pisan. Requiere
declararlo en el SRI.

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
otra cosa, que se hace al emitir — ahí sí se renombra, se junta y se agrega
detalle.

### La factura no tiene la forma de la orden

Se emite desde **`/dashboard/ordenes/[id]/facturar`**, una pantalla propia con
las líneas de la orden ya cargadas una a una. Ese es el caso común y sigue
siendo un clic. Lo que la pantalla hace posible es lo otro: **cobrar varios
trabajos de un período como una sola línea** de "servicio de mantenimiento" con
el detalle al costado, que es como se factura el mantenimiento acá y como el
vivero ya lo hacía a mano.

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

### Toda línea de la **factura** sale del catálogo

No hay líneas de texto libre. `detalles[]` **exige `producto_id`** —una línea
con solo `cuenta_id` da `400 Falta campo producto_id`—, así que una línea sin
producto sería un documento imposible de emitir. Texto adicional sí se puede
mandar (`nombre_manual`), pero acompaña al nombre del producto, no lo reemplaza.

**El vínculo con Contífico se exige sobre la factura, no sobre la orden.** Se
exigía sobre la orden, con el argumento de que así ninguna podía llegar a
facturación con algo que no se puede emitir; eso valía cuando las dos eran lo
mismo. Ahora la orden es el registro interno de lo que se vendió —diez trabajos
que salen impresos como una línea— y pedir el vínculo ahí obligaba a cargar en
el catálogo ajeno cosas que nunca iban a imprimirse. El chequeo vive en
`emitirFactura()`, y el armador marca la línea que no lo tiene y no deja emitir
hasta cambiarla.

Con una salvedad que se agregó después: **la ficha de la orden apaga *Emitir
factura*** mientras haya un producto sin vincular, así que a esa pantalla no se
llega con líneas rotas. La marca del armador queda como red por si el vínculo se
cae entre medio, y como el lugar donde se elige otro producto para esa línea.

Lo que sí sigue valiendo para las dos: la línea **necesita un producto del
catálogo del portal**. `OrdenLinea.productoId` y `FacturaLinea.productoId` son
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
Agregalo solo si es un extra"*. Nada queda en gris: un producto sin vincular con
Contífico también entra, con su propio aviso — lo que frena es emitir, no armar.

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
suscripción **sin productos activos**, y lo reporta en la respuesta. Antes
omitía también las que tuvieran un producto sin vincular a Contífico; dejó de
hacerlo cuando el vínculo pasó a exigirse al emitir: saltearla dejaba al cliente
sin su orden del mes por un detalle de configuración del catálogo, y el período
igual se puede facturar con otro producto.

El mismo cron corre `generarBorradoresDeVisitas()`, la red de seguridad para
visitas completadas que quedaron sin su borrador —lo normal es que nazca al
completar la visita— y que también deja lo suyo en `omitidas` con el motivo.

### Dónde se ven las facturas

**No hay una pantalla de facturas.** La había y se sacó: con una orden por
factura, era la misma lista de órdenes con otro nombre y otra columna. Una
factura se mira desde su orden, que es donde está todo lo demás.

- Detalle de la orden — número, ID de Contífico, estado, saldo, a nombre de
  quién salió, sus cobros, y el menú para verla, mandarla al SRI o
  resincronizarla
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

Una factura que nunca se sincronizó no tiene saldo conocido; entra igual, con el
total como saldo y un `?` que lo aclara. No saber cuánto falta no es lo mismo
que saber que no falta nada.

### El borrador se edita, lo confirmado no

`actualizarOrden()` acepta cambios solo en `BORRADOR`: agregar o quitar líneas,
ajustar precios y cantidades, cambiar de cliente, cambiar **qué visitas** cubre
y las notas. Confirmada la orden es lo que se le va a cobrar al cliente, y
facturada Contífico no deja editarla por API — mover los números después sería
mentirle al historial.

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
parte / cobrada / sin sincronizar. No se guarda, porque los cobros son de
Contífico y pueden cargarse desde su interfaz: una copia local sería una copia
vieja de un número que habla de plata. Cruzar los dos ejes en un solo enum
hubiera pedido un estado por combinación.

Un `saldo` en `null` es **sin sincronizar**, no "cobrada": suponer lo segundo es
el error caro, así que esas facturas entran igual en "Por cobrar" con el total
como saldo.

**Una emisión que falla deja la orden en `BORRADOR`**, el único estado editable
—`actualizarOrden()` solo acepta cambios ahí—, que es donde se arregla la causa:
vincular el producto, cargarle los datos al cliente. Por eso los borradores
tienen página propia (`/dashboard/ordenes/borradores`): son trabajo por revisar,
no plata por entrar. `/dashboard/ordenes` lista las confirmadas y las anuladas,
con la columna de cobro.

### Una orden, una factura

La acción principal de una orden **cambia con lo que le falta**. Sin documento
emitido dice **"Emitir factura"** y lleva al armador; con uno emitido y saldo
pendiente, **"Registrar cobro"**. Ofrecer "Registrar cobro" sobre un borrador
prometía un paso que en realidad empezaba por otro lado: un cobro se registra
**contra** un documento de Contífico, así que la factura tiene que existir antes.

De ahí salen las dos funciones del servicio:

- `facturarOrden()` — emite y nada más. Es la venta a crédito, y también lo que
  usa *Emitir* en el armador.
- `cobrarOrden()` — emite si hace falta y registra el cobro. Sobre una orden que
  ya tiene factura cobra contra esa, así que reintentar después de una falla a
  mitad de camino es seguro. Es lo que hay detrás de *Emitir y cobrar*.

**Si emitir falla, la orden se queda en `BORRADOR`** y el motivo vuelve en
`errorFactura` con HTTP 200 en vez de tirarse. Borrador es el único estado
editable, o sea exactamente donde hay que estar para arreglar la causa: vincular
el producto que faltaba, cargarle los datos al cliente. (Antes confirmar y emitir
eran dos pasos y una emisión fallida dejaba la orden `CONFIRMADA` sin factura;
`confirmarYFacturar()` ya no existe.)

A nombre de quién sale la factura vive en `Orden.datoFacturacionId` y se elige
mientras la orden es borrador, pero **el armador lo vuelve a preguntar** y puede
cambiarlo para esa emisión: `opciones.datoFacturacionId` gana, después el de la
orden, y por último el predeterminado del cliente.

**Antes de llegar al armador hay dos frenos, y los dos se ven en pantalla.** Sin
datos de facturación cargados y con productos sin vincular a Contífico, *Emitir
factura* queda apagado y dice cuál de las dos cosas falta; la ficha lista además
los productos sin vincular, linkeados a su ficha. En *Nueva orden* el que se
apaga es **Crear y facturar** —*Guardar borrador* sigue disponible, que es donde
esto se arregla—.

Emitir **no** manda nada al SRI: crea el documento en Contífico. La firma la
pone Contífico sola y la transmisión sale en su tanda horaria.

### Anular la orden anula su factura

`anularOrdenCompleta()` anula la factura y después la orden, en ese orden y sin
dejarlas nunca en desacuerdo. Anular es el final del camino: la orden no se
reabre ni se vuelve a facturar, y para cobrar ese trabajo se arma una orden
nueva.

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

**Cobrada del todo no se anula.** Contífico la anula igual —lo probamos con un
cobro parcial encima, no lo impide—, pero anular una saldada dejaría la plata
cobrada sin nada que la respalde; para eso va una nota de crédito. Parcialmente
cobrada sí se anula: ahí todavía hay una operación abierta. El corte está en
`anularFactura`, que **relee el saldo de Contífico** antes de decidir, porque el
guardado puede ser de antes de un cobro cargado por su interfaz. Verificado el
24/08/2026: saldada la `001-002-000900007`, el intento se rechazó.

Como no hay factura que anular por separado en la UI, `/api/facturas/[id]/anular`
se eliminó: la única puerta es anular la orden.

La dirección inversa no espeja. Si anulan la factura desde la interfaz de
Contífico, `sincronizarFactura` devuelve la orden a **`BORRADOR`** en vez de
matarla: `CONFIRMADA` quiere decir "tiene factura viva", y quedarse ahí sin
ninguna sería mentir. El trabajo sigue enlazado, no se pierde nada, y borrador
es además el estado editable — si la anularon fue porque algo estaba mal.

## Flujo de emisión

```
Orden BORRADOR
  ↓  resolver con qué datos se factura (los del armador, los de la orden, el predeterminado)
  ↓  validar cédula/RUC (módulo 10)
  ↓  armar las líneas del documento (las de la orden 1:1, o las del armador)
  ↓  verificar que cuadren con la orden, base imponible por tasa
  ↓  verificar que cada producto de esas líneas tenga contificoProductoId
  ↓  reservar secuencial y fechar el documento con hoy (Ecuador)
  ↓  POST /documento/  (cliente embebido, FAC electrónica o DNA interno)
  ↓  guardar Factura + FacturaLinea, y la orden pasa a CONFIRMADA
```

Emitir **no escribe nada en el catálogo**: si un producto de la factura no está
vinculado, corta nombrándolo en vez de crearlo allá. Escribir en el catálogo
ajeno es una decisión explícita, y el botón de facturar es el peor momento para
tomarla sin darse cuenta.

El estado inicial es siempre `PENDIENTE` ("No se ha firmado"). Contífico firma y
transmite de forma **asincrónica**, procesando los pendientes cada hora, así que
### "Hoy" es en Ecuador, no en UTC

El servidor corre en UTC y `new Date()` truncado a día da **mañana** entre las
19:00 y la medianoche de Ecuador (UTC-5). No es cosmético: `Orden.fecha` y
`Factura.fechaEmision` son columnas `DATE`, viajan como `fecha_emision` a
Contífico y de ahí al SRI.

Verificado el 25/08/2026 con la `001-002-000900043`: emitida a las **22:38 del
24** hora de Ecuador, quedó guardada con fecha del **25**.

Por eso existe `hoyEnEcuador()` en `src/lib/fechas.ts`, y lo mismo del lado del
navegador —`new Date().toISOString().slice(0, 10)` **también** es UTC, no la
fecha local del que está mirando la pantalla—.

Al mostrar hay que distinguir dos cosas, y por eso `formato.ts` tiene dos
funciones:

| | Qué es | Cómo se muestra |
|---|---|---|
| `fecha()` | Columna `DATE` (sin hora) | En **UTC**: Prisma la devuelve como medianoche UTC y formatearla en Ecuador la correría un día atrás |
| `fechaHora()` | Un instante real (`createdAt`) | En **hora de Ecuador**, con hora |

En la card de la factura conviven las dos: *Fecha* es la del documento —la que
ve el SRI— y *Emitida* es cuándo salió de verdad del portal. Los cobros solo
tienen fecha: Contífico devuelve `fecha` en `DD/MM/YYYY`, sin hora.

### `url_ride` existe antes de que exista el RIDE

**Que la URL venga no quiere decir que el PDF esté.** `url_ride` y `url_xml`
llegan en el documento desde el momento de emitir, con `firmado: false`, pero
abrirlas devuelve **302** hacia un error de Contífico:

> *No se puede consultar el RIDE de un documento que no esté firmado.*

Verificado el 24/08/2026 sobre `001-002-000900021` a `…24`, las cuatro sin
firmar: las cuatro traían `url_ride` y las cuatro respondían 302.

Por eso el portal **no** decide por la URL sino por el estado: *Ver factura* solo
enlaza cuando la factura pasó de `PENDIENTE`. Mientras tanto aparece
deshabilitada y diciendo que falta que la firmen, en vez de esconderse — el
enlace va a llegar, y esconderlo hacía pensar que algo se rompió.

`sincronizarFactura` igual las relee y las guarda —solo si vinieron, para que un
refresco flojo no borre las que ya estaban—, porque al emitir no siempre vienen.

### Contífico no avisa: hay que preguntarle

No hay webhook ni callback. Firma, transmite, recibe la autorización del SRI y
registra cobros desde su propia interfaz **sin decirnos nada**. Todo lo que el
portal sabe de una factura después de emitirla salió de habérselo preguntado.

Por eso existe `/api/cron/facturas`: `sincronizarPendientes()` relee todas las
facturas que todavía pueden cambiar.

**Corre una vez por día, y es un límite del plan, no una decisión.** El ritmo
que corresponde es cada hora —el mismo al que Contífico procesa— pero el tier
Hobby de Vercel **rechaza el deploy entero** si un cron dispara más de una vez
al día: `0 * * * *` no falla en tiempo de ejecución, hace que el deployment no
llegue a existir. Con Pro se puede volver a `0 * * * *`; sin Pro, un scheduler
externo (GitHub Actions, cron-job.org) puede pegarle al endpoint con el
`CRON_SECRET` y mantener el ritmo horario. Mientras tanto, una factura puede
tardar hasta un día en mostrar su RIDE, y el botón *Actualizar* de la ficha
sigue estando para forzarlo. El corte es *"ya no queda nada por saber"*: **anulada**, o **autorizada
y saldada**. Cualquier otra combinación se relee, porque puede avanzar de estado
o recibir un cobro cargado del otro lado. Verificado caso por caso el 24/08/2026.

Va **en serie**, de a una factura, con los errores contados en vez de cortar la
corrida. Son dos llamadas por factura y no hay ningún apuro; cien pedidos en
paralelo son la forma de descubrir su rate limit en producción.

Estados de `GET /documento/<id>/estado/`:

| Contífico | En el portal |
|---|---|
| `No se ha firmado` | `PENDIENTE` |
| `Firmado` | `FIRMADO` |
| `Enviado SRI` | `ENVIADO_SRI` |
| `Autorizado` | `AUTORIZADO` |

### La firma es automática; no hay endpoint para pedirla

**Nadie firma desde el portal.** Contífico firma con el certificado del vivero
por su cuenta, y no expone ninguna llamada para dispararlo. Verificado el
23/08/2026: la factura `001-002-000900007` se emitió con `autorizacion: null` y
apareció después en `firmado: true` / `estado: "Firmado"` sin que el portal
llamara a nada. Si una factura sigue en `PENDIENTE` en el portal, lo más
probable es que **nadie haya vuelto a sincronizar**, no que esté trabada.

Ojo con la pareja de campos, que no dicen lo mismo:

| Campo | Dónde | Qué significa |
|---|---|---|
| `firmado` | `GET /documento/<id>/` | Ya tiene la firma electrónica |
| `estado` | `GET /documento/<id>/` | `P`/`C`/`G`/`A`/`E`/`F` — el ciclo **comercial**, no el del SRI |
| `estado` | `GET /documento/<id>/estado/` | El avance ante el SRI |

Un documento con `firmado: true` puede seguir con `estado: "P"` en el `GET`
directo: son ejes distintos.

### Qué trae cada cobro

`GET /documento/<id>/` devuelve `cobros[]`, y cada uno tiene bastante más que
monto y fecha:

| Campo | Cuándo viene |
|---|---|
| `cuenta_bancaria_id` | Transferencia. Es un **id**: hay que cruzarlo con `/banco/cuenta/` para tener el nombre |
| `numero_comprobante` | Transferencia |
| `numero_cheque`, `fecha_cheque` | Cheque |
| `tipo_ping`, `numero_tarjeta`, `bin_tarjeta`, `nombre_tarjeta`, `lote` | Tarjeta |

**En efectivo, `numero_comprobante` no es un dato de nadie:** Contífico lo pisa
con su propia etiqueta y devuelve literalmente `"Efectivo"`. Mostrarlo es
mostrar ruido, así que `listarCobros` solo lo pasa cuando la forma es `TRA`.
Y ojo con la forma: un cobro mandado como `EF` vuelve como `CAJA`.

El nombre de la cuenta se resuelve **solo si hay alguna transferencia** —es otra
llamada— y si esa llamada falla se muestra el cobro igual, sin el nombre.

### El comprobante interno no se puede linkear

En la interfaz de Contífico, el menú de PDF de un documento ofrece *PDF*, *PDF
sin asiento* e *Historial*. Eso genera un **"Comprobante de Compra/Venta"**, que
es un impreso interno suyo —existe desde que se crea el documento, incluso
pendiente y sin firmar— y **no es el RIDE**. El RIDE es la factura electrónica y
solo existe una vez firmada.

Ese comprobante sale de la web, no de la API:

```
https://<host>/sistema/registro/documento/consultar/408826552/?imprimir=4
```

`408826552` es un **id interno numérico que la API nunca devuelve**. El
documento trae `id: "QzaO7zXDPAtmQap4"` y el RIDE cuelga de otro slug distinto
(`bOvb7e4sBTp`), y ninguno sirve en esa ruta: probados los dos el 24/08/2026,
404 en todas las formas, con y sin API key. Tampoco hay ningún campo numérico en
el payload del documento.

O sea: **hoy no se puede poner un link al comprobante en el portal.** Haría
falta que expongan el id interno o un endpoint propio. El campo `url_` viene
siempre `null` y es el candidato más obvio a preguntarles.

En cambio **el RIDE sí es público**: `GET` a `url_ride` devuelve
`200 application/pdf` **sin API key ni sesión**. Se le puede pasar al cliente
tal cual — y conviene tenerlo presente en el otro sentido: cualquiera con la URL
lo ve.

### `PUT /documento/<id>/sri/` encola, no transmite

Adelanta el envío sin esperar el proceso horario.
[La doc](https://contifico.github.io/registro/documentoelectronico/) lo describe
como envío manual de documentos ya creados.

- **Sin cuerpo.** El `PUT` va pelado; devuelve `200` con el documento entero, la
  misma forma que el `GET`.
- **Es asincrónico.** Responde en ~500 ms pero el estado **no cambia en esa
  llamada**. En la prueba del 23/08/2026 el documento siguió en `Firmado` con
  `autorizacion: null` durante los tres minutos siguientes. Por eso
  `reenviarAlSri` sincroniza al final y puede devolver el mismo estado que
  antes: no es un error, y la UI no debe prometer "enviada y autorizada".
- **Nada que ver con el `PUT /documento/` que desanula.** Ese es otro path, lleva
  el documento completo en el cuerpo y sí pisa `anulado` (ver arriba). Este no
  lleva cuerpo. Quedó **sin probar** qué hace sobre un documento anulado —no
  había ninguno con el que arriesgarse—, así que `reenviarAlSri` rechaza las
  anuladas y las ya autorizadas antes de llamar.

En el portal es *Enviar al SRI ahora*, en el menú de la factura dentro de la
orden. Solo aparece en `PENDIENTE` y `FIRMADO`: enviada o autorizada ya no hay
nada que apurar.

### Al SRI solo se manda lo emitido **hoy**

Verificado el 30/08/2026 sobre la `001-002-000900136`, emitida el 28:

> El documento no puede ser enviado al SRI. Solo se permiten documentos con
> fecha de emisión del día actual según la normativa vigente del SRI. Ingresa a
> la nube para mandar a autorizar manualmente. Fecha de emisión del documento:
> 28/08/2026. Fecha actual: 30/08/2026.

Es del SRI, no de Contífico: un comprobante electrónico se autoriza el mismo día
que se emite. La consecuencia para nosotros es que **la factura se emite con la
fecha de hoy, no con la de la orden** (`hoyEnEcuador()` en `emitirFactura()`).
Antes viajaba `orden.fecha`, y como una orden se arma un día y se cobra otro
—los borradores del cron y de las visitas son de días anteriores por
definición—, esas facturas nacían imposibles de transmitir. `Orden.fecha` sigue
siendo la de la orden; `Factura.fechaEmision` es la del documento.

Solo queda el caso de una factura vieja que nunca se transmitió: ahí no hay nada
que hacer desde el portal, se autoriza a mano desde la nube de Contífico, y el
mensaje ahora lo dice.

### Lo que dice Contífico llega a la pantalla

`ContificoError` no es un `ServiceError`, así que caía en el `catch` genérico de
las rutas: la pantalla mostraba **"Error interno"** y el motivo de verdad —el de
arriba, o *"No existe un contribuyente registrado con el RUC…"*— se quedaba en
el log del servidor. Ahora `factura.service.ts` lo traduce con
`conErrorDeContifico()` en las acciones que dispara una persona: enviar al SRI,
registrar un cobro y anular. El mensaje llega entero, con su prefijo de contexto.

**Ojo con el ambiente de pruebas.** La empresa del sandbox no tiene permiso de
facturar en producción, así que sus documentos muestran *"ARCHIVO NO CUMPLE
ESTRUCTURA XML (No existe un contribuyente registrado con el RUC …)"*. No es un
problema del payload: es el RUC de prueba contra el SRI real.

## Pendiente

- **Sandbox propio.** El de pruebas actual es **compartido** entre integradores:
  2932 categorías, la mayoría basura ajena, y series de numeración ya usadas.
  Sirve para probar, pero no refleja lo que van a ver en producción. Ahí quedó
  `VF-I38L8PHP35`, el producto que el portal creó al probar la sincronización.
- **Punto de emisión propio** para el portal, declarado en el SRI.
- **Desde qué secuencial arrancar** en producción.
