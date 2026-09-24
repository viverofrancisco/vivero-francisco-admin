-- Las tres versiones de una foto de chat: móvil (480), tablet (1024) y escritorio (2048).
ALTER TABLE "ChatAdjunto"
  ADD COLUMN "urlMovil" TEXT,
  ADD COLUMN "urlTablet" TEXT,
  ADD COLUMN "urlEscritorio" TEXT;
