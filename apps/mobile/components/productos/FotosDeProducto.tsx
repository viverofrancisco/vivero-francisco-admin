import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { VisorDeFotosDeProducto } from "./VisorDeFotosDeProducto";
import {
  SelectorDeFotos,
  fotoDeBiblioteca,
} from "@/components/informes/SelectorDeFotos";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

/**
 * Las fotos del producto, la sección *Media* de Shopify: las miniaturas
 * grandes en una fila que scrollea, y al final un **+** que agrega. Tocar
 * una foto la abre en el visor (`VisorDeFotosDeProducto`), donde están
 * recortar, ponerla primera y quitarla; había una hoja con *Ver foto* y
 * *Quitar* en el medio, que Shopify no tiene.
 *
 * El **+** abre el selector de fotos del informe en modo biblioteca
 * (`SelectorDeFotos`, el *Select files* de Shopify): la grilla de la
 * biblioteca con las del producto ya marcadas, el buscador, y la cámara y
 * el + arriba para subir nuevas, que entran a la biblioteca y quedan
 * marcadas. *Listo* devuelve la lista final: lo que se desmarcó se saca del
 * producto y lo nuevo se suma, en el acto, como en Shopify. Quitar la saca
 * **del producto**, no de la biblioteca. La ficha vuelve a cargar después
 * de cada gesto.
 */
export function FotosDeProducto({
  productoId,
  imagenes,
  canEdit,
  onRecargar,
}: {
  productoId: string;
  imagenes: { id: string; mediaId: string; url: string }[];
  canEdit: boolean;
  onRecargar: () => void;
}) {
  /** En qué foto se abrió el visor, o `null` cerrado. */
  const [visor, setVisor] = useState<number | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lo que quedó marcado en el selector, contra lo que el producto tiene:
   * lo desmarcado se quita y lo nuevo se suma. Las que siguen no se tocan,
   * así conservan su fila y el vínculo de la variante que las eligió.
   */
  async function aplicar(mediaIds: string[]) {
    setEligiendo(false);
    setAplicando(true);
    setError(null);
    try {
      const finales = new Set(mediaIds);
      const quitadas = imagenes.filter((i) => !finales.has(i.mediaId));
      const tenia = new Set(imagenes.map((i) => i.mediaId));
      const nuevas = mediaIds.filter((id) => !tenia.has(id));
      for (const q of quitadas) {
        await apiRequest(`/api/mobile/servicios/${productoId}/imagenes/${q.id}`, {
          method: "DELETE",
        });
      }
      if (nuevas.length > 0) {
        await apiRequest(`/api/mobile/servicios/${productoId}/imagenes`, {
          method: "POST",
          body: { mediaIds: nuevas },
        });
      }
      if (quitadas.length > 0 || nuevas.length > 0) onRecargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar las fotos"));
    } finally {
      setAplicando(false);
    }
  }

  async function ponerPrimera(id: string) {
    setError(null);
    try {
      await apiRequest(`/api/mobile/servicios/${productoId}/imagenes`, {
        method: "PATCH",
        body: { ids: [id, ...imagenes.map((i) => i.id).filter((x) => x !== id)] },
      });
      onRecargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos reordenar las fotos"));
    }
  }

  async function quitar(id: string) {
    setError(null);
    try {
      await apiRequest(`/api/mobile/servicios/${productoId}/imagenes/${id}`, {
        method: "DELETE",
      });
      onRecargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos quitar la foto"));
    }
  }

  return (
    <View style={estilosDeFicha.section}>
      <Text variant="labelMedium" style={estilosDeFicha.sectionLabel}>
        FOTOS{imagenes.length > 0 ? ` (${imagenes.length})` : ""}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fila}
      >
        {imagenes.map((img, i) => (
          <PressableScale
            key={img.id}
            onPress={() => setVisor(i)}
            accessibilityLabel={i === 0 ? "Foto principal" : `Foto ${i + 1}`}
          >
            <Image source={{ uri: img.url }} style={styles.foto} contentFit="cover" cachePolicy="disk" />
          </PressableScale>
        ))}
        {canEdit ? (
          <Pressable
            onPress={() => setEligiendo(true)}
            disabled={aplicando}
            style={({ pressed }) => [styles.foto, styles.agregar, pressed && styles.tocado]}
            accessibilityLabel="Agregar fotos"
          >
            {aplicando ? (
              <ActivityIndicator color={tema.texto2} />
            ) : (
              <Ionicons name="add" size={28} color={tema.texto} />
            )}
          </Pressable>
        ) : null}
        {imagenes.length === 0 && !canEdit ? (
          <Text style={estilosDeFicha.vacio}>Sin fotos.</Text>
        ) : null}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* El selector del informe en modo biblioteca: las del producto entran
          marcadas, y lo que vuelve es la lista final. */}
      {eligiendo ? (
        <SelectorDeFotos
          pool={[]}
          soloBiblioteca
          enLaSeccion={imagenes.map((i) => fotoDeBiblioteca({ id: i.mediaId, url: i.url }))}
          onCerrar={() => setEligiendo(false)}
          onConfirmar={(fotos) =>
            void aplicar(fotos.map((f) => f.mediaId).filter((id): id is string => !!id))
          }
        />
      ) : null}

      {visor !== null ? (
        <VisorDeFotosDeProducto
          productoId={productoId}
          imagenes={imagenes}
          inicial={visor}
          canEdit={canEdit}
          onCerrar={() => setVisor(null)}
          onRecargar={onRecargar}
          onPonerPrimera={(id) => void ponerPrimera(id)}
          onQuitar={(id) => void quitar(id)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { gap: 10, paddingVertical: 2, paddingRight: 16 },
  foto: { width: 120, height: 120, borderRadius: 12, backgroundColor: tema.lienzo },
  agregar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  tocado: { opacity: 0.6 },
  error: { color: tema.rojo, fontSize: 13, paddingHorizontal: 4, paddingTop: 4 },

});
