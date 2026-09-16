"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Check, Clock, Smartphone } from "lucide-react";
import { UbicacionDeMarca } from "@/components/visitas/ubicaciones-marcadas";
import { horaConDia } from "@/components/visitas/formato-marca";
import type { PersonalDeVisita, TareaHecha } from "@/lib/visita-tareas";

interface VisitaParaFichas {
  fechaProgramada: string | Date;
  grupo: { nombre: string } | null;
  tareasObligatorias: { tarea: { id: string; nombre: string } }[];
  personal: PersonalDeVisita[];
}

/**
 * Lo que pidió la visita arriba, y debajo una ficha por persona.
 *
 * Esta tarjeta pasó por tres formas antes de esta, y todas rompían lo mismo:
 * repartían los datos de una misma persona en lugares distintos. Fueron dos
 * tarjetas —Tareas de un lado, Personal del otro—; después una sola con dos
 * listas, donde el nombre de cada tarea se escribía dos veces; después una
 * grilla de tarea × persona, que contestaba bien "¿quién hizo el desmalezado?"
 * pero dejaba la hora de entrada al pie de una columna, la ubicación en una
 * frase suelta abajo y las tareas convertidas en tildes: el parte de alguien
 * desarmado en tres pedazos de la misma tarjeta.
 *
 * Acá **cada persona es una sección**: su entrada con la ubicación de esa
 * marca, su salida con la de esa otra, cuánto estuvo y qué hizo. Es la unidad
 * que se mira —un parte— y es también la unidad que se corrige.
 *
 * Secciones separadas por una línea, no recuadros: adentro de una tarjeta,
 * meter tarjetas convierte a cada persona en un objeto aparte que hay que
 * volver a juntar con la vista, y de paso repite un borde que el de la tarjeta
 * ya dibujó. Alcanza con la línea y con sangrar lo suyo al ancho del avatar.
 *
 * Dos cosas quedan afuera de la sección a propósito:
 *
 * - **Las obligatorias**, arriba y una sola vez: son de la visita, no de nadie
 *   en particular, y se decidieron al agendar. Adentro de cada ficha estarían
 *   repetidas tantas veces como gente haya.
 * - **La ubicación no es un renglón aparte**: va pegada a la hora que le
 *   corresponde. Juntas abajo había que volver a emparejarlas con la hora de
 *   arriba para saber cuál era la de la entrada.
 */
export function Cronologia({
  visita,
  mismoAparato,
  canModify,
}: {
  visita: VisitaParaFichas;
  /** Quiénes marcaron desde el mismo aparato que otro. */
  mismoAparato: Set<string>;
  /** La ubicación de las marcas es de oficina: el jardinero no revisa a nadie. */
  canModify: boolean;
}) {
  const gente = visita.personal;

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Cronología</CardTitle>
        {/* El grupo nombra a este conjunto de gente. */}
        {visita.grupo && (
          <CardAction>
            <span className="text-xs text-muted-foreground">
              {visita.grupo.nombre}
            </span>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {gente.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nadie está asignado todavía.
          </p>
        ) : (
          /*
           * Una línea vertical con un punto por persona.
           *
           * El orden es el del día —quien entró primero va primero, y quien no
           * marcó queda al final—, así que la tarjeta se lee como pasó la
           * jornada en vez de como está ordenada la tabla de asignaciones. El
           * punto lleno dice que esa persona ya cerró lo suyo; el hueco, que
           * todavía falta.
           */
          <ol className="relative space-y-5 py-1 pl-6">
            <span
              aria-hidden
              className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
            />
            {[...gente].sort(porCronologia).map((vp) => (
              <FichaDeParte
                key={vp.personalId}
                parte={vp}
                fechaDeLaVisita={visita.fechaProgramada}
                mismoAparato={mismoAparato.has(vp.personalId)}
                verUbicacion={canModify}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Quien entró antes va antes; quien no marcó, al final. */
function porCronologia(a: PersonalDeVisita, b: PersonalDeVisita): number {
  if (!a.entradaEl && !b.entradaEl) return 0;
  if (!a.entradaEl) return 1;
  if (!b.entradaEl) return -1;
  return new Date(a.entradaEl).getTime() - new Date(b.entradaEl).getTime();
}

/** Lo que la visita exigía, y si se cubrió. Se decide al agendar. */
export function TareasObligatorias({
  visita,
  hechas,
  faltantes,
}: {
  visita: Pick<VisitaParaFichas, "tareasObligatorias">;
  /** La unión de lo que cargó cada uno. */
  hechas: TareaHecha[];
  /** Las obligatorias que nadie cubrió. */
  faltantes: { id: string }[];
}) {
  const hechasIds = new Set(hechas.map((t) => t.id));
  if (visita.tareasObligatorias.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Tareas obligatorias</CardTitle>
        {faltantes.length > 0 && (
          <CardAction>
            <Badge variant="destructive" className="flex-none">
              {faltantes.length === 1
                ? "1 sin hacer"
                : `${faltantes.length} sin hacer`}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {visita.tareasObligatorias.map(({ tarea }) => {
            const hecha = hechasIds.has(tarea.id);
            return (
              <Badge
                key={tarea.id}
                variant={hecha ? "secondary" : "outline"}
                className={`gap-1.5 font-normal ${
                  hecha ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {hecha ? (
                  <Check className="h-3.5 w-3.5 flex-none" />
                ) : (
                  <Clock className="h-3.5 w-3.5 flex-none" />
                )}
                {tarea.nombre}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Todo lo de una persona junto: cuándo entró, cuándo salió y qué hizo.
 *
 * Quien no cargó nada se dice con todas las letras en vez de dejar el renglón
 * vacío: "no marcó ninguna tarea" y "todavía no cargó su parte" se ven igual de
 * vacíos y significan cosas distintas, y es exactamente lo que la oficina mira
 * antes de cerrar la visita.
 */
function FichaDeParte({
  parte,
  fechaDeLaVisita,
  mismoAparato,
  verUbicacion,
}: {
  parte: PersonalDeVisita;
  fechaDeLaVisita: string | Date;
  mismoAparato: boolean;
  verUbicacion: boolean;
}) {
  const nombre =
    `${parte.personal.nombre} ${parte.personal.apellido ?? ""}`.trim();
  const suyas = parte.tareas.map((t) => t.tarea.nombre);
  const duracion = duracionEntre(parte.entradaEl, parte.salidaEl);

  const cerro = parte.salidaEl !== null;

  return (
    <li className="relative">
      {/* El punto sobre la línea: lleno cuando esa persona ya cerró lo suyo,
          hueco mientras falte. Es lo que hace que se lea de un vistazo cuánto
          de la jornada está cerrado. */}
      <span
        aria-hidden
        className={`absolute -left-6 top-2 h-2.5 w-2.5 rounded-full border-2 ${
          cerro
            ? "border-primary bg-primary"
            : parte.entradaEl
              ? "border-primary bg-card"
              : "border-border bg-card"
        }`}
      />
      <div className="flex items-center gap-2.5">
        <InitialsAvatar name={nombre} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {nombre}
        </span>
        {/* A la derecha, lo que resume su paso: cuánto estuvo, o que no marcó. */}
        <span className="flex-none text-xs tabular-nums text-muted-foreground">
          {duracion ?? (parte.entradaEl ? "Sin salir todavía" : "Sin marcar")}
        </span>
      </div>

      {/* Sangrado al ancho del avatar: lo de abajo es de esta persona, y la
          sangría lo dice sin necesidad de encerrarlo. */}
      <div className="mt-1.5 space-y-1 pl-[38px]">
        {(parte.entradaEl || parte.salidaEl) && (
          <>
            <Marca
              etiqueta="Entrada"
              cuando={
                parte.entradaEl
                  ? horaConDia(parte.entradaEl, fechaDeLaVisita)
                  : null
              }
              ubicacion={
                verUbicacion ? (
                  <UbicacionDeMarca parte={parte} cual="entrada" />
                ) : null
              }
            />
            <Marca
              etiqueta="Salida"
              cuando={
                parte.salidaEl
                  ? horaConDia(parte.salidaEl, fechaDeLaVisita)
                  : null
              }
              ubicacion={
                verUbicacion ? (
                  <UbicacionDeMarca parte={parte} cual="salida" />
                ) : null
              }
            />
          </>
        )}

        {/* En la misma columna que las horas, con el mismo rótulo a la
            izquierda: es un dato más del parte, no un bloque aparte. Separadas
            por puntos y no por comas, porque las comas viven adentro de los
            nombres: "Deshoje de plantas de hojas grandes (alocasias, bijao,
            heliconias)". */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          <span className="w-20 flex-none text-muted-foreground">Tareas</span>
          <span className="min-w-0 flex-1">
            {suyas.length > 0 ? (
              suyas.join(" · ")
            ) : (
              <span className="text-muted-foreground">
                {parte.registradoEl === null
                  ? parte.entradaEl
                    ? "Marcó entrada, todavía no cargó lo que hizo."
                    : "Todavía no cargó su parte."
                  : "No marcó ninguna tarea."}
              </span>
            )}
          </span>
        </div>

        {/* Es el único rastro que deja prestarle la cuenta a un compañero, y por
            eso va con esa persona y no en una lista de avisos: lo que se
            conversa es con ella. */}
        {mismoAparato && (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
            <Smartphone className="h-3 w-3 flex-none" />
            Marcó desde el mismo teléfono que otra persona
          </p>
        )}
      </div>
    </li>
  );
}

/** Una marca: la hora y, pegada, dónde estaba el teléfono al apretar. */
function Marca({
  etiqueta,
  cuando,
  ubicacion,
}: {
  etiqueta: string;
  cuando: string | null;
  ubicacion: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="w-20 flex-none text-muted-foreground">{etiqueta}</span>
      <span className="flex-none tabular-nums">
        {cuando ?? <span className="text-muted-foreground">Sin marcar</span>}
      </span>
      {cuando ? ubicacion : null}
    </div>
  );
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
