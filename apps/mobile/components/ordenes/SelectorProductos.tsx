import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { PieDeLista } from "@/components/ui/PantallaLista";
import type { ProductoVendible } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const POR_TANDA = 30;

/** Lo que se eligió: la variante, con su producto para el precio y el IVA. */
export interface VarianteElegida {
  producto: ProductoVendible;
  variante: ProductoVendible["variantes"][number];
}

/**
 * Elegir productos para la orden, **varios de una**, como Shopify.
 *
 * Una hoja a pantalla completa con Cancelar y Guardar arriba: se marcan
 * casillas y nada entra a la orden hasta *Guardar*. Un producto con una sola
 * variante se marca directo; con varias, el renglón dice cuántas y el
 * chevron abre su lista de variantes con precio y stock, donde se marcan las
 * que se venden. La casilla del producto queda a medias —el guion— cuando
 * tiene algunas marcadas. Cancelar con cambios pregunta antes de tirarlos.
 *
 * Antes cada toque agregaba una línea y cerraba la hoja: una orden de cinco
 * productos eran cinco viajes al buscador.
 */
export function SelectorProductos({
  visible,
  yaElegidas,
  onCerrar,
  onGuardar,
}: {
  visible: boolean;
  /** Las variantes que ya están en la orden: llegan marcadas. */
  yaElegidas: string[];
  onCerrar: () => void;
  /** La selección entera: lo que hay que agregar y lo que se desmarcó. */
  onGuardar: (elegidas: VarianteElegida[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState<ProductoVendible[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  /** Todo lo que se vio: un producto elegido no se pierde al buscar otro. */
  const [conocidos, setConocidos] = useState<Map<string, ProductoVendible>>(new Map());
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  /** Adentro de un producto con varias variantes. */
  const [abierto, setAbierto] = useState<ProductoVendible | null>(null);

  // Al abrir, arranca con lo que la orden ya tiene.
  useEffect(() => {
    if (!visible) return;
    setMarcadas(new Set(yaElegidas));
    setAbierto(null);
    setBusqueda("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * El catálogo, de a tandas, como las demás listas: la primera al abrir o al
   * cambiar la búsqueda, y las siguientes al llegar al pie. Todo lo que llega
   * se guarda en `conocidos`, así un producto marcado no se pierde al buscar.
   */
  const traer = useCallback(
    async (desde: number, q: string) => {
      if (desde === 0) setCargando(true);
      else setCargandoMas(true);
      try {
        const r = await apiRequest<{ items: ProductoVendible[]; hayMas: boolean }>(
          "/api/mobile/ordenes/catalogo",
          { query: { q: q.trim() || undefined, offset: desde, limit: POR_TANDA } }
        );
        setItems((antes) => (desde ? [...antes, ...r.items] : r.items));
        setHayMas(r.hayMas);
        setConocidos((prev) => {
          const m = new Map(prev);
          for (const p of r.items) m.set(p.id, p);
          return m;
        });
      } catch {
        if (desde === 0) setItems([]);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!visible) return;
    const reloj = setTimeout(() => traer(0, busqueda), 250);
    return () => clearTimeout(reloj);
  }, [visible, busqueda, traer]);

  const hayCambios = useMemo(() => {
    const antes = new Set(yaElegidas);
    if (antes.size !== marcadas.size) return true;
    for (const id of marcadas) if (!antes.has(id)) return true;
    return false;
  }, [yaElegidas, marcadas]);

  const alternar = (ids: string[], marcar: boolean) =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      for (const id of ids) {
        if (marcar) s.add(id);
        else s.delete(id);
      }
      return s;
    });

  /**
   * Cancelar con cambios pregunta en un **popup**, el alerta del sistema, y
   * no en una hoja: es lo que hace Shopify, y una hoja que sube desde abajo
   * encima de otra hoja es una decisión chica con el peso de una pantalla.
   */
  const cerrar = () => {
    if (!hayCambios) return onCerrar();
    // Etiquetas cortas a propósito: con las largas iOS apila los botones en
    // dos pisos; con estas entran lado a lado, como en Shopify.
    Alert.alert("Tienes cambios sin guardar", undefined, [
      { text: "Volver", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: onCerrar },
    ]);
  };

  const guardar = () => {
    const elegidas: VarianteElegida[] = [];
    for (const p of conocidos.values()) {
      for (const v of p.variantes) {
        if (marcadas.has(v.id)) elegidas.push({ producto: p, variante: v });
      }
    }
    onGuardar(elegidas);
  };

  /** Cuántas variantes de un producto están marcadas. */
  const marcadasDe = (p: ProductoVendible) =>
    p.variantes.filter((v) => marcadas.has(v.id)).length;

  const teclado = useAltoDelTeclado();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cerrar}
    >
      <View style={[styles.pantalla, { paddingBottom: teclado }]}>
        {/* Cancelar / Guardar arriba, como el portal y como Shopify: son lo
            único que no se va scrolleando. Adentro de un producto, la flecha
            vuelve a la lista sin perder nada. */}
        {/* Sin el margen del notch: la hoja (`pageSheet`) ya arranca debajo
            de la barra de estado, y sumárselo dejaba una franja vacía. */}
        <View style={styles.cabecera}>
          {abierto ? (
            <PressableScale onPress={() => setAbierto(null)} hitSlop={8} style={styles.volver}>
              <Ionicons name="chevron-back" size={24} color={tema.texto} />
            </PressableScale>
          ) : (
            <PressableScale onPress={cerrar} hitSlop={8} style={styles.boton}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </PressableScale>
          )}
          <Text style={styles.titulo} numberOfLines={1}>
            {abierto ? abierto.nombre : "Productos"}
          </Text>
          {abierto ? (
            <View style={styles.boton} />
          ) : (
            <PressableScale onPress={guardar} disabled={!hayCambios} hitSlop={8} style={styles.boton}>
              <Text style={[styles.guardar, !hayCambios && styles.apagado]}>Guardar</Text>
            </PressableScale>
          )}
        </View>

        {abierto ? (
          <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
            {abierto.variantes.map((v) => {
              const marcada = marcadas.has(v.id);
              return (
                <Pressable
                  key={v.id}
                  onPress={() => alternar([v.id], !marcada)}
                  style={({ pressed }) => [styles.fila, pressed && styles.presionada]}
                >
                  <Casilla estado={marcada ? "si" : "no"} />
                  <View style={styles.texto}>
                    <Text variant="bodyLarge" style={styles.nombre}>
                      {v.nombre || abierto.nombre}
                    </Text>
                    <Text variant="bodySmall" style={styles.detalle}>
                      {v.precio === 0 ? "Sin precio de lista" : plata(v.precio)}
                      {v.manejaInventario ? ` · ${v.stock} disponibles` : ""}
                      {v.sku ? ` · ${v.sku}` : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <>
            <View style={styles.buscadorCaja}>
              <Searchbar
                placeholder="Buscar"
                value={busqueda}
                onChangeText={setBusqueda}
                elevation={0}
                style={styles.buscador}
                inputStyle={styles.buscadorTexto}
              />
            </View>
            {cargando && items.length === 0 ? (
              <ActivityIndicator style={styles.cargando} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(p) => p.id}
                style={styles.lista}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.vacio}>Sin coincidencias.</Text>}
                ListFooterComponent={<PieDeLista cargando={cargandoMas} hayMas={hayMas} />}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (hayMas && !cargandoMas && !cargando) traer(items.length, busqueda);
                }}
                renderItem={({ item: p }) => {
                  const varias = p.variantes.length > 1;
                  const cuantas = marcadasDe(p);
                  const estado =
                    cuantas === 0 ? "no" : cuantas === p.variantes.length ? "si" : "medias";
                  const unica = p.variantes[0];
                  const marcarTodas = () =>
                    varias
                      ? alternar(
                          p.variantes.map((v) => v.id),
                          estado !== "si"
                        )
                      : unica && alternar([unica.id], !marcadas.has(unica.id));
                  return (
                    /* La casilla y el renglón son dos presionables **hermanos**,
                       no uno adentro del otro: anidados, un toque en la casilla
                       le llegaba a los dos y se deshacía a sí mismo. Con varias
                       variantes, la casilla marca o desmarca todas y el renglón
                       entra a elegir; con una, los dos hacen lo mismo. */
                    <View style={styles.fila}>
                      <Pressable onPress={marcarTodas} hitSlop={10}>
                        <Casilla estado={estado} />
                      </Pressable>
                      <Pressable
                        onPress={() => (varias ? setAbierto(p) : marcarTodas())}
                        style={({ pressed }) => [styles.cuerpo, pressed && styles.presionada]}
                      >
                        <View style={styles.texto}>
                          <Text variant="bodyLarge" style={styles.nombre}>
                            {p.nombre}
                          </Text>
                          <Text variant="bodySmall" style={styles.detalle}>
                            {varias
                              ? `${p.variantes.length} variantes${cuantas > 0 ? ` (${cuantas} seleccionada${cuantas === 1 ? "" : "s"})` : ""}`
                              : !unica
                                ? "Sin variante para vender"
                                : unica.precio === 0
                                  ? "Sin precio de lista"
                                  : plata(unica.precio)}
                          </Text>
                        </View>
                        {varias ? (
                          <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </>
        )}

      </View>
    </Modal>
  );
}

/** La casilla: vacía, marcada, o a medias (algunas variantes). */
function Casilla({ estado }: { estado: "no" | "si" | "medias" }) {
  const activa = estado !== "no";
  return (
    <View style={[styles.casilla, activa && styles.casillaActiva]}>
      {estado === "si" ? (
        <Ionicons name="checkmark" size={15} color="#fff" />
      ) : estado === "medias" ? (
        <Ionicons name="remove" size={15} color="#fff" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  boton: { minWidth: 76, paddingHorizontal: 6, paddingVertical: 6 },
  volver: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cancelar: { color: tema.texto2, fontSize: 16, fontWeight: "600" },
  guardar: { color: tema.verde, fontSize: 16, fontWeight: "700", textAlign: "right" },
  apagado: { color: tema.texto3 },
  titulo: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: tema.texto },

  buscadorCaja: { paddingHorizontal: 12, paddingVertical: 8 },
  buscador: { backgroundColor: tema.lienzo, borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },
  lista: { flex: 1, paddingHorizontal: 8 },
  cargando: { padding: 24 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  cuerpo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
    borderRadius: 8,
  },
  presionada: { backgroundColor: tema.lienzo },
  texto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  detalle: { color: tema.texto3 },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaActiva: { backgroundColor: tema.verde, borderColor: tema.verde },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
});
