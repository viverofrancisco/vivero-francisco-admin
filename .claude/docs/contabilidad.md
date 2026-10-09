# Contabilidad

El portal va a **reemplazar a Contífico** (hoy *Siigo Contífico*), donde el vivero
lleva la contabilidad. No se conecta a él: se construye la contabilidad completa en
el portal, por partes, y Contífico se apaga cuando el portal cubra todo. Hasta
entonces **Contífico sigue facturando y declarando**. Las facturas electrónicas del
portal existen pero no se usan todavía: arrancan cuando la contabilidad del portal
funcione como se necesita.

El estudio de qué tiene Contífico, qué exige la ley ecuatoriana (SRI, IESS,
Superintendencia de Compañías) y el plan por fases quedó fuera del repo, en
`../research_notes/Contabilidad estilo Contífico/` y
`../reports/Contabilidad estilo Contífico.md`.

## Orden de construcción

1. **Plan de cuentas, centros de costo y obras** — hecho (oct-2026).
2. Proveedores y compras: cada línea va al inventario o directo a una obra o gasto.
3. Inventario con costo (promedio) y **salidas a obra**.
4. Libro diario con asientos automáticos (ventas, cobros, compras, consumos) y
   manuales.
5. Reportes: mayor, balance de comprobación, estado de resultados y **cuánto deja
   cada obra**.
6. Después: retenciones electrónicas y formularios 103/104/ATS, bancos y
   conciliación, activos fijos, nómina, cierre anual.

## Plan de cuentas

`CuentaContable`: un árbol de códigos punteados (`1`, `1.1`, `1.1.1`…), cada cuenta
de **grupo** (agrupa) o de **detalle** (recibe movimientos). Arrancó como copia del
plan del vivero en Contífico —584 cuentas, 90 de grupo y 494 de detalle, en el
modelo de la Superintendencia de Compañías bajo NIIF— y se edita desde
*Contabilidad → Plan de cuentas* (`cuenta-contable.service.ts`, ADMIN y STAFF).

Reglas, todas en el servicio:

- El código de una hija es **el de su padre más un segmento**; una raíz lleva un solo
  número. El diálogo propone el siguiente libre.
- **El código no se cambia** después de crear la cuenta: ordena el árbol y nombra la
  cuenta en los asientos. El nombre sí se corrige.
- Solo un grupo tiene hijas. Un grupo con hijas no pasa a detalle.
- **Desactivar baja** a todo lo que cuelga de la cuenta; **activar sube** a sus
  padres. Una inactiva no se ofrece para nuevos movimientos pero sigue en el árbol.
  Las que en Contífico decían *NO UTILIZAR* entraron inactivas.
- Borrar es solo para la cuenta creada por error: sin hijas (y, cuando haya asientos,
  sin movimientos). La que se dejó de usar se desactiva.
- La **naturaleza** (deudora/acreedora) no se guarda: sale del primer dígito
  (`naturalezaDeCuenta` en `@vivero/shared`): 2, 3 y 4 son acreedoras; el resto,
  deudoras.

## Centros de costo y obras

Son **dos etiquetas distintas**, y cada movimiento lleva su centro de costo y, si es
de una obra, también la obra:

- **`CentroCosto`** — las partes de la empresa: *Administración*, *Vivero
  Hipódromo*, *Vivero Aurora*, *Mantenimiento* y *Obras* (los cinco los crea la
  migración `20261009230000_centros_de_costo`). Pocos y permanentes; responden
  "¿cuánto cuesta y cuánto deja cada parte del vivero?". Se desactivan en vez de
  borrarse si tienen obras. `centro-costo.service.ts`, en *Contabilidad → Centros de
  costo*.
- **`Obra`** — cada trabajo puntual: tiene principio y fin, cliente y propiedad
  opcionales (las importadas llegan solo con su nombre), presupuesto sin IVA, fechas
  y notas, y pertenece a un centro de costo (una nueva va a *Obras* por defecto).
  Responde "¿cuánto dejó esta obra?". Estado `EN_CURSO` / `TERMINADA` /
  `CANCELADA`; la lista arranca en las en curso. Archivar es soft (`deletedAt`): los
  asientos que la citen tienen que seguir diciendo de qué obra eran.
  `obra.service.ts`, en *Obras*.

**Por qué dos y no una.** En Contífico el vivero tenía una sola etiqueta, el centro
de costo, y ahí metía las obras —unas 60— mezcladas con tres áreas (*Mantenimiento*,
*Sector Hipódromo*, *Aurora*). Contífico tiene también *proyectos*
(*Contabilidad → Centros de Costos → pestaña Proyectos*: nombre y estado, y se le
pone a cada documento aparte del centro de costo), que es exactamente lo que son las
obras, pero el plan contratado por el vivero no muestra esa pestaña. Como una obra
termina y un área no, en Contífico todas quedaban *Activo* para siempre: al
importarlas entran todas *En curso* y hay que marcar a mano las terminadas.

**Por qué el inventario tiene que pasar por la obra.** En Contífico la mayoría de
las compras se registran directo al costo (la categoría del producto lleva la cuenta
`5.1.1.1.x`), así que hay que decidir a qué obra cargarlas en el momento de comprar,
cuando todavía no se sabe dónde se va a usar ni cuánto. Por eso no se sabe cuánto
deja cada obra. Acá la compra entra al **inventario** y la **salida a obra** —"Casa
del Sol: 30 sacos"— es la que se vuelve costo de esa obra, a costo promedio; lo que
sobra queda en bodega para otra. Lo que no tiene sentido inventariar (combustible,
alimentación) se carga directo a la obra al registrar la compra.

## Importar desde Contífico

```bash
CONTIFICO_IMPORT_API_KEY=… npx tsx --env-file=.env scripts/importar-contifico.ts
# --solo-plan | --solo-obras
```

La clave va en su propia variable, no en `CONTIFICO_API_KEY`, porque es la del
vivero y en el `.env` de desarrollo esa variable apunta a la cuenta de prueba (la
del vivero está comentada al lado). Solo lee. Es idempotente por `contificoId`:
volver a correrlo actualiza nombres sin pisar lo editado en el portal. Los centros de
Contífico cuyo nombre dice *mantenimiento*, *hipódromo* o *aurora* se enlazan a su
centro de costo del portal (por `contificoId`); el resto entra como obra del centro
*Obras*. El grupo raíz (*VIVERO FRANCISCO SAS*) es la empresa entera y se salta.

**Trampas de la API de Contífico** (ver también el cliente viejo en el historial de
git, `apps/admin/src/lib/contifico/client.ts` antes de `5235497`):

- La clave va cruda en `Authorization`, sin `Bearer`. Una clave inválida da **401**;
  si se manda con basura pegada (por ejemplo leída mal de una línea comentada: el
  `sed` de macOS no entiende `\s`) Contífico responde **500 con una página HTML**, no
  401.
- `GET /producto/` sin filtro se cuelga. Las fechas van `DD/MM/YYYY`.
- Lo que la API **no** entrega —la tabla de retenciones configurada, los parámetros y
  cuentas de nómina, un ATS de ejemplo— está solo en la interfaz web.
- Lo que se vio en la cuenta (9-oct-2026): plan `1`–`5` con códigos punteados; 63
  centros de costo (1 grupo con 46 obras debajo, 16 sueltos); 3 cuentas bancarias
  (`1.1.1.3.x`); categorías con `cuenta_venta`/`cuenta_compra`/`cuenta_inventario`;
  en septiembre, 32 facturas electrónicas (serie `001-001`), 19 *DNA* (notas
  internas de mantenimiento) y 4 *DAC* (anticipos de clientes).
