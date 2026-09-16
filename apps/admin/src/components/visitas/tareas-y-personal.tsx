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
import { Check, LogIn, LogOut, Smartphone, X } from "lucide-react";
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
 * Acá **cada persona es un bloque**: su entrada con la ubicación de esa marca,
 * su salida con la de esa otra, cuánto estuvo y qué hizo. Es la unidad que se
 * mira —un parte— y es también la unidad que se corrige.
 *
 * Dos cosas quedan afuera del bloque a propósito:
 *
 * - **Las obligatorias**, arriba y una sola vez: son de la visita, no de nadie
 *   en particular, y se decidieron al agendar. Adentro de cada ficha estarían
 *   repetidas tantas veces como gente haya.
 * - **La ubicación no es un renglón aparte**: va pegada a la hora que le
 *   corresponde. Juntas abajo había que volver a emparejarlas con la hora de
 *   arriba para saber cuál era la de la entrada.
 */
export function TareasYPersonal({
  visita,
  hechas,
  faltantes,
  mismoAparato,
  canModify,
}: {
  visita: VisitaParaFichas;
  /** La unión de lo que cargó cada uno. */
  hechas: TareaHecha[];
  /** Las obligatorias que nadie cubrió. */
  faltantes: { id: string }[];
  /** Quiénes marcaron desde el mismo aparato que otro. */
  mismoAparato: Set<string>;
  /** La ubicación de las marcas es de oficina: el jardinero no revisa a nadie. */
  canModify: boolean;
}) {
  const gente = visita.personal;
  const hechasIds = new Set(hechas.map((t) => t.id));

  return (
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
                ? "1 sin hacer"
                : `${faltantes.length} sin hacer`}
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Lo que la visita exigía, una sola vez y arriba de todo. */}
        {visita.tareasObligatorias.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Obligatorias
            </span>
            {visita.tareasObligatorias.map(({ tarea }) => {
              const hecha = hechasIds.has(tarea.id);
              return (
                <Badge
                  key={tarea.id}
                  variant={hecha ? "secondary" : "destructive"}
                  className="gap-1 font-normal"
                >
                  {hecha ? (
                    <Check className="h-3 w-3 flex-none" />
                  ) : (
                    <X className="h-3 w-3 flex-none" />
                  )}
                  {tarea.nombre}
                </Badge>
              );
            })}
          </div>
        )}

        {gente.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nadie está asignado todavía.
          </p>
        ) : (
          <div className="space-y-2">
            {gente.map((vp) => (
              <FichaDeParte
                key={vp.personalId}
                parte={vp}
                fechaDeLaVisita={visita.fechaProgramada}
                mismoAparato={mismoAparato.has(vp.personalId)}
                verUbicacion={canModify}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Todo lo de una persona en un bloque: cuándo entró, cuándo salió y qué hizo.
 *
 * Quien no cargó nada se dice con todas las letras en vez de dejar el bloque
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

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <InitialsAvatar name={nombre} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {nombre}
        </span>
        {/* A la derecha, lo que resume su paso: cuánto estuvo, o que no marcó. */}
        <span className="flex-none text-xs tabular-nums text-muted-foreground">
          {duracion ?? (parte.entradaEl ? "Sin salir todavía" : "Sin marcar")}
        </span>
      </div>

      <div className="space-y-2.5 px-3 py-2.5">
        {(parte.entradaEl || parte.salidaEl) && (
          <div className="space-y-1.5">
            <Marca
              icono={<LogIn className="h-3.5 w-3.5 flex-none" />}
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
              icono={<LogOut className="h-3.5 w-3.5 flex-none" />}
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
          </div>
        )}

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Hizo
          </p>
          {suyas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {suyas.map((n) => (
                <Badge key={n} variant="outline" className="font-normal">
                  {n}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {parte.registradoEl === null
                ? parte.entradaEl
                  ? "Marcó entrada, todavía no cargó lo que hizo."
                  : "Todavía no cargó su parte."
                : "No marcó ninguna tarea."}
            </p>
          )}
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
    </div>
  );
}

/** Una marca: la hora y, pegada, dónde estaba el teléfono al apretar. */
function Marca({
  icono,
  etiqueta,
  cuando,
  ubicacion,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  cuando: string | null;
  ubicacion: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="flex w-20 flex-none items-center gap-1.5 text-muted-foreground">
        {icono}
        {etiqueta}
      </span>
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
