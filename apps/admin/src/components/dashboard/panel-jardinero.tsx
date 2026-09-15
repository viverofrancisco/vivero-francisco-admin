import Link from "next/link";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { CalendarOff } from "lucide-react";

/**
 * El panel de quien trabaja en el campo: una sola pantalla.
 *
 * Tenía las tarjetas de la oficina —"Mis visitas de septiembre", el anillo de
 * cumplimiento— y ninguna le servía para nada: el jardinero no decide qué se
 * agenda ni cierra las visitas, así que un porcentaje de cumplimiento le mide
 * algo sobre lo que no puede actuar, y ocupaba la mitad de arriba de la
 * pantalla. Lo que necesita saber al abrir esto es qué le toca hoy y qué viene
 * después.
 */

export interface VisitaDelPanel {
  id: string;
  cliente: string;
  sector: string | null;
  horaEntrada: string | null;
  fechaProgramada: string;
  estado: string;
  tareas: string;
}

export function PanelJardinero({
  nombre,
  fechaHoy,
  hoy,
  proximas,
}: {
  nombre: string;
  fechaHoy: string;
  hoy: VisitaDelPanel[];
  proximas: VisitaDelPanel[];
}) {
  return (
    <div className="space-y-5 p-4 md:p-7">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
          Hola, {nombre}
        </h1>
        <p className="text-sm font-medium text-muted-foreground">{fechaHoy}</p>
      </div>

      <Seccion
        titulo="Visitas de hoy"
        sub={
          hoy.length === 0
            ? undefined
            : `${hoy.length} ${hoy.length === 1 ? "visita" : "visitas"}`
        }
      >
        {hoy.length === 0 ? (
          <Vacio
            icono={<CalendarOff className="h-8 w-8 text-muted-foreground/50" />}
            titulo="Hoy no tienes visitas"
          />
        ) : (
          <Filas visitas={hoy} conHora />
        )}
      </Seccion>

      <Seccion titulo="Próximas visitas" verTodasHref="/dashboard/visitas">
        {proximas.length === 0 ? (
          <Vacio
            icono={<CalendarOff className="h-8 w-8 text-muted-foreground/50" />}
            titulo="No tienes visitas programadas"
          />
        ) : (
          <Filas visitas={proximas} />
        )}
      </Seccion>
    </div>
  );
}

function Seccion({
  titulo,
  sub,
  verTodasHref,
  children,
}: {
  titulo: string;
  sub?: string;
  verTodasHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="text-[15.5px] font-extrabold text-foreground">
            {titulo}
          </div>
          {sub && (
            <div className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">
              {sub}
            </div>
          )}
        </div>
        {verTodasHref && (
          <Link
            href={verTodasHref}
            className="text-[13px] font-bold text-primary hover:underline"
          >
            Ver todas
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Filas({
  visitas,
  conHora = false,
}: {
  visitas: VisitaDelPanel[];
  /** La hora solo en las de hoy: en las futuras lo que ubica es la fecha. */
  conHora?: boolean;
}) {
  return (
    <div className="divide-y divide-border/60">
      {visitas.map((v) => (
        <Link
          key={v.id}
          href={`/dashboard/visitas/${v.id}`}
          className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50"
        >
          <span className="w-14 flex-none text-sm font-extrabold tabular-nums text-foreground">
            {conHora ? (v.horaEntrada ?? "—") : v.fechaProgramada}
          </span>
          <InitialsAvatar name={v.cliente} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-foreground">
              {v.cliente}
            </div>
            <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
              {v.tareas}
            </div>
          </div>
          <span className="hidden text-[13px] font-semibold text-muted-foreground sm:block">
            {v.sector ?? "—"}
          </span>
          <StatusBadge estado={v.estado as EstadoVisitaUI} size="sm" />
        </Link>
      ))}
    </div>
  );
}

function Vacio({ icono, titulo }: { icono: React.ReactNode; titulo: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      {icono}
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
    </div>
  );
}
