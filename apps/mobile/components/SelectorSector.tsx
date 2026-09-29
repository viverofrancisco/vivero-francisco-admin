import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Dialog, Portal, Searchbar, Text } from "react-native-paper";
import { apiRequest } from "@/lib/api";
import type { SectorOption, SectoresListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

/**
 * Elegir el sector de un lugar.
 *
 * El sector es **geográfico**: es de la propiedad, no de la persona. Alguien
 * con una casa en Isla Mocolí y una oficina en Vía a la Costa está en dos, y
 * mientras vivía en el cliente había que elegir uno y el otro quedaba mal
 * contado.
 *
 * Vivía adentro del formulario del cliente. Con las propiedades hay dos
 * pantallas que preguntan lo mismo, y dos copias de un selector son dos
 * selectores que se van pareciendo cada vez menos.
 */
export function SelectorSector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [sectores, setSectores] = useState<SectorOption[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    apiRequest<SectoresListResponse>("/api/mobile/sectores")
      .then((res) => setSectores(res.items))
      .catch(() => {});
  }, []);

  const elegido = sectores.find((s) => s.id === value);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return sectores;
    return sectores.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [busqueda, sectores]);

  function elegir(id: string | null) {
    onChange(id);
    setAbierto(false);
  }

  const teclado = useAltoDelTeclado();
  const { height: alto } = useWindowDimensions();
  return (
    <>
      <Pressable
        onPress={() => {
          setBusqueda("");
          setAbierto(true);
        }}
        style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
      >
        <Text variant="bodyLarge" style={styles.valor}>
          {elegido?.nombre ?? "Sin sector"}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Portal>
        <Dialog
          visible={abierto}
          onDismiss={() => setAbierto(false)}
          // Centrado en lo que el teclado deja libre, y no más alto que eso:
          // el diálogo de Paper no se mueve solo y los sectores quedaban
          // detrás del teclado con el buscador abierto.
          style={[
            styles.dialogo,
            teclado > 0 && {
              transform: [{ translateY: -teclado / 2 }],
              maxHeight: alto - teclado - 48,
            },
          ]}
        >
          <Dialog.Title>Seleccionar sector</Dialog.Title>
          <Dialog.Content style={styles.dialogoContenido}>
            <Searchbar
              placeholder="Buscar sector"
              value={busqueda}
              onChangeText={setBusqueda}
              elevation={0}
              style={styles.buscador}
              inputStyle={styles.buscadorTexto}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.ScrollArea style={styles.dialogoScroll}>
            <ScrollView>
              <Opcion
                nombre="Sin sector"
                seleccionado={value === null}
                onPress={() => elegir(null)}
              />
              {filtrados.length === 0 ? (
                <Text style={styles.vacio}>Sin coincidencias.</Text>
              ) : (
                filtrados.map((s) => (
                  <Opcion
                    key={s.id}
                    nombre={s.nombre}
                    seleccionado={value === s.id}
                    onPress={() => elegir(s.id)}
                  />
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAbierto(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function Opcion({
  nombre,
  seleccionado,
  onPress,
}: {
  nombre: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcion,
        seleccionado && styles.opcionElegida,
        pressed && !seleccionado && styles.opcionPresionada,
      ]}
    >
      <Text variant="bodyLarge" style={styles.opcionTexto}>
        {nombre}
      </Text>
      {seleccionado ? (
        <View style={styles.tilde}>
          <Text style={styles.tildeIcono}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  filaPresionada: { backgroundColor: "#eaeaea" },
  valor: { color: tema.texto },
  chevron: { fontSize: 22, color: tema.texto3 },

  dialogo: { backgroundColor: "#fff", borderRadius: 16 },
  dialogoContenido: { paddingBottom: 8 },
  dialogoScroll: { paddingHorizontal: 0, maxHeight: 360 },
  buscador: { backgroundColor: "#f4f4f4", borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },

  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  opcionElegida: { backgroundColor: tema.verde50 },
  opcionPresionada: { backgroundColor: "#fafafa" },
  opcionTexto: { color: tema.texto },
  tilde: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  tildeIcono: { color: "#fff", fontWeight: "700", fontSize: 12 },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
});
