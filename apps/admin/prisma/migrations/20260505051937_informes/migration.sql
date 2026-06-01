-- CreateTable
CREATE TABLE "TipoActividad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcionTemplate" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Informe" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3),
    "fechaHasta" TIMESTAMP(3),
    "pdfKey" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Informe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformeVisita" (
    "informeId" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,

    CONSTRAINT "InformeVisita_pkey" PRIMARY KEY ("informeId","visitaId")
);

-- CreateTable
CREATE TABLE "InformeSeccion" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "tipoActividadId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "mediaIds" TEXT[],

    CONSTRAINT "InformeSeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "firmante1Nombre" TEXT,
    "firmante1Cedula" TEXT,
    "firmante2Nombre" TEXT,
    "firmante2Cedula" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Informe_clienteId_idx" ON "Informe"("clienteId");

-- CreateIndex
CREATE INDEX "Informe_generatedAt_idx" ON "Informe"("generatedAt");

-- CreateIndex
CREATE INDEX "InformeVisita_visitaId_idx" ON "InformeVisita"("visitaId");

-- CreateIndex
CREATE INDEX "InformeSeccion_informeId_idx" ON "InformeSeccion"("informeId");

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeVisita" ADD CONSTRAINT "InformeVisita_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeVisita" ADD CONSTRAINT "InformeVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeSeccion" ADD CONSTRAINT "InformeSeccion_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeSeccion" ADD CONSTRAINT "InformeSeccion_tipoActividadId_fkey" FOREIGN KEY ("tipoActividadId") REFERENCES "TipoActividad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
