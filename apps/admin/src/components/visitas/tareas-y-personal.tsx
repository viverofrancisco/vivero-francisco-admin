"use client";

import { Card, CardContent } from "@/components/ui/card";
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
  const gente = [...visita.personal].sort(porCronologia);

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <CardContent className="p-[22px]">
        <div className="mb-[18px] flex items-center justify-between gap-3">
          <span className="text-[15.5px] font-extrabold">Cronología en vivo</span>
          {/* El grupo nombra a este conjunto de gente. */}
          {visita.grupo && (
            <span className="text-[12.5px] font-bold text-muted-foreground">
              {visita.grupo.nombre}
            </span>
          )}
        </div>

        {gente.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nadie está asignado todavía.
          </p>
        ) : (
          <div className="flex flex-col">
            {gente.map((vp, i) => (
              <FichaDeParte
                key={vp.personalId}
                parte={vp}
                fechaDeLaVisita={visita.fechaProgramada}
                mismoAparato={mismoAparato.has(vp.personalId)}
                verUbicacion={canModify}
                ultimo={i === gente.length - 1}
              />
            ))}
          </div>
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
    <Card className="gap-0 rounded-2xl py-0">
      <CardContent className="p-[22px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15.5px] font-extrabold">
            Tareas obligatorias
          </span>
          {faltantes.length > 0 && (
            <span className="rounded-full bg-warning/15 px-[11px] py-1 text-[12.5px] font-bold text-warning-foreground">
              {faltantes.length === 1
                ? "1 sin hacer"
                : `${faltantes.length} sin hacer`}
            </span>
          )}
        </div>
        {/* Una ficha por obligatoria: verde con tilde la que alguien hizo, gris
            con reloj la que sigue esperando. No hay rojo porque todavía no es
            un error: la visita puede estar en curso. */}
        <div className="mt-[14px] flex flex-wrap gap-2">
          {visita.tareasObligatorias.map(({ tarea }) => {
            const hecha = hechasIds.has(tarea.id);
            return (
              <span
                key={tarea.id}
                className={`inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[13px] font-bold ${
                  hecha
                    ? "bg-green-50 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {hecha ? (
                  <Check className="h-3.5 w-3.5 flex-none" strokeWidth={2.5} />
                ) : (
                  <Clock className="h-3.5 w-3.5 flex-none" strokeWidth={2.5} />
                )}
                {tarea.nombre}
              </span>
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
  ultimo,
}: {
  parte: PersonalDeVisita;
  fechaDeLaVisita: string | Date;
  mismoAparato: boolean;
  verUbicacion: boolean;
  /** El último no lleva línea hacia abajo: no hay nadie después. */
  ultimo: boolean;
}) {
  const nombre =
    `${parte.personal.nombre} ${parte.personal.apellido ?? ""}`.trim();
  const suyas = parte.tareas.map((t) => t.tarea.nombre);
  const duracion = duracionEntre(parte.entradaEl, parte.salidaEl);

  return (
    <div className="flex gap-[14px]">
      {/* El riel: el punto de esta persona y la línea que baja a la siguiente.
          Lleno cuando ya cerró lo suyo, anillo gris mientras falte — es lo que
          deja ver de un vistazo cuánto de la jornada está cerrado. */}
      <div className="flex w-5 flex-none flex-col items-center">
        <span
          aria-hidden
          className={`mt-1 h-[13px] w-[13px] flex-none rounded-full ${
            parte.salidaEl
              ? "bg-primary"
              : "border-2 border-border bg-transparent"
          }`}
        />
        {!ultimo && <span aria-hidden className="min-h-[54px] w-0.5 flex-1 bg-muted" />}
      </div>

      <div className="min-w-0 flex-1 pb-[22px]">
        <div className="mb-1 flex items-center gap-2.5">
          <InitialsAvatar name={nombre} size={30} />
          <span className="min-w-0 truncate text-[14.5px] font-bold">
            {nombre}
          </span>
          {/* A la derecha, lo que resume su paso: cuánto estuvo, o que falta. */}
          <span
            className={`ml-auto flex-none text-xs font-bold ${
              duracion ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {duracion ??
              (parte.entradaEl ? "Sin salir todavía" : "Sin marcar")}
          </span>
        </div>

        {/* Sangrado al ancho del avatar, para que cuelgue de su nombre. */}
        <div className="ml-10 flex flex-col gap-[3px] text-[13px] font-semibold text-ink-2">
          {parte.entradaEl ? (
            <>
              <span>
                Entrada {horaConDia(parte.entradaEl, fechaDeLaVisita)}
                {verUbicacion && (
                  <UbicacionDeMarca parte={parte} cual="entrada" />
                )}
              </span>
              <span>
                Salida{" "}
                {parte.salidaEl ? (
                  horaConDia(parte.salidaEl, fechaDeLaVisita)
                ) : (
                  <span className="text-muted-foreground">sin marcar</span>
                )}
                {verUbicacion && parte.salidaEl && (
                  <UbicacionDeMarca parte={parte} cual="salida" />
                )}
              </span>
              <span className="text-muted-foreground">
                Tareas:{" "}
                {suyas.length > 0
                  ? suyas.join(" · ")
                  : parte.registradoEl === null
                    ? "todavía no las cargó"
                    : "no marcó ninguna"}
              </span>
            </>
          ) : (
            /* Sin entrada no hay nada que contar, y el motivo importa: "no
               marcó ninguna tarea" y "todavía no cargó su parte" se ven igual
               de vacíos y significan cosas distintas. */
            <span className="text-muted-foreground">
              Todavía no cargó su parte.
            </span>
          )}

          {/* Es el único rastro que deja prestarle la cuenta a un compañero, y
              por eso va con esa persona: lo que se conversa es con ella. */}
          {mismoAparato && (
            <span className="flex items-center gap-1.5 font-bold text-destructive">
              <Smartphone className="h-3.5 w-3.5 flex-none" />
              Marcó desde el mismo teléfono que otra persona
            </span>
          )}
        </div>
      </div>
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
