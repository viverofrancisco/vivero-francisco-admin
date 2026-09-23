import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { leerTareas, leerVisita } from "@/lib/cache-de-visitas";
import { trabajosDe, useColaDeVisitas } from "@/lib/cola-de-visitas";
import { ubicacionActual } from "@/lib/ubicacion";
import type { VisitaDetail } from "@/lib/types";
import {
  VisitaResultForm,
  type TareaDeCatalogo,
} from "@/components/VisitaResultForm";

/**
 * Mi paso por esta visita: marcar entrada, y al irse contar qué hice.
 *
 * Los dos momentos los **sella el servidor** cuando se aprieta el botón, en vez
 * de dos campos donde escribir una hora: eso es lo que convierte el dato en
 * "estuvo ahí a esa hora" y no "alguien dijo que estuvo".
 *
 * Al salir se pregunta qué hizo, porque recién ahí lo sabe. Las fotos se suben
 * acá o antes, desde la visita: se sacan mientras se trabaja.
 */
export default function ParteVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const personalId = useAuthStore((s) => s.user?.personalId ?? null);
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [tareas, setTareas] = useState<TareaDeCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  // Sin señal, la copia local: la visita y el catálogo de tareas que se
  // guardaron la última vez. Sin catálogo no hay nada que tildar.
  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const [v, t] = await Promise.all([
        apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`).catch(() => null),
        apiRequest<{ items: TareaDeCatalogo[] }>("/api/mobile/tareas").catch(
          () => null
        ),
      ]);
      setVisita(v ?? (await leerVisita(id)));
      setTareas(t?.items?.length ? t.items : ((await leerTareas()) ?? []));
    } finally {
      setLoading(false);
    }
  }, [id]);

  /** La entrada o la salida que esperan en la cola cuentan como marcadas. */
  const cola = useColaDeVisitas((s) => s.items);
  const trabajos = trabajosDe(cola, id ?? "");
  const entradaEnCola = trabajos.some((t) => t.tipo === "ENTRADA");
  const salidaEnCola = trabajos.some((t) => t.tipo === "SALIDA");

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!id) return null;
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const mio = visita?.personal?.find((p) => p.personalId === personalId);

  // Sin entrada marcada no hay nada que contar: marcar la entrada es un
  // diálogo en la ficha, no una pantalla. Si igual se llega acá —un aviso
  // viejo, un enlace guardado— se vuelve en vez de mostrar una pantalla que no
  // sirve para nada.
  if (mio && !mio.entradaEl && !entradaEnCola) {
    router.back();
    return null;
  }

  return (
    <VisitaResultForm
      visitaId={id}
      tareas={tareas}
      obligatorias={visita?.tareasObligatorias?.map((o) => o.tarea.id) ?? []}
      // Ya salió: lo que sigue es corregir, y eso no mueve las marcas.
      modo={mio?.salidaEl || salidaEnCola ? "CORRECCION" : "SALIDA"}
      ubicacion={ubicacionActual}
      initialValues={{
        tareaIds: mio?.tareas.map((t) => t.tarea.id) ?? [],
        existingMedia: visita?.media ?? [],
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
});
