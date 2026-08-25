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

`detalles[]` lleva solo `producto_id`, `cantidad`, `precio` y los porcentajes:
**no hay campo de descripción**. Lo que se imprime en la factura del SRI es el
nombre que Contífico tiene guardado para ese producto.

Consecuencia: editar la descripción de una línea en el editor de órdenes cambia
lo que muestra el portal, no lo que sale en el papel.

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
buscador marca como *Tomado* lo que ya está vinculado en vez de esconderlo.

### Sin vínculo no se vende

Un producto sin `contificoProductoId` **no se puede agregar a una orden ni
contratar en una suscripción** — aparece en los selectores en gris, con el
motivo al pasar el mouse. Se valida en el servicio (`orden.service.ts`, `suscripcion.service.ts`),
no solo en la UI.

Esa regla es lo que hace que `emitirFactura` **no sincronice nada**: si una
orden existe, sus productos ya están vinculados. Antes sincronizaba al emitir, y
eso escondía la decisión de escribir en el catálogo ajeno detrás del botón de
facturar — el peor momento para descubrir un problema.

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

Hay dos formas de armar una orden, y las dos terminan en `crearOrden()`:

| Desde | Cómo | Cuándo conviene |
|---|---|---|
| `/dashboard/ordenes/nueva` | Se eligen productos, se ajusta precio/IVA por línea y se elige el cliente | Es el camino normal. Sirve igual para algo que no pasó por una visita |
| `generarOrden()` | Barrido: junta todo lo pendiente de un rango de fechas | Facturación de fin de mes de varios clientes |

El editor muestra, apenas se elige el cliente, un panel de **pendiente de
facturar**: visitas completadas de productos únicos y períodos de suscripción
todavía sin orden. Agregarlos como líneas conserva la procedencia
(`visitaServicioId`, o `suscripcionItemId` + `periodoInicio`), que es lo que
impide facturarlos dos veces — lo garantizan los índices únicos de
`OrdenLinea`, no la UI.

La descripción y el precio de la línea son un **snapshot**: se pueden editar
sin tocar el catálogo, y sobreviven a que después renombren o borren el
producto.

### Toda línea sale del catálogo

No hay líneas de texto libre. `detalles[]` exige `producto_id` y Contífico no
acepta descripciones sueltas, así que una línea sin producto sería una orden
imposible de cobrar — y el problema aparecería recién al emitir. Si hay que
cobrar algo que no está en el catálogo, se crea el producto primero.

Lo garantiza la base: `OrdenLinea.productoId` es **NOT NULL** y la FK es
`RESTRICT`, así que un producto ya vendido tampoco se puede borrar en duro —
perder ese vínculo dejaría la línea fuera de todo reporte por producto y la
factura sin con qué reconciliarse. (El portal borra en suave, así que en el uso
normal no cambia nada.) Los servicios y el schema de Zod lo validan antes, para
dar un mensaje útil en vez de un error de constraint.

### Lo que se factura junto se factura entero

`ensureTrabajoCompleto()` rechaza una orden que se lleve **parte** de una visita
o **parte** de un período: si toca una visita, entran todos los productos que a
esa visita le falten cobrar; si toca un período de un plan, entran todos los
ítems de ese plan para ese período.

Los índices únicos no alcanzaban. Garantizan que nada se cobre **dos veces**
—`visitaProductoId` es único y `[suscripcionItemId, periodoInicio]` también—
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
`suscripcionItemId` y líneas con `visitaProductoId`. Son dos conversaciones
distintas con el cliente: el plan es lo pactado y se renueva solo; la visita
suelta es algo que pasó y se cotiza. Juntarlas daba una orden cuyo total no se
podía explicar sin abrirla, y una factura que mezclaba la mensualidad con
trabajos puntuales.

**Lo agregado a mano entra en cualquiera de las dos** —es el extra sobre lo que
ya está— y una orden de puro trabajo a mano también vale.

Por eso `generarOrden()` devuelve **varias** órdenes: una por suscripción (sus
períodos agrupados por la cabecera del plan, no todos juntos) y otra con las
visitas sueltas. El armador de órdenes grisa lo que no combina con lo que ya
hay y dice por qué, en vez de dejar apretar y fallar.

### Lo que cubre un plan entra por procedencia, o a mano como extra

Un producto que **este cliente** tiene en una suscripción activa llega a una
orden de tres formas:

- `suscripcionItemId` + período → la renovación del plan;
- `visitaProductoId` → una visita que se hizo y **no** quedó cubierta;
- a mano desde el catálogo → un extra, sin procedencia.

**La tercera estuvo prohibida y ya no.** El argumento era que una línea a mano
no choca contra ningún índice único y el mismo trabajo podría cobrarse dos
veces. Pero esa protección **ninguna línea a mano la tiene**: dos órdenes con
"Poda" escrita a mano tampoco chocan contra nada. La regla no evitaba una clase
de error, evitaba un caso de un error que igual es posible en todos los demás —
y a cambio hacía imposible algo legítimo, como cobrarle un saco de más a alguien
que tiene ese producto en su plan.

Lo que sí protege la base sigue protegido: un período no se cobra dos veces
(`[suscripcionItemId, periodoInicio]`) y una visita tampoco (`visitaProductoId`).

El selector lo ofrece con la aclaración *"El cliente ya lo tiene en un plan.
Agregalo solo si es un extra"*. Lo único que sigue en gris es lo que **no se
puede facturar**: un producto sin vincular con Contífico.

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

Si la visita es de un mes futuro, el tope de fechas se estira **solo para las
visitas** (`hastaVisitas`): de otro modo, entrar desde una visita de septiembre
ofrecería de paso el período de suscripción de septiembre sin que nadie lo
pidiera.

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
las carreras — así que correrlo de más no rompe nada. Si un producto de la
suscripción quedó sin vincular a Contífico, **omite esa suscripción entera** y
lo reporta en la respuesta, en vez de generar una orden que después no se podría
emitir.

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

Los dos casos que **no** son deuda pero necesitan que alguien mire van como
avisos arriba de la tabla:

- **borradores** esperando revisión, que los crea el cron de renovaciones
  (`borradoresSinConfirmar`);
- **órdenes confirmadas sin factura** (`ordenesConfirmadasSinFactura`), o sea
  emisiones que fallaron. Con el flujo sano son cero, y por eso el aviso va en
  ámbar: si aparece, algo hay que arreglar.

Una factura que nunca se sincronizó no tiene saldo conocido; entra igual, con el
total como saldo y un `?` que lo aclara. No saber cuánto falta no es lo mismo
que saber que no falta nada.

### El borrador se edita, lo confirmado no

`actualizarOrden()` acepta cambios solo en `BORRADOR`: agregar o quitar líneas,
ajustar precios, cambiar las notas. Confirmada la orden es lo que se le va a
cobrar al cliente, y facturada Contífico no deja editarla por API — mover los
números después sería mentirle al historial.

Al editar, `lineas` **reemplaza el conjunto entero** y la procedencia viaja
intacta aunque cambien descripción o precio. Sacar una línea libera su
procedencia: ese período o esa visita vuelven a aparecer como pendientes, que es
justo lo que se espera. Y valen las mismas reglas que al crear —una sola función
las aplica a las dos— así que por la puerta de atrás no entra nada.

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

La acción principal de una orden es **"Registrar cobro"**, y por debajo
`cobrarOrden()` hace los tres pasos que hagan falta: confirma, emite y registra
el cobro. El orden **no se puede invertir** —un cobro se registra contra un
documento de Contífico, así que la factura tiene que existir antes—, pero quien
cobra no tiene por qué saberlo. Cada paso se saltea si ya está hecho, así que
reintentar después de una falla a mitad de camino es seguro.

Para vender a crédito está *"Emitir factura sin cobrar"* en el menú, que llama a
`confirmarYFacturar()`. **Si emitir falla, la orden queda `CONFIRMADA` igual** y
el motivo vuelve en `errorFactura` con HTTP 200: confirmar sí funcionó, y una
orden aprobada sin factura es exactamente lo que cuenta el aviso de "Por cobrar".
Verificado el 24/08/2026 desvinculando un producto — la orden quedó `CONFIRMADA`
con cero facturas y el mensaje diciendo cuál faltaba.

A nombre de quién sale la factura vive en `Orden.datoFacturacionId` y se elige
**mientras la orden es borrador**, junto con todo lo demás que se puede decidir.
No hay diálogo que lo pregunte al emitir: confirmada la orden, lo que se va a
cobrar ya está resuelto.

Emitir **no** manda nada al SRI: crea el documento en Contífico. La firma la
pone Contífico sola y la transmisión sale en su tanda horaria.

### Anular la orden anula su factura

`anularOrdenCompleta()` anula la factura y después la orden, en ese orden y sin
dejarlas nunca en desacuerdo. Anular es el final del camino: la orden no se
reabre ni se vuelve a facturar, y para cobrar ese trabajo se arma una orden
nueva.

**Y acá está la trampa que casi nos comemos.** `visitaProductoId` y
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
Contífico, `sincronizarFactura` devuelve la orden a `CONFIRMADA` en vez de
matarla: el trabajo sigue enlazado, no se pierde nada, y se emite otra factura o
se anula la orden por el camino explícito.

## Flujo de emisión

```
Orden CONFIRMADA
  ↓  validar cédula/RUC (módulo 10)
  ↓  verificar que cada producto tenga contificoProductoId (no se sincroniza acá)
  ↓  reservar secuencial
  ↓  POST /documento/  (cliente embebido, tipo FAC, electronico: true)
  ↓  guardar Factura + orden pasa a CONFIRMADA
```

Los productos ya están vinculados (sin eso la orden no existiría), así que
emitir no escribe nada en el catálogo.

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

Por eso existe `/api/cron/facturas`, cada hora —el mismo ritmo al que Contífico
procesa—: `sincronizarPendientes()` relee todas las facturas que todavía pueden
cambiar. El corte es *"ya no queda nada por saber"*: **anulada**, o **autorizada
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

## Pendiente

- **Sandbox propio.** El de pruebas actual es **compartido** entre integradores:
  2932 categorías, la mayoría basura ajena, y series de numeración ya usadas.
  Sirve para probar, pero no refleja lo que van a ver en producción. Ahí quedó
  `VF-I38L8PHP35`, el producto que el portal creó al probar la sincronización.
- **Punto de emisión propio** para el portal, declarado en el SRI.
- **Desde qué secuencial arrancar** en producción.
