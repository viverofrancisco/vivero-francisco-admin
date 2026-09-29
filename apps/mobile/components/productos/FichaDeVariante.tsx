import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { gananciaDeVenta } from "@vivero/shared";
import { CabeceraDeHoja } from "@/components/ui/CabeceraDeHoja";
import { Fila, Seccion, estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaAjustarStock } from "./HojaAjustarStock";
import { HojaInventarioDeVariante, HojaPrecioDeVariante } from "./HojasDeVariante";
import { SelectorDeFotoDeVariante } from "./SelectorDeFotoDeVariante";
import { VisorDeFotosDeProducto } from "./VisorDeFotosDeProducto";
import { AccionDeHoja, TituloDeHoja } from "./AccionDeHoja";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { dinero, pesoTexto, precioTexto } from "./formato";
import type { ServicioDetail, VarianteDeProducto } from "@/lib/types";
import { apiRequest } from "@/lib/api";
import { tema } from "@/lib/tema";

/**
 * Lo que se vende, como lo muestra Shopify en la variante: el precio como un
 * renglón que abre su pantalla, y el inventario como una sección con *Editar*
 * y la cantidad en una pastilla que abre *Ajustar stock*.
 *
 * Es el cuerpo de la ficha de la variante **y** de la ficha de un bien sin
 * opciones: ahí la variante única se lee como el producto, igual que en el
 * portal, así que las secciones son las mismas y se escriben una vez.
 */
export function CuerpoDeVariante({
  variante,
  canEdit,
  onRecargar,
}: {
  variante: VarianteDeProducto;
  canEdit: boolean;
  /** Se guardó algo: quien tiene la ficha vuelve a pedirla. */
  onRecargar: () => void;
}) {
  const [hoja, setHoja] = useState<"precio" | "inventario" | "stock" | null>(null);
  const cuenta = gananciaDeVenta(variante.precio, variante.costo);
  const abrir = (h: "precio" | "inventario" | "stock") => (canEdit ? () => setHoja(h) : undefined);

  return (
    <>
      <Seccion titulo="Precio">
        <Fila label="Precio de lista" value={precioTexto(variante.precio)} onPress={abrir("precio")} />
        <Fila
          label="Costo por unidad"
          value={variante.costo === null ? "—" : dinero(variante.costo)}
          onPress={abrir("precio")}
        />
        {/* Las dos pastillas de Shopify, como dos filas: sin costo no hay
            nada que decir, y vendiendo por debajo del costo salen en ámbar. */}
        {cuenta ? (
          <Fila
            label="Ganancia"
            value={
              <Text variant="bodyMedium" style={[estilosDeFicha.rowValue, cuenta.ganancia < 0 && estilosDeFicha.ambar]}>
                {cuenta.ganancia > 0 ? "+" : ""}
                {dinero(cuenta.ganancia)}
              </Text>
            }
          />
        ) : null}
        {cuenta ? (
          <Fila
            label="Margen"
            value={
              <Text variant="bodyMedium" style={[estilosDeFicha.rowValue, cuenta.ganancia < 0 && estilosDeFicha.ambar]}>
                {cuenta.margen === null ? "—" : `${cuenta.margen > 0 ? "+" : ""}${cuenta.margen}%`}
              </Text>
            }
          />
        ) : null}
        <Fila label="Cobrar IVA" value={variante.cobraIva ? "Sí" : "No"} onPress={abrir("precio")} />
      </Seccion>

      <Seccion
        titulo="Inventario"
        accion={canEdit ? { etiqueta: "Editar", onPress: () => setHoja("inventario") } : null}
      >
        {variante.manejaInventario ? (
          <Fila
            label="Disponible"
            value={
              canEdit ? (
                <PressableScale onPress={() => setHoja("stock")} style={styles.pastillaStock} hitSlop={6}>
                  <Text style={[styles.pastillaStockTexto, variante.stock <= 0 && estilosDeFicha.ambar]}>
                    {variante.stock}
                  </Text>
                </PressableScale>
              ) : (
                <Text variant="bodyMedium" style={[estilosDeFicha.rowValue, variante.stock <= 0 && estilosDeFicha.ambar]}>
                  {variante.stock}
                </Text>
              )
            }
          />
        ) : (
          <Fila label="Disponible" value="No se cuenta" />
        )}
        {variante.manejaInventario ? (
          <Fila label="Vender sin stock" value={variante.permiteNegativo ? "Sí" : "No"} />
        ) : null}
        <Fila label="SKU" value={variante.sku || "—"} />
        <Fila label="Peso" value={pesoTexto(variante)} />
      </Seccion>

      {hoja === "precio" ? (
        <HojaPrecioDeVariante
          variante={variante}
          onCerrar={() => setHoja(null)}
          onGuardado={() => {
            setHoja(null);
            onRecargar();
          }}
        />
      ) : null}
      {hoja === "inventario" ? (
        <HojaInventarioDeVariante
          variante={variante}
          onCerrar={() => setHoja(null)}
          onGuardado={() => {
            setHoja(null);
            onRecargar();
          }}
        />
      ) : null}
      {hoja === "stock" ? (
        <HojaAjustarStock
          variante={variante}
          visible
          onCerrar={() => setHoja(null)}
          onHecho={() => {
            setHoja(null);
            onRecargar();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * La ficha de una variante, la de Shopify: la ✕ arriba, la foto con el nombre
 * de la combinación y el del producto, qué valor tiene en cada eje, y debajo
 * el precio y el inventario.
 */
export function FichaDeVariante({
  variante,
  producto,
  canEdit,
  onCerrar,
  onRecargar,
}: {
  variante: VarianteDeProducto;
  /** El producto entero: el nombre para el encabezado y las fotos para elegir la suya. */
  producto: ServicioDetail;
  canEdit: boolean;
  onCerrar: () => void;
  onRecargar: () => void;
}) {
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  /** La hoja *Acciones* de Shopify sobre la foto: ver, cambiar, quitar. */
  const [acciones, setAcciones] = useState(false);
  const [viendo, setViendo] = useState(false);
  const [quitando, setQuitando] = useState(false);
  /** La foto elegida, o la principal del producto; con un + si no hay ninguna, como Shopify. */
  const foto = variante.imagenUrl;
  /** Si la foto es una elegida para esta variante: solo esa se puede quitar. */
  const propia = variante.imagenId !== null;
  const imagenDeProducto = producto.imagenes.find((i) => i.id === variante.imagenId) ?? null;

  /** Una hoja que se abre mientras otra baja se pierde: un respiro. */
  function despuesDeCerrar(abrir: () => void) {
    setAcciones(false);
    setTimeout(abrir, 250);
  }

  async function quitarFoto() {
    setQuitando(true);
    try {
      await apiRequest(`/api/mobile/variantes/${variante.id}`, {
        method: "PATCH",
        body: { imagenId: null },
      });
      onRecargar();
    } catch {
      // La ficha vuelve a mostrar la misma foto: no hay nada más que decir.
    } finally {
      setQuitando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={estilosDeFicha.flex}>
        <CabeceraDeHoja onCerrar={onCerrar} />
        <ScrollView contentContainerStyle={estilosDeFicha.container}>
          <View style={styles.encabezado}>
            {/* Con foto, tocarla abre la hoja *Acciones* de Shopify —ver,
                cambiar, quitar—; sin foto, el + elige una de las del producto. */}
            <PressableScale
              onPress={() => (foto ? setAcciones(true) : setEligiendoFoto(true))}
              disabled={!canEdit && !foto}
              accessibilityLabel={foto ? "Acciones de la foto" : "Elegir la foto de la variante"}
            >
              {foto ? (
                <Image source={{ uri: foto }} style={styles.foto} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[styles.foto, styles.sinFoto]}>
                  <Ionicons name={canEdit ? "add" : "image-outline"} size={26} color={tema.texto2} />
                </View>
              )}
            </PressableScale>
            <View style={styles.encabezadoTexto}>
              <Text style={styles.nombre} numberOfLines={2}>
                {variante.nombre}
              </Text>
              <Text style={styles.producto} numberOfLines={1}>
                {producto.nombre}
              </Text>
            </View>
          </View>

          {/* Qué valor tiene en cada eje: "Color · Rojo". Se cambia en las
              opciones del producto, que regeneran todas las combinaciones. */}
          <Seccion titulo="Opciones">
            {variante.valores.map((v) => (
              <Fila key={v.opcion} label={v.opcion} value={v.valor} />
            ))}
          </Seccion>

          <CuerpoDeVariante variante={variante} canEdit={canEdit} onRecargar={onRecargar} />
        </ScrollView>
      </View>

      <HojaInferior visible={acciones} onCerrar={() => setAcciones(false)}>
        <TituloDeHoja texto="Acciones" />
        <AccionDeHoja
          icono="eye-outline"
          texto="Ver foto"
          onPress={() => despuesDeCerrar(() => setViendo(true))}
        />
        {canEdit ? (
          <AccionDeHoja
            icono="swap-horizontal-outline"
            texto="Cambiar foto"
            onPress={() => despuesDeCerrar(() => setEligiendoFoto(true))}
          />
        ) : null}
        {canEdit && propia ? (
          <AccionDeHoja
            icono="close-outline"
            texto="Quitar foto"
            onPress={() => {
              setAcciones(false);
              if (!quitando) void quitarFoto();
            }}
          />
        ) : null}
      </HojaInferior>

      {viendo && foto ? (
        <VisorDeFotosDeProducto
          productoId={producto.id}
          imagenes={[
            imagenDeProducto ?? { id: "actual", mediaId: "", url: foto },
          ]}
          inicial={0}
          canEdit={false}
          onCerrar={() => setViendo(false)}
          onRecargar={onRecargar}
        />
      ) : null}

      {eligiendoFoto ? (
        <SelectorDeFotoDeVariante
          variante={variante}
          productoId={producto.id}
          imagenes={producto.imagenes}
          onCerrar={() => setEligiendoFoto(false)}
          onGuardado={() => {
            setEligiendoFoto(false);
            onRecargar();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 4 },
  encabezadoTexto: { flex: 1, gap: 4 },
  foto: { width: 88, height: 88, borderRadius: 14, backgroundColor: tema.lienzo },
  sinFoto: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: tema.linea },
  nombre: { fontSize: 24, fontWeight: "700", color: tema.texto },
  producto: { fontSize: 16, color: tema.texto3 },
  pastillaStock: {
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
  },
  pastillaStockTexto: { fontSize: 16, fontWeight: "600", color: tema.texto },
});
