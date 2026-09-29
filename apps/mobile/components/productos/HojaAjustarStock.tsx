import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { CampoEnCaja } from "@/components/ui/Formulario";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

type Motivo = "AJUSTE" | "CONTEO" | "INGRESO";

/**
 * Los motivos del libro, con las palabras del popover del portal. La
 * corrección es la de siempre, como en Shopify.
 */
const MOTIVOS: { clave: Motivo; etiqueta: string }[] = [
  { clave: "AJUSTE", etiqueta: "Corrección (predeterminado)" },
  { clave: "CONTEO", etiqueta: "Conteo" },
  { clave: "INGRESO", etiqueta: "Entró mercadería" },
];

/**
 * Mover el stock de una variante, la pantalla de Shopify: el número grande
 * con − y +, que es **en cuánto va a quedar**; debajo, el motivo en un renglón
 * que abre la lista; y una tarjeta con el antes y el después. *Cancelar* y
 * *Guardar* arriba.
 *
 * Toda edición de stock **es un movimiento del libro**, así que lo que se
 * guarda no es el número sino qué pasó: con *Conteo* viaja cuánto hay y el
 * servidor calcula la diferencia; con *Corrección* y *Entró mercadería*
 * viaja la diferencia, que acá se calcula del número que se dejó. Entró
 * mercadería solo suma: para restar está la corrección.
 */
export function HojaAjustarStock({
  variante,
  visible,
  onCerrar,
  onHecho,
}: {
  variante: { id: string; nombre?: string; stock: number; permiteNegativo: boolean };
  visible: boolean;
  onCerrar: () => void;
  /** Se guardó: la ficha vuelve a cargar. */
  onHecho: () => void;
}) {
  const [texto, setTexto] = useState(String(variante.stock));
  const [motivo, setMotivo] = useState<Motivo>("AJUSTE");
  const [nota, setNota] = useState("");
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nuevo = texto.trim() === "" || texto.trim() === "-" ? null : Number(texto.replace("−", "-"));
  const valido = nuevo !== null && Number.isInteger(nuevo);
  const diferencia = valido ? nuevo - variante.stock : 0;
  const hayCambios = valido && diferencia !== 0;

  /** Qué impide guardar, si algo lo impide. */
  const impedimento = !valido
    ? "Escribe un número entero."
    : nuevo < 0 && !variante.permiteNegativo
      ? "Esta variante no se vende sin stock: no puede quedar en negativo."
      : motivo === "INGRESO" && diferencia < 0
        ? "Entró mercadería solo suma. Para restar, elige Corrección."
        : null;

  function mover(paso: number) {
    const base = valido ? nuevo : variante.stock;
    setTexto(String(base + paso));
  }

  async function guardar() {
    if (!hayCambios || impedimento || nuevo === null) return;
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(`/api/mobile/variantes/${variante.id}/movimientos`, {
        method: "POST",
        body:
          motivo === "CONTEO"
            ? { motivo, contado: nuevo, nota: nota.trim() || null }
            : { motivo, cantidad: diferencia, nota: nota.trim() || null },
      });
      onHecho();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el movimiento"));
    } finally {
      setGuardando(false);
    }
  }

  const etiquetaMotivo = MOTIVOS.find((m) => m.clave === motivo)?.etiqueta ?? "";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo={variante.nombre ?? "Ajustar stock"}
          onCerrar={onCerrar}
          cerrando="cancelar"
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              disabled={!hayCambios || !!impedimento}
              cargando={guardando}
            />
          }
        />
        <KeyboardAvoidingView style={styles.pantalla} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
            <Text style={styles.rotuloDisponible}>Disponible</Text>

            {/* El número que se ve es en cuánto va a quedar: la pregunta
                después de tocar + tres veces es esa, no cuánto se sumó. */}
            <View style={styles.contador}>
              <Pressable
                onPress={() => mover(-1)}
                style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
                accessibilityLabel="Uno menos"
              >
                <Ionicons name="remove" size={22} color={tema.texto} />
              </Pressable>
              <View style={styles.numeroCaja}>
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  keyboardType={variante.permiteNegativo ? "numbers-and-punctuation" : "number-pad"}
                  selectTextOnFocus
                  style={[styles.numero, nuevo !== null && nuevo < 0 && styles.ambar]}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                onPress={() => mover(1)}
                style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
                accessibilityLabel="Uno más"
              >
                <Ionicons name="add" size={22} color={tema.texto} />
              </Pressable>
            </View>

            {/* El motivo, como el *Reason* de Shopify: un renglón que abre la
                lista. Es lo que el libro guarda al lado del número. */}
            <PressableScale
              onPress={() => setEligiendoMotivo(true)}
              estiloExterno={styles.ancho}
              style={styles.filaMotivo}
              accessibilityRole="button"
            >
              <Text style={styles.filaMotivoRotulo}>Motivo</Text>
              <View style={styles.filaMotivoValor}>
                <Text style={styles.filaMotivoTexto} numberOfLines={1}>
                  {etiquetaMotivo}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={tema.texto3} />
              </View>
            </PressableScale>

            {/* El antes y el después, como la tarjeta de Shopify. */}
            <View style={styles.tarjeta}>
              <View style={[styles.tarjetaFila, styles.tarjetaFilaResaltada]}>
                <Text style={styles.tarjetaRotulo}>Disponible</Text>
                <View style={styles.cambio}>
                  <Text style={styles.antes}>{variante.stock}</Text>
                  <Ionicons name="arrow-forward" size={14} color={tema.texto2} />
                  <Text style={[styles.despues, nuevo !== null && nuevo < 0 && styles.ambar]}>
                    {valido ? nuevo : "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.tarjetaFila}>
                <Text style={styles.tarjetaRotuloSuave}>Diferencia</Text>
                <Text style={styles.tarjetaValorSuave}>
                  {valido ? `${diferencia > 0 ? "+" : ""}${diferencia}` : "—"}
                </Text>
              </View>
            </View>

            <CampoEnCaja label="Nota" value={nota} onChangeText={setNota} placeholder="Opcional" />

            {impedimento && hayCambios ? (
              <HelperText type="error" visible style={styles.aviso}>
                {impedimento}
              </HelperText>
            ) : null}
            {error ? (
              <HelperText type="error" visible style={styles.aviso}>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* La lista de motivos, con el tilde en el elegido, como la de Shopify. */}
      <HojaInferior visible={eligiendoMotivo} onCerrar={() => setEligiendoMotivo(false)}>
        <View style={styles.lista}>
          <Text style={styles.listaTitulo}>Motivo del ajuste</Text>
          {MOTIVOS.map((m) => (
            <PressableScale
              key={m.clave}
              onPress={() => {
                setMotivo(m.clave);
                setEligiendoMotivo(false);
              }}
              estiloExterno={styles.ancho}
              style={styles.listaFila}
              accessibilityRole="radio"
              accessibilityState={{ selected: motivo === m.clave }}
            >
              <Text style={styles.listaTexto}>{m.etiqueta}</Text>
              {motivo === m.clave ? (
                <Ionicons name="checkmark" size={20} color={tema.texto} />
              ) : null}
            </PressableScale>
          ))}
        </View>
      </HojaInferior>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  ancho: { alignSelf: "stretch" },
  cuerpo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  rotuloDisponible: { textAlign: "center", fontSize: 13, fontWeight: "600", color: tema.texto2 },

  contador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 18,
  },
  redondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  tocado: { opacity: 0.6 },
  numeroCaja: {
    minWidth: 136,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  numero: {
    fontSize: 30,
    fontWeight: "700",
    color: tema.texto,
    textAlign: "center",
    minWidth: 88,
    fontVariant: ["tabular-nums"],
  },
  ambar: { color: tema.ambarTexto },

  filaMotivo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  filaMotivoRotulo: { fontSize: 15, color: tema.texto },
  filaMotivoValor: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  filaMotivoTexto: { fontSize: 15, color: tema.texto2, flexShrink: 1 },

  tarjeta: {
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  tarjetaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tarjetaFilaResaltada: { backgroundColor: tema.fondo },
  tarjetaRotulo: { fontSize: 15, fontWeight: "600", color: tema.texto },
  tarjetaRotuloSuave: { fontSize: 15, color: tema.texto2 },
  tarjetaValorSuave: { fontSize: 15, color: tema.texto2, fontVariant: ["tabular-nums"] },
  cambio: { flexDirection: "row", alignItems: "center", gap: 8 },
  antes: { fontSize: 15, fontWeight: "600", color: tema.texto, fontVariant: ["tabular-nums"] },
  despues: { fontSize: 15, fontWeight: "700", color: tema.verde700, fontVariant: ["tabular-nums"] },
  aviso: { marginTop: 4 },

  lista: { paddingBottom: 8 },
  listaTitulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  listaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  listaTexto: { fontSize: 16, color: tema.texto },
});
