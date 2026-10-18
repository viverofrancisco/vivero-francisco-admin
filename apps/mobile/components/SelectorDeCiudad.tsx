import { useMemo, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { HelperText, Searchbar, Text, TextInput } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { CIUDADES_FRECUENTES, opcionesDeCiudad } from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { tema } from "@/lib/tema";

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La ciudad de una dirección, **elegida de la lista oficial** —los 221
 * cantones del INEC, `CANTONES_DEL_ECUADOR`— y no escrita: escrita salían
 * "Samborondon", "samborondón" y "La Puntilla" para el mismo lugar, y con eso
 * no se agrupa ni se busca. Se ve como cualquier campo del formulario y abre
 * un cajón con buscador, las de todos los días (Guayaquil, Samborondón…)
 * primero, y la provincia al lado, porque hay nombres repetidos (Bolívar,
 * Olmedo). Una ciudad guardada antes que no está en la lista se sigue
 * mostrando tal cual.
 */
export function SelectorDeCiudad({
  valor,
  onCambio,
  etiqueta = "Ciudad",
  error = false,
  textoDeError,
}: {
  valor: string;
  onCambio: (ciudad: string) => void;
  etiqueta?: string;
  error?: boolean;
  textoDeError?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const opciones = useMemo(() => opcionesDeCiudad(valor), [valor]);
  const q = sinTildes(busqueda.trim());
  const visibles = q
    ? opciones.filter(
        (o) => sinTildes(o.nombre).includes(q) || (o.provincia && sinTildes(o.provincia).includes(q))
      )
    : opciones;
  const cerrar = () => {
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          setAbierto(true);
        }}
      >
        {/* Un campo de Paper sin edición, para que se vea como los demás. */}
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={etiqueta}
            value={valor}
            editable={false}
            error={error}
            right={<TextInput.Icon icon="chevron-down" />}
          />
        </View>
      </Pressable>
      {error && textoDeError ? (
        <HelperText type="error" visible>
          {textoDeError}
        </HelperText>
      ) : null}

      <HojaInferior visible={abierto} onCerrar={cerrar} maxAlto={0.85}>
        <Text style={styles.titulo}>Ciudad</Text>
        <View style={styles.buscadorCaja}>
          <Searchbar
            placeholder="Buscar ciudad o provincia"
            value={busqueda}
            onChangeText={setBusqueda}
            elevation={0}
            style={styles.buscador}
            inputStyle={styles.buscadorTexto}
          />
        </View>
        <FlatList
          data={visibles}
          keyExtractor={(o) => o.codigo ?? `manual-${o.nombre}`}
          keyboardShouldPersistTaps="handled"
          style={styles.lista}
          contentContainerStyle={styles.listaCuerpo}
          initialNumToRender={20}
          renderItem={({ item: o, index }) => {
            const elegida = o.nombre === valor;
            // Una raya entre las frecuentes y el resto, solo sin búsqueda.
            const corte = !q && index === CIUDADES_FRECUENTES.length - 1 + (opciones[0]?.codigo ? 0 : 1);
            return (
              <Pressable
                onPress={() => {
                  onCambio(o.nombre);
                  cerrar();
                }}
                style={({ pressed }) => [
                  styles.fila,
                  corte && styles.corte,
                  pressed && styles.filaTocada,
                ]}
              >
                <View style={styles.filaTexto}>
                  <Text style={[styles.nombre, elegida && styles.nombreElegido]}>{o.nombre}</Text>
                  {o.provincia ? <Text style={styles.provincia}>{o.provincia}</Text> : null}
                </View>
                {elegida ? <Ionicons name="checkmark" size={20} color={tema.verde} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.vacio}>Sin coincidencias.</Text>}
        />
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  buscadorCaja: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  buscador: { backgroundColor: tema.lienzo, borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },
  lista: { flexGrow: 0 },
  listaCuerpo: { paddingBottom: 24 },
  fila: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  corte: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tema.linea },
  filaTocada: { backgroundColor: tema.lienzo },
  filaTexto: { flex: 1, gap: 1 },
  nombre: { color: tema.texto, fontSize: 15 },
  nombreElegido: { color: tema.verde700, fontWeight: "600" },
  provincia: { color: tema.texto3, fontSize: 12 },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
});
