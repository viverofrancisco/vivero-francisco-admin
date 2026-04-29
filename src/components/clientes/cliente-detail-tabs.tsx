"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { ClienteServicioForm } from "@/components/clientes/cliente-servicio-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Eye,
} from "lucide-react";

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
    cliente: { id: string; nombre: string; apellido?: string | null };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: { id: string; nombre: string } | null;
}

interface ClienteData {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  sectorId: string | null;
  sector: { id: string; nombre: string } | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  metrosCuadrados: number | null;
  recibirRecordatorios: boolean;
  recibirConfirmaciones: boolean;
  createdAt: string;
}

interface ClienteDetailTabsProps {
  cliente: ClienteData;
  asignaciones: Asignacion[];
  serviciosCatalogo: ServicioCatalogo[];
  visitas: VisitaRow[];
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const estadoServicioBadge = (estado: string) => {
  switch (estado) {
    case "ACTIVO": return "default" as const;
    case "PAUSADO": return "secondary" as const;
    case "CANCELADO": return "destructive" as const;
    default: return "outline" as const;
  }
};

const estadoVisitaBadge = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "secondary" as const;
    case "COMPLETADA": return "default" as const;
    case "INCOMPLETA": return "destructive" as const;
    case "CANCELADA": return "outline" as const;
    default: return "outline" as const;
  }
};

const estadoVisitaLabel = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "Programada";
    case "COMPLETADA": return "Completada";
    case "INCOMPLETA": return "Incompleta";
    case "CANCELADA": return "Cancelada";
    default: return estado;
  }
};

const estadoServicioLabel = (estado: string) => {
  switch (estado) {
    case "ACTIVO": return "Activo";
    case "PAUSADO": return "Pausado";
    case "CANCELADO": return "Cancelado";
    default: return estado;
  }
};

export function ClienteDetailTabs({
  cliente,
  asignaciones,
  serviciosCatalogo,
  visitas,
}: ClienteDetailTabsProps) {
  const router = useRouter();
  const [cardsEditing, setCardsEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Asignacion | null>(null);
  const [recibirRecordatorios, setRecibirRecordatorios] = useState(
    cliente.recibirRecordatorios
  );
  const [recibirConfirmaciones, setRecibirConfirmaciones] = useState(
    cliente.recibirConfirmaciones
  );

  const handleNotifToggle = async (
    field: "recibirRecordatorios" | "recibirConfirmaciones",
    value: boolean
  ) => {
    if (field === "recibirRecordatorios") setRecibirRecordatorios(value);
    else setRecibirConfirmaciones(value);

    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: cliente.nombre,
          [field]: value,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferencia actualizada");
    } catch {
      // Revert on error
      if (field === "recibirRecordatorios") setRecibirRecordatorios(!value);
      else setRecibirConfirmaciones(!value);
      toast.error("Error al actualizar preferencia");
    }
  };

  const handleEdit = (asignacion: Asignacion) => {
    setEditData(asignacion);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditData(null);
  };

  const nombreCompleto = `${cliente.nombre} ${cliente.apellido || ""}`.trim();
  const topServicios = asignaciones.slice(0, 3);
  const topVisitas = visitas.slice(0, 3);

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/clientes")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold truncate">{nombreCompleto}</h1>
              {cliente.sector && (
                <Badge variant="outline">{cliente.sector.nombre}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente desde {formatDate(cliente.createdAt)}
            </p>
          </div>
          {cardsEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCardsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="cliente-cards-form"
              >
                Guardar cambios
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content below header */}
      <div className="px-4 md:px-6 pt-6 pb-6">
      <ClienteForm
        initialData={{
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          email: cliente.email,
          telefono: cliente.telefono,
          ciudad: cliente.ciudad,
          direccion: cliente.direccion,
          numeroCasa: cliente.numeroCasa,
          referencia: cliente.referencia,
          notas: cliente.notas,
          metrosCuadrados: cliente.metrosCuadrados,
        }}
        cards
        cardsEditing={cardsEditing}
        onEditDone={() => setCardsEditing(false)}
        rightColumnContent={
          <>
            {/* Services Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Servicios</CardTitle>
                <CardAction>
                  <Link href="/dashboard/servicios/asignar">
                    <Button size="sm" variant="ghost">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="pt-3">
                {asignaciones.length === 0 ? (
                  <EmptyState message="Sin servicios" />
                ) : (
                  <div className="space-y-3">
                    {topServicios.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {a.servicio.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(a.precio)}
                            {a.frecuenciaMensual
                              ? ` · ${a.frecuenciaMensual}x/mes`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge
                            variant={estadoServicioBadge(a.estado)}
                            className="text-xs"
                          >
                            {estadoServicioLabel(a.estado)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(a)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {asignaciones.length > 3 && (
                      <Link
                        href={`/dashboard/clientes/${cliente.id}/servicios`}
                        className="flex items-center justify-center gap-1 text-sm text-primary hover:underline pt-1"
                      >
                        Ver todos ({asignaciones.length})
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visits Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Visitas</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {visitas.length === 0 ? (
                  <EmptyState message="Sin visitas" />
                ) : (
                  <div className="space-y-3">
                    {topVisitas.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {v.clienteServicio.servicio.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(v.fechaProgramada)}
                            {v.grupo ? ` · ${v.grupo.nombre}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge
                            variant={estadoVisitaBadge(v.estado)}
                            className="text-xs"
                          >
                            {estadoVisitaLabel(v.estado)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              router.push(`/dashboard/visitas/${v.id}`)
                            }
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {visitas.length > 3 && (
                      <Link
                        href={`/dashboard/clientes/${cliente.id}/visitas`}
                        className="flex items-center justify-center gap-1 text-sm text-primary hover:underline pt-1"
                      >
                        Ver todas ({visitas.length})
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notificaciones WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recibir-recordatorios" className="cursor-pointer">
                    Recibir recordatorios de visita
                  </Label>
                  <Switch
                    id="recibir-recordatorios"
                    checked={recibirRecordatorios}
                    onCheckedChange={(val) =>
                      handleNotifToggle("recibirRecordatorios", val)
                    }
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="recibir-confirmaciones" className="cursor-pointer">
                    Recibir confirmaciones de visita
                  </Label>
                  <Switch
                    id="recibir-confirmaciones"
                    checked={recibirConfirmaciones}
                    onCheckedChange={(val) =>
                      handleNotifToggle("recibirConfirmaciones", val)
                    }
                    size="sm"
                  />
                </div>
                {!cliente.telefono && (
                  <p className="text-xs text-muted-foreground">
                    Este cliente no tiene teléfono registrado. Las notificaciones
                    no se enviarán hasta que se agregue uno.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        }
      />

      {/* Edit Service Dialog */}
      {editData && (
        <ClienteServicioForm
          clienteId={cliente.id}
          servicios={serviciosCatalogo}
          editData={editData}
          onClose={handleClose}
          open={dialogOpen}
        />
      )}
      </div>
    </div>
  );
}
