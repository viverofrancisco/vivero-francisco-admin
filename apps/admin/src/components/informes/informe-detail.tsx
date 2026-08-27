"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { useAca } from "@/lib/filtros-url";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export interface InformeDetailData {
  id: string;
  numero: number;
  titulo: string;
  /** La que sale impresa, `YYYY-MM-DD`. */
  fecha: string;
  generatedAt: string;
  pdfUrl: string;
  cliente: { id: string; nombre: string };
  generadoPor: string | null;
  firmantes: Array<{ nombre: string; cedula: string | null }>;
  visitas: Array<{
    id: string;
    numero: number;
    estado: string;
    fecha: string;
  }>;
  secciones: Array<{ titulo: string; fotos: number }>;
}

/**
 * La ficha de un informe: el PDF y de qué está hecho.
 *
 * Es de solo lectura porque un informe no se edita. Ya salió firmado y con
 * fecha; corregirlo por debajo dejaría al cliente con un documento que no es
 * el que tenemos nosotros. Para arreglar algo se elimina y se hace el bueno,
 * que además queda con su propio número.
 */
export function InformeDetail({
  informe,
  backHref,
}: {
  informe: InformeDetailData;
  backHref: string;
}) {
  const router = useRouter();
  const aca = useAca();
  const [borrando, setBorrando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    setEliminando(true);
    try {
      const res = await fetch(`/api/admin/informes/${informe.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Informe eliminado");
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("No pudimos eliminar");
      setEliminando(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-none items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              Informe #{informe.numero}
            </h1>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {informe.cliente.nombre} · {informe.titulo}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={informe.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir
          </Button>
          {/* Por nuestra ruta y no directo a R2: `download` no funciona
              entre dominios, así que el enlace crudo abría el PDF en vez de
              guardarlo. */}
          <Button
            size="sm"
            nativeButton={false}
            render={<a href={`/api/admin/informes/${informe.id}/descargar`} />}
          >
            <Download className="mr-1.5 h-4 w-4" /> Descargar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setBorrando(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-3">
        {/* El PDF es el informe: ocupa la columna grande. */}
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="min-h-[60vh] flex-1 overflow-hidden rounded-lg border bg-neutral-200">
            <iframe
              src={`${informe.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Informe #${informe.numero}`}
              className="block h-full w-full border-0"
            />
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Dato etiqueta="Cliente">
                <Link
                  href={`/dashboard/clientes/${informe.cliente.id}?from=${aca}`}
                  className="font-medium hover:underline"
                >
                  {informe.cliente.nombre}
                </Link>
              </Dato>
              {/* Dos fechas distintas a propósito: la impresa es la que dice
                  el documento, la de generado es cuándo se armó. */}
              <Dato etiqueta="Fecha del informe">{fechaLarga(informe.fecha)}</Dato>
              <Dato etiqueta="Generado">
                {/* Quién lo hizo va abajo y no detrás de un punto: son dos
                    datos distintos, y juntos en un renglón el corte caía en
                    cualquier lado. */}
                <span className="block">{generadoEl(informe.generatedAt)}</span>
                {informe.generadoPor ? (
                  <span className="block text-muted-foreground">
                    {informe.generadoPor}
                  </span>
                ) : null}
              </Dato>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Visitas incluidas ({informe.visitas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y text-sm">
                {informe.visitas.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/dashboard/visitas/${v.id}?from=${aca}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-medium tabular-nums">
                          #{v.numero}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {fechaCorta(v.fecha)}
                        </span>
                      </span>
                      <StatusBadge
                        estado={v.estado as EstadoVisitaUI}
                        size="sm"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Secciones ({informe.secciones.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y text-sm">
                {informe.secciones.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="truncate font-medium" title={s.titulo}>
                      {s.titulo}
                    </span>
                    <span className="flex flex-none items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {s.fotos}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Firman</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {informe.firmantes.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{f.nombre}</span>
                  {f.cedula ? (
                    <Badge variant="outline" className="flex-none tabular-nums">
                      {f.cedula}
                    </Badge>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={borrando} onOpenChange={(v) => !v && setBorrando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar el informe #{informe.numero}</DialogTitle>
            <DialogDescription>
              Se borra el informe de {informe.cliente.nombre}, sus secciones y
              el PDF. El enlace deja de abrir, también para quien ya lo haya
              recibido. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBorrando(false)}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/** "26 ago 2026" — entra en un renglón de la columna. */
function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "26 ago" — en una lista alcanza. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "26 ago 2026, 11:33" — con hora, que es lo que distingue dos del mismo día. */
function generadoEl(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
