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

## Las fotos son del producto, la variante elige la suya

`ProductoImagen` cuelga del **producto**. `Variante.imagenId` apunta a una de
ellas, y la que no apunta a ninguna muestra la primera.

Colgar las fotos de la variante era la otra opción y es peor: lo que una foto
muestra suele ser un eje solo —el color— así que con 3 colores × 4 tamaños la
foto del rojo habría que subirla cuatro veces, una por talle. Con la galería en
el producto se sube una vez y las cuatro variantes rojas apuntan ahí.

La subida es en **dos pasos**, como la de una visita: `POST` devuelve URLs
firmadas, el navegador manda el archivo directo a R2, y `PUT` confirma lo que
llegó. Un archivo grande nunca pasa por el servidor. Si una de cinco falla, las
otras cuatro se guardan igual.

Solo `image/*`, y se valida en el servidor porque **el `contentType` es lo que
se firma**: R2 guarda lo que llegue con ese tipo, así que sin ese filtro un
pedido armado a mano deja un ejecutable guardado como foto de producto.

Borrar una foto deja sin foto propia a la variante que la señalaba
(`onDelete: SetNull`) y la manda de vuelta a la primera. El objeto de R2 se
borra **después** de la fila: al revés quedaría una fila apuntando a un archivo
que no existe.

## Un producto está en varias categorías

Era una columna (`Producto.categoriaId`), o sea una sola. Pero un rosal es
"Plantas" y también "Exterior", y con un casillero había que elegir cuál de las
dos verdades guardar. Ahora es `ProductoCategoria`, y `categoriaIds` reemplaza
el conjunto entero al guardar.

Borrar una categoría se lleva sus filas de la puente, no los productos: dejar
de agrupar algo no es darlo de baja.

## El precio de lista es una propuesta, no lo cobrado

`Variante.precio` es opcional y es **lo que se propone** al armar una orden.
Lo que se cobró vive donde siempre: `OrdenLinea.precioUnitario`, un snapshot
que es la verdad. Tenerlos separados es lo que permite subir la lista sin
reescribir lo ya vendido — verificado: una línea cobrada a $18 se quedó en $18
después de llevar la lista a $30.

**Nulo es una respuesta distinta de cero.** Un bien puede cotizarse por trabajo,
igual que un servicio, y un cero haría que la orden nazca diciendo que algo vale
nada. En la lista de variantes eso se ve como un guión.

**El precio sigue a la lista mientras nadie lo haya tocado**
(`precioAlCambiarVariante()`): si el campo está vacío o todavía dice el precio
de la variante anterior, pasa al de la nueva; si alguien escribió otro número,
ese manda. Pisarlo sería tirar lo que la persona acaba de decidir, que es
justamente lo que un precio de lista no puede hacer. Es la misma regla que ya
usa la cantidad al marcar visitas.

**El armador de la factura no propone precio**, a diferencia de la orden. Una
línea del documento existe para repartir lo que la orden ya dice; proponerle un
precio de catálogo la haría nacer descuadrada, y el cuadre es lo único que esa
pantalla no negocia.

Un **servicio no tiene precio de lista** porque no tiene variantes, y es fiel al
dominio: una poda se cotiza cada vez. Si algún día hace falta, el lugar es una
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
