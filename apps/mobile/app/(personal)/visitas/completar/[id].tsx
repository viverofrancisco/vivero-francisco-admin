import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ubicacionActual } from "@/lib/ubicacion";
import { dispositivoId } from "@/lib/dispositivo";
import * as Haptics from "expo-haptics";
import type { VisitaDetail } from "@/lib/types";
import {
  VisitaResultForm,
  type TareaDeCatalogo,
} from "@/components/VisitaResultForm";
import { tema } from "@/lib/tema";

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
  const [marcando, setMarcando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!id) return;
    return Promise.all([
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

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function marcarEntrada() {
    setMarcando(true);
    setError(null);
    try {
      // La ubicación se pide acá y no se exige: si el permiso está negado o no
      // hay señal, la marca sale igual y la oficina ve que vino sin ubicación.
      await apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}/marca`, {
        method: "POST",
        body: {
          tipo: "ENTRADA",
          ubicacion: await ubicacionActual(),
          // Con qué teléfono se marcó: si dos compañeros marcan desde el mismo,
          // la oficina lo ve. Ver `lib/dispositivo.ts`.
          dispositivo: await dispositivoId(),
        },
      });
      // El golpecito en el mismo momento que el dato queda guardado, no cuando
      // termina de dibujarse: una háptica que llega tarde se lee como una falla,
      // no como confirmación. Marcar la entrada es la acción que hace que el
      // registro diga "estuvo ahí a esa hora" — hasta ahora se resolvía en
      // silencio, con una pantalla que se redibujaba sola.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await cargar();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ApiError ? e.message : "No pudimos marcar");
    } finally {
      setMarcando(false);
    }
  }

  if (!id) return null;
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const mio = visita?.personal?.find((p) => p.personalId === personalId);

  // Sin entrada marcada no hay nada que contar todavía: la pantalla es un botón.
  if (mio && !mio.entradaEl) {
    return (
      <View style={styles.center}>
        <Text variant="titleMedium" style={styles.titulo}>
          Marca tu entrada
        </Text>
        <Text variant="bodyMedium" style={styles.ayuda}>
          Cuando termines vas a marcar tu salida y contar qué hiciste.
        </Text>
        {error ? (
          <Text variant="bodySmall" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          mode="contained"
          onPress={marcarEntrada}
          loading={marcando}
          disabled={marcando}
          buttonColor={tema.verde}
          textColor="#fff"
          style={styles.boton}
          contentStyle={styles.botonContenido}
        >
          Marcar entrada
        </Button>
        <Button mode="text" textColor="#666" onPress={() => router.back()}>
          Volver
        </Button>
      </View>
    );
  }

  return (
    <VisitaResultForm
      visitaId={id}
      tareas={tareas}
      obligatorias={visita?.tareasObligatorias?.map((o) => o.tarea.id) ?? []}
      // Ya salió: lo que sigue es corregir, y eso no mueve las marcas.
      modo={mio?.salidaEl ? "CORRECCION" : "SALIDA"}
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
  titulo: { color: "#111", fontWeight: "700" },
  ayuda: { color: "#666", textAlign: "center", marginBottom: 12 },
  error: { color: "#b3261e", textAlign: "center" },
  boton: { borderRadius: 12, alignSelf: "stretch", marginTop: 8 },
  botonContenido: { height: 52 },
});
