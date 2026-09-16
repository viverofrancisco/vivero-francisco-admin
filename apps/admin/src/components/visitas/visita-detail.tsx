"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  Clock,
  LogIn,
  LogOut,
  Pencil,
  PenLine,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { ArchivosVisita } from "@/components/visitas/archivos-visita";
import {
  Cronologia,
  TareasObligatorias,
} from "@/components/visitas/tareas-y-personal";
import { Badge } from "@/components/ui/badge";
import { hora12, horaConDia } from "./formato-marca";
import {
  CalificacionVisita,
  type CalificacionData,
} from "./calificacion-visita";
import {
  estadoLabel as estadoOrdenLabel,
  estadoVariant as estadoOrdenVariant,
} from "@/components/ordenes/formato";
import {
  PERIODICIDAD_LABEL,
  estadoVariant as estadoSuscripcionVariant,
} from "@/components/suscripciones/formato";
import { nombreCliente } from "@vivero/shared";
import {
  obligatoriasSinCubrir,
  personalSinRegistrar,
  marcaronDesdeElMismoAparato,
  tareasHechas,
  type PersonalDeVisita,
  type TareaDeVisita,
} from "@/lib/visita-tareas";
import { MiParte } from "./mi-parte";

interface VisitaDetailData {
  id: string;
  numero: number;
  fechaProgramada: string;
  fechaRealizada: string | null;
  /** Cuándo se la marcó como completada, en ISO. */
  completadaEl?: string | null;
  /** Cómo se llamaba quien la completó, guardado en ese momento. */
  completadaPorNombre?: string | null;
  /** Última modificación, sea del tipo que sea. */
  actualizadaEl?: string | null;
  actualizadaPorNombre?: string | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  media: { id: string; url: string; tipo: string; tareaId: string | null }[];
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
    ciudad: string | null;
    sector: { nombre: string } | null;
  };
  tareasObligatorias: { tarea: TareaDeVisita }[];
  grupo: {
    id: string;
    nombre: string;
    miembros: { personal: { id: string; nombre: string; apellido?: string | null } }[];
  } | null;
  /** Quiénes van, y qué registró cada uno. */
  personal: PersonalDeVisita[];
  /** Las órdenes que dicen cubrir esta visita. */
  ordenes?: { id: string; numero: number; estado: string }[];
  /** Lo que dijo el cliente. Solo llega si quien mira es de la oficina. */
  calificacion?: CalificacionData | null;
  /** El plan al que pertenece, si es de alguno. */
  suscripcion?: {
    id: string;
    numero: number;
    periodicidad: string;
    estado: string;
    cliente: { nombre: string; apellido: string | null; empresa: string | null };
  } | null;
}


interface VisitaDetailProps {
  /** El catálogo de tareas, para etiquetar las fotos y para cargar el parte. */
  catalogo?: { tareaId: string; nombre: string }[];
  visita: VisitaDetailData;
  userRole?: string;
  /**
   * Quién está mirando, si es del personal. Con eso la ficha sabe cuál de los
   * partes es el suyo — el único que puede cargar.
   */
  personalId?: string | null;
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref?: string;
}

export function VisitaDetail({
  visita,
  userRole,
  personalId = null,
  backHref = "/dashboard/visitas",
  catalogo = [],
}: VisitaDetailProps) {
  const router = useRouter();
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    setEliminando(true);
    try {
      const res = await fetch(`/api/visitas/${visita.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // El servidor dice *por qué* no se pudo —"ya está facturada en la
        // orden #12"—, que es lo único que le sirve a quien lo intentó.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "No pudimos eliminar la visita");
      }
      toast.success(`Visita #${visita.numero} eliminada`);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos eliminar la visita"
      );
      setEliminando(false);
      setConfirmando(false);
    }
  }

  const isProgramada = visita.estado === "PROGRAMADA";
  const canModify = userRole !== "PERSONAL";
  /**
   * Las órdenes de la visita son plata: solo la oficina. Un admin de sector
   * agenda y cierra la visita; lo que se cobra por ella no es asunto suyo.
   */
  const vePlata = userRole === "ADMIN" || userRole === "STAFF";

  /**
   * Qué falta cobrar de esta visita.
   *
   * Lo cubierto por un plan no se factura aparte: entra en la orden del período.
   * Lo demás se cobra una vez, y la línea de orden es la prueba de que ya pasó.
   *
   * Se puede facturar por adelantado: alcanza con que la visita exista y no
   * esté cancelada. De una cancelada no hay nada que cobrar, y
   * `listarPendientes` tampoco la ofrece.
   */
  const facturable = visita.estado !== "CANCELADA";

  /** Lo que se hizo: la unión de lo que cargó cada uno. */
  const hechas = tareasHechas(visita);
  /** Lo que se exigía y **nadie** hizo. Es la pregunta de la oficina. */
  const faltantes = obligatoriasSinCubrir(visita);
  /**
   * Borrar es para la visita agendada mal que todavía no pasó: el cliente
   * equivocado, el día equivocado, la duplicada. En cuanto alguien marcó su
   * entrada hay un hecho anotado y atrás vienen su parte, sus fotos y el
   * informe; ahí lo que corresponde es cancelarla.
   */
  const sePuedeEliminar =
    visita.estado !== "EN_CURSO" &&
    visita.estado !== "COMPLETADA" &&
    visita.estado !== "INCOMPLETA" &&
    !visita.personal.some((p) => p.entradaEl);
  /** Quiénes todavía no cargaron su parte. */
  const sinRegistrar = personalSinRegistrar(visita.personal);
  /** Quiénes marcaron desde el mismo teléfono que otro. Solo la oficina lo ve. */
  const mismoAparato = canModify
    ? marcaronDesdeElMismoAparato(visita.personal)
    : new Set<string>();

  /**
   * Mi asignación, si soy del personal y estoy en esta visita.
   *
   * Lo que habilita el formulario no es el rol sino la asignación: un jardinero
   * abriendo la visita de otra cuadrilla la ve —el chat, las fotos— pero no
   * tiene parte que cargar ahí. Una visita cancelada tampoco: el servicio la
   * rechaza, y ofrecer un botón que va a fallar es peor que no ofrecerlo.
   */
  const miParte =
    userRole === "PERSONAL" && personalId && visita.estado !== "CANCELADA"
      ? visita.personal.find((p) => p.personalId === personalId)
      : undefined;

  const plan = visita.suscripcion ?? null;
  const ordenes = visita.ordenes ?? [];

  return (
    <>
      {/*
        El encabezado del diseño: el título con sus píldoras a la izquierda, las
        acciones a la derecha, y nada más.
        Se fue el renglón con el cliente y las tareas —el cliente tiene su
        tarjeta verde a la derecha y las tareas son la mitad de la página— y se
        fue la barra pegajosa: las acciones son "editar" y "completar", que se
        usan una vez y no mientras se lee. La flecha se queda, porque volver a
        donde uno estaba no lo resuelve el botón del navegador cuando se llegó
        desde una suscripción o desde una lista filtrada.
      */}
      <div className="mb-[22px] flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href={backHref}>
            <Button variant="ghost" size="icon" className="-ml-2 flex-none">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="truncate text-2xl font-extrabold tracking-[-0.02em]">
            Visita #{visita.numero}
          </h1>
          <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
          {sinRegistrar.length > 0 && visita.estado === "EN_CURSO" && (
            /* Ámbar y no gris: es lo que impide cerrar la visita, y al lado de
               la píldora del estado un contorno neutro se lee como un dato
               más. */
            <span className="flex-none rounded-full bg-warning/15 px-[11px] py-1 text-[12.5px] font-bold text-warning-foreground">
              {sinRegistrar.length === 1
                ? "Falta 1 parte"
                : `Faltan ${sinRegistrar.length} partes`}
            </span>
          )}
        </div>

        <div className="flex flex-none items-center gap-2">
          {miParte && (
            <MiParte
              visitaId={visita.id}
              fechaProgramada={visita.fechaProgramada}
              parte={miParte}
              obligatoriasIds={visita.tareasObligatorias.map((o) => o.tarea.id)}
              catalogo={catalogo}
            />
          )}
          {canModify && (
            <>
              {/* Editable en cualquier estado: corregir la fecha de una visita
                  ya hecha no debería obligar a rehacerla. */}
              <Link href={`/dashboard/visitas/${visita.id}/editar`}>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </Link>
              {isProgramada && (
                <Link href={`/dashboard/visitas/${visita.id}/completar`}>
                  <Button>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completar
                  </Button>
                </Link>
              )}
              {/* Solo el ícono: es la acción que nadie viene a buscar, y con
                  su nombre al lado de las otras dos compite por el mismo
                  lugar de la pantalla. Y solo mientras no haya trabajo
                  registrado: en cuanto alguien marcó, lo que corresponde es
                  cancelar. Lo rechaza el servicio igual (`softDeleteVisita`);
                  acá no se ofrece. */}
              {sePuedeEliminar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label="Eliminar visita"
                  title="Eliminar visita"
                  onClick={() => setConfirmando(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-[18px]">
        {/* Arriba de las tareas: cuando hay algo que decir, es lo primero que
            la oficina quiere leer. Cuando no hay, no ocupa nada. */}
        {visita.calificacion && (
          <CalificacionVisita calificacion={visita.calificacion} />
        )}

        {/* Cómo pasó la jornada, en orden: un punto por persona sobre una
            línea, con su entrada, su salida y lo que hizo. Ver `Cronologia`. */}
        <Cronologia
          visita={visita}
          mismoAparato={mismoAparato}
          canModify={canModify}
        />

        {/* Lo que la visita exigía, aparte: se decide al agendar y es de la
            visita, no de nadie en particular. */}
        <TareasObligatorias
          visita={visita}
          hechas={hechas}
          faltantes={faltantes}
        />


        {plan && (
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Suscripción</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/dashboard/suscripciones/${plan.id}?from=/dashboard/visitas/${visita.id}`}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    Suscripción #{plan.numero}
                  </span>
                  <span className="block truncate text-xs font-semibold text-muted-foreground">
                    {nombreCliente(plan.cliente)} ·{" "}
                    {PERIODICIDAD_LABEL[plan.periodicidad] ?? plan.periodicidad}
                  </span>
                </span>
                <Badge
                  variant={estadoSuscripcionVariant[plan.estado] ?? "outline"}
                  className="flex-none"
                >
                  {plan.estado.charAt(0) + plan.estado.slice(1).toLowerCase()}
                </Badge>
              </Link>
            </CardContent>
          </Card>
        )}


        {/* Editable aquí y no en el formulario de edición: las fotos se sacan
            mientras se hace el trabajo, y quien las sube no tiene por qué
            pasar por otra pantalla ni esperar a completar la visita. */}
        <ArchivosVisita
          visitaId={visita.id}
          archivos={visita.media}
          catalogo={catalogo}
          // Las tareas que alguien cargó: son de las que va a haber fotos, así
          // que sus secciones van primero y existen aunque estén vacías.
          hechas={hechas.map((t) => t.id)}
          // También el jardinero asignado: las fotos se sacan mientras se
          // trabaja, y el que está en el jardín es él. `canModify` lo dejaba
          // afuera junto con agendar y cerrar, que sí son de oficina.
          puedeEditar={canModify || miParte !== undefined}
        />

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visita.notas ? (
              <p className="whitespace-pre-wrap text-sm">{visita.notas}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin notas</p>
            )}
            {visita.notasIncompleto && (
              <div className="rounded-md bg-destructive/5 p-3">
                <p className="mb-1 text-xs font-bold text-destructive">
                  {visita.estado === "CANCELADA"
                    ? "Razón de cancelación"
                    : "Razón de incompleto"}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {visita.notasIncompleto}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
        {/* En degradado y no en blanco: es de quién es esta visita, el dato
            que se busca primero al abrir la ficha, y en una columna de
            tarjetas iguales había que leerlas todas para encontrarlo. */}
        <Card className="gap-0 rounded-2xl border-transparent bg-linear-135 from-green-deep to-green-700 py-0 text-white">
          <CardContent className="p-5">
            <p className="text-[12.5px] font-bold tracking-[0.04em] text-white/75">
              CLIENTE
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20 text-[15px] font-bold">
                {iniciales(nombreCliente(visita.cliente))}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/clientes/${visita.cliente.id}`}
                  className="block truncate text-[15.5px] font-extrabold hover:underline"
                >
                  {nombreCliente(visita.cliente)}
                </Link>
                <span className="block truncate text-[12.5px] font-semibold text-white/75">
                  {[visita.cliente.sector?.nombre, visita.cliente.ciudad]
                    .filter(Boolean)
                    .join(" · ") || "Sin sector"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Las dos fechas juntas: para cuándo se agendó y cuándo se hizo. Verlas
            una al lado de la otra es la forma de notar que se corrió. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="px-1">
            <dl>
              <Fila etiqueta="Programada" icono={<CalendarDays className="h-3.5 w-3.5 flex-none" />}>
                <span className="capitalize">
                  {formatCorta(visita.fechaProgramada)}
                </span>
              </Fila>
              <Fila etiqueta="Realizada" icono={<CalendarCheck className="h-3.5 w-3.5 flex-none" />}>
                {visita.fechaRealizada ? (
                  <span className="capitalize">
                    {formatCorta(visita.fechaRealizada)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Todavía no</span>
                )}
              </Fila>
              {/* Quien está asignado ve **sus** marcas y nada más: "Horario"
                  es la ventana de toda la visita —la primera entrada y la
                  última salida de todos— y al lado de las suyas decía dos veces
                  casi lo mismo, con la trampa de que no significan lo mismo.
                  La oficina ve la ventana, que es la que le importa. */}
              {miParte ? (
                <>
                  <Fila etiqueta="Entrada" icono={<LogIn className="h-3.5 w-3.5 flex-none" />}>
                    <MarcaEnDetalle
                      fecha={miParte.entradaEl}
                      dia={visita.fechaProgramada}
                    />
                  </Fila>
                  <Fila etiqueta="Salida" icono={<LogOut className="h-3.5 w-3.5 flex-none" />}>
                    <MarcaEnDetalle
                      fecha={miParte.salidaEl}
                      dia={visita.fechaProgramada}
                    />
                  </Fila>
                  {/* Después de la salida, que es de donde sale. Y es **su**
                      duración, no la de la visita: arriba están sus horas, y
                      mezclar las dos cosas en filas pegadas es lo que hace que
                      un número no cierre con el de al lado. */}
                  <Fila etiqueta="Duración" icono={<Timer className="h-3.5 w-3.5 flex-none" />}>
                    {duracionEntre(miParte.entradaEl, miParte.salidaEl) ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Fila>
                </>
              ) : (
                <>
                  <Fila etiqueta="Horario" icono={<Clock className="h-3.5 w-3.5 flex-none" />}>
                    {visita.horaEntrada || visita.horaSalida ? (
                      `${
                        visita.horaEntrada ? hora12(visita.horaEntrada) : "—"
                      } a ${visita.horaSalida ? hora12(visita.horaSalida) : "—"}`
                    ) : (
                      <span className="text-muted-foreground">Sin registrar</span>
                    )}
                  </Fila>
                  <Fila etiqueta="Duración" icono={<Timer className="h-3.5 w-3.5 flex-none" />}>
                    {duracion(visita.horaEntrada, visita.horaSalida) ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Fila>
                </>
              )}
              {/* "Realizada" es el día del trabajo; esto es cuándo y quién la
                  cerró en el sistema, que no tiene por qué ser el mismo día ni
                  la misma persona. */}
              {visita.completadaEl && (
                <Fila etiqueta="Completada" icono={<CheckCircle className="h-3.5 w-3.5 flex-none" />}>
                  <span className="block">{momento(visita.completadaEl)}</span>
                  {visita.completadaPorNombre && (
                    <span className="block text-xs text-muted-foreground">
                      por {visita.completadaPorNombre}
                    </span>
                  )}
                </Fila>
              )}
              {visita.actualizadaEl && (
                <Fila etiqueta="Última edición" icono={<PenLine className="h-3.5 w-3.5 flex-none" />}>
                  <span className="block">{momento(visita.actualizadaEl)}</span>
                  {visita.actualizadaPorNombre && (
                    <span className="block text-xs text-muted-foreground">
                      por {visita.actualizadaPorNombre}
                    </span>
                  )}
                </Fila>
              )}
            </dl>
          </CardContent>
        </Card>


        {/* Las órdenes que dicen cubrir esta visita. **Es un enlace, no una
            explicación de dónde sale cada peso**: la visita dejó de llevar
            productos, así que ninguna línea viene de acá. Sirve para ir de una
            a la otra. */}
        {vePlata && (
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Órdenes</CardTitle>
            {canModify && facturable && (
              <CardAction>
                <Link
                  href={`/dashboard/ordenes/nueva?cliente=${visita.cliente.id}&visita=${visita.id}`}
                >
                  {/* Con su nombre y no un "+": es la acción de la card, y un
                      ícono solo obliga a adivinar o a esperar el tooltip. */}
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Crear orden
                  </Button>
                </Link>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {ordenes.length === 0 ? (
              <EmptyState
                message={
                  facturable ? "Sin órdenes" : "La visita está cancelada"
                }
              />
            ) : (
              <div className="space-y-1">
                {ordenes.map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/ordenes/${o.id}?from=/dashboard/visitas/${visita.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-bold">Orden #{o.numero}</p>
                    <Badge
                      variant={estadoOrdenVariant[o.estado] ?? "outline"}
                      className="flex-none"
                    >
                      {estadoOrdenLabel[o.estado] ?? o.estado}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
        </div>
      </div>

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />

      {/* Sin promesa de recuperarla: la fila se queda marcada, pero del
          portal no vuelve, y decir "se archiva" invita a intentarlo. */}
      <Dialog
        open={confirmando}
        onOpenChange={(v) => !v && !eliminando && setConfirmando(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar la visita #{visita.numero}</DialogTitle>
            <DialogDescription>
              Sale de las listas, del calendario y de lo que queda por facturar,
              con sus fotos y su chat. Si su trabajo está en una orden en
              borrador, también sale de ahí. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmando(false)}
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
    </>
  );
}


/** Casilla chica: etiqueta arriba, valor abajo. */
/** Etiqueta a la izquierda, valor a la derecha. */
/**
 * Una fila de Detalles, con su ícono.
 *
 * El ícono no decora: en una columna de ocho filas de texto gris es lo que deja
 * encontrar la que se busca sin leerlas todas.
 */
/**
 * Una fila de Detalles: un chip con el ícono, el rótulo, y el valor a la
 * derecha.
 *
 * El ícono no decora: en una columna de ocho renglones de texto gris es lo que
 * deja encontrar el que se busca sin leerlos todos. Va adentro de un chip con
 * fondo para que la izquierda tenga un ritmo en vez de ser ocho grises pegados.
 */
function Fila({
  etiqueta,
  icono,
  children,
}: {
  etiqueta: string;
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-muted px-3 py-[11px] last:border-b-0">
      <dt className="flex flex-none items-center gap-2.5 text-[13px] font-semibold text-ink-2">
        {icono && (
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icono}
          </span>
        )}
        {etiqueta}
      </dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-semibold">
        {children}
      </dd>
    </div>
  );
}

/** Las dos primeras letras del nombre, para el avatar del cliente. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")
  ).toUpperCase() || "?";
}

const formatCorta = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "3 h 30 min" a partir de las horas cargadas al cerrar la visita. */
/** "27 ago 2026, 2:11 p. m." — el instante en que alguien apretó el botón. */
function momento(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function duracion(entrada: string | null, salida: string | null): string | null {
  if (!entrada || !salida) return null;
  const min = (h: string) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + (b || 0);
  };
  const total = min(salida) - min(entrada);
  if (total <= 0) return null;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return [horas ? `${horas} h` : null, resto ? `${resto} min` : null]
    .filter(Boolean)
    .join(" ");
}

/**
 * Una de mis marcas, en Detalles.
 *
 * Solo la hora. Decía además si la marca había salido con ubicación, y eso es
 * cosa de la oficina: al jardinero no le sirve para nada —no revisa a nadie— y
 * le agregaba un renglón a cada fila.
 */
function MarcaEnDetalle({
  fecha,
  dia,
}: {
  fecha: string | Date | null;
  dia: string;
}) {
  if (!fecha) {
    return <span className="text-muted-foreground">Sin marcar</span>;
  }
  return <span className="tabular-nums">{horaConDia(fecha, dia)}</span>;
}

/** Cuánto duró entre dos instantes. `null` si falta uno o no da positivo. */
function duracionEntre(
  entrada: string | Date | null,
  salida: string | Date | null
): string | null {
  if (!entrada || !salida) return null;
  const min = Math.round(
    (new Date(salida).getTime() - new Date(entrada).getTime()) / 60000
  );
  if (min <= 0) return null;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return [horas ? `${horas} h` : null, resto ? `${resto} min` : null]
    .filter(Boolean)
    .join(" ");
}
