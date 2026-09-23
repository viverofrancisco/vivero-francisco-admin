-- El id que le puso el cliente al mensaje, para que un reintento no lo
-- duplique. Único por chat; los NULL (los mensajes de antes) no chocan.
ALTER TABLE "ChatMensaje" ADD COLUMN "idCliente" TEXT;
CREATE UNIQUE INDEX "ChatMensaje_chatId_idCliente_key" ON "ChatMensaje"("chatId", "idCliente");

-- Quién leyó cada mensaje y cuándo.
CREATE TABLE "ChatLectura" (
    "mensajeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leidoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLectura_pkey" PRIMARY KEY ("mensajeId","userId")
);
CREATE INDEX "ChatLectura_userId_idx" ON "ChatLectura"("userId");
ALTER TABLE "ChatLectura" ADD CONSTRAINT "ChatLectura_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "ChatMensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatLectura" ADD CONSTRAINT "ChatLectura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo ya leído según `ChatMiembro.leidoEl`: cada miembro leyó todo lo que era
-- anterior a su marca. La hora es la de la marca, que es lo más cerca que se
-- puede estar sin haberlo anotado en su momento.
INSERT INTO "ChatLectura" ("mensajeId", "userId", "leidoEl")
SELECT m."id", mi."userId", mi."leidoEl"
FROM "ChatMensaje" m
JOIN "ChatMiembro" mi ON mi."chatId" = m."chatId"
WHERE mi."leidoEl" IS NOT NULL
  AND m."createdAt" <= mi."leidoEl"
  AND (m."autorId" IS NULL OR m."autorId" <> mi."userId")
ON CONFLICT DO NOTHING;
