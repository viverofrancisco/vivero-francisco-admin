import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { StatusBadge } from "@/components/ui/status-badge";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  Users,
  Wrench,
  UserCheck,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { resumenTareas, TAREAS_DE_VISITA_INCLUDE } from "@/lib/visita-tareas";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listInbox } from "@/lib/services/chat.service";
import { nombreCliente } from "@vivero/shared";
import {
  PanelJardinero,
  type VisitaDelPanel,
} from "@/components/dashboard/panel-jardinero";

/** Cuántas visitas futuras y cuántas conversaciones caben antes de cansar. */
const PROXIMAS_VISIBLES = 10;
const CONVERSACIONES_VISIBLES = 5;

const VISITA_DEL_PANEL = {
  cliente: { include: { sector: { select: { nombre: true } } } },
  ...TAREAS_DE_VISITA_INCLUDE,
} as const;

type FilaDeVisita = {
  id: string;
  horaEntrada: string | null;
  fechaProgramada: Date;
  estado: string;
  cliente: {
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    sector: { nombre: string } | null;
  };
};

function aFilaDelPanel(
  v: FilaDeVisita & Parameters<typeof resumenTareas>[0],
): VisitaDelPanel {
  return {
    id: v.id,
    cliente: nombreCliente(v.cliente),
    sector: v.cliente.sector?.nombre ?? null,
    horaEntrada: v.horaEntrada,
    fechaProgramada: v.fechaProgramada.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }),
    estado: v.estado,
    tareas: resumenTareas(v),
  };
}

/** "hace 5 min", "ayer", "12 sep" — lo justo para ubicar un mensaje. */
function cuando(fecha: Date): string {
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  if (horas < 48) return "ayer";
  return fecha.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: typeof Users;
  iconClass: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-[18px] transition-shadow hover:shadow-md"
    >
      <div
        className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon className="h-[21px] w-[21px]" />
      </div>
      <div className="mt-3.5 text-[32px] font-extrabold leading-none tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold text-muted-foreground">
        {label}
      </div>
      {sub && (
        <div className="mt-1.5 text-[12.5px] font-semibold text-muted-foreground/80">
          {sub}
        </div>
      )}
    </Link>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 flex-none">
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          className="stroke-border"
          strokeWidth="11"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          {pct}%
        </span>
      </div>
    </div>
  );
}

function Legend({
  colorClass,
  label,
  value,
}: {
  colorClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${colorClass}`} />
      <span className="flex-1 text-[13px] font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="text-[13.5px] font-extrabold text-foreground">
        {value}
      </span>
    </div>
  );
}

const crewColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-5",
  "bg-chart-4",
];

export default async function DashboardPage() {
  const user = await requireAuth();

  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth();
  const dia = now.getDate();
  const inicioMes = new Date(anio, mes, 1);
  const finMes = new Date(anio, mes + 1, 1);
  const inicioDia = new Date(anio, mes, dia);
  const finDia = new Date(anio, mes, dia + 1);

  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const isPersonal = user.role === "PERSONAL";

  // Qué visitas ve cada uno (sin filtro de fecha: eso lo pone cada consulta).
  //
  // El jardinero ve **las que tiene asignadas**, no las de su grupo: el grupo
  // dice con quién suele trabajar, la asignación dice a dónde fue. Eran lo
  // mismo cuando reportaba el capataz por todos; ahora cada uno carga lo suyo y
  // lo que importa es dónde estuvo él.
  let scope: Prisma.VisitaWhereInput = {};
  if (isPersonal) {
    const personal = await prisma.personal.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    scope = personal
      ? { personal: { some: { personalId: personal.id, removedAt: null } } }
      : { id: "none" };

    // Y hasta acá llega lo compartido: el jardinero tiene su propia pantalla,
    // así que ni se piden los conteos de la oficina.
    const suyas = { ...scope, deletedAt: null } as const;
    const [hoy, proximas, bandeja] = await Promise.all([
      prisma.visita.findMany({
        where: { ...suyas, fechaProgramada: { gte: inicioDia, lt: finDia } },
        include: VISITA_DEL_PANEL,
        orderBy: [{ horaEntrada: "asc" }, { createdAt: "asc" }],
      }),
      // `gte: finDia` —el arranque de mañana— y no `gt: hoy`, porque
      // `fechaProgramada` es `@db.Date`: Prisma le manda a Postgres solo la
      // parte de fecha, así que el corte cae donde tiene que caer. Lo que no
      // hay que hacer es comparar en JavaScript lo que vuelve: viene como
      // medianoche **UTC**, y contra una medianoche local (Guayaquil, UTC-5)
      // una visita de mañana parece de hoy.
      prisma.visita.findMany({
        where: { ...suyas, fechaProgramada: { gte: finDia } },
        include: VISITA_DEL_PANEL,
        orderBy: [{ fechaProgramada: "asc" }, { horaEntrada: "asc" }],
        take: PROXIMAS_VISIBLES,
      }),
      listInbox(await viewerFromSession(), { limit: CONVERSACIONES_VISIBLES }),
    ]);

    return (
      <PanelJardinero
        nombre={
          [user.name, user.apellido].filter(Boolean).join(" ") || "Usuario"
        }
        fechaHoy={capitalize(
          now.toLocaleDateString("es-EC", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
        )}
        hoy={hoy.map(aFilaDelPanel)}
        proximas={proximas.map(aFilaDelPanel)}
        conversaciones={bandeja.items.map((c) => ({
          visitaId: c.visitaId,
          cliente: c.clienteNombre,
          ultimo:
            c.lastMessage?.body ||
            (c.lastMessage?.hasMedia ? "Envió una foto" : "Sin mensajes"),
          cuando: c.lastMessage ? cuando(c.lastMessage.createdAt) : "",
          sinLeer: c.unreadCount,
        }))}
      />
    );
  }

  const mesFilter: Prisma.VisitaWhereInput = {
    ...scope,
    deletedAt: null,
    fechaProgramada: { gte: inicioMes, lt: finMes },
  };
  const diaFilter: Prisma.VisitaWhereInput = {
    ...scope,
    deletedAt: null,
    fechaProgramada: { gte: inicioDia, lt: finDia },
  };

  const [
    clientesCount,
    serviciosCount,
    personalCount,
    visitasMesTotal,
    visitasCompletadas,
    visitasIncompletas,
    visitasProgramadas,
    visitasHoy,
  ] = await Promise.all([
    isAdmin
      ? prisma.cliente.count({ where: { deletedAt: null } })
      : Promise.resolve(0),
    isAdmin
      ? prisma.producto.count({ where: { deletedAt: null } })
      : Promise.resolve(0),
    isAdmin
      ? prisma.personal.count({ where: { deletedAt: null } })
      : Promise.resolve(0),
    prisma.visita.count({ where: mesFilter }),
    prisma.visita.count({ where: { ...mesFilter, estado: "COMPLETADA" } }),
    prisma.visita.count({ where: { ...mesFilter, estado: "INCOMPLETA" } }),
    prisma.visita.count({ where: { ...mesFilter, estado: "PROGRAMADA" } }),
    prisma.visita.findMany({
      where: diaFilter,
      include: {
        cliente: { include: { sector: { select: { nombre: true } } } },
        ...TAREAS_DE_VISITA_INCLUDE,
        grupo: { select: { nombre: true } },
      },
      orderBy: [{ horaEntrada: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const pct =
    visitasMesTotal > 0
      ? Math.round((visitasCompletadas / visitasMesTotal) * 100)
      : 0;

  // Crews in field today (aggregate today's visits by group).
  const crewMap = new Map<string, { sectores: Set<string>; count: number }>();
  for (const v of visitasHoy) {
    const nombre = v.grupo?.nombre;
    if (!nombre) continue;
    const sector = v.cliente.sector?.nombre;
    const entry = crewMap.get(nombre) ?? { sectores: new Set(), count: 0 };
    if (sector) entry.sectores.add(sector);
    entry.count += 1;
    crewMap.set(nombre, entry);
  }
  const crews = [...crewMap.entries()]
    .map(([nombre, { sectores, count }]) => ({
      nombre,
      sector: [...sectores].join(", "),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const userName =
    [user.name, user.apellido].filter(Boolean).join(" ") || "Usuario";
  const mesNombre = now.toLocaleDateString("es-EC", { month: "long" });
  const fechaHoy = capitalize(
    now.toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  return (
    <div className="space-y-5 p-4 md:p-7">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
          Bienvenido, {userName}
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          Resumen general del vivero
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clientes activos"
          value={clientesCount}
          icon={Users}
          iconClass="bg-info/12 text-info"
          href="/dashboard/clientes"
        />
        <StatCard
          label="Servicios"
          value={serviciosCount}
          icon={Wrench}
          iconClass="bg-clay/12 text-clay"
          href="/dashboard/productos"
        />
        <StatCard
          label="Personal"
          value={personalCount}
          icon={UserCheck}
          iconClass="bg-success/12 text-green-700"
          href="/dashboard/personal"
        />
        <StatCard
          label={`Visitas de ${capitalize(mesNombre)}`}
          value={visitasMesTotal}
          sub={`${visitasCompletadas} completadas`}
          icon={CalendarDays}
          iconClass="bg-warning/15 text-warning-foreground"
          href="/dashboard/visitas"
        />
      </div>

      {/* Today + right column */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Today's visits */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="text-[15.5px] font-extrabold text-foreground">
                Visitas de hoy
              </div>
              <div className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">
                {fechaHoy} · {visitasHoy.length} programadas
              </div>
            </div>
            <Link
              href="/dashboard/visitas"
              className="text-[13px] font-bold text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {visitasHoy.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm font-medium text-muted-foreground">
              No hay visitas programadas para hoy.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visitasHoy.slice(0, 8).map((v) => {
                const c = v.cliente;
                const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ");
                return (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                    {v.horaEntrada && (
                      <span className="w-12 flex-none text-sm font-extrabold tabular-nums text-foreground">
                        {v.horaEntrada}
                      </span>
                    )}
                    <InitialsAvatar name={nombre} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground">
                        {nombre}
                      </div>
                      <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
                        {resumenTareas(v)}
                      </div>
                    </div>
                    <span className="hidden text-[13px] font-semibold text-muted-foreground sm:block">
                      {c.sector?.nombre ?? "—"}
                    </span>
                    <StatusBadge estado={v.estado} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 text-[15px] font-extrabold text-foreground">
              Cumplimiento del mes
            </div>
            <div className="flex items-center gap-5">
              <Ring pct={pct} />
              <div className="flex flex-1 flex-col gap-2.5">
                <Legend
                  colorClass="bg-primary"
                  label="Completadas"
                  value={visitasCompletadas}
                />
                <Legend
                  colorClass="bg-warning"
                  label="Incompletas"
                  value={visitasIncompletas}
                />
                <Legend
                  colorClass="bg-muted-foreground"
                  label="Programadas"
                  value={visitasProgramadas}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3.5 text-[15px] font-extrabold text-foreground">
              Cuadrillas en campo
            </div>
            {crews.length === 0 ? (
              <p className="text-[13px] font-medium text-muted-foreground">
                Ninguna cuadrilla en campo hoy.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {crews.map((crew, i) => (
                  <div key={crew.nombre} className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 flex-none rounded-full ${crewColors[i % crewColors.length]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold text-foreground">
                        {crew.nombre}
                      </div>
                      {crew.sector && (
                        <div className="truncate text-xs font-semibold text-muted-foreground">
                          {crew.sector}
                        </div>
                      )}
                    </div>
                    <span className="text-[12.5px] font-bold text-muted-foreground">
                      {crew.count} {crew.count === 1 ? "visita" : "visitas"}
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
