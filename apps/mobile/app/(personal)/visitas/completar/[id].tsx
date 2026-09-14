import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { VisitaDetail } from "@/lib/types";
import {
  VisitaResultForm,
  type TareaDeCatalogo,
} from "@/components/VisitaResultForm";

/**
 * "¿Qué hiciste?" — el parte de quien abre la pantalla.
 *
 * Reemplaza a la vieja de "completar visita". Cerrar la visita pasó a ser de
 * oficina; desde el teléfono cada uno cuenta lo suyo, y lo que ya tenía cargado
 * viene puesto para poder corregirlo.
 */
export default function ParteVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personalId = useAuthStore((s) => s.user?.personalId ?? null);
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [tareas, setTareas] = useState<TareaDeCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`).catch(() => null),
      apiRequest<{ items: TareaDeCatalogo[] }>("/api/mobile/tareas").catch(
        () => ({ items: [] as TareaDeCatalogo[] })
      ),
    ])
      .then(([v, t]) => {
        setVisita(v);
        setTareas(t.items);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return null;
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // El parte propio, si ya lo cargó: es lo que el formulario abre para editar.
  const mio = visita?.personal?.find((p) => p.personalId === personalId);

  return (
    <VisitaResultForm
      visitaId={id}
      tareas={tareas}
      obligatorias={visita?.tareasObligatorias?.map((o) => o.tarea.id) ?? []}
      initialValues={{
        horaEntrada: mio?.horaEntrada ?? null,
        horaSalida: mio?.horaSalida ?? null,
        tareaIds: mio?.tareas.map((t) => t.tarea.id) ?? [],
        existingMedia: visita?.media ?? [],
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
