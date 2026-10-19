"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SelectorCiudad } from "@/components/shared/selector-ciudad";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MultiDateCalendar } from "@/components/ui/multi-date-calendar";
import { PersonalSelector } from "@/components/grupos/personal-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { SelectorTareas } from "@/components/visitas/selector-tareas";
import { PERIODICIDAD_LABEL, unidadDePeriodo } from "@/lib/periodos";

interface TareaCatalogo {
  id: string;
  nombre: string;
}

interface SuscripcionOpcion {
  id: string;
  numero: number;
  periodicidad: string;
  visitasPorPeriodo: number;
  /** De qué jardín es el plan: elegirlo elige la propiedad. */
  propiedad: { id: string; nombre: string };
}

interface Cliente {
  id: string;
  nombre: string;
  apellido?: string | null;
  empresa?: string | null;
  /** Marcado como inactivo: se ve, atenuado, y no se puede elegir. */
  inactivoDesde: string | null;
  /** Dónde se le trabaja. Casi siempre una; a veces dos o tres. */
  propiedades: { id: string; nombre: string; direccion: string | null }[];
  suscripciones: SuscripcionOpcion[];
}

interface Grupo {
  id: string;
  nombre: string;
  miembrosIds: string[];
}

/** "Casa · Mensual · 4 visitas/mes": lo que distingue un plan de otro. */
function describirPlan(sus: SuscripcionOpcion): string {
  return `${sus.propiedad.nombre} · ${PERIODICIDAD_LABEL[sus.periodicidad] ?? sus.periodicidad} · ${sus.visitasPorPeriodo} visita${sus.visitasPorPeriodo === 1 ? "" : "s"}/${unidadDePeriodo(sus.periodicidad)}`;
}

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

interface Props {
  clientes: Cliente[];
  tareas: TareaCatalogo[];
  grupos: Grupo[];
  personalList: PersonalOption[];
  /** Preseleccionado al venir desde una suscripción. */
  suscripcionInicial?: string;
  /** La solicitud de donde sale, al agendar desde *Solicitudes*. */
  solicitud?: SolicitudDeOrigen;
}

interface SolicitudDeOrigen {
  id: string;
  numero: number;
  mensaje: string;
  direccion: string | null;
  /** `null`: la mandó un invitado; el alta arranca en *Cliente nuevo* con sus datos. */
  clienteId: string | null;
  propiedadId: string | null;
  contacto: {
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    email: string | null;
  };
  /** La otra dirección por partes, para arrancar *Propiedad nueva* con ella. */
  lugar: LugarNuevo & { lat: number | null; lng: number | null };
  /** Los nombres de los servicios que marcó. */
  servicios: string[];
}

/** Un cliente escrito en el alta (`clienteNuevo` del servidor). */
interface ClienteNuevo {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}
/** Una propiedad escrita en el alta (`propiedadNueva`). */
interface LugarNuevo {
  direccion: string;
  numeroCasa: string;
  ciudad: string;
  referencia: string;
}
const CLIENTE_VACIO: ClienteNuevo = { nombre: "", apellido: "", telefono: "", email: "" };
const LUGAR_VACIO: LugarNuevo = { direccion: "", numeroCasa: "", ciudad: "", referencia: "" };

const fechaCorta = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Alta de visitas.
 *
 * Todo se ve de una: no hay pasos ni campos que aparezcan al elegir cliente.
 * Agendar es una sola decisión —cuándo, a quién y con quién— y encadenarlas
 * obligaba a empezar de cero cada vez que se cambiaba la primera.
 *
 * **No se eligen productos.** Lo que se hace en una visita son tareas, y las
 * marca cada jardinero al terminar; acá lo único que se decide sobre el trabajo
 * es si alguna tarea es **obligatoria**, que es la pregunta que la oficina se
 * va a hacer después: "¿hicieron lo que había que hacer?".
 */
export function NuevaVisitaPage({
  clientes,
  suscripcionInicial,
  solicitud,
  tareas,
  grupos,
  personalList,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Con un plan preseleccionado, el cliente sale de él: es su dueño y no hay
  // nada que elegir. Se resuelve en el estado inicial y no en un efecto.
  const [clienteId, setClienteId] = useState(
    () =>
      solicitud?.clienteId ??
      clientes.find((c) =>
        c.suscripciones.some((s) => s.id === suscripcionInicial)
      )?.id ??
      ""
  );
  // Con un plan preseleccionado la propiedad es la del plan; si no, sale sola
  // cuando el cliente tiene una, que es casi siempre.
  const [propiedadId, setPropiedadId] = useState(() => {
    if (solicitud) {
      const dueno = clientes.find((x) => x.id === solicitud.clienteId);
      const suya = dueno?.propiedades.find((p) => p.id === solicitud.propiedadId);
      if (suya) return suya.id;
      return dueno?.propiedades.length === 1 ? dueno.propiedades[0].id : "";
    }
    const c = clientes.find((x) =>
      x.suscripciones.some((s) => s.id === suscripcionInicial)
    );
    const plan = c?.suscripciones.find((s) => s.id === suscripcionInicial);
    if (plan) return plan.propiedad.id;
    return c?.propiedades.length === 1 ? c.propiedades[0].id : "";
  });
  const [tareaIds, setTareaIds] = useState<string[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [personalIds, setPersonalIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  /**
   * De qué plan es la visita. Vacío = trabajo aparte, se cobra en una orden.
   *
   * Una sola decisión y de la visita entera. El plan es de un jardín, así que
   * elegirlo pone su propiedad, y cambiar de propiedad suelta un plan que no
   * sea de esa.
   */
  const [suscripcionId, setSuscripcionId] = useState(
    suscripcionInicial ?? ""
  );

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  /**
   * **Un cliente o una propiedad que todavía no existen se escriben acá**,
   * como en Shopify, en vez de ir a darlos de alta a otra pantalla y volver:
   * nacen con la visita, en la misma transacción (`createVisitasBatch`).
   * `null` es elegir uno que ya está. La solicitud de un invitado arranca en
   * *Cliente nuevo* con sus datos, y una con otra dirección en *Propiedad
   * nueva* con esa dirección: nada de eso se guarda hasta crear la visita.
   */
  const [clienteNuevo, setClienteNuevo] = useState<ClienteNuevo | null>(() =>
    solicitud && !solicitud.clienteId
      ? {
          nombre: solicitud.contacto.nombre ?? "",
          apellido: solicitud.contacto.apellido ?? "",
          telefono: solicitud.contacto.telefono ?? "",
          email: solicitud.contacto.email ?? "",
        }
      : null
  );
  const [lugarNuevo, setLugarNuevo] = useState<LugarNuevo | null>(() =>
    solicitud && !solicitud.propiedadId && solicitud.direccion
      ? {
          direccion: solicitud.lugar.direccion,
          numeroCasa: solicitud.lugar.numeroCasa,
          ciudad: solicitud.lugar.ciudad,
          referencia: solicitud.lugar.referencia,
        }
      : null
  );
  const [nombreDelLugar, setNombreDelLugar] = useState("");
  /** El pin de la solicitud viaja con la propiedad nueva si arrancó de ella. */
  const pinDelLugar =
    solicitud && lugarNuevo && solicitud.lugar.lat !== null
      ? { lat: solicitud.lugar.lat, lng: solicitud.lugar.lng }
      : {};
  // Con un cliente nuevo la propiedad siempre es nueva (o la *Principal* vacía).
  const lugarEnUso = clienteNuevo ? (lugarNuevo ?? LUGAR_VACIO) : lugarNuevo;
  const clienteListo = clienteNuevo ? clienteNuevo.nombre.trim().length > 0 : !!clienteId;
  const lugarListo = clienteNuevo || lugarNuevo ? true : !!propiedadId;

  /** Adónde vuelve: de una solicitud, a Solicitudes; si no, a Visitas. */
  const volver = solicitud ? "/dashboard/solicitudes" : "/dashboard/visitas";
  // Un plan es de una propiedad que ya está: con algo nuevo no hay planes.
  const planes = clienteNuevo || lugarNuevo ? [] : (cliente?.suscripciones ?? []);

  const elegirPlan = (id: string) => {
    setSuscripcionId(id);
    const plan = planes.find((s) => s.id === id);
    if (plan) setPropiedadId(plan.propiedad.id);
  };

  const elegirPropiedad = (id: string) => {
    setPropiedadId(id);
    const plan = planes.find((s) => s.id === suscripcionId);
    if (plan && plan.propiedad.id !== id) setSuscripcionId("");
  };

  // El orden del catálogo manda, así la lista no salta al elegir.
  const elegidas = tareas.filter((t) => tareaIds.includes(t.id));

  /**
   * Al elegir cliente, su propiedad queda elegida sola si tiene una sola.
   *
   * Es el caso de casi todos, y obligar a tocar un desplegable de un solo ítem
   * es cobrarle a todos por el caso de los pocos que tienen dos.
   */
  const elegirCliente = (id: string) => {
    setClienteId(id);
    setSuscripcionId("");
    const c = clientes.find((x) => x.id === id);
    setPropiedadId(c?.propiedades.length === 1 ? c.propiedades[0].id : "");
  };

  const alternarTarea = (id: string) =>
    setTareaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const aplicarGrupo = (id: string) => {
    setGrupoId(id);
    const g = grupos.find((x) => x.id === id);
    if (g) setPersonalIds(g.miembrosIds);
  };

  const crear = async () => {
    setConfirmar(false);
    setLoading(true);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(clienteNuevo
            ? {
                clienteNuevo: {
                  nombre: clienteNuevo.nombre.trim(),
                  apellido: clienteNuevo.apellido.trim() || undefined,
                  telefono: clienteNuevo.telefono.trim() || undefined,
                  email: clienteNuevo.email.trim() || undefined,
                },
              }
            : { clienteId }),
          ...(lugarEnUso
            ? {
                propiedadNueva: {
                  nombre: nombreDelLugar.trim() || undefined,
                  direccion: lugarEnUso.direccion.trim() || undefined,
                  numeroCasa: lugarEnUso.numeroCasa.trim() || undefined,
                  ciudad: lugarEnUso.ciudad.trim() || undefined,
                  referencia: lugarEnUso.referencia.trim() || undefined,
                  ...pinDelLugar,
                },
              }
            : { propiedadId }),
          tareasObligatoriasIds: tareaIds,
          suscripcionId: (!clienteNuevo && !lugarNuevo && suscripcionId) || null,
          fechas,
          grupoId: grupoId || undefined,
          personalIds,
          notas: notas.trim() || undefined,
          solicitudId: solicitud?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success(
        fechas.length === 1 ? "Visita creada" : `${fechas.length} visitas creadas`
      );
      router.push(volver);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crear la visita");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href={volver}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nueva visita</h1>
          <p className="text-sm text-muted-foreground">
            Una visita por fecha elegida. Lo que se hizo lo marca cada jardinero
            al terminar.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link href={volver}>
            <Button variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </Link>
          <Button
            onClick={() => setConfirmar(true)}
            disabled={loading || !clienteListo || !lugarListo || fechas.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {fechas.length > 1
              ? `Crear ${fechas.length} visitas`
              : "Crear visita"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 md:px-6 lg:grid-cols-3">
        {/* ── Qué y cuándo ─────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Tareas obligatorias</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {elegidas.length}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Lo que esta visita tiene que dejar hecho. Es opcional: no impide
                hacer otras cosas ni frena nada, pero la visita va a mostrar
                cuáles quedaron sin cubrir.
              </p>
              {elegidas.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Sin tareas obligatorias.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {elegidas.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.nombre}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-none"
                        onClick={() => alternarTarea(t.id)}
                        aria-label={`Quitar ${t.nombre}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEligiendo(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar tareas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Fechas</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {fechas.length} {fechas.length === 1 ? "visita" : "visitas"}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <MultiDateCalendar value={fechas} onChange={setFechas} />
              {fechas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {fechas.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setFechas((prev) => prev.filter((x) => x !== f))
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/70"
                    >
                      {fechaCorta(f)}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFechas([])}
                    className="ml-1 text-xs text-muted-foreground hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

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

        {/* ── A quién y con quién ──────────────────────────────────── */}
        <div className="space-y-6">
          {/* Lo que pidió el cliente, a la vista mientras se agenda: es de
              donde salen las tareas y las notas. */}
          {solicitud ? (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">
                  Solicitud #{solicitud.numero}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {solicitud.servicios.length ? (
                  <p className="font-medium text-primary">
                    {solicitud.servicios.join(", ")}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{solicitud.mensaje}</p>
                {solicitud.direccion ? (
                  <p className="text-muted-foreground">
                    Dónde: {solicitud.direccion}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Al crear la visita, la solicitud queda atendida.
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {clienteNuevo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Campo
                      etiqueta="Nombre *"
                      valor={clienteNuevo.nombre}
                      onCambio={(v) => setClienteNuevo({ ...clienteNuevo, nombre: v })}
                    />
                    <Campo
                      etiqueta="Apellido"
                      valor={clienteNuevo.apellido}
                      onCambio={(v) => setClienteNuevo({ ...clienteNuevo, apellido: v })}
                    />
                  </div>
                  <Campo
                    etiqueta="Teléfono"
                    tipo="tel"
                    valor={clienteNuevo.telefono}
                    onCambio={(v) => setClienteNuevo({ ...clienteNuevo, telefono: v })}
                  />
                  <Campo
                    etiqueta="Correo"
                    tipo="email"
                    valor={clienteNuevo.email}
                    onCambio={(v) => setClienteNuevo({ ...clienteNuevo, email: v })}
                  />
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => setClienteNuevo(null)}
                  >
                    Elegir un cliente existente
                  </button>
                </div>
              ) : (
                <>
                  <CustomSelect
                    value={clienteId}
                    onChange={elegirCliente}
                    // El inactivo se ve, atenuado y sin poder elegirse: saberlo
                    // ahí mismo es mejor que no encontrarlo.
                    options={clientes.map((c) => ({
                      value: c.id,
                      label: nombreCliente(c),
                      disabled: c.inactivoDesde !== null,
                      hint: c.inactivoDesde !== null ? "Inactivo" : undefined,
                    }))}
                    placeholder="Seleccionar cliente"
                    searchable
                    searchPlaceholder="Buscar cliente..."
                    clearable
                  />
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      setClienteNuevo(CLIENTE_VACIO);
                      setClienteId("");
                      setPropiedadId("");
                      setSuscripcionId("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Cliente nuevo
                  </button>
                </>
              )}

              {/* Dónde. Con una sola propiedad ya viene elegida y el
                  desplegable solo confirma; con varias es la decisión que
                  antes no existía porque la dirección era del cliente. Una
                  que no está se escribe acá y nace con la visita. */}
              {cliente || clienteNuevo ? (
                <div className="mt-4 space-y-1.5">
                  <Label>Propiedad</Label>
                  {lugarEnUso ? (
                    <div className="space-y-3">
                      <Campo
                        etiqueta="Nombre"
                        placeholder={clienteNuevo ? "Principal" : "La calle, si lo dejas vacío"}
                        valor={nombreDelLugar}
                        onCambio={setNombreDelLugar}
                      />
                      <Campo
                        etiqueta="Calle"
                        valor={lugarEnUso.direccion}
                        onCambio={(v) => setLugarNuevo({ ...lugarEnUso, direccion: v })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Campo
                          etiqueta="Número de casa"
                          valor={lugarEnUso.numeroCasa}
                          onCambio={(v) => setLugarNuevo({ ...lugarEnUso, numeroCasa: v })}
                        />
                        <div className="space-y-1">
                          <Label className="text-xs">Ciudad</Label>
                          <SelectorCiudad
                            value={lugarEnUso.ciudad}
                            onChange={(v) => setLugarNuevo({ ...lugarEnUso, ciudad: v })}
                          />
                        </div>
                      </div>
                      <Campo
                        etiqueta="Referencia"
                        valor={lugarEnUso.referencia}
                        onCambio={(v) => setLugarNuevo({ ...lugarEnUso, referencia: v })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {clienteNuevo
                          ? "Opcional: si no escribes nada, nace como «Principal». "
                          : ""}
                        Las medidas y el pin se completan después en la ficha de la propiedad
                        {"lat" in pinDelLugar ? "; el pin de la solicitud ya va con ella" : ""}.
                      </p>
                      {!clienteNuevo ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={() => setLugarNuevo(null)}
                        >
                          Elegir una de sus propiedades
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {cliente && cliente.propiedades.length > 0 ? (
                        <CustomSelect
                          value={propiedadId}
                          onChange={elegirPropiedad}
                          options={cliente.propiedades.map((p) => ({
                            value: p.id,
                            label: p.nombre,
                            hint: p.direccion ?? undefined,
                          }))}
                          placeholder="Seleccionar propiedad"
                          searchable={cliente.propiedades.length > 6}
                          searchPlaceholder="Buscar propiedad..."
                        />
                      ) : null}
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        onClick={() => {
                          setLugarNuevo(LUGAR_VACIO);
                          setPropiedadId("");
                          setSuscripcionId("");
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Propiedad nueva
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* De qué plan es la visita: una decisión, de la visita entera. El
              plan es de un jardín, así que elegirlo pone la propiedad. La X la
              desvincula; una opción "Ninguna" diría lo mismo ocupando lugar. */}
          {planes.length > 0 && (
            <Card className="overflow-visible">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Suscripción</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomSelect
                  value={suscripcionId}
                  onChange={elegirPlan}
                  options={planes.map((sus) => ({
                    value: sus.id,
                    label: `Suscripción #${sus.numero}`,
                    hint: describirPlan(sus),
                  }))}
                  placeholder="Sin suscripción"
                  clearable
                />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Personal</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {personalIds.length}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {grupos.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Aplicar un grupo</Label>
                  <CustomSelect
                    value={grupoId}
                    onChange={aplicarGrupo}
                    options={grupos.map((g) => ({
                      value: g.id,
                      label: g.nombre,
                    }))}
                    placeholder="Sin grupo"
                    searchable
                    searchPlaceholder="Buscar grupo..."
                    clearable
                  />
                  <p className="text-xs text-muted-foreground">
                    Carga sus miembros; después se pueden ajustar.
                  </p>
                </div>
              )}
              <PersonalSelector
                personalList={personalList}
                selectedIds={personalIds}
                onChange={setPersonalIds}
              />
            </CardContent>
          </Card>

        </div>
      </div>

      <SelectorTareas
        open={eligiendo}
        onOpenChange={setEligiendo}
        catalogo={tareas}
        seleccionados={tareaIds}
        titulo="Tareas obligatorias"
        onToggle={alternarTarea}
      />

      {/* Se crean N visitas de una sola vez y deshacerlo es borrarlas una por
          una, así que conviene mirar el resumen antes. */}
      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fechas.length > 1
                ? `Crear ${fechas.length} visitas`
                : "Crear visita"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <dl className="divide-y rounded-md border text-sm">
              <Fila etiqueta="Propiedad">
                {lugarEnUso
                  ? `Nueva: ${nombreDelLugar.trim() || lugarEnUso.direccion.trim() || "Principal"}`
                  : (cliente?.propiedades.find((p) => p.id === propiedadId)?.nombre ?? "—")}
              </Fila>
              <Fila etiqueta="Cliente">
                {clienteNuevo
                  ? `Nuevo: ${[clienteNuevo.nombre, clienteNuevo.apellido].map((x) => x.trim()).filter(Boolean).join(" ")}`
                  : cliente
                    ? nombreCliente(cliente)
                    : "—"}
              </Fila>
              <Fila etiqueta="Obligatorias">
                {elegidas.length === 0 ? (
                  "Ninguna"
                ) : (
                  <span className="space-y-0.5">
                    {elegidas.map((t) => (
                      <span key={t.id} className="block">
                        {t.nombre}
                      </span>
                    ))}
                  </span>
                )}
              </Fila>
              <Fila etiqueta="Fechas">
                {[...fechas].sort().map(fechaCorta).join(", ")}
              </Fila>
              <Fila etiqueta="Personal">
                {personalIds.length === 0
                  ? "Sin asignar"
                  : personalList
                      .filter((p) => personalIds.includes(p.id))
                      .map((p) => `${p.nombre} ${p.apellido ?? ""}`.trim())
                      .join(", ")}
              </Fila>
              {notas.trim() && <Fila etiqueta="Notas">{notas.trim()}</Fila>}
            </dl>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmar(false)}
                disabled={loading}
              >
                Volver
              </Button>
              <Button onClick={crear} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-20 flex-none text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

/** Un campo de texto con su rótulo, para el cliente y la propiedad nuevos. */
function Campo({
  etiqueta,
  valor,
  onCambio,
  tipo = "text",
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  tipo?: "text" | "tel" | "email";
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{etiqueta}</Label>
      <Input
        type={tipo}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
      />
    </div>
  );
}
