# Base de datos y migraciones

PostgreSQL en Neon, vía `@prisma/adapter-pg`. El cliente generado está
**commiteado** en `apps/admin/src/generated/prisma` — se importa desde
`@/generated/prisma/client`, nunca desde `@prisma/client`.

## Entornos

Neon usa *branches*: cada uno es una copia con su propia connection string.

| Branch | Para qué |
|---|---|
| `production` | La app en producción. **Nunca apuntar el `.env` local acá.** |
| branch de desarrollo | Copia de producción. Es lo que va en el `.env` local. |

El `.env` local debe apuntar **siempre** al branch de desarrollo. Antes de
correr cualquier cosa que escriba, conviene confirmar contra qué base se está
trabajando:

```bash
grep -m1 '^DATABASE_URL=' apps/admin/.env | sed -E 's|://[^:]+:[^@]+@|://USER:PASS@|'
npm run migrate:status
```

Cuando el branch de desarrollo se aleja demasiado, se crea uno nuevo desde
producción y se actualiza el `.env`.

## Migraciones

```bash
npm run migrate:dev      # crea + aplica una migración (desarrollo)
npm run migrate:status   # qué hay aplicado y qué falta
npm run migrate:deploy   # aplica pendientes sin generar nada (producción)
```

### En cada deploy se aplican solas

El build de `apps/admin` corre `prisma migrate deploy` antes de `next build`:

```json
"build": "prisma migrate deploy && next build"
```

`migrate deploy` solo aplica lo que ya está en `prisma/migrations`: nunca genera
migraciones nuevas ni borra datos, así que es seguro en producción. Si una
migración falla, el build falla y no se despliega código contra un esquema que
no le corresponde.

Para compilar sin tocar la base (por ejemplo en CI sin `DATABASE_URL`):

```bash
npm run build:sin-migrar -w apps/admin
```

**Ojo con los branches dormidos.** Neon suspende los branches por inactividad,
así que el primer intento puede fallar con `Error: P1002` (no se pudo alcanzar
la base) mientras despierta. Reintentar alcanza. Si pasa seguido en los deploys,
conviene despertar la base antes del build.

### Escribir la migración a mano cuando hay datos en juego

`prisma migrate dev` genera el SQL comparando esquemas, y **no sabe distinguir
un rename de un drop + create**. Para renombrar, cambiar el tipo de una columna
o dividir un campo en dos, hay que editar el `migration.sql` a mano:

```bash
npx prisma migrate dev --name lo_que_sea --create-only   # crea sin aplicar
# editar prisma/migrations/<timestamp>_lo_que_sea/migration.sql
npm run migrate:deploy
```

Después, confirmar que el esquema y la base coinciden:

```bash
npx prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --script
# tiene que decir: "This is an empty migration."
```

**El orden importa.** Siempre: crear lo nuevo → backfillear → recién ahí borrar
lo viejo. Un `ADD COLUMN ... NOT NULL` sobre una tabla con filas falla; se
agrega nullable, se backfillea y después se marca `NOT NULL`.

**Al endurecer una columna, fallá con un mensaje que sirva.** Un
`SET NOT NULL` sobre datos sucios muere con *"null value violates not-null
constraint"* y nada más, en medio de un deploy. Un chequeo previo cuesta cinco
líneas y dice qué mirar:

```sql
DO $$
DECLARE huerfanas INT;
BEGIN
  SELECT COUNT(*) INTO huerfanas FROM "OrdenLinea" WHERE "productoId" IS NULL;
  IF huerfanas > 0 THEN
    RAISE EXCEPTION 'Hay % línea(s) sin producto. Asignales uno antes: SELECT ...', huerfanas;
  END IF;
END $$;
```

El deploy falla igual —que es lo correcto: nadie debería decidir en automático
qué hacer con esas filas— pero quien lo lee sabe qué hacer.

Ejemplos en el repo que vale la pena mirar antes de escribir una:

| Migración | Qué resuelve |
|---|---|
| `20260820120000_visita_multi_servicio_e_informe_secciones` | FK simple → tabla intermedia, con backfill |
| `20260820220000_servicio_a_producto` | `ALTER TABLE ... RENAME` preservando datos, y un enum dividido en dos |
| `20260820223140_libro_de_ventas` | Tablas nuevas + backfill de `ivaTasa` desde el monto |
| `20260821180000_datos_de_facturacion` | Tabla nueva + backfill desde campos sueltos del Cliente |
| `20260821200000_orden_linea_producto_obligatorio` | Nullable → NOT NULL con chequeo previo que falla con un mensaje útil |
| `20260821220000_visita_producto_sin_precio` | `RENAME TO` de tabla + índices y constraints, que arrastran el nombre viejo |
| `20260822150000_visitas_por_periodo` | `RENAME COLUMN` + conversión de unidad: el valor era mensual y pasa a ser por período, así que se multiplica por los meses del ciclo |
| `20260822160000_periodicidad_solo_en_suscripcion` | `DROP COLUMN` de un campo que nada leía, con el motivo escrito arriba |
| `20260823160000_producto_sin_modalidad` | `DROP COLUMN` + `DROP TYPE`: la etiqueta global se reemplaza por una pregunta por cliente, y el SQL explica dónde |

### Índices que Prisma no sabe expresar

Un índice único parcial (`WHERE ... IS NULL`) o un `CHECK` hay que escribirlos a
mano en el `migration.sql`. Prisma no los conoce, así que **el próximo
`migrate dev` va a querer borrarlos**: hay que sacar esa línea del SQL generado
antes de aplicarlo.

## Verificar contra datos reales

Compilar no alcanza: un `include` mal escrito typechea y explota en runtime. El
patrón que se usa en este repo es un script temporal con `tsx`:

```ts
import "dotenv/config";           // ← primero, antes de importar nada más

async function main() {
  // Import dinámico: el cliente de Prisma se crea al importarse, y con un
  // `import` estático se instancia antes de que dotenv cargue DATABASE_URL.
  const { prisma } = await import("@/lib/prisma");
  // ...
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
```

```bash
cd apps/admin && npx tsx script.ts && rm script.ts
```

Dos reglas para estos scripts:

1. **Limpiar en un `finally`**, para que un fallo a mitad no deje basura.
2. **Comparar conteos al final** contra los de antes. Si algo no se limpió, se
   nota ahí y no dos días después. (Un `catch` vacío al borrar puede tapar un
   `Restrict` de una FK y dejar filas colgadas.)

## Convenciones del esquema

- **Soft delete** (`deletedAt`) en Cliente, Producto, Personal, Grupo, Visita,
  Sector. Toda consulta de negocio filtra `deletedAt: null`.
- **Auditoría** `createdById` / `updatedById` con `onDelete: SetNull` en casi
  todos los modelos. Al agregar un modelo con auditoría hay que sumar las
  relaciones inversas en `User` o Prisma no valida.
- **Plata** en `Decimal(10,2)`; **tasas de IVA** en `Decimal(5,2)`, siempre como
  porcentaje y no como monto — un monto fijo no prorratea y se desactualiza al
  cambiar el precio.
- **Fechas sin hora** (`fechaProgramada`, `periodoInicio`) con `@db.Date`, y se
  construyen en UTC (`Date.UTC(...)`) para que no se corran por zona horaria.
