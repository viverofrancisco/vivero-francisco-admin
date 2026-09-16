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
import { Check, Minus, Smartphone } from "lucide-react";
import { Ubicaciones } from "@/components/visitas/ubicaciones-marcadas";
import { horaConDia } from "@/components/visitas/formato-marca";
import type { PersonalDeVisita, TareaHecha } from "@/lib/visita-tareas";

interface VisitaParaGrilla {
  fechaProgramada: string | Date;
  grupo: { nombre: string } | null;
  tareasObligatorias: { tarea: { id: string; nombre: string } }[];
  personal: PersonalDeVisita[];
}

/**
 * Quién hizo qué, en una grilla: la tarea es la fila y la persona la columna.
 *
 * Fueron dos tarjetas —Tareas de un lado, Personal del otro—, y después una con
 * dos listas adentro. Las dos versiones tenían el mismo problema: el nombre de
 * cada tarea se escribía dos veces —arriba, en la lista de lo que se pidió, y
 * abajo otra vez adentro del renglón de cada persona— y para contestar "¿quién
 * hizo el desmalezado?" había que leer de corrido buscando un nombre entre
 * comas, con las comas metidas adentro de los propios nombres ("Deshoje de
 * plantas de hojas grandes (alocasias, bijao, heliconias)").
 *
 * En una grilla esa pregunta es un cruce, cada nombre se escribe una sola vez,
 * y **lo que falta es una fila vacía**: se ve de lejos, sin leer.
 *
 * Tres decisiones que la sostienen:
 *
 * - **Las obligatorias van primero y separadas.** Son lo que la visita exigía,
 *   decidido al agendar; el resto es lo que alguien hizo además. Mezclarlas
 *   perdía la única diferencia que la oficina mira antes de cerrar.
 * - **Las horas viven al pie de su columna**, no en un bloque aparte: son de la
 *   persona, como las tildes de arriba, y ahí quedan alineadas entre sí, que es
 *   como se comparan.
 * - **Los avisos son excepciones, no columnas.** Una marca sin ubicación o dos
 *   personas con el mismo teléfono son raros y largos de explicar; como fila de
 *   la grilla serían íconos que hay que descifrar, y abajo son una frase.
 */
export function TareasYPersonal({
  visita,
  hechas,
  faltantes,
  mismoAparato,
  canModify,
}: {
  visita: VisitaParaGrilla;
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
  const obligatorias = visita.tareasObligatorias.map((o) => o.tarea);
  const obligatoriasIds = new Set(obligatorias.map((t) => t.id));
  const extras = hechas.filter((t) => !obligatoriasIds.has(t.id));

  /** Qué marcó cada uno, para preguntar por el cruce sin recorrer listas. */
  const suyas = new Map(
    gente.map((vp) => [vp.personalId, new Set(vp.tareas.map((t) => t.tarea.id))])
  );

  const avisos = [
    ...gente
      .filter((vp) => mismoAparato.has(vp.personalId))
      .map((vp) => ({
        clave: `aparato-${vp.personalId}`,
        icono: <Smartphone className="h-3.5 w-3.5 flex-none" />,
        texto: `${nombreCorto(vp)} marcó desde el mismo teléfono que otra persona.`,
      })),
  ];

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
          {/* Corto: la grilla dice **cuáles** faltan —son las filas vacías—,
              así que acá alcanza con el número, que es lo que se ve sin leer. */}
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
        {gente.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nadie está asignado todavía.
          </p>
        ) : obligatorias.length === 0 && extras.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Todavía nadie cargó su parte.
          </p>
        ) : (
          // La grilla se desborda a lo ancho con mucha gente: scrollea sola en
          // vez de empujar la página, como el resto de las tablas del portal.
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-md border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card pb-2 pr-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tarea
                  </th>
                  {gente.map((vp) => (
                    <th
                      key={vp.personalId}
                      className="w-24 px-1 pb-2 align-bottom"
                      title={nombreLargo(vp)}
                    >
                      <span className="flex flex-col items-center gap-1">
                        <InitialsAvatar name={nombreLargo(vp)} size={26} />
                        <span className="max-w-20 truncate text-xs font-medium">
                          {nombreCorto(vp)}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <Seccion titulo="Obligatorias" columnas={gente.length + 1} />
                {obligatorias.length === 0 ? (
                  <tr>
                    <td
                      colSpan={gente.length + 1}
                      className="border-t py-2 text-xs text-muted-foreground"
                    >
                      La visita no exigía ninguna.
                    </td>
                  </tr>
                ) : (
                  obligatorias.map((t) => (
                    <FilaDeTarea
                      key={t.id}
                      tareaId={t.id}
                      nombre={t.nombre}
                      gente={gente}
                      suyas={suyas}
                      // Una obligatoria que nadie hizo es la fila que hay que
                      // ver: se pinta entera en vez de marcarla al costado.
                      resaltar={!hechas.some((h) => h.id === t.id)}
                    />
                  ))
                )}

                {extras.length > 0 && (
                  <>
                    <Seccion
                      titulo="También se hizo"
                      columnas={gente.length + 1}
                    />
                    {extras.map((t) => (
                      <FilaDeTarea
                        key={t.id}
                        tareaId={t.id}
                        nombre={t.nombre}
                        gente={gente}
                        suyas={suyas}
                      />
                    ))}
                  </>
                )}
              </tbody>

              {/* Las horas al pie de cada columna: son de la persona igual que
                  las tildes de arriba, y quedan alineadas para compararlas. */}
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-10 border-t bg-card py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Horario
                  </td>
                  {gente.map((vp) => (
                    <td
                      key={vp.personalId}
                      className="border-t px-1 py-2 text-center"
                    >
                      {vp.entradaEl || vp.salidaEl ? (
                        <span className="block text-xs tabular-nums">
                          {vp.entradaEl
                            ? horaConDia(vp.entradaEl, visita.fechaProgramada)
                            : "—"}
                          <span className="block text-muted-foreground">
                            {vp.salidaEl
                              ? horaConDia(vp.salidaEl, visita.fechaProgramada)
                              : "sigue ahí"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin marcar
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Quién no cargó nada: la columna vacía no distingue "no hizo
            ninguna" de "todavía no lo cargó", y es lo que la oficina mira
            antes de cerrar. */}
        {gente.some((vp) => vp.registradoEl === null) && (
          <p className="text-xs text-muted-foreground">
            Falta el parte de{" "}
            {gente
              .filter((vp) => vp.registradoEl === null)
              .map((vp) => nombreCorto(vp))
              .join(", ")}
            .
          </p>
        )}

        {/* Solo la oficina. Es la pregunta que ella quería poder hacerse, y la
            única respuesta honesta: dónde estaba el teléfono cuando se apretó
            el botón. No prueba presencia —en el navegador la ubicación se
            falsea en tres clics— pero un "sin ubicación" repetido es algo que
            se conversa. Al jardinero no se le muestra: no es él quien revisa a
            nadie. */}
        {canModify &&
          gente.some((vp) => vp.entradaEl || vp.salidaEl) && (
            <div className="space-y-1 border-t pt-2">
              {gente
                .filter((vp) => vp.entradaEl || vp.salidaEl)
                .map((vp) => (
                  <div
                    key={vp.personalId}
                    className="flex flex-wrap items-center gap-x-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {nombreCorto(vp)}
                    </span>
                    <Ubicaciones parte={vp} />
                  </div>
                ))}
            </div>
          )}

        {avisos.length > 0 && (
          <div className="space-y-1">
            {avisos.map((a) => (
              <p
                key={a.clave}
                className="flex items-center gap-1.5 text-xs font-semibold text-destructive"
              >
                {a.icono}
                {a.texto}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** El rótulo que separa lo que se exigía de lo que se hizo además. */
function Seccion({ titulo, columnas }: { titulo: string; columnas: number }) {
  return (
    <tr>
      <td
        colSpan={columnas}
        className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {titulo}
      </td>
    </tr>
  );
}

function FilaDeTarea({
  tareaId,
  nombre,
  gente,
  suyas,
  resaltar = false,
}: {
  tareaId: string;
  nombre: string;
  gente: PersonalDeVisita[];
  suyas: Map<string, Set<string>>;
  resaltar?: boolean;
}) {
  return (
    <tr className={resaltar ? "bg-destructive/5" : undefined}>
      <td
        className={`sticky left-0 z-10 border-t py-2 pr-3 ${
          resaltar ? "bg-destructive/5" : "bg-card"
        }`}
      >
        {/* Entero: es el nombre de la tarea lo que distingue una fila de otra,
            y recortado "Deshoje de plantas de hojas grandes (alocasias, b…" no
            distingue nada. */}
        <span className="text-sm">{nombre}</span>
      </td>
      {gente.map((vp) => {
        const hizo = suyas.get(vp.personalId)?.has(tareaId) ?? false;
        return (
          <td key={vp.personalId} className="border-t px-1 py-2 text-center">
            {hizo ? (
              <Check className="mx-auto h-4 w-4 text-primary" />
            ) : (
              <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** El primer nombre alcanza para saber a quién preguntarle. */
function nombreCorto(vp: PersonalDeVisita): string {
  return vp.personal.nombre.split(" ")[0];
}

function nombreLargo(vp: PersonalDeVisita): string {
  return `${vp.personal.nombre} ${vp.personal.apellido ?? ""}`.trim();
}
