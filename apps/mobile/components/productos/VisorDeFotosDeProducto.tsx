import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecortarFoto, type EdicionDeFoto } from "@/components/informes/RecortarFoto";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

export interface FotoDeProducto {
  id: string;
  mediaId: string;
  url: string;
}

/**
 * Las fotos del producto a pantalla completa, el visor de Shopify: fondo
 * negro, la ✕ y el ⋯ en círculos oscuros arriba —así se ven también sobre
 * una foto blanca—, *N de M* en el medio, un deslizamiento por foto, y abajo
 * *Recortar*. El ⋯ tiene lo demás que se hace con una foto: ponerla primera
 * y quitarla del producto.
 *
 * Tocar una miniatura abría una hoja con *Ver foto* y *Quitar*, y el visor de
 * antes ponía una ✕ blanca sin fondo que sobre una foto clara desaparecía.
 *
 * El recorte es el mismo recortador del informe: dibuja el recuadro y el
 * servidor aplica la edición y devuelve **otra** imagen de la biblioteca, que
 * pasa a ocupar el lugar de esta en el producto (`PATCH …/imagenes/[id]`),
 * sin moverla de posición ni soltar la variante que la había elegido.
 */
export function VisorDeFotosDeProducto({
  productoId,
  imagenes,
  inicial,
  canEdit,
  onCerrar,
  onRecargar,
  onPonerPrimera,
  onQuitar,
}: {
  productoId: string;
  imagenes: FotoDeProducto[];
  inicial: number;
  canEdit: boolean;
  onCerrar: () => void;
  onRecargar: () => void;
  onPonerPrimera?: (id: string) => void;
  onQuitar?: (id: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [indice, setIndice] = useState(Math.min(inicial, Math.max(0, imagenes.length - 1)));
  const [menu, setMenu] = useState(false);
  const [recortando, setRecortando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista = useRef<FlatList<FotoDeProducto>>(null);
  const actual = imagenes[indice] ?? null;

  // Quitar la última cierra el visor; quitar la del final corre el índice.
  useEffect(() => {
    if (imagenes.length === 0) onCerrar();
    else if (indice > imagenes.length - 1) setIndice(imagenes.length - 1);
  }, [imagenes.length, indice, onCerrar]);

  async function recortar(edicion: EdicionDeFoto) {
    if (!actual) return;
    setOcupado(true);
    setError(null);
    try {
      const { media } = await apiRequest<{ media: { id: string } }>(
        `/api/mobile/media/${actual.mediaId}/editar`,
        { method: "POST", body: { origen: "biblioteca", ...edicion } }
      );
      await apiRequest(`/api/mobile/servicios/${productoId}/imagenes/${actual.id}`, {
        method: "PATCH",
        body: { mediaId: media.id },
      });
      setRecortando(false);
      onRecargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos recortar la foto"));
      setRecortando(false);
    } finally {
      setOcupado(false);
    }
  }

  const altoBarra = insets.top + 8 + 44;

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <FlatList
          ref={lista}
          horizontal
          pagingEnabled
          data={imagenes}
          keyExtractor={(f) => f.id}
          initialScrollIndex={indice}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setIndice(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image
                source={{ uri: item.url }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="disk"
              />
            </View>
          )}
        />

        {/* Arriba: la ✕, el contador y el ⋯, en círculos oscuros para que se
            lean sobre cualquier foto. */}
        <View style={[styles.arriba, { paddingTop: insets.top + 8 }]}>
          <BotonOscuro icono="close-outline" etiqueta="Cerrar" onPress={onCerrar} />
          <Text style={styles.contador}>
            {imagenes.length > 0 ? `${indice + 1} de ${imagenes.length}` : ""}
          </Text>
          {canEdit && (onPonerPrimera || onQuitar) ? (
            <BotonOscuro
              icono="ellipsis-horizontal"
              etiqueta="Acciones"
              onPress={() => setMenu((v) => !v)}
            />
          ) : (
            <View style={styles.hueco} />
          )}
        </View>

        {menu ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
            <View style={[styles.menu, { top: altoBarra + 6 }]}>
              {onPonerPrimera && indice > 0 ? (
                <ItemDeMenu
                  icono="star-outline"
                  texto="Poner como primera"
                  onPress={() => {
                    setMenu(false);
                    if (actual) onPonerPrimera(actual.id);
                  }}
                />
              ) : null}
              {onQuitar ? (
                <ItemDeMenu
                  icono="trash-outline"
                  texto="Quitar del producto"
                  peligro
                  onPress={() => {
                    setMenu(false);
                    if (actual) onQuitar(actual.id);
                  }}
                />
              ) : null}
            </View>
          </>
        ) : null}

        {/* Abajo, las herramientas de Shopify: acá, recortar. */}
        {canEdit ? (
          <View style={[styles.abajo, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={() => setRecortando(true)}
              disabled={!actual || ocupado}
              style={({ pressed }) => [styles.herramienta, pressed && styles.tocado]}
              accessibilityLabel="Recortar"
            >
              <Ionicons name="crop-outline" size={22} color="#fff" />
              <Text style={styles.herramientaTexto}>Recortar</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <Text style={[styles.error, { bottom: Math.max(insets.bottom, 12) + 84 }]}>{error}</Text>
        ) : null}
        {ocupado && !recortando ? (
          <View style={styles.velo}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>

      {recortando && actual ? (
        <RecortarFoto
          key={actual.id}
          url={actual.url}
          guardando={ocupado}
          onCerrar={() => setRecortando(false)}
          onGuardar={(edicion) => void recortar(edicion)}
        />
      ) : null}
    </Modal>
  );
}

/** Un botón redondo oscuro sobre la foto: 44, como los de Shopify en su visor. */
function BotonOscuro({
  icono,
  etiqueta,
  onPress,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  etiqueta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
    >
      <Ionicons name={icono} size={22} color="#fff" />
    </Pressable>
  );
}

function ItemDeMenu({
  icono,
  texto,
  peligro = false,
  onPress,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  texto: string;
  peligro?: boolean;
  onPress: () => void;
}) {
  const color = peligro ? "#ff6b6b" : "#fff";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.itemTocado]}>
      <Ionicons name={icono} size={20} color={color} />
      <Text style={[styles.itemTexto, { color }]}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  arriba: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  contador: { color: "#fff", fontSize: 15, fontWeight: "600", opacity: 0.9 },
  redondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(60,60,60,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  hueco: { width: 44, height: 44 },
  tocado: { opacity: 0.7 },
  menu: {
    position: "absolute",
    right: 12,
    minWidth: 240,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#2c2c2e",
  },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  itemTocado: { backgroundColor: "rgba(255,255,255,0.08)" },
  itemTexto: { fontSize: 16 },
  abajo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  herramienta: {
    minWidth: 120,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(60,60,60,0.85)",
  },
  herramientaTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
  error: { position: "absolute", left: 16, right: 16, color: tema.rojo, textAlign: "center", fontSize: 13 },
  velo: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
});
