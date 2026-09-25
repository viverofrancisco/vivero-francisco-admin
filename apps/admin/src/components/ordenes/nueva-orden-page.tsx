"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  SelectorVariante,
  ivaAlCambiarVariante,
  ivaDeLista,
  precioAlCambiarVariante,
  precioDeLista,
} from "@/components/ordenes/selector-variante";
import {
  SelectorVisitas,
  type VisitaVinculable,
  esPersonalizada,
  lineaPersonalizada,
  origenDeLinea,
  nuevoUid,
  type LineaEditable,
  type Pendiente,
} from "./selector-visitas";
import {
  Casilla,
  SelectorProductos,
  type ProductoElegible,
  type VarianteElegida,
} from "./selector-productos";
import {
  HojaItemPersonalizado,
  type ItemPersonalizado,
} from "./item-personalizado";
import {
  SelectorClienteMovil,
  type ClienteElegible,
} from "@/components/clientes/selector-cliente-movil";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCatalogo } from "./use-catalogo";
import { nombreCliente } from "@vivero/shared";
import { tareasHechas } from "@/lib/visita-tareas";
import { cn } from "@/lib/utils";
import { money, fecha } from "./formato";

/** Un cliente para elegir: lo que la fila del teléfono muestra debajo del nombre. */
type Cliente = ClienteElegible;

/** Un producto del catálogo, con sus variantes. */
type Producto = ProductoElegible;

/**
 * El tipo de línea, el de pendiente y el rearmado por visitas viven en
 * `selector-visitas`: los comparte con la edición de un borrador, que es el
 * mismo formulario en otro momento.
 */
type Linea = LineaEditable;

/**
 * Toda línea que se agrega a mano sale de un producto del catálogo.
 *
 * El SRI pide un `codigoPrincipal` en cada detalle y ese código sale del
 * producto, así que una línea suelta sería una orden imposible de cobrar. Si
 * algo no está en el catálogo, hay que crearlo como producto primero. La única
 * sin producto es la de un período de plan: su código es el número del plan.
 */
function lineaBase(): Omit<Linea, "descripcion" | "productoId"> {
  return {
    uid: nuevoUid(),
    cantidad: "1",
    precioUnitario: "",
    ivaTasa: "0",
    varianteId: null,
    suscripcionId: null,
    periodoInicio: null,
    periodoFin: null,
  };
}

/** Un período pendiente convertido en la línea de la orden. */
function lineaDesde(p: Pendiente): Linea {
  return {
    ...lineaBase(),
    descripcion: p.descripcion,
    precioUnitario: String(Number(p.precio)),
    ivaTasa: String(Number(p.ivaTasa)),
    productoId: null,
    suscripcionId: p.suscripcionId,
    periodoInicio: p.periodoInicio,
    periodoFin: p.periodoFin,
  };
}

/** Clave estable de un pendiente: la misma del índice único de `OrdenLinea`. */
function clavePendiente(p: {
  suscripcionId: string | null;
  periodoInicio: string | null;
}): string {
  return `${p.suscripcionId}:${p.periodoInicio}`;
}

function importes(l: Linea) {
  const subtotal = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
  const iva = (subtotal * (Number(l.ivaTasa) || 0)) / 100;
  return { subtotal, iva, total: subtotal + iva };
}

export function NuevaOrdenPage({
  clientes,
  productos,
  hayMasProductos = false,
  clienteInicial,
  pendientesIniciales,
  visitasIniciales,
  desdeVisita,
}: {
  clientes: Cliente[];
  /** La primera tanda del catálogo. El resto llega al buscar o al bajar. */
  productos: Producto[];
  hayMasProductos?: boolean;
  /** Preseleccionado al venir desde "Por facturar". */
  clienteInicial?: string;
  /**
   * Pendientes del cliente preseleccionado, resueltos en el servidor. Traerlos
   * acá evita un efecto que dispare un fetch al montar, y la pantalla aparece
   * ya completa en vez de con un spinner.
   */
  pendientesIniciales?: Pendiente[];
  /** Las visitas del cliente preseleccionado, para poder marcarlas. */
  visitasIniciales?: VisitaVinculable[];
  /** De qué visita se llegó, para decirlo en pantalla. */
  desdeVisita?: { id: string; numero: number; fecha: string } | null;
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [notas, setNotas] = useState("");
  // La preselección se resuelve en el estado inicial y no en un efecto: así no
  // hay un render con la orden vacía ni un `setState` después de pintar.
  /**
   * El catálogo, de a tandas.
   *
   * `pagina` es lo que muestra el desplegable; `conocidos` es todo lo que se
   * vio, y de ahí salen el precio, el IVA y las variantes de cada línea — si
   * al buscar otra cosa se fueran los anteriores, una línea ya cargada se
   * quedaría sin los suyos. Es **uno solo** para el desplegable del
   * escritorio y el selector del teléfono, por lo mismo.
   */
  const catalogo = useCatalogo(productos, hayMasProductos);

  // Arranca vacía **aunque se llegue desde una visita**: lo que se hizo ahí
  // son tareas, y una tarea no tiene precio. Qué se le cobra al cliente por ese
  // trabajo lo decide quien arma la orden.
  const [lineas, setLineas] = useState<Linea[]>([]);

  /**
   * De qué visitas es esta orden. Vacío = de ninguna.
   *
   * **Pueden ser varias**: cobrarle a alguien el mes entero en una sola orden
   * es lo normal. Se llega con una puesta al entrar desde la ficha de una
   * visita, y las demás se marcan acá. Es traza, no plata: marcar una no carga
   * ninguna línea.
   */
  const [visitaIds, setVisitaIds] = useState<string[]>(
    desdeVisita ? [desdeVisita.id] : []
  );
  /** Se entró desde la visita: sacarla sería no ser esa orden. */
  const bloqueada = desdeVisita != null;
  /** Las visitas del cliente, para poder marcarlas. Se cargan con el cliente. */
  const [visitas, setVisitas] = useState<VisitaVinculable[]>(
    visitasIniciales ?? []
  );
  const [pendientes, setPendientes] = useState<Pendiente[]>(
    pendientesIniciales ?? []
  );
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [productoAAgregar, setProductoAAgregar] = useState("");
  /** Las dos hojas del teléfono: el selector del catálogo y el ítem a mano. */
  const [eligiendoProductos, setEligiendoProductos] = useState(false);
  const [agregandoPersonalizado, setAgregandoPersonalizado] = useState(false);

  async function cargarPendientes(id: string) {
    setCargandoPendientes(true);
    try {
      const res = await fetch(`/api/ordenes/pendientes?clienteId=${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const datos = await res.json();
      setPendientes(datos.items);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos ver lo pendiente"
      );
    } finally {
      setCargandoPendientes(false);
    }
  }

  /**
   * Las visitas del cliente, para poder decir de cuáles es la orden.
   *
   * Se piden aparte de lo pendiente porque ya no son lo mismo: una visita no
   * deja nada por facturar —lo que se hace ahí son tareas— así que la lista es
   * "sus visitas", no "sus visitas con trabajo sin cobrar".
   */
  async function cargarVisitas(id: string) {
    try {
      const res = await fetch(`/api/visitas?clienteId=${id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const items: {
        id: string;
        numero: number;
        fechaProgramada: string;
        estado: string;
        tareasObligatorias: {
          tarea: { id: string; nombre: string; orden: number };
        }[];
        personal: {
          personal: { nombre: string; apellido: string | null };
          tareas: { tarea: { id: string; nombre: string; orden: number } }[];
        }[];
      }[] = await res.json();
      setVisitas(
        items
          .filter((v) => v.estado !== "CANCELADA")
          .map((v) => ({
            id: v.id,
            numero: v.numero,
            fecha: v.fechaProgramada,
            tareas: tareasHechas(v).map((t) => t.nombre),
          }))
      );
    } catch {
      // Sin visitas la orden se arma igual: es traza, no un requisito.
    }
  }

  const seleccionarCliente = async (id: string) => {
    setClienteId(id);
    // Las líneas que venían de pendientes eran de otro cliente: no valen más.
    setLineas((prev) => prev.filter((l) => !l.suscripcionId));
    setVisitaIds([]);
    setPendientes([]);
    setVisitas([]);
    if (!id) return;
    await Promise.all([cargarPendientes(id), cargarVisitas(id)]);
  };

  const agregarProducto = (productoId: string) => {
    const p = catalogo.conocidos.find((x) => x.id === productoId);
    if (!p) return;
    setLineas((prev) => [
      ...prev,
      {
        ...lineaBase(),
        descripcion: p.nombre,
        productoId: p.id,
        // Con una sola no hay nada que preguntar; con varias, el selector.
        varianteId: p.variantes.length === 1 ? p.variantes[0].id : null,
        // El precio y la tasa vienen propuestos y se pueden cambiar: lo que se
        // cobra es lo que quede en la línea.
        precioUnitario:
          p.variantes.length === 1 ? precioDeLista(p.variantes[0]) : "",
        ivaTasa:
          p.variantes.length === 1
            ? ivaDeLista(p.variantes[0], p.ivaTasa)
            : p.ivaTasa != null
              ? String(p.ivaTasa)
              : "0",
      },
    ]);
    setProductoAAgregar("");
  };

  /**
   * Lo que el selector del teléfono devuelve es la selección **entera**:
   * entran las variantes nuevas, con su precio de lista, y salen las que se
   * desmarcaron. Las que ya estaban se quedan como estén, precio tocado
   * incluido. La misma regla que en la app.
   */
  const aplicarSeleccion = (elegidas: VarianteElegida[]) => {
    const ids = new Set(elegidas.map((e) => e.variante.id));
    setLineas((prev) => {
      const quedan = prev.filter((l) => !l.varianteId || ids.has(l.varianteId));
      const nuevas = elegidas
        .filter((e) => !prev.some((l) => l.varianteId === e.variante.id))
        .map<Linea>((e) => ({
          ...lineaBase(),
          // Con varias variantes el nombre dice cuál: en el teléfono no hay
          // un campo aparte para eso, la elección ya se hizo en el selector.
          descripcion:
            e.producto.variantes.length > 1
              ? `${e.producto.nombre} · ${e.variante.nombre}`
              : e.producto.nombre,
          productoId: e.producto.id,
          varianteId: e.variante.id,
          precioUnitario: precioDeLista(e.variante),
          ivaTasa: ivaDeLista(e.variante, e.producto.ivaTasa),
        }));
      return [...quedan, ...nuevas];
    });
    setEligiendoProductos(false);
  };

  const agregarPersonalizado = (item: ItemPersonalizado) => {
    setLineas((prev) => [...prev, { ...lineaPersonalizada(), ...item }]);
    setAgregandoPersonalizado(false);
  };

  // Lo que ya está en la orden no vuelve a ofrecerse. La misma clave que usa
  // el índice único de OrdenLinea, así que coincide con lo que rechaza la BD.
  const yaEnLaOrden = new Set(
    lineas.filter((l) => l.suscripcionId).map(clavePendiente)
  );
  /** Lo único pendiente que existe: los períodos de plan, uno por fila. */
  const periodosPendientes = pendientes
    .filter((p) => !yaEnLaOrden.has(clavePendiente(p)))
    .sort((a, b) => a.periodoInicio.localeCompare(b.periodoInicio));

  /**
   * Una orden es de un plan **o** de unas visitas, nunca de las dos.
   *
   * El servicio lo rechaza y acá se avisa antes: agregar un período con visitas
   * marcadas, o marcar una visita con un período cargado, es armar una orden
   * cuyo total no se puede explicar sin abrirla.
   */
  const tienePeriodo = lineas.some((l) => l.suscripcionId);

  const cambiarVisitas = (ids: string[]) => {
    if (ids.length > 0 && tienePeriodo) {
      toast.error(
        "Esta orden cubre un período de suscripción. Las visitas van en otra."
      );
      return;
    }
    setVisitaIds(ids);
  };

  /**
   * Una orden es de **un** plan: dos planes en la misma orden son dos
   * acuerdos, cada uno con su factura. El servicio lo rechaza; acá se avisa
   * antes de dejar apretar.
   */
  const deOtroPlan = (p: Pendiente) =>
    lineas.some((l) => l.suscripcionId && l.suscripcionId !== p.suscripcionId);

  const agregarPendiente = (p: Pendiente) => {
    if (visitaIds.length > 0) {
      toast.error(
        "Esta orden es por unas visitas. Los períodos de suscripción van en otra."
      );
      return;
    }
    if (deOtroPlan(p)) {
      toast.error(
        "Esta orden ya es de otra suscripción. Arma una orden por plan."
      );
      return;
    }
    setLineas((prev) => [...prev, lineaDesde(p)]);
  };

  const agregarTodosLosPeriodos = () => {
    if (visitaIds.length > 0) {
      toast.error(
        "Esta orden es por unas visitas. Los períodos de suscripción van en otra."
      );
      return;
    }
    // Solo los del plan que ya está en la orden, o del primero de la lista.
    const plan =
      lineas.find((l) => l.suscripcionId)?.suscripcionId ??
      periodosPendientes[0]?.suscripcionId;
    const delPlan = periodosPendientes.filter((p) => p.suscripcionId === plan);
    setLineas((prev) => [...prev, ...delPlan.map(lineaDesde)]);
    if (delPlan.length < periodosPendientes.length) {
      toast.info(
        "Se agregaron los períodos de un solo plan: una orden es de un plan."
      );
    }
  };

  const actualizar = (uid: string, patch: Partial<Linea>) =>
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );

  const quitar = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const totales = lineas.reduce(
    (acc, l) => {
      const i = importes(l);
      return {
        subtotal: acc.subtotal + i.subtotal,
        iva: acc.iva + i.iva,
        total: acc.total + i.total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  /**
   * Crear la orden. Nace en `BORRADOR` —el único estado editable— y la pantalla
   * sigue a su ficha, que es donde se factura.
   *
   * Hubo dos botones: *Guardar borrador* y *Crear y facturar*, que saltaba al
   * armador del documento. Facturar es otro paso, con sus propias decisiones
   * —qué sale impreso, con qué RUC, a nombre de quién— y ofrecerlo en el mismo
   * botón que crea hacía parecer que una orden sin factura era una orden a
   * medias. Un borrador puede quedar sin precios: existe justamente para que
   * alguien los ponga.
   */
  const crear = async () => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (lineas.length === 0) return toast.error("Agrega al menos un producto");
    const sinDescripcion = lineas.find((l) => !l.descripcion.trim());
    if (sinDescripcion) return toast.error("Hay un producto sin descripción");
    const negativo = lineas.find((l) => Number(l.precioUnitario) < 0);
    if (negativo)
      return toast.error(`El precio de "${negativo.descripcion}" es negativo`);

    setGuardando(true);
    try {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          notas: notas.trim() || undefined,
          // Las visitas marcadas: se marcaban y no viajaban, así que la orden
          // nacía sin decir de qué era.
          visitaIds,
          lineas: lineas.map((l) => ({
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad) || 1,
            precioUnitario: Number(l.precioUnitario),
            ivaTasa: Number(l.ivaTasa) || 0,
            productoId: l.productoId,
            varianteId: l.varianteId,
            suscripcionId: l.suscripcionId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const orden = await res.json();
      toast.success(`Orden #${orden.numero} creada`);
      router.push(`/dashboard/ordenes/${orden.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crear la orden");
    } finally {
      setGuardando(false);
    }
  };

  const noSePuedeGuardar = guardando || !clienteId || lineas.length === 0;

  /** Vuelve de donde vino: si se entró desde una visita, cancelar tiene que
      devolver a esa visita y no a la lista de órdenes. */
  const hrefVolver = desdeVisita
    ? `/dashboard/visitas/${desdeVisita.id}`
    : "/dashboard/ordenes";

  /**
   * Una línea, igual en las dos pantallas: el nombre (o el campo, si es
   * personalizada), la papelera, y cantidad, precio e IVA — a tercios en el
   * teléfono, con su ancho fijo en el escritorio.
   *
   * Es una función y no un componente adentro de este: un componente definido
   * acá se recrea en cada render, y React lo desmonta y vuelve a montar, con
   * lo que el campo pierde el foco a cada tecla.
   */
  const renderLinea = (l: Linea) => {
    const i = importes(l);
    const prod = l.productoId
      ? catalogo.conocidos.find((p) => p.id === l.productoId)
      : undefined;
    return (
      <div
        key={l.uid}
        className="space-y-2 rounded-xl border p-3 md:rounded-md"
      >
        <div className="flex items-start gap-2">
          {/* El nombre no se edita aquí. La orden registra **lo que se
              hizo**, y renombrarlo es una decisión de qué sale impreso: eso
              se toma al emitir, donde además se puede juntar todo en una sola
              línea. */}
          <div className="flex flex-1 flex-wrap items-baseline gap-x-2">
            {/* La personalizada se escribe acá: no hay catálogo del que tomar
                el nombre. */}
            {esPersonalizada(l) ? (
              <Input
                value={l.descripcion}
                onChange={(e) =>
                  actualizar(l.uid, { descripcion: e.target.value })
                }
                placeholder="Descripción del ítem *"
                className="max-w-md"
                autoFocus={l.descripcion === ""}
              />
            ) : (
              <p className="text-sm font-medium">{l.descripcion}</p>
            )}
            {origenDeLinea(l) && (
              <span className="text-xs text-muted-foreground">
                {origenDeLinea(l)}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => quitar(l.uid)}
            aria-label="Quitar producto"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-end md:gap-3">
          {/* Sin producto no hay variante que elegir. En el teléfono, con la
              variante ya elegida en el selector, el nombre de la línea la
              dice y el campo sobra; sin elegir todavía, se muestra igual. */}
          {prod && prod.variantes.length > 1 && (
            <div
              className={cn("col-span-3", l.varianteId && "hidden md:block")}
            >
              <SelectorVariante
                variantes={prod.variantes}
                value={l.varianteId}
                onChange={(varianteId) => {
                  const vs = prod.variantes;
                  const antes = vs.find((v) => v.id === l.varianteId);
                  const ahora = vs.find((v) => v.id === varianteId);
                  actualizar(l.uid, {
                    varianteId,
                    precioUnitario: precioAlCambiarVariante(
                      l.precioUnitario,
                      antes,
                      ahora
                    ),
                    ivaTasa: ivaAlCambiarVariante(
                      l.ivaTasa,
                      antes,
                      ahora,
                      prod.ivaTasa
                    ),
                  });
                }}
              />
            </div>
          )}
          <div className="space-y-1 md:w-20">
            <Label className="text-xs">Cant.</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={l.cantidad}
              onChange={(e) => actualizar(l.uid, { cantidad: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:w-28">
            <Label className="text-xs">Precio *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={l.precioUnitario}
              onChange={(e) =>
                actualizar(l.uid, { precioUnitario: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1 md:w-24">
            <Label className="text-xs">IVA %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={l.ivaTasa}
              onChange={(e) => actualizar(l.uid, { ivaTasa: e.target.value })}
            />
          </div>
          <div className="col-span-3 flex items-baseline justify-end gap-1.5 md:col-auto md:ml-auto md:block md:text-right">
            <p className="text-xs text-muted-foreground md:text-xs">
              <span className="text-sm font-bold text-foreground md:hidden">
                Total
              </span>
              <span className="hidden md:inline">Total</span>
            </p>
            <p className="font-bold tabular-nums md:font-semibold">
              {money(i.total)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  /** Subtotal, IVA y total: al pie de las líneas, que es de donde salen. */
  const renderTotales = () => (
    <>
      <FilaDePago etiqueta="Subtotal" valor={money(totales.subtotal)} />
      <FilaDePago etiqueta="IVA" valor={money(totales.iva)} />
      <FilaDePago etiqueta="Total" valor={money(totales.total)} fuerte />
    </>
  );

  const hayVisitasParaMarcar =
    Boolean(clienteId) && (visitas.length > 0 || visitaIds.length > 0);
  const hayPeriodosParaOfrecer =
    Boolean(clienteId) &&
    visitaIds.length === 0 &&
    periodosPendientes.length > 0;

  return (
    <div className="pb-6 md:space-y-6">
      {/* Pegado arriba, con las acciones: una orden puede tener quince líneas y
          guardar no puede quedar a un scroll de distancia de lo que se edita. */}
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur-sm">
        {/* En el teléfono, la cabecera de la app: Cancelar a la izquierda, el
            título en el medio, Crear a la derecha. Sin subtítulo: lo que la
            pantalla es se ve en la pantalla. */}
        <div className="flex h-12 items-center gap-1.5 px-2.5 md:hidden">
          <Link
            href={hrefVolver}
            className="min-w-[76px] rounded-lg px-1.5 py-1.5 text-base font-semibold text-muted-foreground active:bg-muted"
          >
            Cancelar
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
            Nueva orden
          </h1>
          <button
            type="button"
            onClick={crear}
            disabled={noSePuedeGuardar}
            className="flex min-w-[76px] items-center justify-end rounded-lg px-1.5 py-1.5 text-base font-bold text-primary active:bg-muted disabled:text-muted-foreground"
          >
            {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear"}
          </button>
        </div>

        {/* En el escritorio, como siempre. */}
        <div className="hidden flex-wrap items-center gap-3 px-6 py-3 md:flex">
          <Link href={hrefVolver}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Nueva orden</h1>
            {/* Llegando desde una visita hay que decirlo: si no, la línea ya
                cargada parece salida de la nada. */}
            {desdeVisita ? (
              <p className="text-sm text-muted-foreground">
                Con el trabajo de la{" "}
                <Link
                  href={`/dashboard/visitas/${desdeVisita.id}`}
                  className="text-primary hover:underline"
                >
                  visita del {fecha(desdeVisita.fecha)}
                </Link>{" "}
                ya cargado. Puedes sumarle más productos antes de guardar.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Arma la orden con lo que se vendió. Facturarla es el paso
                siguiente, desde su ficha.
              </p>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            {/* Un solo botón: crea el borrador y va a su ficha. Facturar es el
                paso siguiente, con sus propias decisiones, y vive allá. */}
            <Button onClick={crear} disabled={noSePuedeGuardar}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </div>
        </div>
      </div>

      {/* ══ Teléfono: la pantalla de la app, en el mismo orden ═══════════
          Secciones separadas por bandas, como Shopify: cada bloque es una
          pregunta —para quién, qué, cuánto— y la banda gris del fondo es lo
          que las separa sin recuadrar cada una. El escritorio se dibuja aparte
          más abajo, sobre el mismo estado: es la misma orden en dos anchos. */}
      <div className="space-y-2 md:hidden">
        <Seccion titulo="Cliente">
          <SelectorClienteMovil
            clientes={clientes}
            valor={clienteId || null}
            onElegir={seleccionarCliente}
          />
        </Seccion>

        <Seccion titulo="Productos">
          {/* Dos botones, como Shopify: del catálogo —varios de una, en su
              propia hoja— o un ítem personalizado escrito a mano. */}
          <div className="flex gap-2.5">
            <Button
              className="h-11 flex-1 rounded-xl text-[15px]"
              onClick={() => setEligiendoProductos(true)}
            >
              Agregar producto
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl text-[15px]"
              onClick={() => setAgregandoPersonalizado(true)}
            >
              Ítem personalizado
            </Button>
          </div>

          {lineas.length > 0 && (
            <div className="mt-2.5 space-y-2">{lineas.map(renderLinea)}</div>
          )}

          {/* Los períodos de plan sin orden, uno por fila. Con visitas
              marcadas no se ofrecen: una orden es de un plan o de visitas. */}
          {hayPeriodosParaOfrecer && (
            <div className="mt-2">
              <p className="mb-1 text-[13px] font-semibold text-muted-foreground">
                Períodos por facturar
              </p>
              {cargandoPendientes ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              ) : (
                periodosPendientes.map((p) => (
                  <div
                    key={clavePendiente(p)}
                    className="flex items-center gap-3 border-t py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {fecha(p.periodoInicio)} → {fecha(p.periodoFin)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Suscripción #{p.suscripcionNumero} · {p.propiedad} ·{" "}
                        {money(Number(p.precio))}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-none"
                      onClick={() => agregarPendiente(p)}
                    >
                      Agregar
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Pago">{renderTotales()}</Seccion>

        {/* De qué visitas es la orden: una etiqueta, no carga líneas. */}
        {hayVisitasParaMarcar && (
          <Seccion titulo="Visitas">
            {tienePeriodo ? (
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                Esta orden cubre un período de suscripción. Las visitas van en
                otra orden.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[13px] leading-[18px] text-muted-foreground">
                  Deja dicho por qué existe esta orden y permite ir de una a la
                  otra. No carga productos.
                </p>
                {visitas.map((v) => {
                  const marcada = visitaIds.includes(v.id);
                  const trabada =
                    bloqueada && desdeVisita?.id === v.id && marcada;
                  return (
                    /* La fila entera es lo que se toca, con la casilla
                       dibujada adentro: un botón adentro de otro no es HTML
                       válido, y dos que se disputan el toque marcan y
                       desmarcan en un solo gesto. */
                    <button
                      key={v.id}
                      type="button"
                      disabled={trabada}
                      onClick={() =>
                        cambiarVisitas(
                          marcada
                            ? visitaIds.filter((x) => x !== v.id)
                            : [...visitaIds, v.id]
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-3 border-t py-2.5 text-left",
                        trabada ? "opacity-60" : "active:bg-muted"
                      )}
                    >
                      <Casilla
                        estado={marcada ? "si" : "no"}
                        className="h-[22px] w-[22px] rounded-md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          Visita #{v.numero} · {fecha(v.fecha)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.tareas.length > 0
                            ? v.tareas.join(", ")
                            : "Sin tareas registradas"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </Seccion>
        )}

        <Seccion titulo="Notas">
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
            rows={3}
            className="rounded-xl"
          />
        </Seccion>
      </div>

      {/* ══ Escritorio ═══════════════════════════════════════════════════ */}
      <div className="hidden items-start gap-6 px-6 md:grid lg:grid-cols-[1fr_360px]">
        {/* ── Líneas ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay nada en la orden.
                </p>
              ) : (
                <div className="space-y-3">{lineas.map(renderLinea)}</div>
              )}

              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <div className="min-w-[220px] flex-1 space-y-1">
                  <Label className="text-xs">Agregar del catálogo</Label>
                  <CustomSelect
                    value={productoAAgregar}
                    onChange={agregarProducto}
                    options={catalogo.pagina.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                    }))}
                    placeholder="Buscar producto..."
                    searchable
                    // El catálogo se busca y se pagina en el servidor: traerlo
                    // entero al abrir la pantalla se paga aunque la orden
                    // termine con dos líneas.
                    onBuscar={catalogo.onBuscar}
                    onMas={catalogo.onMas}
                    hayMas={catalogo.hayMas}
                    cargando={catalogo.cargando}
                    searchPlaceholder="Buscar producto..."
                  />
                </div>
                {/* Un trabajo puntual que no vale la pena dar de alta como
                    producto: se escribe y se cobra, con un código genérico
                    impreso. El ítem personalizado de Shopify. */}
                <Button
                  variant="outline"
                  onClick={() =>
                    setLineas((prev) => [...prev, lineaPersonalizada()])
                  }
                >
                  Ítem personalizado
                </Button>
              </div>

              {/* Los totales al pie de las líneas, que es de donde salen. En la
                  columna de al lado obligaban a mirar a otro lado para ver el
                  efecto de lo que se acaba de tipear. */}
              {lineas.length > 0 && (
                <div className="border-t pt-2 text-sm">{renderTotales()}</div>
              )}
            </CardContent>
          </Card>

          {/* Debajo de los productos porque **es** la forma de cargarlos: se
              marcan las visitas y entra su trabajo entero. Marcar no es una
              etiqueta —la cabecera de la orden sale de la procedencia de las
              líneas—, así que marcar sin traer el trabajo sería una asignación
              que no queda registrada en ningún lado.

              Lista con casillas y no un desplegable: se eligen **varias**, y
              hay que ver de un vistazo cuáles están marcadas. */}
          {hayVisitasParaMarcar && (
            <SelectorVisitas
              visitas={visitas}
              marcadas={visitaIds}
              onCambiar={cambiarVisitas}
              fija={bloqueada ? desdeVisita?.id : null}
              deshabilitado={tienePeriodo}
              motivoDeshabilitado="Esta orden cubre un período de suscripción. Las visitas van en otra orden."
            />
          )}

          {/* ── Períodos de suscripción por facturar ─────────────── */}
          {hayPeriodosParaOfrecer && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">
                  Períodos por facturar
                </CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={agregarTodosLosPeriodos}
                  >
                    Agregar todos
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {cargandoPendientes ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando…
                  </div>
                ) : (
                  <div className="divide-y">
                    {periodosPendientes.map((p) => (
                      <div
                        key={clavePendiente(p)}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {fecha(p.periodoInicio)} → {fecha(p.periodoFin)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Suscripción #{p.suscripcionNumero} · {p.propiedad}
                          </p>
                        </div>
                        <div className="flex flex-none items-center gap-3">
                          {/* Sin IVA, como el precio de la línea que va a
                              crear: el total con IVA se ve abajo. */}
                          <span className="font-semibold tabular-nums">
                            {money(Number(p.precio))}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => agregarPendiente(p)}
                          >
                            Agregar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Cliente y notas ────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                value={clienteId}
                onChange={seleccionarCliente}
                // El inactivo se ve y no se elige, como en el teléfono y en la
                // app: si volvió a contratar, primero se lo reactiva.
                options={clientes.map((c) => ({
                  value: c.id,
                  label: nombreCliente(c),
                  disabled: c.inactivoDesde !== null,
                  hint: c.inactivoDesde !== null ? "Inactivo" : undefined,
                }))}
                placeholder="Seleccionar cliente"
                searchable
                searchPlaceholder="Buscar cliente..."
              />
            </CardContent>
          </Card>

          {/* A nombre de quién sale la factura no se pregunta acá: es una
              decisión de la emisión, y el armador del documento la hace con
              los datos del cliente delante. Preguntarla al armar la orden era
              pedir dos veces lo mismo, y la segunda era la que valía. */}

          {/* Notas en la columna derecha, con lo demás que describe la orden y
              no lo que se vendió. Entre las líneas y el catálogo interrumpía
              el armado. */}
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Las dos hojas del teléfono. Se montan una vez, fuera de los dos
          árboles, y viven en un portal: no les importa cuál se está viendo. */}
      <SelectorProductos
        abierto={eligiendoProductos}
        catalogo={catalogo}
        yaElegidas={lineas
          .map((l) => l.varianteId)
          .filter((id): id is string => !!id)}
        onCerrar={() => setEligiendoProductos(false)}
        onGuardar={aplicarSeleccion}
      />
      <HojaItemPersonalizado
        abierto={agregandoPersonalizado}
        onCerrar={() => setAgregandoPersonalizado(false)}
        onAgregar={agregarPersonalizado}
      />
    </div>
  );
}

/**
 * Una sección del teléfono: blanca, con su título, sobre el fondo gris que
 * hace de banda entre una y la siguiente. La `Seccion` de la app.
 */
function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card px-4 py-3.5">
      <h2 className="mb-2.5 text-[17px] font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

/** Una fila de Subtotal / IVA / Total. */
function FilaDePago({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between border-t py-2 text-sm first:border-t-0 md:first:border-t",
        fuerte ? "font-bold md:text-base" : "text-muted-foreground"
      )}
    >
      <span className={cn(fuerte && "text-foreground")}>{etiqueta}</span>
      <span className={cn("tabular-nums", !fuerte && "text-foreground")}>
        {valor}
      </span>
    </div>
  );
}
