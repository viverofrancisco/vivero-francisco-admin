import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  ACCIONES_DE_VARIANTES_EN_LOTE,
  TITULO_DE_CAMPO_EN_LOTE,
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  cambiosDelLote,
  editableEnLote,
  resumenDelLote,
  valorInicialEnLote,
  type AccionDeVariantesEnLote,
  type CampoDeVarianteEnLote,
  type UnidadPeso,
} from "@vivero/shared";
import { CabeceraDeHoja, PastillaDeHoja } from "@vivero/app-ui/components/ui/CabeceraDeHoja";
import { HojaInferior } from "@vivero/app-ui/components/ui/HojaInferior";
import { SelectorOpcion } from "@vivero/app-ui/components/ui/SelectorOpcion";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import type { VarianteDeProducto } from "@vivero/app-ui/lib/types";
import { tema } from "@vivero/app-ui/lib/tema";

interface RespuestaDelLote {
  editadas: number;
  errores: { id: string; nombre: string | null; motivo: string }[];
}

/** Manda el lote y avisa: en silencio si salió todo, nombrando lo que no. */
async function mandarLote(
  productoId: string,
  cambios: Record<string, unknown>[]
): Promise<boolean> {
  try {
    const r = await apiRequest<RespuestaDelLote>(`/api/mobile/servicios/${productoId}/variantes`, {
      method: "PATCH",
      body: { cambios },
    });
    const { titulo, detalle } = resumenDelLote(r);
    if (detalle) Alert.alert(titulo, detalle);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return r.editadas > 0;
  } catch (e) {
    Alert.alert("No se pudo guardar", mensajeDeError(e, "Intenta de nuevo en un momento."));
    return false;
  }
}

/**
 * El drawer de *Editar* de la barra de selección: las mismas acciones que el
 * portal (`ACCIONES_DE_VARIANTES_EN_LOTE`). Un campo abre su pantalla; un
 * interruptor —*Cobrar IVA*, *Llevar inventario*, *Vender sin stock*— se
 * aplica a todas las elegidas en el acto.
 */
export function AccionesDeVariantesEnLote({
  visible,
  productoId,
  ids,
  onCerrar,
  onCampo,
  onAplicado,
}: {
  visible: boolean;
  productoId: string;
  ids: string[];
  onCerrar: () => void;
  onCampo: (campo: CampoDeVarianteEnLote) => void;
  onAplicado: () => void;
}) {
  const [aplicando, setAplicando] = useState(false);

  async function elegir(a: AccionDeVariantesEnLote) {
    if (a.tipo === "campo") {
      onCerrar();
      // Una hoja que se abre mientras otra baja se pierde en iOS: un respiro.
      setTimeout(() => onCampo(a.campo), 300);
      return;
    }
    setAplicando(true);
    const ok = await mandarLote(
      productoId,
      ids.map((id) => ({ id, [a.campo]: a.valor }))
    );
    setAplicando(false);
    onCerrar();
    if (ok) onAplicado();
  }

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <Text style={styles.hojaTitulo}>
        {ids.length === 1 ? "1 variante" : `${ids.length} variantes`}
      </Text>
      <ScrollView style={styles.hojaLista}>
        {ACCIONES_DE_VARIANTES_EN_LOTE.map((a, i) => (
          <View key={a.etiqueta}>
            {a.tipo === "interruptor" && ACCIONES_DE_VARIANTES_EN_LOTE[i - 1]?.tipo === "campo" ? (
              <View style={styles.separador} />
            ) : null}
            <Pressable
              onPress={() => elegir(a)}
              disabled={aplicando}
              style={({ pressed }) => [styles.accion, pressed && styles.tocado]}
            >
              <Text style={[styles.accionTexto, aplicando && styles.apagado]}>{a.etiqueta}</Text>
              {a.tipo === "campo" ? (
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              ) : null}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </HojaInferior>
  );
}

/**
 * *Editar en lote* un campo, como el *Bulk edit* de Shopify: cada variante
 * elegida con su caja y arriba **Aplicar a todas**. *Guardar* manda solo lo
 * que cambió, en un solo pedido, y si alguna no se pudo (un SKU repetido) lo
 * dice por su nombre; las demás quedan guardadas. El stock es un conteo:
 * cuántas hay en el estante.
 */
export function EditarVariantesEnLote({
  campo,
  productoId,
  variantes,
  onCerrar,
  onGuardado,
}: {
  campo: CampoDeVarianteEnLote;
  productoId: string;
  variantes: VarianteDeProducto[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(variantes.map((v) => [v.id, valorInicialEnLote(v, campo)]))
  );
  const [todas, setTodas] = useState("");
  const [unidad, setUnidad] = useState<UnidadPeso>(variantes[0]?.pesoUnidad ?? "KG");
  const [guardando, setGuardando] = useState(false);

  const cambios = cambiosDelLote(campo, variantes, textos, campo === "peso" ? unidad : undefined);
  const teclado = campo === "sku" ? "default" : campo === "stock" ? "number-pad" : "decimal-pad";
  const prefijo = campo === "precio" || campo === "costo" ? "$" : null;

  async function guardar() {
    if (cambios.length === 0) return onCerrar();
    setGuardando(true);
    const ok = await mandarLote(productoId, cambios);
    setGuardando(false);
    if (ok) {
      onGuardado();
      onCerrar();
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo={TITULO_DE_CAMPO_EN_LOTE[campo]}
          subtitulo={variantes.length === 1 ? "1 variante" : `${variantes.length} variantes`}
          cerrando="cancelar"
          onCerrar={onCerrar}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              cargando={guardando}
              disabled={cambios.length === 0}
            />
          }
        />
        <KeyboardAvoidingView style={styles.pantalla} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
            {/* Lo mismo para todas: se escribe una vez y se reparte en las
                cajas, que siguen editables una por una. */}
            <View style={styles.todas}>
              <Text style={styles.todasRotulo}>Aplicar a todas</Text>
              <View style={styles.todasFila}>
                <Caja valor={todas} onCambio={setTodas} teclado={teclado} prefijo={prefijo} ancha />
                <Pressable
                  onPress={() =>
                    setTextos((t) =>
                      Object.fromEntries(
                        variantes.map((v) => [v.id, editableEnLote(v, campo) ? todas : (t[v.id] ?? "")])
                      )
                    )
                  }
                  disabled={todas.trim() === ""}
                  style={({ pressed }) => [styles.aplicar, (pressed || todas.trim() === "") && styles.tocado]}
                >
                  <Text style={styles.aplicarTexto}>Aplicar</Text>
                </Pressable>
              </View>
              {campo === "peso" ? (
                <SelectorOpcion
                  label="Unidad"
                  valor={unidad}
                  onElegir={(c) => setUnidad(c as UnidadPeso)}
                  opciones={UNIDADES_DE_PESO.map((u) => ({ clave: u, etiqueta: UNIDAD_PESO_LABEL[u] }))}
                />
              ) : null}
            </View>

            <View style={styles.lista}>
              {variantes.map((v, i) => (
                <View key={v.id} style={[styles.fila, i > 0 && styles.filaDivisor]}>
                  <Text style={styles.nombre} numberOfLines={2}>
                    {v.nombre}
                  </Text>
                  {editableEnLote(v, campo) ? (
                    <Caja
                      valor={textos[v.id] ?? ""}
                      onCambio={(t) => setTextos((x) => ({ ...x, [v.id]: t }))}
                      teclado={teclado}
                      prefijo={prefijo}
                      sufijo={campo === "peso" ? UNIDAD_PESO_LABEL[unidad] : null}
                    />
                  ) : (
                    <Text style={styles.noCuenta}>No lleva inventario</Text>
                  )}
                </View>
              ))}
            </View>
            {campo === "stock" ? (
              <Text style={styles.ayuda}>
                Escribe cuántas hay en el estante: el inventario anota la diferencia como un conteo.
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Caja({
  valor,
  onCambio,
  teclado,
  prefijo,
  sufijo,
  ancha = false,
}: {
  valor: string;
  onCambio: (t: string) => void;
  teclado: "default" | "decimal-pad" | "number-pad";
  prefijo: string | null;
  sufijo?: string | null;
  ancha?: boolean;
}) {
  return (
    <View style={[styles.caja, ancha && styles.cajaAncha]}>
      {prefijo ? <Text style={styles.afijo}>{prefijo}</Text> : null}
      <TextInput
        value={valor}
        onChangeText={onCambio}
        keyboardType={teclado}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.cajaTexto, teclado !== "default" && styles.cajaNumero]}
        placeholderTextColor={tema.texto3}
      />
      {sufijo ? <Text style={styles.afijo}>{sufijo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cuerpo: { padding: 16, gap: 14, paddingBottom: 40 },
  todas: { backgroundColor: tema.lienzo, borderRadius: 12, padding: 12, gap: 8 },
  todasRotulo: { color: tema.texto2, fontSize: 13, fontWeight: "600" },
  todasFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  aplicar: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
  },
  aplicarTexto: { color: tema.verde, fontWeight: "600", fontSize: 14 },
  lista: { borderWidth: StyleSheet.hairlineWidth, borderColor: tema.linea, borderRadius: 12, paddingHorizontal: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  filaDivisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  nombre: { flex: 1, color: tema.texto, fontSize: 15 },
  noCuenta: { color: tema.texto3, fontSize: 13 },
  caja: {
    width: 130,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  cajaAncha: { flex: 1, width: undefined },
  cajaTexto: { flex: 1, fontSize: 16, color: tema.texto, padding: 0 },
  cajaNumero: { textAlign: "right", fontVariant: ["tabular-nums"] },
  afijo: { color: tema.texto3, fontSize: 15 },
  ayuda: { color: tema.texto3, fontSize: 13 },
  hojaTitulo: { color: tema.texto3, fontSize: 13, paddingHorizontal: 20, paddingBottom: 6 },
  hojaLista: { flexGrow: 0 },
  accion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  accionTexto: { color: tema.texto, fontSize: 17 },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: tema.linea, marginHorizontal: 20, marginVertical: 4 },
  tocado: { opacity: 0.55 },
  apagado: { color: tema.texto3 },
});
