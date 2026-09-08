"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hoyISOEcuador } from "@/lib/fechas";
import { useBusquedaEnUrl, useFiltroUrl } from "@/lib/filtros-url";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { VisitasTable } from "@/components/visitas/visitas-table";
import { VisitasCalendar } from "@/components/visitas/visitas-calendar";
import { EmptyState } from "@/components/shared/empty-state";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import { CalendarDays, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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


interface VisitasPageClientProps {
  initialVisitas: VisitaRow[];
  initialDesde: string;
  initialHasta: string;
  /**
   * Los filtros que ya aplicó el servidor. Vienen de él y no de la URL leída
   * acá para que la pantalla no pueda mostrar un filtro que la lista no tiene.
   */
  filtros: {
    q?: string;
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
  productos: FilterOption[];
}

export function VisitasPageClient({
  initialVisitas,
  initialDesde,
  initialHasta,
  filtros,
  cerradores,
  userRole,
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
  const texto = filtros.q ?? "";
  const estado = filtros.estado ?? "ALL";
  // Ya no tiene control propio —lo reemplazó el buscador— pero sigue leyéndose
  // porque un enlace puede traer `?cliente=<id>`. Cuenta como filtro puesto, y
  // "Limpiar" lo saca; si no, quedaría una lista recortada sin nada que lo diga.
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
  /**
   * Modo selección de móvil. Vive acá y no en la tabla porque se prende desde
   * el menú del encabezado, que es la única barra de herramientas del teléfono.
   */
  const [seleccionando, setSeleccionando] = useState(false);
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

  // El buscador escribe en su propio estado y recién después navega: la lista
  // la trae el servidor, así que pedirla en cada tecla es una consulta por
  // letra. El hook es el que sabe distinguir el eco de la URL de un cambio de
  // afuera, que es lo que antes se comía las letras tecleadas mientras la
  // consulta viajaba.
  const [buscado, setBuscado] = useBusquedaEnUrl(texto, (v) =>
    navegar({ q: v })
  );

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
      q: "",
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
    v.productos.some((p) => !p.suscripcionItemId && !p.ordenLineaOrigen);

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
        actions={
          userRole !== "PERSONAL"
            ? [
                {
                  label: "Nueva Visita",
                  href: "/dashboard/visitas/nueva",
                  icon: "plus",
                  primary: true,
                },
                // Solo en móvil, solo en la tabla y solo si hay algo que
                // marcar: en escritorio las casillas ya están en cada fila, y
                // en el calendario no hay filas.
                ...(vista === "tabla" && !seleccionando && visibles.length > 0
                  ? [
                      {
                        label: "Seleccionar visitas",
                        onClick: () => setSeleccionando(true),
                        soloMovil: true,
                      } as const,
                    ]
                  : []),
              ]
            : []
        }
      />

      {/* Una sola fila de controles: las cinco pastillas de estado más cuatro
          campos ocupaban un cuarto de la pantalla antes de mostrar un dato. */}
      <div className="flex flex-wrap items-center gap-3">
        <BarraFiltros
          escritorio="popover"
          activos={filtrosActivos}
          onLimpiar={limpiarFiltros}
          className="min-w-0 flex-1"
          busqueda={
            <div className="relative min-w-0 flex-1 md:min-w-[220px] md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={buscado}
                onChange={(e) => setBuscado(e.target.value)}
                className="pl-9"
              />
            </div>
          }
        >

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
            {/* Solo en escritorio: el panel de móvil trae su propio
                "Limpiar" al pie, y dos seguidos son dos maneras de lo mismo. */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden w-full md:inline-flex"
              onClick={limpiarFiltros}
              disabled={filtrosActivos === 0}
            >
              Limpiar filtros
            </Button>
        </BarraFiltros>

        {/* Solo los íconos: una tabla y un calendario se reconocen sin que se
            los nombre, y el par de etiquetas se comía el ancho que necesita el
            buscador. El nombre sigue estando para quien no ve el ícono. */}
        <div className="inline-flex flex-none rounded-lg border bg-card p-0.5">
          {(
            [
              { v: "tabla", label: "Tabla", Icono: List },
              { v: "calendario", label: "Calendario", Icono: CalendarDays },
            ] as const
          ).map(({ v, label, Icono }) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVista(v);
                setSeleccionando(false);
              }}
              aria-label={label}
              aria-pressed={vista === v}
              title={label}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                vista === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icono className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* La lista de antes se queda puesta mientras viaja la nueva, apenas
          apagada. Cambiarla por un "Cargando..." en cada respiro del buscador
          hacía parecer que la pantalla se recargaba sola mientras se escribe. */}
      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity ${
          loadingFilter ? "opacity-60" : ""
        }`}
        aria-busy={loadingFilter}
      >
        {vista === "calendario" ? (
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
          <VisitasTable
            visitas={visibles}
            puedeEliminar={userRole !== "PERSONAL"}
            seleccionando={seleccionando}
            onSalirSeleccion={() => setSeleccionando(false)}
          />
        )}
      </div>
    </>
  );
}
