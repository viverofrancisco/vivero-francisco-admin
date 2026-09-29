import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, TextInput, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { CategoriaListItem } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

/**
 * En qué categorías está el producto: la pantalla *Collections* de Shopify.
 * Un buscador arriba, cada categoría como una fila con su casilla, su foto y
 * cuántos productos tiene, y abajo la barra oscura que dice cuántas van.
 *
 * En cuanto el conjunto cambia, arriba aparecen *Cancelar* y *Guardar*, como
 * en las hojas de precio e inventario: *Guardar* manda el conjunto entero por
 * `PUT` del producto y la ficha vuelve a cargar; *Cancelar* deja todo como
 * estaba. Es un reemplazo, no un parche —como en el portal—, así que lo que
 * se desmarca se va y lo que se marca entra en el mismo pedido.
 */
export function SelectorDeCategorias({
  productoId,
  elegidas,
  onCerrar,
  onGuardado,
}: {
  productoId: string;
  /** Los ids de las categorías del producto hoy. */
  elegidas: string[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [categorias, setCategorias] = useState<CategoriaListItem[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(elegidas));
  const [filtro, setFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ categorias: CategoriaListItem[] }>("/api/mobile/categorias")
      .then((r) => setCategorias(r.categorias))
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar las categorías")));
  }, []);

  const filas = useMemo(() => {
    if (!categorias) return [];
    const q = filtro.trim().toLowerCase();
    return q ? categorias.filter((c) => c.nombre.toLowerCase().includes(q)) : categorias;
  }, [categorias, filtro]);

  const hayCambios =
    marcadas.size !== elegidas.length || elegidas.some((id) => !marcadas.has(id));

  function alternar(id: string) {
    setMarcadas((actual) => {
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
      // En el orden del catálogo, no en el que se marcaron.
      const ids = (categorias ?? []).filter((c) => marcadas.has(c.id)).map((c) => c.id);
      await apiRequest(`/api/mobile/servicios/${productoId}`, {
        method: "PUT",
        body: { categoriaIds: ids },
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar las categorías"));
      setGuardando(false);
    }
  }

  const teclado = useAltoDelTeclado();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingBottom: teclado }]}>
        <CabeceraDeHoja
          titulo="Categorías"
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
            placeholder="Filtrar categorías"
            placeholderTextColor={tema.texto3}
            style={styles.buscadorTexto}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {categorias === null && !error ? (
          <View style={styles.centro}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={filas}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
            ListEmptyComponent={
              <Text style={styles.vacio}>
                {categorias && categorias.length === 0
                  ? "Todavía no hay categorías creadas."
                  : "Ninguna categoría coincide."}
              </Text>
            }
            renderItem={({ item }) => {
              const marcada = marcadas.has(item.id);
              return (
                <PressableScale
                  onPress={() => alternar(item.id)}
                  estiloExterno={styles.ancho}
                  style={[styles.fila, marcada && styles.filaMarcada]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcada }}
                >
                  <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
                    {marcada ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                  {item.imagenUrl ? (
                    <Image source={{ uri: item.imagenUrl }} style={styles.foto} contentFit="cover" cachePolicy="disk" />
                  ) : (
                    <View style={[styles.foto, styles.sinFoto]}>
                      <Ionicons name="pricetag-outline" size={18} color={tema.texto3} />
                    </View>
                  )}
                  <View style={styles.filaTexto}>
                    <Text style={styles.nombre} numberOfLines={2}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.cuenta}>
                      {item.productos} {item.productos === 1 ? "producto" : "productos"}
                    </Text>
                  </View>
                </PressableScale>
              );
            }}
          />
        )}

        {/* La barra de Shopify: oscura, flotando sobre la lista, con cuántas
            van. Se ve mientras haya alguna marcada. */}
        {marcadas.size > 0 ? (
          <View style={[styles.barra, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
            <View style={styles.barraPastilla}>
              <Text style={styles.barraTexto}>
                {marcadas.size} {marcadas.size === 1 ? "seleccionada" : "seleccionadas"}
              </Text>
              <PressableScale
                onPress={() => setMarcadas(new Set())}
                style={styles.barraBoton}
                accessibilityLabel="Desmarcar todas"
              >
                <Text style={styles.barraBotonTexto}>Desmarcar</Text>
              </PressableScale>
            </View>
          </View>
        ) : null}
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
  foto: { width: 48, height: 48, borderRadius: 8, backgroundColor: tema.lienzo },
  sinFoto: { alignItems: "center", justifyContent: "center" },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: "600", color: tema.texto },
  cuenta: { fontSize: 14, color: tema.texto3 },

  barra: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  barraPastilla: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    alignSelf: "stretch",
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: tema.texto,
  },
  barraTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
  barraBoton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  barraBotonTexto: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
