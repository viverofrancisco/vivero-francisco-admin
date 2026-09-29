import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, TextInput, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { GrupoConMiembros } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

/**
 * En qué cuadrillas está una persona, desde su ficha: la misma pantalla que
 * las categorías de un producto. Un buscador arriba, cada grupo como una fila
 * con su casilla y cuánta gente tiene, y *Guardar* manda la lista entera
 * (`PUT …/personal/[id]/grupos`). Hasta ahora había que abrir cada grupo para
 * cambiar a alguien de cuadrilla.
 */
export function SelectorDeGrupos({
  personalId,
  elegidos,
  onCerrar,
  onGuardado,
}: {
  personalId: string;
  /** Los ids de los grupos de la persona hoy. */
  elegidos: string[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [grupos, setGrupos] = useState<GrupoConMiembros[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(elegidos));
  const [filtro, setFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teclado = useAltoDelTeclado();

  useEffect(() => {
    apiRequest<{ items: GrupoConMiembros[] }>("/api/mobile/grupos")
      .then((r) => setGrupos(r.items))
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar los grupos")));
  }, []);

  const filas = useMemo(() => {
    if (!grupos) return [];
    const q = filtro.trim().toLowerCase();
    return q ? grupos.filter((g) => g.nombre.toLowerCase().includes(q)) : grupos;
  }, [grupos, filtro]);

  const hayCambios =
    marcados.size !== elegidos.length || elegidos.some((id) => !marcados.has(id));

  function alternar(id: string) {
    setMarcados((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  async function guardar() {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(`/api/mobile/personal/${personalId}/grupos`, {
        method: "PUT",
        body: { grupoIds: [...marcados] },
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar los grupos"));
      setGuardando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingBottom: teclado }]}>
        <CabeceraDeHoja
          titulo="Grupos"
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              disabled={!hayCambios}
              cargando={guardando}
            />
          }
        />
        <View style={styles.buscador}>
          <Ionicons name="search" size={18} color={tema.texto3} />
          <TextInput
            value={filtro}
            onChangeText={setFiltro}
            placeholder="Filtrar grupos"
            placeholderTextColor={tema.texto3}
            style={styles.buscadorTexto}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {grupos === null && !error ? (
          <View style={styles.centro}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={filas}
            keyExtractor={(g) => g.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
            ListEmptyComponent={
              <Text style={styles.vacio}>
                {grupos && grupos.length === 0
                  ? "Todavía no hay grupos creados."
                  : "Ningún grupo coincide."}
              </Text>
            }
            renderItem={({ item }) => {
              const marcado = marcados.has(item.id);
              const cuantos = item.miembros.length;
              return (
                <PressableScale
                  onPress={() => alternar(item.id)}
                  estiloExterno={styles.ancho}
                  style={[styles.fila, marcado && styles.filaMarcada]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                >
                  <View style={[styles.casilla, marcado && styles.casillaMarcada]}>
                    {marcado ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                  <View style={styles.filaTexto}>
                    <Text style={styles.nombre} numberOfLines={2}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.cuenta}>
                      {cuantos} {cuantos === 1 ? "persona" : "personas"}
                    </Text>
                  </View>
                </PressableScale>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  ancho: { alignSelf: "stretch" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
  },
  buscadorTexto: { flex: 1, fontSize: 16, color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 12 },
  vacio: { color: tema.texto3, textAlign: "center", padding: 24 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  filaMarcada: { backgroundColor: tema.fondo },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: "600", color: tema.texto },
  cuenta: { fontSize: 14, color: tema.texto3 },
});
