-- Precio de lista por variante.
--
-- Es lo que se **propone** al armar una orden, no lo que se cobró: eso sigue en
-- `OrdenLinea.precioUnitario`, que es un snapshot y es la verdad. Separarlos es
-- lo que permite subir la lista sin reescribir lo ya vendido.
--
-- Nulo a propósito, y sin default: un bien puede cotizarse por trabajo, y un
-- cero haría que una orden nazca diciendo que algo vale nada.
ALTER TABLE "Variante" ADD COLUMN "precio" DECIMAL(10,2);
