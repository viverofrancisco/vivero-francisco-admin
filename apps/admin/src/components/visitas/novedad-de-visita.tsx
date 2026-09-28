"use client";

import Link from "next/link";
import { AlertTriangle, MapPin, Smartphone } from "lucide-react";
import {
  MOTIVO_NOVEDAD_LABEL,
  enlaceParaLlegar,
  type MotivoNovedad,
} from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fechaYHora, horaConDia } from "./formato-marca";

/** Una novedad como llega a la ficha: la fila de `VisitaNovedad`, con fechas en ISO. */
export interface NovedadData {
  id: string;
  /** De quién es: la cronología la pone en la ficha de esa persona. */
  personalId: string;
  personalNombre: string;
  motivo: string;
  nota: string | null;
  /** Las que hagan falta, como los adjuntos de un mensaje. */
  fotos: { id: string; url: string }[];
  /** Cuándo se reportó, según el teléfono si fue sin señal. */
  marcadaEl: string;
  /** Cuándo llegó al servidor. Con `sinConexion`, es la otra hora que se mira. */
  recibidaEl: string;
  sinConexion: boolean;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  simulada: boolean | null;
}

/**
 * La píldora que en una lista dice que alguien reportó que no pudo hacer la
 * visita y todavía nadie la resolvió. Va al lado del estado, no en su lugar:
 * la visita sigue programada o en curso, lo que cambió es que hay algo que
 * mirar.
 */
export function PastillaNovedad({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      Novedad
    </span>
  );
}

/**
 * Lo que alguien reportó desde el jardín: "llegué y no pude". Arriba de todo
 * en la ficha, porque es lo primero que la oficina tiene que leer, y con la
 * evidencia de una marca —la hora, el punto, si llegó tarde— porque es lo que
 * se le contesta al cliente que dice que nunca fueron.
 *
 * `resolverHref` es el camino a cerrarla: con él la tarjeta lleva el botón;
 * sin él (ya se resolvió, o quien mira no puede) solo cuenta lo que pasó.
 */
export function TarjetaNovedades({
  novedades,
  fechaProgramada,
  resolverHref,
  onVerFoto,
}: {
  novedades: NovedadData[];
  /** El día de la visita, para escribir la hora sola cuando coincide. */
  fechaProgramada: string;
  resolverHref?: string | null;
  onVerFoto?: (url: string) => void;
}) {
  if (novedades.length === 0) return null;
  return (
    <Card className="gap-0 rounded-2xl border-amber-200 bg-amber-50/60 py-0">
      <CardContent className="p-[22px]">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[15.5px] font-extrabold text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {novedades.length === 1
              ? "No se pudo hacer la visita"
              : `${novedades.length} novedades`}
          </span>
          {resolverHref ? (
            // `nativeButton={false}`: se dibuja como enlace, y Base UI avisa
            // en consola si no se le dice.
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={resolverHref} />}
            >
              Resolver
            </Button>
          ) : null}
        </div>
        <div className="mt-[14px] flex flex-col gap-4">
          {novedades.map((n) => (
            <Novedad
              key={n.id}
              novedad={n}
              fechaProgramada={fechaProgramada}
              onVerFoto={onVerFoto}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Novedad({
  novedad: n,
  fechaProgramada,
  onVerFoto,
}: {
  novedad: NovedadData;
  fechaProgramada: string;
  onVerFoto?: (url: string) => void;
}) {
  const tienePunto = n.lat !== null && n.lng !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0 flex-1">
        {/* El motivo en una línea y la nota en otra: lo que se eligió y lo
            que se escribió son dos cosas. */}
        <p className="text-sm font-bold">
          {MOTIVO_NOVEDAD_LABEL[n.motivo as MotivoNovedad] ?? n.motivo}
        </p>
        {n.nota ? (
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.nota}</p>
        ) : null}
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {n.personalNombre}, a las{" "}
          <span className="tabular-nums">
            {horaConDia(n.marcadaEl, fechaProgramada)}
          </span>
          {n.sinConexion ? (
            <span
              className="ml-1.5 text-[11px] font-medium text-amber-700"
              title={`Reportada sin conexión; llegó al servidor el ${fechaYHora(new Date(n.recibidaEl))}`}
            >
              sin conexión, llegó {fechaYHora(new Date(n.recibidaEl))}
            </span>
          ) : null}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          {tienePunto ? (
            <a
              href={enlaceParaLlegar(n.lat!, n.lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              Ver dónde estaba
              {n.precision !== null ? ` (±${Math.round(n.precision)} m)` : ""}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Sin ubicación
            </span>
          )}
          {n.simulada ? (
            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
              <Smartphone className="h-3.5 w-3.5" />
              Ubicación simulada
            </span>
          ) : null}
        </p>
      </div>
      {/* Las fotos en una fila debajo del texto, como los adjuntos de un
          mensaje: con una sola cabía al lado, con cinco no. */}
      {n.fotos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {n.fotos.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onVerFoto?.(f.url)}
              className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-muted"
              aria-label="Ver la foto de la novedad"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
