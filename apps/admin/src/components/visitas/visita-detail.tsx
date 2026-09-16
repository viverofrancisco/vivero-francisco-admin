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
  Check,
  CheckCircle,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { ArchivosVisita } from "@/components/visitas/archivos-visita";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { horaConDia } from "./formato-marca";
import {
  CalificacionVisita,
  type CalificacionData,
} from "./calificacion-visita";
import { Ubicaciones } from "./ubicaciones-marcadas";
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
  nombrePersonal,
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
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b mb-6">
        <div className="flex items-center gap-3">
          {/* Vuelve de donde vino: llegar desde una suscripción y salir a la
              lista de visitas es perder el lugar donde uno estaba. */}
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                Visita #{visita.numero}
              </h1>
              <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
              {sinRegistrar.length > 0 && visita.estado === "EN_CURSO" && (
                <Badge variant="outline" className="flex-none">
                  {sinRegistrar.length === 1
                    ? "Falta 1 parte"
                    : `Faltan ${sinRegistrar.length} partes`}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {nombreCliente(visita.cliente)}
              {hechas.length > 0
                ? ` — ${hechas.map((t) => t.nombre).join(", ")}`
                : ""}
            </p>
          </div>
          {miParte && (
            <div className="flex flex-none items-center gap-2">
              <MiParte
                visitaId={visita.id}
                fechaProgramada={visita.fechaProgramada}
                parte={miParte}
                obligatoriasIds={visita.tareasObligatorias.map((o) => o.tarea.id)}
                catalogo={catalogo}
              />
            </div>
          )}
          {canModify && (
            <div className="flex flex-none items-center gap-2">
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
                  lugar de la pantalla. */}
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
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
        {/* Arriba de las tareas: cuando hay algo que decir, es lo primero que
            la oficina quiere leer. Cuando no hay, no ocupa nada. */}
        {visita.calificacion && (
          <CalificacionVisita calificacion={visita.calificacion} />
        )}

        {/* Qué exigía la visita y qué hizo cada uno, en una sola tarjeta.
            Eran dos —Tareas de un lado, Personal del otro— y había que ir y
            volver entre ellas para contestar la única pregunta que la oficina
            se hace acá: qué se pidió, qué se hizo y quién lo hizo. Las tareas
            **son** de cada jardinero: la lista suelta de "se hizo" era la unión
            de todas, con los nombres al costado, o sea la misma información
            ordenada de la peor manera. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Tareas y personal</CardTitle>
            <CardAction className="flex items-center gap-2">
              {/* El grupo nombra a este conjunto de gente. */}
              {visita.grupo && (
                <span className="text-xs text-muted-foreground">
                  {visita.grupo.nombre}
                </span>
              )}
              {faltantes.length > 0 && (
                <Badge variant="destructive" className="flex-none">
                  {faltantes.length === 1
                    ? "1 obligatoria sin hacer"
                    : `${faltantes.length} obligatorias sin hacer`}
                </Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {visita.tareasObligatorias.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Obligatorias
                </p>
                <ul className="divide-y rounded-md border">
                  {visita.tareasObligatorias.map(({ tarea }) => {
                    const hecha = hechas.find((t) => t.id === tarea.id);
                    return (
                      <li
                        key={tarea.id}
                        className="flex items-center gap-2.5 px-3 py-2"
                      >
                        {hecha ? (
                          <Check className="h-4 w-4 flex-none text-primary" />
                        ) : (
                          <X className="h-4 w-4 flex-none text-destructive" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {tarea.nombre}
                        </span>
                        <span className="flex-none text-xs text-muted-foreground">
                          {hecha ? hecha.porQuienes.join(", ") : "Sin hacer"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Cada uno con lo suyo: sus horas y sus tareas. Es el dato que
                el modelo viejo —una persona reportando por todo el grupo— no
                podía dar. Quien no cargó nada se dice, porque es lo que la
                oficina mira antes de cerrar. */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quién fue
              </p>
              {visita.personal.length === 0 ? (
                <EmptyState message="Nadie está asignado todavía" />
              ) : (
                <ul className="space-y-3">
                  {visita.personal.map((vp) => {
                    const nombre = nombrePersonal(vp.personal);
                    const suyas = vp.tareas.map((t) => t.tarea.nombre);
                    return (
                      <li
                        key={vp.personal.id}
                        className="flex items-start gap-2.5"
                      >
                        <InitialsAvatar name={nombre} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {nombre}
                            </span>
                            {vp.entradaEl || vp.salidaEl ? (
                              <span className="flex-none text-xs tabular-nums text-muted-foreground">
                                {vp.entradaEl
                                  ? horaConDia(
                                      vp.entradaEl,
                                      visita.fechaProgramada
                                    )
                                  : "—"}{" "}
                                →{" "}
                                {vp.salidaEl
                                  ? horaConDia(
                                      vp.salidaEl,
                                      visita.fechaProgramada
                                    )
                                  : "—"}
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {vp.registradoEl === null
                              ? vp.entradaEl
                                ? "Marcó entrada, todavía no salió"
                                : "Todavía no cargó su parte"
                              : suyas.length > 0
                                ? suyas.join(", ")
                                : "No marcó ninguna tarea"}
                          </span>
                          {/* Solo la oficina. Es la pregunta que ella quería
                              poder hacerse, y la única respuesta honesta: dónde
                              estaba el teléfono cuando se apretó el botón. No
                              prueba presencia —en el navegador la ubicación se
                              falsea en tres clics— pero un "sin ubicación"
                              repetido es algo que se conversa. Al jardinero no
                              se le muestra: no es él quien revisa a nadie. */}
                          {canModify && <Ubicaciones parte={vp} />}
                          {mismoAparato.has(vp.personalId) && (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                              <Smartphone className="h-3 w-3 flex-none" />
                              Marcó desde el mismo teléfono que otra persona
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

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

        <div className="space-y-6">
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/clientes/${visita.cliente.id}`}
              className="block truncate font-bold hover:underline"
            >
              {nombreCliente(visita.cliente)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[visita.cliente.sector?.nombre, visita.cliente.ciudad]
                .filter(Boolean)
                .join(" · ") || "Sin sector"}
            </p>
          </CardContent>
        </Card>

        {/* Las dos fechas juntas: para cuándo se agendó y cuándo se hizo. Verlas
            una al lado de la otra es la forma de notar que se corrió. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              <Fila etiqueta="Programada">
                <span className="capitalize">
                  {formatCorta(visita.fechaProgramada)}
                </span>
              </Fila>
              <Fila etiqueta="Realizada">
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
                  <Fila etiqueta="Entrada">
                    <MarcaEnDetalle
                      fecha={miParte.entradaEl}
                      dia={visita.fechaProgramada}
                    />
                  </Fila>
                  <Fila etiqueta="Salida">
                    <MarcaEnDetalle
                      fecha={miParte.salidaEl}
                      dia={visita.fechaProgramada}
                    />
                  </Fila>
                  {/* Después de la salida, que es de donde sale. Y es **su**
                      duración, no la de la visita: arriba están sus horas, y
                      mezclar las dos cosas en filas pegadas es lo que hace que
                      un número no cierre con el de al lado. */}
                  <Fila etiqueta="Duración">
                    {duracionEntre(miParte.entradaEl, miParte.salidaEl) ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Fila>
                </>
              ) : (
                <>
                  <Fila etiqueta="Horario">
                    {visita.horaEntrada || visita.horaSalida ? (
                      `${visita.horaEntrada ?? "—"} a ${visita.horaSalida ?? "—"}`
                    ) : (
                      <span className="text-muted-foreground">Sin registrar</span>
                    )}
                  </Fila>
                  <Fila etiqueta="Duración">
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
                <Fila etiqueta="Completada">
                  <span className="block">{momento(visita.completadaEl)}</span>
                  {visita.completadaPorNombre && (
                    <span className="block text-xs text-muted-foreground">
                      por {visita.completadaPorNombre}
                    </span>
                  )}
                </Fila>
              )}
              {visita.actualizadaEl && (
                <Fila etiqueta="Última edición">
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
function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
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
