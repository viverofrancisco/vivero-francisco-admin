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

`VENTA` y `DEVOLUCION` están en el enum pero **todavía nada los escribe** — ver
*Lo que falta*.

### Dos interruptores por variante

- **`manejaInventario`** — si se cuenta. Una planta sí; la tierra a granel
  quizá no. Apagarlo con stock cargado se rechaza: primero se ajusta a cero, y
  así queda anotado en el libro por qué dejó de haber.
- **`permiteNegativo`** — si se puede vender sin stock. Vender contra pedido es
  normal; que pase sin querer no lo es, y por eso se decide por variante y no
  una vez para todo el catálogo.

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

## El SKU y el código

Hoy conviven dos:

- **`Producto.codigo`** es lo que sale impreso como `codigoPrincipal` en cada
  detalle del XML del SRI. Es lo que tiene un servicio, que no tiene variantes.
- **`Variante.sku`** es el identificador de esa combinación: lo que va en la
  etiqueta y lo que se busca. Único en todo el catálogo.

Cuando vender pase a ser por variante (abajo), el `codigoPrincipal` va a salir
del SKU y `Producto.codigo` deja de tener sentido. Todavía no: una línea de
orden apunta a un producto, no a una variante.

## Lo que falta

- **Vender una variante.** `OrdenLinea` y `FacturaLinea` apuntan a `Producto`.
  Para que una venta descuente stock hay que llevar la variante hasta ahí, que
  el `codigoPrincipal` salga de su SKU, y escribir el movimiento `VENTA` **al
  facturar** — no al crear la orden: un borrador se edita y se descarta, y
  descontar ahí dejaría mercadería reservada por algo que puede no pasar.
  Anular la factura escribe la `DEVOLUCION`.
- **`MovimientoInventario` no tiene `facturaId`.** Se agrega con eso, no antes:
  una columna que nada escribe ni lee es peso muerto.
- **Precio por variante.** Hoy ningún producto tiene precio: cada peso vive en
  `OrdenLinea` o en `SuscripcionItem`. Si un bien de mostrador necesita precio
  de lista, ese es el momento de decidir dónde va.
