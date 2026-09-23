import type { TareaDeCatalogo } from "@/components/VisitaResultForm";
import type { TrabajoEnCola } from "./cola-de-visitas";
import type { VisitaDetail } from "./types";

export type ArchivosEnCola = Extract<TrabajoEnCola, { tipo: "ARCHIVOS" }>;

export interface VisitaConCola {
  /** La visita como se ve: lo del servidor más lo que espera en la cola. */
  visita: VisitaDetail;
  entradaEnCola?: TrabajoEnCola;
  salidaEnCola?: TrabajoEnCola;
  archivosEnCola: ArchivosEnCola[];
}

/**
 * La visita **con la cola puesta encima**: la entrada y la salida que esperan
 * se ven marcadas, las tareas cargadas, las fotos borradas ya no están y las
 * reetiquetadas tienen su tarea nueva. Es lo mismo que `mezclarConLaCola` en
 * el chat: la pantalla dibuja lo que la persona hizo, no lo que el servidor
 * ya confirmó, y la diferencia la dice un ✓ de "esperando señal".
 *
 * Las fotos nuevas no entran en `media` —no tienen id ni URL todavía— y van
 * aparte, en `archivosEnCola`, para que la lista las dibuje desde el archivo
 * del teléfono.
 */
export function aplicarCola(
  visita: VisitaDetail,
  personalId: string | null,
  trabajos: TrabajoEnCola[],
  catalogo: TareaDeCatalogo[]
): VisitaConCola {
  const archivosEnCola = trabajos.filter(
    (t): t is ArchivosEnCola => t.tipo === "ARCHIVOS"
  );
  if (trabajos.length === 0) return { visita, archivosEnCola };

  const entradaEnCola = trabajos.find((t) => t.tipo === "ENTRADA");
  const salidaEnCola = trabajos.find((t) => t.tipo === "SALIDA");

  const personal = (visita.personal ?? []).map((p) => {
    if (p.personalId !== personalId) return p;
    let mio = { ...p };
    if (entradaEnCola?.tipo === "ENTRADA" && !mio.entradaEl) {
      mio = { ...mio, entradaEl: entradaEnCola.marcadaEl, entradaSinConexion: true };
    }
    if (salidaEnCola?.tipo === "SALIDA" && !mio.salidaEl) {
      mio = {
        ...mio,
        salidaEl: salidaEnCola.marcadaEl,
        salidaSinConexion: true,
        registradoEl: salidaEnCola.marcadaEl,
        tareas: salidaEnCola.tareaIds.map((id) => ({
          tarea: catalogo.find((c) => c.id === id) ?? { id, nombre: "Tarea", orden: 0 },
        })),
      };
    }
    return mio;
  });

  let media = visita.media ?? [];
  for (const t of archivosEnCola) {
    const fuera = new Set(t.eliminar);
    const nueva = new Map(t.etiquetar.map((e) => [e.id, e.tareaId]));
    media = media
      .filter((m) => !fuera.has(m.id))
      .map((m) => (nueva.has(m.id) ? { ...m, tareaId: nueva.get(m.id)! } : m));
  }

  const estado =
    visita.estado === "PROGRAMADA" && entradaEnCola ? "EN_CURSO" : visita.estado;

  return {
    visita: { ...visita, personal, media, estado },
    entradaEnCola,
    salidaEnCola,
    archivosEnCola,
  };
}
