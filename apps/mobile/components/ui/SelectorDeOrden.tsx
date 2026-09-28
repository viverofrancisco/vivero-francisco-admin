import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  CAMPOS_ORDEN_PRODUCTOS,
  CAMPO_ORDEN_PRODUCTOS_LABEL,
  ORDEN_PRODUCTOS_POR_DEFECTO,
  etiquetaDeDireccion,
  invertirOrden,
  mismoOrden,
  ordenPorCampo,
  type OrdenProductos,
} from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import {
  BOTON_JUNTO_AL_BUSCADOR,
  BOTON_JUNTO_AL_BUSCADOR_ACTIVO,
} from "@/components/ui/PantallaLista";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Ordenar la lista de productos, como Shopify: el ⇅ al lado del buscador abre
 * una hoja desde abajo con los campos como filas, y la fila elegida lleva su
 * dirección al lado —"Más recientes primero"—, que un segundo toque invierte.
 * Elegir otra fila la pone con la dirección que se propone para ella (un
 * nombre de la A a la Z, una fecha desde lo último). **La hoja no se cierra al
 * elegir**: la segunda decisión, la dirección, se toma ahí mismo; se cierra
 * arrastrando o tocando afuera, como toda hoja.
 *
 * El botón se pinta como el de filtros con algo puesto cuando el orden no es
 * el de siempre, que es lo único que hace falta saber sin abrirlo. Es la
 * misma hoja que el portal abre debajo de `md` (`SelectorOrdenProductos`).
 */
export function SelectorDeOrden({
  orden,
  onCambiar,
  etiqueta = "Ordenar productos",
}: {
  orden: OrdenProductos;
  onCambiar: (orden: OrdenProductos) => void;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const distinto = !mismoOrden(orden, ORDEN_PRODUCTOS_POR_DEFECTO);

  return (
    <>
      <PressableScale
        onPress={() => setAbierto(true)}
        style={[
          BOTON_JUNTO_AL_BUSCADOR,
          distinto && BOTON_JUNTO_AL_BUSCADOR_ACTIVO,
        ]}
        accessibilityLabel={etiqueta}
      >
        <Ionicons
          name="swap-vertical"
          size={20}
          color={distinto ? tema.verde700 : tema.texto2}
        />
      </PressableScale>

      <HojaInferior visible={abierto} onCerrar={() => setAbierto(false)}>
        <Text style={styles.titulo}>Ordenar por</Text>
        <View style={styles.lista}>
          {CAMPOS_ORDEN_PRODUCTOS.map((campo, i) => {
            const activa = orden.campo === campo;
            return (
              <Pressable
                key={campo}
                onPress={() =>
                  onCambiar(activa ? invertirOrden(orden) : ordenPorCampo(campo))
                }
                style={({ pressed }) => [
                  styles.fila,
                  i === 0 && styles.primera,
                  pressed && styles.filaPresionada,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
              >
                <Text variant="bodyLarge" style={styles.campo}>
                  {CAMPO_ORDEN_PRODUCTOS_LABEL[campo]}
                </Text>
                {activa ? (
                  <View style={styles.direccion}>
                    <Text style={styles.direccionTexto}>
                      {etiquetaDeDireccion(orden)}
                    </Text>
                    <Ionicons name="swap-vertical" size={18} color={tema.verde700} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </HojaInferior>
    </>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  lista: { paddingHorizontal: 8 },
  /* Renglones separados por una línea, como los de Shopify: acá no hay tilde
     y la línea es lo que dice dónde termina cada uno. */
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  primera: { borderTopWidth: 0 },
  filaPresionada: { backgroundColor: tema.lienzo },
  campo: { color: tema.texto },
  direccion: { flexDirection: "row", alignItems: "center", gap: 6 },
  direccionTexto: { fontSize: 14, fontWeight: "600", color: tema.verde700 },
});
