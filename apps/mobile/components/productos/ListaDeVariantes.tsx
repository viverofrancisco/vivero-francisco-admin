import { useState } from "react";
import { FlatList, Modal, StyleSheet, TextInput, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja } from "@/components/ui/CabeceraDeHoja";
import { PressableScale } from "@/components/ui/PressableScale";
import { FichaDeVariante } from "./FichaDeVariante";
import { resumenDeVariante } from "./formato";
import type { ServicioDetail } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Las variantes de un producto, la lista de Shopify: la miniatura, el nombre
 * de la combinación, "$16,00 • 578 disponibles" y el SKU, con un filtro
 * arriba para cuando son muchas. Cada fila abre la ficha de la variante.
 *
 * Recibe el producto entero y no una copia de las variantes: cuando la ficha
 * de una guarda algo, el producto se vuelve a pedir y la lista y la ficha
 * abierta se refrescan solas con lo que llegó.
 */
export function ListaDeVariantes({
  producto,
  canEdit,
  onCerrar,
  onRecargar,
}: {
  producto: ServicioDetail;
  canEdit: boolean;
  onCerrar: () => void;
  onRecargar: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);

  const q = filtro.trim().toLowerCase();
  const filas = q
    ? producto.variantes.filter(
        (v) => v.nombre.toLowerCase().includes(q) || (v.sku ?? "").toLowerCase().includes(q)
      )
    : producto.variantes;
  const abierta = producto.variantes.find((v) => v.id === abiertaId) ?? null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo="Variantes"
          subtitulo={`${producto.variantes.length} ${producto.variantes.length === 1 ? "variante" : "variantes"}`}
          onCerrar={onCerrar}
        />
        <View style={styles.buscador}>
          <Ionicons name="search" size={18} color={tema.texto3} />
          <TextInput
            value={filtro}
            onChangeText={setFiltro}
            placeholder="Filtrar variantes"
            placeholderTextColor={tema.texto3}
            style={styles.buscadorTexto}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        <FlatList
          data={filas}
          keyExtractor={(v) => v.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.vacio}>Ninguna variante coincide.</Text>}
          renderItem={({ item }) => (
            <PressableScale onPress={() => setAbiertaId(item.id)} estiloExterno={styles.ancho} style={styles.fila}>
              {item.imagenUrl ? (
                <Image source={{ uri: item.imagenUrl }} style={styles.foto} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[styles.foto, styles.sinFoto]}>
                  <Ionicons name="image-outline" size={20} color={tema.texto3} />
                </View>
              )}
              <View style={styles.filaTexto}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={styles.resumen} numberOfLines={1}>
                  {resumenDeVariante(item)}
                </Text>
                <Text style={styles.sku} numberOfLines={1}>
                  {item.sku ? `SKU ${item.sku}` : "Sin SKU"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          )}
        />
      </View>

      {abierta ? (
        <FichaDeVariante
          variante={abierta}
          producto={producto}
          canEdit={canEdit}
          onCerrar={() => setAbiertaId(null)}
          onRecargar={onRecargar}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  ancho: { alignSelf: "stretch" },
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
  buscadorTexto: { flex: 1, fontSize: 17, color: tema.texto },
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
  foto: { width: 52, height: 52, borderRadius: 10, backgroundColor: tema.lienzo },
  sinFoto: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: tema.linea },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { fontSize: 17, fontWeight: "600", color: tema.texto },
  resumen: { fontSize: 15, color: tema.texto2 },
  sku: { fontSize: 14, color: tema.texto3 },
});
