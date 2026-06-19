import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { VisitaChatPanel } from "@/components/visitas/visita-chat-panel";
import { VisitaInfoSidebar } from "@/components/mensajes/visita-info-sidebar";
import { nombreCliente } from "@vivero/shared";

export default async function VisitaChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitaId: string }>;
  searchParams: Promise<{ search?: string; messageId?: string }>;
}) {
  await requireAuth();
  const { visitaId } = await params;
  const { search, messageId } = await searchParams;

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId, deletedAt: null },
    include: {
      clienteServicio: {
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              empresa: true,
              telefono: true,
              direccion: true,
              ciudad: true,
              sector: { select: { nombre: true } },
            },
          },
          servicio: { select: { id: true, nombre: true } },
        },
      },
      personal: {
        where: { removedAt: null },
        include: {
          personal: {
            select: { id: true, nombre: true, apellido: true, tipo: true },
          },
        },
      },
      media: {
        select: { id: true, url: true, tipo: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!visita) notFound();

  const cliente = visita.clienteServicio.cliente;
  const clienteName = nombreCliente(cliente);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/dashboard/mensajes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{clienteName}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {visita.clienteServicio.servicio.nombre}
          </p>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <VisitaChatPanel
          visitaId={visita.id}
          initialSearch={search}
          initialMessageId={messageId}
          fillHeight
        />
        <div className="hidden lg:block min-h-0">
          <VisitaInfoSidebar visita={visita} />
        </div>
      </div>
    </div>
  );
}
