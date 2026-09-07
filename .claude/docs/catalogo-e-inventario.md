# Catálogo: variantes, inventario e imágenes

**Producto** es el catálogo único: servicios de jardinería y bienes de vivero.
Lo que sigue es cómo se divide un bien en variantes, cómo se cuenta el stock y
dónde viven las fotos.

- Esquema: [`prisma/schema.prisma`](../../apps/admin/prisma/schema.prisma)
- Servicios: [`variante.service.ts`](../../apps/admin/src/lib/services/variante.service.ts),
  [`inventario.service.ts`](../../apps/admin/src/lib/services/inventario.service.ts),
  [`producto-imagen.service.ts`](../../apps/admin/src/lib/services/producto-imagen.service.ts)

## El modelo, que es el de Shopify

Un producto tiene **ejes** (`OpcionProducto`: Color, Tamaño), cada eje tiene
**valores** (`ValorOpcion`: Rojo, Azul), y una **variante** (`Variante`) es una
combinación concreta: "Rojo · Grande". Con 3 colores y 2 tamaños hay seis
variantes, y cada una es lo que se cuenta y lo que lleva su SKU.

```
Producto "Maceta"
├── Opción "Color"  → Rojo, Azul, Verde
├── Opción "Tamaño" → Grande, Chico
└── 6 variantes: Rojo·Grande, Rojo·Chico, Azul·Grande, …
```

**Solo los bienes.** Un servicio no tiene nada que combinar: lo que cambia de
una poda a otra es el precio, y eso vive en la orden, no en el catálogo.
`guardarOpciones()` lo rechaza y la ficha de un servicio no muestra la sección.

**Un bien sin opciones tiene una variante igual**, sin valores. Es lo que hace
que todo lo que pregunta "cuánto hay" mire siempre al mismo lado: no hay un
camino para el producto simple y otro para el que tiene combinaciones. Se crea
sola al dar de alta el bien (`asegurarVarianteUnica()`), hereda el código del
producto como SKU, y quien nunca usa opciones no se entera de que existen.

### La combinación es lo que la base garantiza

`Variante.combinacion` guarda los ids de sus valores en el orden de sus ejes,
unidos por `·`, y hay un único `[productoId, combinacion]`. Sin esa columna,
"un producto no puede tener dos variantes con los mismos valores" no se puede
expresar en SQL: la tabla puente sola no alcanza. Vacía en la variante única.

### Los ejes se editan en el lugar

Cada uno se muestra plegado a su resumen —nombre y valores— y se abre el que se
toca, ahí mismo, como en Shopify. Un diálogo para cambiar una palabra tapaba la
lista de variantes, que es justo lo que hay que mirar para saber si el cambio es
el que se quería.

*Listo* solo **pliega**: lo que se escribe ahí es un cambio del producto como
cualquier otro y se guarda con la barra del header. Un botón que guardara solo
esa parte convivía con otro que guarda todo, y nadie sabría cuál de los dos hace
falta.

Al guardar, los ejes van en **su propio pedido** (`PUT …/opciones`) después del
producto: regeneran las variantes, así que no son un campo sino una operación
del servidor — y es la que puede responder 409 cuando el cambio borra variantes
con stock. Esa confirmación aparece ahí, dentro del guardado.

Los valores se cargan de a uno **tipeando**: la última fila está vacía, escribir
en ella la convierte en un valor y abre otra debajo. La conversión es solo en
esa fila; borrar el texto de un valor del medio lo deja en blanco para
reescribirlo, en vez de hacerlo desaparecer bajo el cursor.

### Guardar los ejes es un reemplazo, no un parche

`guardarOpciones()` recibe el **estado final** —igual que `actualizarOrden()`
con sus líneas— y regenera las variantes. Lo que sobrevive es lo que sigue
teniendo sentido: una variante cuya combinación no cambió conserva su SKU, su
stock y su foto, porque es la misma cosa aunque se haya agregado otro eje.

**Los valores viajan con su id cuando ya existían.** Sin eso, renombrar "Rojo"
a "Rojo intenso" sería borrar un valor y crear otro, y las cuatro variantes
rojas se irían con su stock por un cambio de texto. Verificado: tras el rename,
la variante conserva su id y sus −2 unidades.

**Sacar un eje borra las variantes que dependían de él, y no en silencio.** Si
esas variantes tienen movimientos o stock ≠ 0, el servicio responde 409 con
*cuáles* y *con cuánto*, y hace falta `descartarVariantes: true` para seguir —
el mismo trato que anular una orden con trabajo enlazado. El mensaje se arma
con los nombres leídos **antes** de tocar nada: la cascada ya se llevó los
valores para cuando se lo escribe, y "Rojo · Grande" quedaba llamándose
"Grande" justo en el aviso que tiene que decir qué se pierde.

Topes: 3 ejes y 200 variantes. El segundo existe porque 5 ejes de 10 valores
son 100.000 filas y nadie quiso eso.

## El inventario se lleva en un libro

`MovimientoInventario` es el libro; `Variante.stock` es su saldo. **Nunca se le
escribe encima al saldo desde otro lado**: todo pasa por `moverStock()`, que
anota el movimiento y actualiza el saldo en la misma transacción.

Un número suelto contesta "cuánto hay" y ninguna otra pregunta: quién lo
cambió, cuándo, y contra qué. Cuando alguien discute un conteo, lo que se mira
es esto. Cada movimiento congela además su `saldo`, así que saber cómo estaba
el stock en una fecha no obliga a sumar el libro entero desde cero.

### Dos ajustes a la vez no se pisan

`moverStock()` toma la fila con `SELECT … FOR UPDATE` antes de leer el saldo.
Sin eso, dos ajustes simultáneos sobre la misma variante leen 10, escriben 12
los dos, y uno queda contado en el libro pero no en el saldo. Prisma no expone
`FOR UPDATE`, así que va como SQL.

### Contar es distinto de ajustar

Son tres preguntas y por eso son tres formas:

| Motivo | Qué se manda |
|---|---|
| `INGRESO` | cuánto **entró** |
| `AJUSTE` | cuánto **sumar o restar** (negativo resta) |
| `CONTEO` | cuánto **hay** |

Quien cuenta el estante no sabe qué decía el sistema, y hacerle restar la
diferencia a mano es pedirle la única cuenta que la máquina no puede errar.
`contarStock()` calcula el delta y lo guarda como el movimiento que lleva de un
número al otro, así que el libro sigue cerrando. Un conteo que da lo mismo no
anota nada: no pasó nada.

### Vender descuenta, y la nota de crédito devuelve

`OrdenLinea.varianteId` y `FacturaLinea.varianteId` dicen qué variante salió.
Son **nulables** porque un servicio no tiene ninguna; que un bien sí la lleve lo
exige `ensureVariantes()` en `orden.service`, que es quien sabe el `tipo` — la
base no puede expresar "obligatorio solo si el producto es un BIEN".

**Con una sola variante la completa sola.** Un bien sin opciones tiene
exactamente una, así que preguntar cuál sería preguntar por una decisión que no
existe — y los borradores que arma el portal solo (al completar una visita, al
renovar un plan) no tienen a quién preguntarle. Con varias corta y lo dice.

El orden de la emisión importa y no es simétrico:

1. **Antes de emitir**, `ensureStockParaVender()` mira si alcanza. Es el único
   momento en que se puede decir que no: después el comprobante ya está
   autorizado y no se deshace.
2. **Después de que el SRI autorizó**, `descontarPorVenta()` anota la salida
   con `forzar: true`. La venta ya es un hecho; negarse a registrarla no
   evitaría nada, dejaría el stock mintiendo sobre mercadería que salió por la
   puerta.
3. Una emisión **rechazada no descuenta nada**: el movimiento va dentro del
   `if (estado === "AUTORIZADO")`.

`emitirNotaCredito()` escribe la `DEVOLUCION`, y la ata **a la nota**, no a la
factura: son dos hechos con su propio comprobante. Una variante que aparece en
dos líneas de la misma factura se mueve una sola vez, con las cantidades
sumadas.

Verificado de punta a punta contra el SRI de pruebas: stock 12 → orden de 3 →
factura `001-001-000000010` autorizada → stock 9 con el movimiento
`VENTA -3 → 9 · Factura 001-001-000000010` → nota de crédito → stock 12. Una
orden de 99 sobre 12 se frenó **antes** de emitir y la orden quedó en
`BORRADOR`.

### Dos interruptores por variante

- **`manejaInventario`** — si se cuenta. Una planta sí; la tierra a granel
  quizá no. Apagarlo con stock cargado se rechaza: primero se ajusta a cero, y
  así queda anotado en el libro por qué dejó de haber.
- **`permiteNegativo`** — si se puede vender sin stock. Vender contra pedido es
  normal; que pase sin querer no lo es, y por eso se decide por variante y no
  una vez para todo el catálogo.

## La ficha del producto tiene dos formas

Copiadas de Shopify, porque resuelven bien el caso común:

**Sin opciones** —un bien con su variante única— el stock se muestra en una
card **Inventario** en la ficha misma: el número grande, *Ajustar*, el SKU y
los dos interruptores. A los ojos de quien mira, ese stock es del producto; por
debajo sigue siendo el de la variante única, así que agregar opciones después no
cambia nada del modelo. La card de **Variantes** ahí solo ofrece *Agregar
opciones como color o tamaño*: una tabla de una fila para decir "hay 12" es una
tabla de más.

**Con opciones** la card de Inventario desaparece —el stock es por combinación—
y la de Variantes muestra los ejes con sus valores y la lista: nombre, SKU y
cuánto hay. El nombre abre los ajustes de esa variante y el número abre el
movimiento: son las dos cosas que se hacen sobre una fila, y cada una tiene su
blanco en vez de un menú que las esconda a las dos.

**Con dos o más ejes** aparece *Agrupar por*, y las filas se pliegan por el
valor de uno de ellos. Con ejes de 3 y 6 valores son dieciocho filas y ninguna
se encuentra; agrupadas son tres, y se abre la que interesa.

El **historial de movimientos** va dentro del diálogo de ajuste, no en otra
pantalla: cuando alguien está por corregir un número, lo que le dice si confiar
en él es ver qué pasó antes.

La ficha es de **dos columnas**: a la izquierda lo que el producto *es* —qué es,
cómo se ve, cuánto hay—, a la derecha cómo se lo agrupa. Las categorías se
guardan al elegirlas, sin pasar por *Editar*: reagrupar un producto no es
editarlo, es una etiqueta que se pone y se saca mientras se ordena el catálogo.

## Biblioteca de medios

Hay tres niveles y cada uno contesta una pregunta distinta:

| | Qué es |
|---|---|
| **`Media`** | El archivo. Se sube una vez y vive en R2 |
| **`ProductoImagen`** | Qué archivos usa un producto, y en qué orden |
| **`Variante.imagenId`** | Cuál de esos representa a una variante |

Antes cada `ProductoImagen` era su propio objeto en R2, así que usar la misma
foto en dos productos eran **dos subidas**: dos objetos que pagar y, peor,
renombrar una dejaba a la otra vieja.

**Sacar una foto de un producto no la borra de la biblioteca**: sigue disponible
para otro. Borrarla de verdad es otra acción y la FK es `Restrict`, así que no
se puede mientras algún producto la use — el servicio lo chequea primero para
poder decir *cuántos* la usan, porque un error de foreign key no le explica nada
a nadie. Verificado: la misma foto en dos productos da `usos: 2` y el borrado se
rechaza nombrándolos.

`[productoId, mediaId]` es único, así que elegir de nuevo una foto que el
producto ya tiene no la duplica — se saltea, porque es un pedido sin efecto y no
un error.

### Fotos del producto, no de la variante

Lo que una foto muestra suele ser un eje solo —el color— así que colgarla de
cada combinación obligaría a subir la misma imagen una vez por talle: con 3
colores × 4 tamaños, la del rojo iría cuatro veces. La variante *elige* cuál de
las del producto es la suya, y la que no elige ninguna muestra la primera.

### La subida

Dos pasos, como la de una visita: `POST /api/media` devuelve URLs firmadas, el
navegador manda el archivo **directo a R2**, y `PUT` lo anota en la biblioteca.
Un archivo grande nunca pasa por el servidor. Si una de cinco falla, las otras
cuatro se guardan igual.

Solo `image/*`, y se valida en el servidor porque **el `contentType` es lo que
se firma**: R2 guarda lo que llegue con ese tipo, así que sin ese filtro un
pedido armado a mano deja un ejecutable guardado como foto de producto.

En pantalla hay tres caminos al mismo lugar —arrastrar encima, *Subir*, *Elegir
existente*— y el diálogo de la biblioteca también deja subir: quien vino a
elegir y no encuentra lo que busca no tiene por qué cerrar y empezar de nuevo.

`Media.nombre` es el nombre del archivo al subirlo, y es lo único con lo que se
puede buscar una imagen sin verla: el `key` es un uuid. Las que venían de antes
quedaron con ese uuid como nombre — se va a leer feo hasta que alguien las
renombre, que es la verdad y es mejor que un "sin nombre" que esconde el
problema.

## Un producto está en varias categorías

Era una columna (`Producto.categoriaId`), o sea una sola. Pero un rosal es
"Plantas" y también "Exterior", y con un casillero había que elegir cuál de las
dos verdades guardar. Ahora es `ProductoCategoria`, y `categoriaIds` reemplaza
el conjunto entero al guardar.

Borrar una categoría se lleva sus filas de la puente, no los productos: dejar
de agrupar algo no es darlo de baja.

## El precio de lista es una propuesta, no lo cobrado

`Variante.precio` es **lo que se propone** al armar una orden. Lo que se cobró
vive donde siempre: `OrdenLinea.precioUnitario`, un snapshot que es la verdad.
Tenerlos separados es lo que permite subir la lista sin reescribir lo ya vendido
— verificado: una línea cobrada a $18 se quedó en $18 después de llevar la lista
a $30.

**Es obligatorio, y cero quiere decir gratis.** Toda variante tiene precio,
aunque sea ninguno; quien quiera cobrar otra cosa lo cambia en la orden. Nació
nulable —para distinguir "se cotiza al vender" de "no cuesta nada"— y esa
distinción se descartó a propósito: no se usaba, y obligaba a que todo el código
tratara dos formas de "sin precio".

El costo de esa decisión es que **una variante recién creada nace en cero**, o
sea gratis, sin que nadie lo haya decidido. Por eso el cero no se muestra como
`$0.00` sino como **"Gratis" en ámbar**: casi siempre significa que todavía
falta ponerle precio, y así salta a la vista en la lista en vez de esconderse
entre los otros números. Y por eso vaciar el campo no guarda cero — repone lo
que decía: marcar algo como gratis es una decisión, y borrar un número mientras
se lo reescribe no lo es.

**El precio sigue a la lista mientras nadie lo haya tocado**
(`precioAlCambiarVariante()`): si el campo está vacío o todavía dice el precio
de la variante anterior, pasa al de la nueva; si alguien escribió otro número,
ese manda. Cambiar a una variante gratis **propone 0 de verdad**, que es lo que
la versión nulable no podía hacer: dejaba el número anterior. Pisarlo sería tirar lo que la persona acaba de decidir, que es
justamente lo que un precio de lista no puede hacer. Es la misma regla que ya
usa la cantidad al marcar visitas.

**El armador de la factura no propone precio**, a diferencia de la orden. Una
línea del documento existe para repartir lo que la orden ya dice; proponerle un
precio de catálogo la haría nacer descuadrada, y el cuadre es lo único que esa
pantalla no negocia.

Un **servicio no tiene precio de lista** porque no tiene variantes: una poda se
cotiza cada vez. Si algún día hace falta, el lugar es una
variante única de servicio — no una columna nueva en `Producto`.

## El SKU y el código

El `codigoPrincipal` de cada detalle del XML sale, en este orden:

1. **`Variante.sku`** — lo que identifica exactamente lo que salió, y lo que
   está pegado en la etiqueta que el cliente tiene en la mano;
2. **`Producto.codigo`** — para un servicio, que no tiene variantes;
3. un código derivado del id, si no hay ninguno de los dos.

Verificado sobre el XML firmado de `001-001-000000010`:
`<codigoPrincipal>MAC-ROJ-…</codigoPrincipal>` con
`<descripcion>Maceta roja</descripcion>` — el SKU de la variante, no el código
del producto.

## Por qué al facturar y no al crear la orden

Un borrador se edita, se descarta y se rearma; descontar ahí dejaría mercadería
reservada por algo que puede no pasar, y habría que devolverla al editar la
orden, al quitar la línea y al anularla — tres caminos donde olvidarse. Al
facturar hay un solo momento y un solo comprobante que lo respalda.

El costo es que dos personas pueden armar órdenes por la misma mercadería y la
segunda se entera recién al emitir. Es el precio de no reservar, y es el
correcto para un vivero: entre armar la orden y cobrarla pasan minutos, no
semanas.

## Lo que falta

- **Una pantalla de inventario.** Hoy el stock se mira y se mueve desde la
  ficha de cada producto. `sinStock()` ya existe en el servicio para "qué está
  por agotarse", pero nada lo muestra todavía.
- **Las órdenes viejas no tienen variante.** Se quedan así: son de servicios, o
  se emitieron antes de que las variantes existieran, y rellenarlas sería
  inventar que alguien la eligió.
