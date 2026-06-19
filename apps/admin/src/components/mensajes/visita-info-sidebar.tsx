"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { nombreCliente } from "@vivero/shared";

interface VisitaInfoData {
  id: string;
  fechaProgramada: Date;
  fechaRealizada: Date | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  clienteServicio: {
    cliente: {
      id: string;
      nombre: string;
      apellido: string | null;
      empresa: string | null;
      telefono: string | null;
      direccion: string | null;
      ciudad: string | null;
      sector: { nombre: string } | null;
    };
    servicio: { id: string; nombre: string };
  };
  personal: {
    personal: {
      id: string;
      nombre: string;
      apellido: string | null;
      tipo: string | null;
    };
  }[];
  media: { id: string; url: string; tipo: string }[];
}

export function VisitaInfoSidebar({ visita }: { visita: VisitaInfoData }) {
  const cliente = visita.clienteServicio.cliente;
  const clienteName = nombreCliente(cliente);
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Detalles de la visita</CardTitle>
        <Link href={`/dashboard/visitas/${visita.id}`}>
          <Button variant="ghost" size="icon" title="Abrir página completa">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        <div className="space-y-2">
          <Badge variant={badgeVariant(visita.estado)}>
            {estadoLabel(visita.estado)}
          </Badge>
          <p className="text-base font-semibold">
            {visita.clienteServicio.servicio.nombre}
          </p>
        </div>

        <Section title="Cliente">
          <Row label="Nombre" value={clienteName} />
          {cliente.telefono ? (
            <Row label="Teléfono" value={cliente.telefono} />
          ) : null}
          {cliente.direccion ? (
            <Row label="Dirección" value={cliente.direccion} />
          ) : null}
          {cliente.sector ? (
            <Row label="Sector" value={cliente.sector.nombre} />
          ) : null}
        </Section>

        <Section title="Cuándo">
          <Row label="Programada" value={formatDate(visita.fechaProgramada)} />
          {visita.fechaRealizada ? (
            <Row
              label="Realizada"
              value={formatDate(visita.fechaRealizada)}
            />
          ) : null}
          {visita.horaEntrada ? (
            <Row
              label={
                visita.estado === "PROGRAMADA"
                  ? "Hora estimada"
                  : "Hora de entrada"
              }
              value={visita.horaEntrada}
            />
          ) : null}
          {visita.horaSalida ? (
            <Row label="Hora de salida" value={visita.horaSalida} />
          ) : null}
        </Section>

        {visita.personal.length > 0 ? (
          <Section title="Personal asignado">
            <ul className="space-y-2">
              {visita.personal.map((p) => (
                <li
                  key={p.personal.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {`${p.personal.nombre} ${p.personal.apellido ?? ""}`.trim()}
                  </span>
                  {p.personal.tipo ? (
                    <span className="text-muted-foreground">
                      {tipoLabel(p.personal.tipo)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {visita.notas || visita.notasIncompleto ? (
          <Section
            title={
              visita.estado === "INCOMPLETA" || visita.estado === "CANCELADA"
                ? "Motivo"
                : "Notas"
            }
          >
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {visita.notasIncompleto || visita.notas}
            </p>
          </Section>
        ) : null}

        {visita.media.length > 0 ? (
          <Section title="Archivos">
            <div className="grid grid-cols-3 gap-2">
              {visita.media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setActiveMedia({ url: m.url, tipo: m.tipo })
                  }
                  className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {m.tipo === "video" ? (
                    <>
                      <video
                        src={m.url}
                        className="h-full w-full object-cover"
                        muted
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60">
                          <Play className="h-3.5 w-3.5 fill-white text-white" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <Image
                      src={m.url}
                      alt=""
                      width={120}
                      height={120}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </Section>
        ) : null}
      </CardContent>
      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecánico";
    default:
      return tipo;
  }
}

function estadoLabel(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "Programada";
    case "COMPLETADA":
      return "Completada";
    case "INCOMPLETA":
      return "Incompleta";
    case "CANCELADA":
      return "Cancelada";
    default:
      return estado;
  }
}

function badgeVariant(
  estado: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case "PROGRAMADA":
      return "secondary";
    case "COMPLETADA":
      return "default";
    case "INCOMPLETA":
      return "destructive";
    case "CANCELADA":
      return "outline";
    default:
      return "outline";
  }
}
