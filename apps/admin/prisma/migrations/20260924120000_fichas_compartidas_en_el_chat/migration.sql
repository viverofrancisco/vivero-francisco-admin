-- Una ficha compartida en un mensaje: visita, cliente o producto, con su copia.
ALTER TABLE "ChatMensaje" ADD COLUMN "referencia" JSONB;
