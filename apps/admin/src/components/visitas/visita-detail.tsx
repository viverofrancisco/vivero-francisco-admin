"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { ArrowLeft, CheckCircle, MessageSquare, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { CompletarVisitaForm } from "@/components/visitas/completar-visita-form";
import { PersonalSelector } from "@/components/grupos/personal-selector";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";

interface VisitaDetailData {
  id: string;
  clienteServicioId: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  media: { id: string; url: string; tipo: string }[];
  clienteServicio: {
    cliente: { id: string; nombre: string; apellido?: string | null; ciudad: string | null; sector: { nombre: string } | null };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: {
    id: string;
    nombre: string;
    miembros: { personal: { id: string; nombre: string; apellido?: string | null } }[];
  } | null;
  personal: { personal: { id: string; nombre: string; apellido?: string | null } }[];
}

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface VisitaDetailProps {
  visita: VisitaDetailData;
  userRole?: string;
  allPersonal?: PersonalOption[];
  hasMessages?: boolean;
}

export function VisitaDetail({
  visita,
  userRole,
  allPersonal = [],
  hasMessages = false,
}: VisitaDetailProps) {
  const router = useRouter();
  const [completarOpen, setCompletarOpen] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<string[]>(
    visita.personal.map((p) => p.personal.id)
  );
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );

  const isProgramada = visita.estado === "PROGRAMADA";
  const canModify = userRole !== "PERSONAL";

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    try {
      const res = await fetch(`/api/visitas/${visita.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalIds: selectedPersonalIds }),
      });
      if (!res.ok) throw new Error();
      toast.success("Personal actualizado");
      setEditingPersonal(false);
      router.refresh();
    } catch {
      toast.error("Error al actualizar personal");
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleCancelEditPersonal = () => {
    setSelectedPersonalIds(visita.personal.map((p) => p.personal.id));
    setEditingPersonal(false);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/visitas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                Detalle de Visita
              </h1>
              <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {`${visita.clienteServicio.cliente.nombre} ${visita.clienteServicio.cliente.apellido || ""}`.trim()} — {visita.clienteServicio.servicio.nombre}
            </p>
          </div>
          {isProgramada && canModify && (
            <Button onClick={() => setCompletarOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha programada</span>
              <span className="capitalize">{formatDate(visita.fechaProgramada)}</span>
            </div>
            {visita.fechaRealizada && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha realizada</span>
                <span className="capitalize">{formatDate(visita.fechaRealizada)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora entrada</span>
              <span>{visita.horaEntrada ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora salida</span>
              <span>{visita.horaSalida ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Servicio</span>
              <span>{visita.clienteServicio.servicio.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant="outline">
                {visita.clienteServicio.servicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <Link
                href={`/dashboard/clientes/${visita.clienteServicio.cliente.id}`}
                className="text-primary hover:underline"
              >
                {`${visita.clienteServicio.cliente.nombre} ${visita.clienteServicio.cliente.apellido || ""}`.trim()}
              </Link>
            </div>
            {visita.clienteServicio.cliente.ciudad && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ciudad</span>
                <span>{visita.clienteServicio.cliente.ciudad}</span>
              </div>
            )}
            {visita.clienteServicio.cliente.sector && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sector</span>
                <span>{visita.clienteServicio.cliente.sector.nombre}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Personal asignado</CardTitle>
              {isProgramada && canModify && !editingPersonal && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingPersonal(true)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {visita.grupo && (
              <div className="flex justify-between mb-3 pb-3 border-b">
                <span className="text-muted-foreground text-sm">Grupo</span>
                <span className="text-sm font-medium">{visita.grupo.nombre}</span>
              </div>
            )}

            {editingPersonal ? (
              <div className="space-y-3">
                <PersonalSelector
                  personalList={allPersonal}
                  selectedIds={selectedPersonalIds}
                  onChange={setSelectedPersonalIds}
                />
                {selectedPersonalIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPersonalIds.length} persona{selectedPersonalIds.length !== 1 ? "s" : ""} seleccionada{selectedPersonalIds.length !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditPersonal}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePersonal}
                    disabled={savingPersonal}
                  >
                    {savingPersonal ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {visita.personal.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin personal asignado</p>
                ) : (
                  <ul className="space-y-1">
                    {visita.personal.map((vp) => (
                      <li key={vp.personal.id} className="text-sm">
                        {`${vp.personal.nombre} ${vp.personal.apellido || ""}`.trim()}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visita.notas ? (
              <p className="text-sm whitespace-pre-wrap">{visita.notas}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Sin notas</p>
            )}
            {visita.notasIncompleto && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  {visita.estado === "CANCELADA" ? "Razón de cancelación:" : "Razón de incompleto:"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{visita.notasIncompleto}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {visita.media.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visita.media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMedia({ url: m.url, tipo: m.tipo })}
                  className="relative rounded-md overflow-hidden border aspect-square bg-muted hover:opacity-80 transition-opacity"
                >
                  {m.tipo === "imagen" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt="Foto de visita"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <video
                        src={m.url}
                        muted
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                          <Play className="h-5 w-5 fill-white text-white" />
                        </span>
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasMessages ? (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Mensajes con el cliente</p>
                <p className="text-xs text-muted-foreground">
                  Hay una conversación abierta sobre esta visita.
                </p>
              </div>
            </div>
            <Link href={`/dashboard/mensajes/${visita.id}`}>
              <Button variant="outline" size="sm">
                Ver mensajes
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <CompletarVisitaForm
        visitaId={visita.id}
        open={completarOpen}
        onClose={() => setCompletarOpen(false)}
      />

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </>
  );
}
