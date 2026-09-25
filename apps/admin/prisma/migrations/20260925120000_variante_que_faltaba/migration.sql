-- La variante que le faltaba a algunos productos.
--
-- Todo producto tiene **al menos** una variante desde
-- `20260907210000_todo_producto_tiene_variante`: es lo que se vende, y de ahí
-- salen el SKU impreso, el precio propuesto y el stock. El servicio la crea
-- con el producto, pero el seed de datos de prueba (`--catalogo`) los creaba
-- con `prisma.producto.create` a secas, y esos productos quedaban sin nada que
-- vender: en el portal la orden fallaba al guardar ("no tiene ninguna variante
-- para vender") y en la app no se podían marcar.
--
-- Misma sentencia que aquella migración, idempotente: solo toca los que no
-- tienen ninguna. Sin SKU, porque `Producto.codigo` ya no existe; el código
-- impreso se deriva del id, como en cualquier variante sin SKU.
INSERT INTO "Variante" ("id", "productoId", "sku", "combinacion", "manejaInventario", "permiteNegativo", "posicion", "precio", "cobraIva")
SELECT gen_random_uuid()::text, p."id", NULL, '', p."tipo" = 'BIEN', false, 0, 0, true
FROM "Producto" p
WHERE NOT EXISTS (SELECT 1 FROM "Variante" v WHERE v."productoId" = p."id");
