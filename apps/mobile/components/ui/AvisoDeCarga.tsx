import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { SIN_ACCESO_A, type TipoDeReferencia } from "@vivero/shared";
import { esApiError } from "@/lib/api";
import { tema } from "@/lib/tema";

/**
 * Una ficha que no se pudo cargar, diciendo **por qué**: sin acceso (403),
 * ya no existe (404), o no llegó (red, servidor caído). Antes las tres
 * decían "No pudimos cargar", y un jardinero que tocaba en el chat la
 * tarjeta de una visita ajena leía lo mismo que si se le hubiera cortado la
 * señal. Las palabras del sin acceso son las de `SIN_ACCESO_A`, las mismas
 * del portal.
 */
const NOMBRE: Record<TipoDeReferencia, { este: string; que: string; lo: string }> = {
  visita: { este: "esta", que: "visita", lo: "la" },
  cliente: { este: "este", que: "cliente", lo: "lo" },
  producto: { este: "este", que: "producto", lo: "lo" },
};

export function AvisoDeCarga({
  error,
  tipo,
  onVolver,
  onReintentar,
}: {
  /** Lo que tiró la carga, tal cual. */
  error: unknown;
  tipo: TipoDeReferencia;
  onVolver: () => void;
  onReintentar?: () => void;
}) {
  const estado = esApiError(error) ? error.status : null;
  const { este, que, lo } = NOMBRE[tipo];

  let icono: keyof typeof Ionicons.glyphMap;
  let titulo: string;
  let detalle: string;
  if (estado === 403) {
    icono = "lock-closed-outline";
    ({ titulo, detalle } = SIN_ACCESO_A[tipo]);
  } else if (estado === 404) {
    icono = "help-circle-outline";
    titulo = `No encontramos ${este} ${que}`;
    detalle = `Puede que ${lo} hayan borrado.`;
  } else {
    icono = "cloud-offline-outline";
    titulo = `No pudimos cargar ${este} ${que}`;
    detalle = esApiError(error) ? error.message : "Revisa la conexión y prueba de nuevo.";
  }
  // Reintentar solo cuando reintentar puede cambiar algo.
  const reintentable = estado !== 403 && estado !== 404 && Boolean(onReintentar);

  return (
    <View style={styles.centro}>
      <Ionicons name={icono} size={32} color={tema.texto3} style={styles.icono} />
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.detalle}>{detalle}</Text>
      <View style={styles.botones}>
        <Button mode="outlined" onPress={onVolver}>
          Volver
        </Button>
        {reintentable ? (
          <Button mode="contained" onPress={onReintentar}>
            Reintentar
          </Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 6,
  },
  icono: { marginBottom: 6 },
  titulo: { fontSize: 16, fontWeight: "600", color: tema.texto, textAlign: "center" },
  detalle: { fontSize: 14, color: tema.texto2, textAlign: "center", maxWidth: 320 },
  botones: { flexDirection: "row", gap: 10, marginTop: 16 },
});
