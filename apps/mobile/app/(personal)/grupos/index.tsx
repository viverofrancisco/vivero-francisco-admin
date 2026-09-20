import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import {
  ALTO_BARRA_SELECCION,
  BarraSeleccion,
} from "@/components/ui/BarraSeleccion";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { avisoDeLote, eliminarEnLote } from "@/lib/lote";
import { useAuthStore } from "@/lib/auth-store";
import type { GrupoConMiembros } from "@/lib/types";
import { coloresDeGrafico, tema } from "@/lib/tema";

/**
 * Las cuadrillas: con quién sale cada uno habitualmente.
 *
 * **La misma pantalla que el portal en el teléfono**: la barra de color que
 * distingue una de otra de un vistazo, cuántos son con la descripción, y
 * cuántas visitas lleva. Los nombres de los miembros quedan para la ficha —no
 * entran en un renglón— y cuántos son sí se dice, que es el dato que separa una
 * cuadrilla de otra.
 */
export default function GruposListScreen() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const puedeEditar = rol === "ADMIN" || rol === "STAFF";
  const [items, setItems] = useState<GrupoConMiembros[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  /** Marcar es un modo, que prende el ⋯ del encabezado. Igual que el portal. */
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: GrupoConMiembros[] }>(
        "/api/mobile/grupos"
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar los grupos"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  function alternar(id: string) {
    setMarcados((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id]
    );
  }

  async function eliminarMarcados() {
    setEliminando(true);
    try {
      const res = await eliminarEnLote("/api/mobile/grupos/eliminar", elegidos);
      setError(avisoDeLote(res, "grupos"));
      setConfirmando(false);
      setSeleccionando(false);
      setMarcados([]);
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos eliminar"));
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () => (q ? items.filter((g) => g.nombre.toLowerCase().includes(q)) : items),
    [items, q]
  );

  // Marcar y filtrar después dejaría una cuenta de seleccionados que ya no
  // están en pantalla, y un botón que borra lo que no se ve.
  const enPantalla = new Set(visibles.map((g) => g.id));
  const elegidos = marcados.filter((id) => enPantalla.has(id));

  return (
    <PantallaLista
      titulo="Grupos"
      accion={
        puedeEditar && !seleccionando && visibles.length > 0 ? (
          <MenuDeEncabezado
            opciones={[
              {
                icono: "checkbox-outline",
                etiqueta: "Seleccionar grupos",
                detalle: "Para eliminar de a varios",
                onPress: () => setSeleccionando(true),
              },
            ]}
          />
        ) : undefined
      }
      onCrear={
        puedeEditar ? () => router.push("/(personal)/grupos/nuevo") : undefined
      }
      etiquetaCrear="Nuevo grupo"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar grupo..."
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(g) => g.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                No se encontraron grupos
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                Un grupo junta a quienes salen habitualmente juntos.
              </Text>
            </View>
          }
          ListFooterComponent={
            seleccionando ? (
              <View style={{ height: ALTO_BARRA_SELECCION }} />
            ) : null
          }
          renderItem={({ item, index }) => (
            <PressableScale
              // Marcando **no navega**: una fila que a veces abre la ficha y a
              // veces marca es una trampa.
              onPress={() =>
                seleccionando
                  ? alternar(item.id)
                  : router.push(`/(personal)/grupos/${item.id}`)
              }
              estiloExterno={styles.ancho}
              style={[
                FILA_LISTA,
                marcados.includes(item.id) && styles.filaMarcada,
              ]}
            >
              {seleccionando ? (
                <Ionicons
                  name={
                    marcados.includes(item.id) ? "checkbox" : "square-outline"
                  }
                  size={22}
                  color={marcados.includes(item.id) ? tema.verde : tema.texto3}
                />
              ) : null}
              {/* La barra de color no dice nada por sí sola: es para reconocer
                  la misma cuadrilla al volver a la lista. */}
              <View
                style={[
                  styles.barra,
                  {
                    backgroundColor:
                      coloresDeGrafico[index % coloresDeGrafico.length],
                  },
                ]}
              />
              <View style={styles.filaTexto}>
                <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text
                  variant="bodySmall"
                  style={styles.detalle}
                  numberOfLines={1}
                >
                  {item.miembros.length}{" "}
                  {item.miembros.length === 1 ? "miembro" : "miembros"}
                  {item.descripcion ? ` · ${item.descripcion}` : ""}
                </Text>
              </View>
              <View style={styles.visitas}>
                <Text style={styles.visitasNumero}>
                  {item._count?.visitas ?? 0}
                </Text>
                <Text style={styles.visitasTexto}>visitas</Text>
              </View>
              {seleccionando ? null : (
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              )}
            </PressableScale>
          )}
        />
      )}

      {seleccionando ? (
        <BarraSeleccion
          cuantas={elegidos.length}
          onSalir={() => {
            setSeleccionando(false);
            setMarcados([]);
          }}
        >
          <PressableScale
            onPress={() => setConfirmando(true)}
            disabled={elegidos.length === 0}
            style={[styles.accionBarra, elegidos.length === 0 && styles.apagado]}
          >
            <Text style={styles.accionBarraTexto}>Eliminar</Text>
          </PressableScale>
        </BarraSeleccion>
      ) : null}

      <DialogoConfirmar
        visible={confirmando}
        titulo={
          elegidos.length === 1
            ? "¿Eliminar 1 grupo?"
            : `¿Eliminar ${elegidos.length} grupos?`
        }
        detalle="Las cuadrillas salen de las listas y de los selectores. Las visitas que salieron con ellas las siguen nombrando: por eso se archivan en vez de borrarse."
        confirmar="Eliminar"
        peligro
        cargando={eliminando}
        onConfirmar={eliminarMarcados}
        onCancelar={() => setConfirmando(false)}
      />
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  ancho: { alignSelf: "stretch" },
  barra: { width: 6, height: 40, borderRadius: 6 },
  filaTexto: { flex: 1, gap: 2 },
  filaMarcada: { backgroundColor: tema.verde50 },
  nombre: { color: tema.texto, fontWeight: "700" },
  detalle: { color: tema.texto3 },
  visitas: { alignItems: "flex-end" },
  visitasNumero: {
    color: tema.texto,
    fontWeight: "700",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  visitasTexto: { color: tema.texto3, fontSize: 11, fontWeight: "600" },
  /* Claro sobre oscuro, nunca el rojo de la casa: sobre la pastilla oscura
     desaparece. El rojo lo pone la confirmación, que es donde se decide. */
  accionBarra: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },
  apagado: { opacity: 0.45 },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
