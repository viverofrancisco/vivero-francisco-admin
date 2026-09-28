import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import {
  ESTADO_PRODUCTO_LABEL,
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  gananciaDeVenta,
  type EstadoProducto,
  type TipoProducto,
  type UnidadPeso,
} from "@vivero/shared";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Campo, Interruptor, Titulo } from "@/components/ui/Formulario";
import { SelectorOpcion } from "@/components/ui/SelectorOpcion";
import { tema } from "@/lib/tema";

/** Lo de la variante única de un bien: lo que la card del portal edita. */
export interface ValoresDeVariante {
  precio: number;
  costo: number | null;
  cobraIva: boolean;
  manejaInventario: boolean;
  permiteNegativo: boolean;
  peso: number | null;
  pesoUnidad: UnidadPeso;
  /** Solo al crear: entra al libro como un ingreso. */
  stockInicial: number | null;
}

export interface ValoresDeProducto {
  nombre: string;
  descripcion: string | null;
  tipo: TipoProducto;
  estado: EstadoProducto;
  /** El SKU de la variante única. Con opciones no aplica. */
  codigo: string | null;
  /** Solo un bien sin opciones. */
  variante: ValoresDeVariante | null;
}

/**
 * Lo que viaja al `PATCH` de la variante: todo menos el stock inicial, que
 * no es un dato de la variante sino un movimiento del libro.
 */
export function datosDeVariante(v: ValoresDeVariante) {
  return {
    precio: v.precio,
    costo: v.costo,
    cobraIva: v.cobraIva,
    manejaInventario: v.manejaInventario,
    permiteNegativo: v.permiteNegativo,
    peso: v.peso,
    pesoUnidad: v.pesoUnidad,
  };
}

export interface ServicioFormProps {
  initial?: Partial<ValoresDeProducto>;
  /** "Nuevo producto", "Editar producto": va en el medio del encabezado. */
  titulo: string;
  /** "Crear", "Guardar": la acción, a la derecha del encabezado. */
  accion: string;
  /** Al editar, el tipo no se cambia y el stock no se carga acá. */
  modo: "crear" | "editar";
  /** Un bien con opciones: el precio, el costo y el stock son de cada variante. */
  conOpciones?: boolean;
  onSubmit: (values: ValoresDeProducto) => Promise<void>;
  onCancelar?: () => void;
}

/**
 * El formulario del producto: la pantalla de alta del portal, en el teléfono.
 *
 * *Cancelar* · título · *Crear* arriba (`EncabezadoDeFormulario`), como
 * Nuevo cliente y Nueva orden: es lo único que no se va scrolleando, y el
 * botón al pie que había quedaba debajo del teclado. Pedía nombre,
 * descripción y tipo, y el resto —SKU, precio, costo, IVA, stock, peso,
 * estado— solo se podía cargar desde el portal.
 *
 * El **tipo** se elige al crear y no se cambia después: cambiarlo dejaría
 * órdenes con una semántica que ya no corresponde, y el servidor lo rechaza.
 * Al editar se muestra como dato. Y de un bien **sin opciones** se editan
 * acá los datos de su variante única, que a los ojos de quien mira son los
 * del producto; con opciones, cada combinación lleva los suyos.
 */
export function ServicioForm({
  initial,
  titulo,
  accion,
  modo,
  conOpciones = false,
  onSubmit,
  onCancelar,
}: ServicioFormProps) {
  const router = useRouter();
  const v = initial?.variante;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [tipo, setTipo] = useState<TipoProducto>(initial?.tipo ?? "SERVICIO");
  const [estado, setEstado] = useState<EstadoProducto>(initial?.estado ?? "ACTIVO");
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const [precio, setPrecio] = useState(v ? String(v.precio) : "");
  const [costo, setCosto] = useState(v?.costo != null ? String(v.costo) : "");
  const [cobraIva, setCobraIva] = useState(v?.cobraIva ?? true);
  const [manejaInventario, setManejaInventario] = useState(v?.manejaInventario ?? true);
  const [permiteNegativo, setPermiteNegativo] = useState(v?.permiteNegativo ?? false);
  const [stock, setStock] = useState("");
  const [peso, setPeso] = useState(v?.peso != null ? String(v.peso) : "");
  const [pesoUnidad, setPesoUnidad] = useState<UnidadPeso>(v?.pesoUnidad ?? "KG");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esBien = tipo === "BIEN";
  const editaVariante = esBien && !conOpciones;
  const cuenta = editaVariante
    ? gananciaDeVenta(numero(precio) ?? 0, numero(costo))
    : null;

  async function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    let variante: ValoresDeVariante | null = null;
    if (editaVariante) {
      const nPrecio = numero(precio);
      if (precio.trim() !== "" && (nPrecio === null || nPrecio < 0)) {
        setError("El precio no es un número válido");
        return;
      }
      const nCosto = numero(costo);
      if (costo.trim() !== "" && (nCosto === null || nCosto < 0)) {
        setError("El costo no es un número válido");
        return;
      }
      const nPeso = numero(peso);
      if (peso.trim() !== "" && (nPeso === null || nPeso < 0)) {
        setError("El peso no es un número válido");
        return;
      }
      const nStock = numero(stock);
      if (stock.trim() !== "" && (nStock === null || !Number.isInteger(nStock) || nStock < 0)) {
        setError("El stock inicial tiene que ser un entero");
        return;
      }
      variante = {
        precio: nPrecio ?? 0,
        costo: nCosto,
        cobraIva,
        manejaInventario,
        permiteNegativo,
        peso: nPeso,
        pesoUnidad,
        stockInicial: modo === "crear" && manejaInventario ? nStock : null,
      };
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        tipo,
        estado,
        codigo: conOpciones ? null : codigo.trim() || null,
        variante,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={titulo}
        accion={accion}
        onAccion={submit}
        onCancelar={onCancelar ?? (() => router.back())}
        cargando={submitting}
        deshabilitado={!nombre.trim()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}

          <Titulo>Producto</Titulo>
          <Campo label="Nombre" required value={nombre} onChangeText={setNombre} autoFocus={modo === "crear"} />
          <Campo
            label="Descripción"
            value={descripcion ?? ""}
            onChangeText={setDescripcion}
            multiline
          />

          <Titulo>Tipo</Titulo>
          {modo === "crear" ? (
            <View style={styles.tipoList}>
              <TipoOption
                label="Servicio"
                description="Un trabajo o mano de obra. No maneja inventario."
                selected={tipo === "SERVICIO"}
                onPress={() => setTipo("SERVICIO")}
              />
              <TipoOption
                label="Bien"
                description="Un producto físico. Maneja inventario."
                selected={tipo === "BIEN"}
                onPress={() => setTipo("BIEN")}
              />
            </View>
          ) : (
            /* Inmutable: se muestra como en la ficha del portal, con el porqué. */
            <View style={styles.dato}>
              <Text variant="bodyLarge" style={styles.datoValor}>
                {esBien ? "Bien" : "Servicio"}
              </Text>
              <Text variant="bodySmall" style={styles.nota}>
                No se puede cambiar después de crear el producto.
              </Text>
            </View>
          )}

          <Titulo>Estado</Titulo>
          <SelectorOpcion
            label="Estado"
            valor={estado}
            onElegir={(c) => setEstado(c as EstadoProducto)}
            opciones={[
              { clave: "ACTIVO", etiqueta: ESTADO_PRODUCTO_LABEL.ACTIVO },
              {
                clave: "BORRADOR",
                etiqueta: ESTADO_PRODUCTO_LABEL.BORRADOR,
                detalle: "No aparece al armar una orden",
              },
            ]}
          />

          {/* Con una sola variante el SKU es, a los ojos de quien mira, del
              producto. Con opciones cada combinación tiene el suyo. */}
          {!conOpciones ? (
            <>
              <Titulo>SKU</Titulo>
              <Campo
                label="SKU"
                value={codigo}
                onChangeText={setCodigo}
                autoCapitalize="none"
              />
              <Text variant="bodySmall" style={styles.ayuda}>
                Sale impreso en la factura y es lo que va en la etiqueta.
              </Text>
            </>
          ) : null}

          {/* La card *Precio e inventario* del portal, con los mismos campos.
              El costo al lado del precio y, con los dos, la ganancia y el
              margen. */}
          {editaVariante ? (
            <>
              <Titulo>Precio e inventario</Titulo>
              <Campo
                label="Precio de lista"
                value={precio}
                onChangeText={setPrecio}
                keyboardType="decimal-pad"
                prefijo="$"
                placeholder="0.00"
              />
              <Text variant="bodySmall" style={styles.ayuda}>
                Se propone al armar una orden y se puede cambiar ahí. En cero,
                se ofrece gratis.
              </Text>
              <Campo
                label="Costo por unidad"
                value={costo}
                onChangeText={setCosto}
                keyboardType="decimal-pad"
                prefijo="$"
              />
              <Text variant="bodySmall" style={styles.ayuda}>
                Lo que costó tenerla. No se imprime en ningún lado.
                {cuenta
                  ? ` Ganancia ${cuenta.ganancia > 0 ? "+" : ""}${dinero(cuenta.ganancia)}` +
                    (cuenta.margen === null
                      ? ""
                      : ` · Margen ${cuenta.margen > 0 ? "+" : ""}${cuenta.margen}%`)
                  : ""}
              </Text>

              <Interruptor
                label="Cobrar IVA"
                nota="La tasa es la del producto."
                value={cobraIva}
                onValueChange={setCobraIva}
              />
              <Interruptor
                label="Se cuenta"
                nota="Apagado, se puede vender siempre."
                value={manejaInventario}
                onValueChange={setManejaInventario}
              />
              {manejaInventario && modo === "crear" ? (
                <>
                  <Campo
                    label="Stock inicial"
                    value={stock}
                    onChangeText={setStock}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <Text variant="bodySmall" style={styles.ayuda}>
                    Queda anotado como un ingreso en el libro.
                  </Text>
                </>
              ) : null}
              {manejaInventario ? (
                <Interruptor
                  label="Vender sin stock"
                  nota="Contra pedido: deja que la cantidad quede en negativo."
                  value={permiteNegativo}
                  onValueChange={setPermiteNegativo}
                />
              ) : null}

              <Titulo>Peso</Titulo>
              <Campo
                label="Peso"
                value={peso}
                onChangeText={setPeso}
                keyboardType="decimal-pad"
              />
              <SelectorOpcion
                label="Unidad"
                valor={pesoUnidad}
                onElegir={(c) => setPesoUnidad(c as UnidadPeso)}
                opciones={UNIDADES_DE_PESO.map((u) => ({
                  clave: u,
                  etiqueta: UNIDAD_PESO_LABEL[u],
                }))}
              />
              <Text variant="bodySmall" style={styles.ayuda}>
                Lo que pesa una unidad, como lo dice la bolsa o la etiqueta.
              </Text>
            </>
          ) : null}

          {esBien && conOpciones ? (
            <Text variant="bodySmall" style={[styles.ayuda, styles.notaOpciones]}>
              Este producto tiene opciones: el precio, el costo, el stock y el
              peso son de cada variante.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Lo escrito, como número. Vacío o a medio escribir vale `null`. */
function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "" || limpio === ".") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function dinero(n: number): string {
  const signo = n < 0 ? "-" : "";
  return `${signo}$${Math.abs(n).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TipoOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tipoRow,
        selected && styles.tipoRowSelected,
        pressed && !selected && styles.tipoRowPressed,
      ]}
    >
      <View style={styles.tipoText}>
        <Text variant="bodyLarge" style={styles.tipoTitle}>
          {label}
        </Text>
        <Text variant="bodySmall" style={styles.tipoDesc}>
          {description}
        </Text>
      </View>
      {selected ? (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkIcon}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  error: { textAlign: "center", marginTop: 8 },
  ayuda: { color: tema.texto3, paddingHorizontal: 4, marginTop: -2, marginBottom: 10 },
  notaOpciones: { marginTop: 18 },

  dato: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    gap: 2,
  },
  datoValor: { color: "#111", fontWeight: "500" },
  nota: { color: "#888" },

  tipoList: { gap: 6 },
  tipoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  tipoRowSelected: { backgroundColor: "#e8f5e9" },
  tipoRowPressed: { backgroundColor: "#eaeaea" },
  tipoText: { flex: 1, gap: 2 },
  tipoTitle: { color: "#111", fontWeight: "500" },
  tipoDesc: { color: "#888" },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  checkmarkIcon: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
