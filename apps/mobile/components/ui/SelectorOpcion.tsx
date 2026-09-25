import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { tema } from "@/lib/tema";

export interface OpcionElegible {
  clave: string;
  etiqueta: string;
  /** Un renglón chico debajo: la dirección de la propiedad, un aviso. */
  detalle?: string | null;
}

/**
 * Elegir una entre pocas opciones, en una hoja que sube desde abajo.
 *
 * Es el desplegable del portal traducido al teléfono: ahí es un `CustomSelect`
 * y acá una fila con el valor elegido que abre una hoja con renglones grandes
 * —los que caben bajo un dedo—. Sirve para lo que tiene tres o seis opciones
 * (la propiedad del plan, la periodicidad, el estado); para buscar entre
 * cientos está el buscador de clientes.
 */
export function SelectorOpcion({
  label,
  valor,
  opciones,
  onElegir,
  placeholder = "Elegir",
  titulo,
}: {
  label: string;
  valor: string | null;
  opciones: OpcionElegible[];
  onElegir: (clave: string) => void;
  placeholder?: string;
  /** El título de la hoja. Sin él, el `label`. */
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.clave === valor) ?? null;

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.filaTexto}>
          <Text style={styles.label}>{label}</Text>
          <Text
            variant="bodyLarge"
            style={[styles.valor, !elegida && styles.valorVacio]}
            numberOfLines={1}
          >
            {elegida?.etiqueta ?? placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={tema.texto3} />
      </Pressable>

      <HojaInferior visible={abierto} onCerrar={() => setAbierto(false)}>
        <Text style={styles.titulo}>{titulo ?? label}</Text>
        <ScrollView style={styles.lista}>
          {opciones.map((o) => {
            const activa = o.clave === valor;
            return (
              <Pressable
                key={o.clave}
                onPress={() => {
                  onElegir(o.clave);
                  setAbierto(false);
                }}
                style={({ pressed }) => [
                  styles.opcion,
                  activa && styles.opcionElegida,
                  pressed && !activa && styles.opcionPresionada,
                ]}
              >
                <View style={styles.opcionTexto}>
                  <Text variant="bodyLarge" style={styles.opcionEtiqueta}>
                    {o.etiqueta}
                  </Text>
                  {o.detalle ? (
                    <Text variant="bodySmall" style={styles.opcionDetalle}>
                      {o.detalle}
                    </Text>
                  ) : null}
                </View>
                {activa ? (
                  <View style={styles.tilde}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </HojaInferior>
    </>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 8,
  },
  filaPresionada: { backgroundColor: tema.lienzo },
  filaTexto: { flex: 1, gap: 1 },
  label: { fontSize: 12, color: tema.texto3 },
  valor: { color: tema.texto },
  valorVacio: { color: tema.texto3 },

  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  lista: { paddingHorizontal: 8 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  opcionElegida: { backgroundColor: tema.verde50 },
  opcionPresionada: { backgroundColor: tema.lienzo },
  opcionTexto: { flex: 1, gap: 2 },
  opcionEtiqueta: { color: tema.texto },
  opcionDetalle: { color: tema.texto3 },
  tilde: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
});
