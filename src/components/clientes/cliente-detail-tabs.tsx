"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { ClienteServiciosTable } from "@/components/clientes/cliente-servicios-table";
import { ClienteServicioForm } from "@/components/clientes/cliente-servicio-form";
import { VisitasTable } from "@/components/visitas/visitas-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ServicioCatalogo {
  id: string;
  nombre: string;
  tipo: string;
}

interface Asignacion {
  id: string;
  servicioId: string;
  precio: number;
  iva: number;
  frecuenciaMensual: number | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  notas: string | null;
  servicio: ServicioCatalogo;
}

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  clienteServicio: {
    cliente: { id: string; nombre: string };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: { id: string; nombre: string } | null;
}

interface ClienteData {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
}

interface ClienteDetailTabsProps {
  cliente: ClienteData;
  asignaciones: Asignacion[];
  serviciosCatalogo: ServicioCatalogo[];
  visitas: VisitaRow[];
}

export function ClienteDetailTabs({
  cliente,
  asignaciones,
  serviciosCatalogo,
  visitas,
}: ClienteDetailTabsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Asignacion | null>(null);

  const handleEdit = (asignacion: Asignacion) => {
    setEditData(asignacion);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditData(null);
  };

  const visitasProgramadas = visitas.filter((v) => v.estado === "PROGRAMADA").length;

  return (
    <>
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="servicios">
            Servicios ({asignaciones.length})
          </TabsTrigger>
          <TabsTrigger value="visitas">
            Visitas ({visitas.length})
            {visitasProgramadas > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {visitasProgramadas} pendientes
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ClienteForm initialData={cliente} />
        </TabsContent>

        <TabsContent value="servicios">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link href="/dashboard/servicios/asignar">
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Asignar Servicio
                </Button>
              </Link>
            </div>

            {asignaciones.length === 0 ? (
              <EmptyState message="No hay servicios asignados" />
            ) : (
              <ClienteServiciosTable
                clienteId={cliente.id}
                asignaciones={asignaciones}
                onEdit={handleEdit}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="visitas">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link href="/dashboard/visitas">
                <span className="text-sm text-green-700 hover:underline">
                  Ver todas las visitas →
                </span>
              </Link>
            </div>

            {visitas.length === 0 ? (
              <EmptyState message="No hay visitas registradas" />
            ) : (
              <VisitasTable visitas={visitas} />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {editData && (
        <ClienteServicioForm
          clienteId={cliente.id}
          servicios={serviciosCatalogo}
          editData={editData}
          onClose={handleClose}
          open={dialogOpen}
        />
      )}
    </>
  );
}
