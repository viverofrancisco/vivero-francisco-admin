"use client";

import Link from "next/link";
import { hoyISOEcuador } from "@/lib/fechas";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  statusMeta,
  type EstadoVisitaUI,
} from "@/components/ui/status-badge";
import {
  PreviewCard,
  PreviewCardTrigger,
  PreviewCardContent,
} from "@/components/ui/preview-card";
import { nombreCliente } from "@vivero/shared";
import { listaProductos, type ProductoDeVisita } from "@/lib/visita-productos";

interface VisitaEnCalendario {
  id: string;
  /** `YYYY-MM-DD` o ISO completo: se normaliza acá. */
  fechaProgramada: string;
  estado: string;
  notas?: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
  };
  productos?: ProductoDeVisita[];
  grupo?: { id: string; nombre: string } | null;
}

/**
 * El día de una visita, sin hora.
 *
 * El server component serializa `"2026-08-01"` y la API `/api/visitas` devuelve
 * `"2026-08-01T00:00:00.000Z"`. Agrupar por la cadena cruda hacía que el
 * calendario se vaciara apenas se refrescaba por filtro o cambio de mes.
 */
const soloDia = (iso: string) => iso.slice(0, 10);

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/** Cuántas caben en una celda antes de resumir con "+N". */
const VISIBLES_POR_DIA = 3;

/**
 * Las visitas del mes en una grilla.
 *
 * Es la misma lista que la tabla, no otra consulta: al cambiar de mes se mueve
 * el filtro de fechas de la página, así lo que se ve en el calendario y lo que
 * se ve en la tabla no pueden diferir.
 */
export function VisitasCalendar({
  visitas,
  mes,
  onMesChange,
}: {
  visitas: VisitaEnCalendario[];
  /** Mes visible, `YYYY-MM`. */
  mes: string;
  onMesChange: (mes: string) => void;
}) {
  const [anio, mesNum] = mes.split("-").map(Number);
  const hoy = hoyISOEcuador();

  const porDia = new Map<string, VisitaEnCalendario[]>();
  for (const v of visitas) {
    const clave = soloDia(v.fechaProgramada);
    const lista = porDia.get(clave);
    if (lista) lista.push(v);
    else porDia.set(clave, [v]);
  }

  const primero = new Date(Date.UTC(anio, mesNum - 1, 1));
  const diasDelMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate();
  // getUTCDay() es 0=domingo; la semana acá empieza el lunes.
  const desplazamiento = (primero.getUTCDay() + 6) % 7;

  const celdas: (string | null)[] = [
    ...Array<null>(desplazamiento).fill(null),
    ...Array.from(
      { length: diasDelMes },
      (_, i) =>
        `${anio}-${String(mesNum).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(anio, mesNum - 1 + delta, 1));
    onMesChange(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-none items-center justify-between border-b px-4 py-3">
        <MonthYearPicker
          anio={anio}
          mes={mesNum - 1}
          onChange={(a, m) =>
            onMesChange(`${a}-${String(m + 1).padStart(2, "0")}`)
          }
          className="-ml-2 text-base font-bold"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => mover(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              onMesChange(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
              );
            }}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => mover(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[46rem]">
          {/* `sticky` sobre el contenedor que scrollea, y con fondo opaco: si
              fuera translúcido las filas se verían pasar por detrás. */}
          <div className="sticky top-0 z-20 grid grid-cols-7 border-b bg-secondary">
            {DIAS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-xs font-bold text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* La última fila y la última columna no dibujan borde: se
              superponía con el del card y parecía una línea de más. */}
          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
            {celdas.map((iso, i) => (
              <DiaCelda
                key={iso ?? `vacio-${i}`}
                iso={iso}
                esHoy={iso === hoy}
                visitas={iso ? (porDia.get(iso) ?? []) : []}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiaCelda({
  iso,
  esHoy,
  visitas,
}: {
  iso: string | null;
  esHoy: boolean;
  visitas: VisitaEnCalendario[];
}) {
  // El "+N más" se abre en la misma celda: mandar a otra pantalla por tres
  // visitas de un martes es más viaje que información.
  const [expandido, setExpandido] = useState(false);
  const mostradas = expandido ? visitas : visitas.slice(0, VISIBLES_POR_DIA);
  const ocultas = visitas.length - mostradas.length;

  if (!iso) {
    return <div className="min-h-24 border-b border-r bg-muted/20" />;
  }

  return (
    <div className="min-h-24 border-b border-r p-1.5">
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          esHoy
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground",
        )}
      >
        {Number(iso.slice(8))}
      </span>

      <div className="mt-1 space-y-0.5">
        {mostradas.map((v) => (
          <VisitaEnDia key={v.id} visita={v} />
        ))}

        {ocultas > 0 && (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="px-1 text-[11px] font-semibold text-muted-foreground hover:underline"
          >
            +{ocultas} más
          </button>
        )}
      </div>
    </div>
  );
}

/** Una visita dentro de una celda: link al detalle, con vista previa al hover. */
function VisitaEnDia({ visita }: { visita: VisitaEnCalendario }) {
  const meta =
    statusMeta[visita.estado as EstadoVisitaUI] ?? statusMeta.COMPLETADA;
  const productos = visita.productos ?? [];

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <Link
            href={`/dashboard/visitas/${visita.id}`}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
          >
            <span
              className={cn("h-1.5 w-1.5 flex-none rounded-full", meta.dot)}
            />
            <span className="min-w-0 flex-1 truncate text-[11px] leading-tight">
              {nombreCliente(visita.cliente)}
            </span>
          </Link>
        }
      />
      <PreviewCardContent className="w-64 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug">
            {nombreCliente(visita.cliente)}
          </p>
          <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
        </div>
        <p className="text-xs capitalize text-muted-foreground">
          {new Date(
            soloDia(visita.fechaProgramada) + "T00:00:00Z",
          ).toLocaleDateString("es-EC", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </p>
        {productos.length > 0 && (
          <p className="text-xs leading-snug">
            {listaProductos({ productos })}
          </p>
        )}
        {visita.grupo && (
          <p className="text-xs text-muted-foreground">{visita.grupo.nombre}</p>
        )}
        {visita.notas && (
          <p className="line-clamp-3 border-t pt-2 text-xs leading-snug text-muted-foreground">
            {visita.notas}
          </p>
        )}
      </PreviewCardContent>
    </PreviewCard>
  );
}
