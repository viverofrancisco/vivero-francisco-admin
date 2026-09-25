import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Searchbar, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { nombreCliente } from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import type { ClienteListItem } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Elegir el cliente entre cientos: una fila que abre una hoja con buscador,
 * como el primer paso del wizard de visitas. El inactivo se ve, atenuado y
 * sin poder elegirse: si volvió a contratar, primero se lo reactiva.
 *
 * Lo comparten el alta de una suscripción y el de una orden: son la misma
 * pregunta, y dos copias se habrían separado a la primera corrección.
 */
export function SelectorCliente({
  clientes,
  valor,
  onElegir,
}: {
  clientes: ClienteListItem[];
  valor: string | null;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const elegido = clientes.find((c) => c.id === valor) ?? null;
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? clientes.filter((c) =>
          `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase().includes(q)
        )
      : clientes;
    return lista.slice(0, 30);
  }, [busqueda, clientes]);

  return (
    <>
      <Pressable
        onPress={() => {
          setBusqueda("");
          setAbierto(true);
        }}
        style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
        accessibilityRole="button"
        accessibilityLabel="Cliente"
      >
        <Text
          variant="bodyLarge"
          style={[styles.valor, !elegido && styles.valorVacio]}
          numberOfLines={1}
        >
          {elegido ? nombreCliente(elegido) : "Seleccionar cliente"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={tema.texto3} />
      </Pressable>

      <HojaInferior visible={abierto} onCerrar={() => setAbierto(false)} maxAlto={0.9}>
        <View style={styles.buscadorCaja}>
          <Searchbar
            placeholder="Buscar por nombre o teléfono"
            value={busqueda}
            onChangeText={setBusqueda}
            elevation={0}
            style={styles.buscador}
            inputStyle={styles.buscadorTexto}
            autoFocus
          />
        </View>
        <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
          {filtrados.length === 0 ? (
            <Text style={styles.vacio}>Sin coincidencias.</Text>
          ) : (
            filtrados.map((c) => {
              const activo = c.id === valor;
              const inactivo = c.inactivoDesde !== null;
              return (
                <Pressable
                  key={c.id}
                  disabled={inactivo}
                  onPress={() => {
                    onElegir(c.id);
                    setAbierto(false);
                  }}
                  style={({ pressed }) => [
                    styles.opcion,
                    activo && styles.opcionElegida,
                    inactivo && styles.opcionInactiva,
                    pressed && !activo && styles.filaPresionada,
                  ]}
                >
                  <View style={styles.opcionTexto}>
                    <Text variant="bodyLarge" style={styles.valor}>
                      {nombreCliente(c)}
                    </Text>
                    {inactivo || c.telefono || c.propiedades[0]?.sector?.nombre ? (
                      <Text variant="bodySmall" style={styles.detalle}>
                        {[inactivo ? "Inactivo" : null, c.telefono, c.propiedades[0]?.sector?.nombre]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  {activo ? (
                    <View style={styles.tilde}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
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
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 8,
  },
  filaPresionada: { backgroundColor: tema.lienzo },
  valor: { color: tema.texto, flexShrink: 1 },
  valorVacio: { color: tema.texto3 },
  detalle: { color: tema.texto3 },

  buscadorCaja: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  buscador: { backgroundColor: tema.lienzo, borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },
  lista: { paddingHorizontal: 8 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  opcionElegida: { backgroundColor: tema.verde50 },
  opcionInactiva: { opacity: 0.45 },
  opcionTexto: { flex: 1, gap: 2 },
  tilde: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
});
