import { useState } from "react";
import { FlatList, Modal, StyleSheet, TextInput, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { BarraSeleccion } from "@/components/ui/BarraSeleccion";
import type { CampoDeVarianteEnLote } from "@vivero/shared";
import { AccionesDeVariantesEnLote, EditarVariantesEnLote } from "./VariantesEnLote";
import { PressableScale } from "@/components/ui/PressableScale";
import { FichaDeVariante } from "./FichaDeVariante";
import { resumenDeVariante } from "./formato";
import type { ServicioDetail } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

/**
 * Las variantes de un producto, la lista de Shopify: la miniatura, el nombre
 * de la combinación, "$16,00 • 578 disponibles" y el SKU, con un filtro
 * arriba para cuando son muchas. Cada fila abre la ficha de la variante.
 *
 * *Seleccionar* (arriba, para quien edita) vuelve las filas casillas y saca la
 * barra oscura con **Editar**: las acciones en lote de Shopify, las mismas del
 * portal (`VariantesEnLote`).
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
  const [seleccionando, setSeleccionando] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [acciones, setAcciones] = useState(false);
  const [editandoCampo, setEditandoCampo] = useState<CampoDeVarianteEnLote | null>(null);
  const salir = () => {
    setSeleccionando(false);
    setMarcadas([]);
  };
  const alternar = (id: string) =>
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const q = filtro.trim().toLowerCase();
  const filas = q
    ? producto.variantes.filter(
        (v) => v.nombre.toLowerCase().includes(q) || (v.sku ?? "").toLowerCase().includes(q)
      )
    : producto.variantes;
  const abierta = producto.variantes.find((v) => v.id === abiertaId) ?? null;

  const teclado = useAltoDelTeclado();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingBottom: teclado }]}>
        <CabeceraDeHoja
          titulo="Variantes"
          subtitulo={`${producto.variantes.length} ${producto.variantes.length === 1 ? "variante" : "variantes"}`}
          onCerrar={onCerrar}
          derecha={
            canEdit && producto.variantes.length > 1 ? (
              seleccionando ? (
                <PastillaDeHoja
                  texto={marcadas.length === filas.length ? "Ninguna" : "Todas"}
                  onPress={() =>
                    setMarcadas(marcadas.length === filas.length ? [] : filas.map((v) => v.id))
                  }
                />
              ) : (
                <PastillaDeHoja texto="Seleccionar" onPress={() => setSeleccionando(true)} />
              )
            ) : undefined
          }
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
          // La barra flota sobre la última fila: un hueco de su alto al pie.
          ListFooterComponent={seleccionando ? <View style={styles.huecoBarra} /> : null}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => (seleccionando ? alternar(item.id) : setAbiertaId(item.id))}
              estiloExterno={styles.ancho}
              style={styles.fila}
              accessibilityRole={seleccionando ? "checkbox" : undefined}
              accessibilityState={seleccionando ? { checked: marcadas.includes(item.id) } : undefined}
            >
              {seleccionando ? (
                <View style={[styles.casilla, marcadas.includes(item.id) && styles.casillaMarcada]}>
                  {marcadas.includes(item.id) ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                </View>
              ) : null}
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
              {seleccionando ? null : <Ionicons name="chevron-forward" size={18} color={tema.texto3} />}
            </PressableScale>
          )}
        />
        {seleccionando ? (
          <BarraSeleccion cuantas={marcadas.length} onSalir={salir}>
            <PressableScale
              onPress={() => setAcciones(true)}
              disabled={marcadas.length === 0}
              style={[styles.accionBarra, marcadas.length === 0 && styles.apagado]}
            >
              <Text style={styles.accionBarraTexto}>Editar</Text>
            </PressableScale>
          </BarraSeleccion>
        ) : null}
      </View>

      <AccionesDeVariantesEnLote
        visible={acciones}
        productoId={producto.id}
        ids={marcadas}
        onCerrar={() => setAcciones(false)}
        onCampo={setEditandoCampo}
        onAplicado={onRecargar}
      />
      {editandoCampo ? (
        <EditarVariantesEnLote
          campo={editandoCampo}
          productoId={producto.id}
          variantes={producto.variantes.filter((v) => marcadas.includes(v.id))}
          onCerrar={() => setEditandoCampo(null)}
          onGuardado={onRecargar}
        />
      ) : null}

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
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tema.texto3,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },
  huecoBarra: { height: 96 },
  // Claro sobre oscuro, como toda acción de la barra de selección.
  accionBarra: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },
  apagado: { opacity: 0.45 },
});
