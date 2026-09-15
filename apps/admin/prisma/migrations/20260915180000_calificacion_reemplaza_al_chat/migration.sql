-- El chat de la visita se va; en su lugar, el cliente califica.
--
-- El chat pedía que alguien estuviera del otro lado —alguien de la oficina
-- mirando una bandeja— y en la práctica no lo usó nadie: se creó, se sembró
-- en desarrollo y nunca entró en producción. La calificación pide una sola
-- cosa, en el único momento en que el cliente tiene algo que decir: cuando el
-- trabajo terminó.
--
-- Las tres tablas del chat se borran con su contenido. Eso es irreversible, y
-- se hace porque no hay contenido real que perder: en producción nunca se
-- usaron. Las fotos que hubiera en R2 quedan huérfanas ahí, sin fila que las
-- nombre; no se borran desde acá porque una migración no habla con R2.
DROP TABLE IF EXISTS "VisitaMessageMedia";
DROP TABLE IF EXISTS "VisitaMessage";
DROP TABLE IF EXISTS "VisitaChatRead";

-- Una calificación por visita: el único lo garantiza, y por eso no hace falta
-- preguntar "¿ya calificó?" en ningún lado — se pregunta por la fila.
CREATE TABLE "CalificacionVisita" (
    "id"         TEXT NOT NULL,
    "visitaId"   TEXT NOT NULL,
    "estrellas"  INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalificacionVisita_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalificacionVisita_visitaId_key" ON "CalificacionVisita"("visitaId");

ALTER TABLE "CalificacionVisita"
  ADD CONSTRAINT "CalificacionVisita_visitaId_fkey"
  FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CalificacionVisitaFoto" (
    "id"             TEXT NOT NULL,
    "calificacionId" TEXT NOT NULL,
    "key"            TEXT NOT NULL,
    "url"            TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalificacionVisitaFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalificacionVisitaFoto_calificacionId_idx" ON "CalificacionVisitaFoto"("calificacionId");

ALTER TABLE "CalificacionVisitaFoto"
  ADD CONSTRAINT "CalificacionVisitaFoto_calificacionId_fkey"
  FOREIGN KEY ("calificacionId") REFERENCES "CalificacionVisita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
