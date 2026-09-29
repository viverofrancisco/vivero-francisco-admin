import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text } from "react-native-paper";
import {
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  gananciaDeVenta,
  type UnidadPeso,
} from "@vivero/shared";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { CampoEnCaja, Casilla, Titulo } from "@/components/ui/Formulario";
import { SelectorOpcion } from "@/components/ui/SelectorOpcion";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { VarianteDeProducto } from "@/lib/types";
import { tema } from "@/lib/tema";
import { dinero } from "./formato";

/** Lo escrito, como número. Vacío o a medio escribir vale `null`. */
function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "" || limpio === ".") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * El precio de una variante: la pantalla *Price* de Shopify. El precio y el
 * costo en sus cajas, debajo del costo las dos tarjetas grises con el
 * **margen** y la **ganancia** calculados en vivo, y *Cobrar IVA* como una
 * casilla. Guarda con la pastilla de arriba, por el `PATCH` gemelo del portal.
 */
export function HojaPrecioDeVariante({
  variante,
  onCerrar,
  onGuardado,
}: {
  variante: VarianteDeProducto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [precio, setPrecio] = useState(String(variante.precio));
  const [costo, setCosto] = useState(variante.costo === null ? "" : String(variante.costo));
  const [cobraIva, setCobraIva] = useState(variante.cobraIva);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nPrecio = numero(precio);
  const nCosto = numero(costo);
  const cuenta = gananciaDeVenta(nPrecio ?? 0, nCosto);
  const pierde = cuenta !== null && cuenta.ganancia < 0;
  const hayCambios =
    (nPrecio ?? variante.precio) !== variante.precio ||
    nCosto !== variante.costo ||
    cobraIva !== variante.cobraIva;

  async function guardar() {
    if (precio.trim() !== "" && (nPrecio === null || nPrecio < 0)) {
      setError("El precio no es un número válido");
      return;
    }
    if (costo.trim() !== "" && (nCosto === null || nCosto < 0)) {
      setError("El costo no es un número válido");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(`/api/mobile/variantes/${variante.id}`, {
        method: "PATCH",
        body: { precio: nPrecio ?? variante.precio, costo: nCosto, cobraIva },
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el precio"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo="Precio"
          subtitulo={variante.nombre}
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              disabled={!hayCambios}
              cargando={guardando}
            />
          }
        />
        <KeyboardAvoidingView style={styles.pantalla} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
            <CampoEnCaja
              label="Precio de lista"
              value={precio}
              onChangeText={setPrecio}
              keyboardType="decimal-pad"
              prefijo="$"
              placeholder="0.00"
            />
            <CampoEnCaja
              label="Costo por unidad"
              value={costo}
              onChangeText={setCosto}
              keyboardType="decimal-pad"
              prefijo="$"
            />
            <Text style={styles.ayuda}>Lo que costó tenerla. No se imprime en ningún lado.</Text>

            {/* Las dos tarjetas de Shopify: el margen y la ganancia, calculados
                con lo que hay escrito. Sin costo dicen "—"; vendiendo por
                debajo del costo salen en ámbar. */}
            <View style={styles.tarjetas}>
              <View style={styles.tarjeta}>
                <Text style={styles.tarjetaTitulo}>Margen</Text>
                <Text style={[styles.tarjetaValor, pierde && styles.ambar]}>
                  {cuenta && cuenta.margen !== null ? `${cuenta.margen}%` : "—"}
                </Text>
              </View>
              <View style={styles.tarjeta}>
                <Text style={styles.tarjetaTitulo}>Ganancia</Text>
                <Text style={[styles.tarjetaValor, pierde && styles.ambar]}>
                  {cuenta ? dinero(cuenta.ganancia) : "—"}
                </Text>
              </View>
            </View>

            <Casilla label="Cobrar IVA" nota="La tasa es la del producto." value={cobraIva} onValueChange={setCobraIva} />

            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * El inventario de una variante, lo que abre *Editar* en Shopify: si se
 * cuenta, si se vende sin stock, el SKU y, porque es un dato de la
 * mercadería, el peso con su unidad. **La cantidad no está acá**: se mueve
 * por el libro, desde el renglón *Disponible*.
 */
export function HojaInventarioDeVariante({
  variante,
  onCerrar,
  onGuardado,
}: {
  variante: VarianteDeProducto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [manejaInventario, setManejaInventario] = useState(variante.manejaInventario);
  const [permiteNegativo, setPermiteNegativo] = useState(variante.permiteNegativo);
  const [sku, setSku] = useState(variante.sku ?? "");
  const [peso, setPeso] = useState(variante.peso === null ? "" : String(variante.peso));
  const [pesoUnidad, setPesoUnidad] = useState<UnidadPeso>(variante.pesoUnidad);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nPeso = numero(peso);
  const hayCambios =
    manejaInventario !== variante.manejaInventario ||
    permiteNegativo !== variante.permiteNegativo ||
    (sku.trim() || null) !== variante.sku ||
    nPeso !== variante.peso ||
    pesoUnidad !== variante.pesoUnidad;

  async function guardar() {
    if (peso.trim() !== "" && (nPeso === null || nPeso < 0)) {
      setError("El peso no es un número válido");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(`/api/mobile/variantes/${variante.id}`, {
        method: "PATCH",
        body: {
          manejaInventario,
          permiteNegativo,
          sku: sku.trim() || null,
          peso: nPeso,
          pesoUnidad,
        },
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el inventario"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo="Inventario"
          subtitulo={variante.nombre}
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              disabled={!hayCambios}
              cargando={guardando}
            />
          }
        />
        <KeyboardAvoidingView style={styles.pantalla} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
            <Casilla
              label="Se cuenta"
              nota="Apagado, se puede vender siempre. Con stock cargado, primero llévalo a cero."
              value={manejaInventario}
              onValueChange={setManejaInventario}
            />
            {manejaInventario ? (
              <Casilla
                label="Vender sin stock"
                nota="Contra pedido: deja que la cantidad quede en negativo."
                value={permiteNegativo}
                onValueChange={setPermiteNegativo}
              />
            ) : null}
            <Titulo>SKU</Titulo>
            <CampoEnCaja label="SKU" value={sku} onChangeText={setSku} autoCapitalize="none" />
            <Text style={styles.ayuda}>Sale impreso en la factura y es lo que va en la etiqueta.</Text>
            <Titulo>Peso</Titulo>
            <CampoEnCaja label="Peso" value={peso} onChangeText={setPeso} keyboardType="decimal-pad" />
            <SelectorOpcion
              label="Unidad"
              valor={pesoUnidad}
              onElegir={(c) => setPesoUnidad(c as UnidadPeso)}
              opciones={UNIDADES_DE_PESO.map((u) => ({ clave: u, etiqueta: UNIDAD_PESO_LABEL[u] }))}
            />
            <Text style={styles.ayuda}>Lo que pesa una unidad, como lo dice la bolsa o la etiqueta.</Text>
            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cuerpo: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  ayuda: { color: tema.texto3, fontSize: 13, paddingHorizontal: 4, marginTop: -4, marginBottom: 12 },
  tarjetas: { flexDirection: "row", gap: 12, marginTop: 4, marginBottom: 8 },
  tarjeta: {
    flex: 1,
    backgroundColor: tema.lienzo,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  tarjetaTitulo: { fontSize: 15, fontWeight: "600", color: tema.texto2 },
  tarjetaValor: { fontSize: 18, fontWeight: "700", color: tema.texto },
  ambar: { color: tema.ambarTexto },
});
