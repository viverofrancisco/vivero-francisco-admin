"use client";

import { useState } from "react";
import { hoyISOEcuador } from "@/lib/fechas";
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
  userRole?: string;
  clientes: ClienteFilterOption[];
  productos: FilterOption[];
}

export function VisitasPageClient({
  initialVisitas,
  initialDesde,
  initialHasta,
  userRole,
  clientes,
  productos,
}: VisitasPageClientProps) {
  const [visitas, setVisitas] = useState(initialVisitas);
  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);
  const [estado, setEstado] = useState("ALL");
  /**
   * Solo las que tienen trabajo suelto sin cobrar.
   *
   * Se filtra en el cliente y no en la API porque la respuesta ya trae la
   * procedencia de cada producto: agregar un parámetro al endpoint sería pedir
   * de vuelta lo que ya está en la mano.
   */
  const [soloSinOrden, setSoloSinOrden] = useState(false);
  const [clienteId, setClienteId] = useState("ALL");
  const [productoId, setServicioId] = useState("ALL");
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [vista, setVista] = useState<"tabla" | "calendario">("tabla");

  const fetchVisitas = async (
    d: string,
    h: string,
    e: string,
    cId: string,
    sId: string
  ) => {
    setLoadingFilter(true);
    try {
      const params = new URLSearchParams();
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);
      if (e !== "ALL") params.set("estado", e);
      if (cId !== "ALL") params.set("clienteId", cId);
      if (sId !== "ALL") params.set("productoId", sId);
      const res = await fetch(`/api/visitas?${params}`);
      if (res.ok) {
        const data: VisitaRow[] = await res.json();
        // La API serializa la fecha como ISO completo y el server component
        // como `YYYY-MM-DD`. Se unifica acá para que nadie aguas abajo tenga
        // que saber de dónde vino la lista.
        setVisitas(
          data.map((v) => ({
            ...v,
            fechaProgramada: v.fechaProgramada.slice(0, 10),
          }))
        );
      }
    } finally {
      setLoadingFilter(false);
    }
  };

  /**
   * El rango llega completo, así que no hay estado intermedio que validar: un
   * día suelto viaja como `desde === hasta` y la consulta devuelve solo ese día.
   */
  const handleRangoChange = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    fetchVisitas(d, h, estado, clienteId, productoId);
  };

  const handleEstadoChange = (v: string) => {
    setEstado(v);
    fetchVisitas(desde, hasta, v, clienteId, productoId);
  };

  const handleClienteChange = (v: string) => {
    setClienteId(v);
    fetchVisitas(desde, hasta, estado, v, productoId);
  };

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
    (desde || hasta ? 1 : 0);

  const limpiarFiltros = () => {
    setClienteId("ALL");
    setServicioId("ALL");
    setEstado("ALL");
    setSoloSinOrden(false);
    setDesde("");
    setHasta("");
    fetchVisitas("", "", "ALL", "ALL", "ALL");
  };

  /** Le queda trabajo suelto que todavía no entró en ninguna orden. */
  const sinOrden = (v: VisitaRow) =>
    v.estado !== "CANCELADA" &&
    v.productos.some((p) => !p.suscripcionItemId && !p.ordenLinea);

  const visibles = soloSinOrden ? visitas.filter(sinOrden) : visitas;

  const handleServicioChange = (v: string) => {
    setServicioId(v);
    fetchVisitas(desde, hasta, estado, clienteId, v);
  };

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
    setDesde(primero);
    setHasta(ultimo);
    fetchVisitas(primero, ultimo, estado, clienteId, productoId);
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
