"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { hoyISOEcuador } from "@/lib/fechas";
import { useFiltroUrl } from "@/lib/filtros-url";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { VisitasTable } from "@/components/visitas/visitas-table";
import { VisitasCalendar } from "@/components/visitas/visitas-calendar";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays, List, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { nombreCliente } from "@vivero/shared";
import type { ProductoDeVisita } from "@/lib/visita-productos";

const ESTADOS = [
  { value: "ALL", label: "Todos" },
  { value: "PROGRAMADA", label: "Programada" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "INCOMPLETA", label: "Incompleta" },
  { value: "CANCELADA", label: "Cancelada" },
];

interface VisitaRow {
  id: string;
  numero: number;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
  };
  productos: ProductoDeVisita[];
  grupo: { id: string; nombre: string } | null;
}

interface FilterOption {
  id: string;
  nombre: string;
}

interface ClienteFilterOption {
  id: string;
  nombre: string;
  apellido?: string | null;
  empresa?: string | null;
}

interface VisitasPageClientProps {
  initialVisitas: VisitaRow[];
  initialDesde: string;
  initialHasta: string;
  /**
   * Los filtros que ya aplicó el servidor. Vienen de él y no de la URL leída
   * acá para que la pantalla no pueda mostrar un filtro que la lista no tiene.
   */
  filtros: {
    estado?: string;
    cliente?: string;
    producto?: string;
    completadaPor?: string;
    completadaDesde?: string;
    completadaHasta?: string;
  };
  /** Quiénes cerraron alguna visita: los únicos por los que tiene sentido filtrar. */
  cerradores: { id: string; nombre: string }[];
  userRole?: string;
  clientes: ClienteFilterOption[];
  productos: FilterOption[];
}

export function VisitasPageClient({
  initialVisitas,
  initialDesde,
  initialHasta,
  filtros,
  cerradores,
  userRole,
  clientes,
  productos,
}: VisitasPageClientProps) {
  const router = useRouter();
  const [navegando, startTransition] = useTransition();

  /**
   * La lista la arma el servidor, así que los filtros que la recortan viajan
   * en la URL y se aplican navegando.
   *
   * `router.replace` y no `history.replaceState`: cambiar la URL a mano no le
   * pide nada al servidor, así que la tabla se quedaba con las visitas de
   * antes. Y `replace` en vez de `push` para no dejar una entrada de historial
   * por cada filtro tocado —volver atrás tiene que salir de la lista, no
   * deshacer filtro por filtro— pero sí deja la URL filtrada en la entrada
   * actual, que es lo que hace que volver desde una visita la recupere.
   */
  const desde = initialDesde;
  const hasta = initialHasta;
  const estado = filtros.estado ?? "ALL";
  const clienteId = filtros.cliente ?? "ALL";
  const productoId = filtros.producto ?? "ALL";
  const completadaPor = filtros.completadaPor ?? "ALL";
  const completadaDesde = filtros.completadaDesde ?? "";
  const completadaHasta = filtros.completadaHasta ?? "";

  const navegar = (patch: Record<string, string>) => {
    const qs = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(patch)) {
      // El vacío se guarda igual: "sin fechas" no es lo mismo que "recién
      // llegué", que es cuando vale el mes actual.
      if (valor === "ALL") qs.delete(clave);
      else qs.set(clave, valor);
    }
    // Cambiar un filtro vuelve a la primera página: la 3 de la lista anterior
    // no es la 3 de esta, y muchas veces ni existe.
    qs.delete("pagina");
    startTransition(() => {
      router.replace(`/dashboard/visitas?${qs.toString()}`, { scroll: false });
    });
  };

  /**
   * Estos dos no tocan la consulta: filtran y dibujan lo que ya llegó. Les
   * alcanza con la URL a secas, sin pedirle nada al servidor.
   */
  const [soloSinOrden, setSoloSinOrden] = useFiltroUrl("sinOrden", false);
  const [vista, setVista] = useFiltroUrl<"tabla" | "calendario">(
    "vista",
    "tabla"
  );

  const visitas = initialVisitas;
  const loadingFilter = navegando;

  /**
   * El rango llega completo, así que no hay estado intermedio que validar: un
   * día suelto viaja como `desde === hasta` y la consulta devuelve solo ese día.
   */
  const handleRangoChange = (d: string, h: string) =>
    navegar({ desde: d, hasta: h });

  const handleEstadoChange = (v: string) => navegar({ estado: v });

  const handleClienteChange = (v: string) => navegar({ cliente: v });

  /**
   * Cuántos filtros están puestos, para el contador del botón. El estado no
   * cuenta: tiene su propio control a la vista.
   *
   * El rango cuenta siempre que haya fechas, aunque sean las del mes actual con
   * que arranca la página: la lista **está** recortada a ese mes, y decir que no
   * hay filtros mientras se esconden las visitas de los otros meses es mentir.
   * Por eso limpiar saca las fechas en vez de devolverlas al mes de hoy.
   */
  const filtrosActivos =
    (clienteId !== "ALL" ? 1 : 0) +
    (productoId !== "ALL" ? 1 : 0) +
    (estado !== "ALL" ? 1 : 0) +
    (soloSinOrden ? 1 : 0) +
    (desde || hasta ? 1 : 0) +
    (completadaPor !== "ALL" ? 1 : 0) +
    (completadaDesde || completadaHasta ? 1 : 0);

  const limpiarFiltros = () => {
    setSoloSinOrden(false);
    navegar({
      cliente: "ALL",
      producto: "ALL",
      estado: "ALL",
      desde: "",
      hasta: "",
      completadaPor: "ALL",
      completadaDesde: "",
      completadaHasta: "",
    });
  };

  /** Le queda trabajo suelto que todavía no entró en ninguna orden. */
  const sinOrden = (v: VisitaRow) =>
    v.estado !== "CANCELADA" &&
    v.productos.some((p) => !p.suscripcionItemId && !p.ordenLinea);

  const visibles = soloSinOrden ? visitas.filter(sinOrden) : visitas;

  const handleServicioChange = (v: string) => navegar({ producto: v });

  /**
   * El mes que muestra el calendario sale del filtro de fechas, y navegarlo
   * mueve ese filtro. Si el calendario llevara su propio mes, avanzar mostraría
   * un mes vacío: los datos son los que trajo el rango.
   */
  const mesVisible = (desde || hoyISOEcuador()).slice(0, 7);

  const handleMesChange = (mes: string) => {
    const [anio, m] = mes.split("-").map(Number);
    const primero = `${mes}-01`;
    const ultimo = new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10);
    navegar({ desde: primero, hasta: ultimo });
  };

  return (
    <>
      <PageHeader
        title="Visitas"
        description="Gestiona las visitas programadas"
        actions={
          userRole !== "PERSONAL"
            ? [
                {
                  label: "Nueva Visita",
                  href: "/dashboard/visitas/nueva",
                  icon: "plus",
                  primary: true,
                },
              ]
            : []
        }
      />

      {/* Una sola fila de controles: las cinco pastillas de estado más cuatro
          campos ocupaban un cuarto de la pantalla antes de mostrar un dato. */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                Filtros
                {filtrosActivos > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {filtrosActivos}
                  </span>
                )}
              </Button>
            }
          />
          <PopoverContent className="w-80 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <CustomSelect
                value={estado}
                onChange={handleEstadoChange}
                options={ESTADOS}
                placeholder="Todos"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fechas</Label>
              <DateRangePicker
                desde={desde}
                hasta={hasta}
                onChange={handleRangoChange}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <CustomSelect
                value={clienteId}
                onChange={handleClienteChange}
                options={[
                  { value: "ALL", label: "Todos" },
                  ...clientes.map((c) => ({ value: c.id, label: nombreCliente(c) })),
                ]}
                placeholder="Todos"
                searchable
                searchPlaceholder="Buscar..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Servicio</Label>
              <CustomSelect
                value={productoId}
                onChange={handleServicioChange}
                options={[
                  { value: "ALL", label: "Todos" },
                  ...productos.map((s) => ({ value: s.id, label: s.nombre })),
                ]}
                placeholder="Todos"
                searchable
                searchPlaceholder="Buscar..."
              />
            </div>
            {/* Quién la cerró y cuándo. Aparte de "Fechas", que es cuándo
                estaba programada: una visita del 3 se puede cerrar el 10. */}
            {cerradores.length > 0 && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Completada por</Label>
                  <CustomSelect
                    value={completadaPor}
                    onChange={(v) => navegar({ completadaPor: v })}
                    options={[
                      { value: "ALL", label: "Cualquiera" },
                      ...cerradores.map((c) => ({
                        value: c.id,
                        label: c.nombre,
                      })),
                    ]}
                    placeholder="Cualquiera"
                    searchable={cerradores.length > 8}
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Completada entre</Label>
                  <DateRangePicker
                    desde={completadaDesde}
                    hasta={completadaHasta}
                    onChange={(d, h) =>
                      navegar({ completadaDesde: d, completadaHasta: h })
                    }
                  />
                </div>
              </>
            )}
            {/* Lo que falta cobrar de trabajo suelto. Lo cubierto por un plan
                no cuenta: no se factura aparte. */}
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
              <Checkbox
                checked={soloSinOrden}
                onCheckedChange={(v) => setSoloSinOrden(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Sin orden
                <span className="block text-xs text-muted-foreground">
                  Con trabajo suelto todavía sin facturar
                </span>
              </span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={limpiarFiltros}
              disabled={filtrosActivos === 0}
            >
              Limpiar filtros
            </Button>
          </PopoverContent>
        </Popover>

        <span className="text-sm text-muted-foreground">
          {visibles.length} {visibles.length === 1 ? "visita" : "visitas"}
        </span>

        <div className="ml-auto inline-flex rounded-lg border bg-card p-0.5">
          {(
            [
              { v: "tabla", label: "Tabla", Icono: List },
              { v: "calendario", label: "Calendario", Icono: CalendarDays },
            ] as const
          ).map(({ v, label, Icono }) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors ${
                vista === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icono className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadingFilter ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : vista === "calendario" ? (
        // El calendario se dibuja aunque no haya nada: un mes vacío es
        // información, y sin grilla no habría cómo pasar al mes siguiente.
        // El scroll lo maneja el calendario, no este envoltorio: así su
        // cabecera y la fila de días quedan fuera del área que se mueve.
        <div className="min-h-0 flex-1">
          <VisitasCalendar
            visitas={visibles}
            mes={mesVisible}
            onMesChange={handleMesChange}
          />
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState message="No hay visitas para este periodo" />
      ) : (
        <VisitasTable visitas={visibles} />
      )}
    </>
  );
}
