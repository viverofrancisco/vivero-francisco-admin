import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fechaSola } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { SelectorCliente } from "@/components/clientes/SelectorCliente";
import {
  SelectorProductos,
  type VarianteElegida,
} from "@/components/ordenes/SelectorProductos";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Campo } from "@/components/ui/Formulario";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  tareasHechas,
  type ClienteListItem,
  type ClientesListResponse,
  type PeriodoPendiente,
  type ProductoVendible,
  type VisitaDetail,
} from "@/lib/types";
import { tema } from "@/lib/tema";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Una línea mientras se arma. Los importes van como texto. */
interface Linea {
  uid: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
  /** `null` en la línea de un período de plan y en una personalizada. */
  productoId: string | null;
  varianteId: string | null;
  suscripcionId: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
}

let contador = 0;
const nuevoUid = () => `l${contador++}`;

function importes(l: Linea) {
  const subtotal = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
  const iva = (subtotal * (Number(l.ivaTasa) || 0)) / 100;
  return { subtotal, iva, total: subtotal + iva };
}

/** La tasa que corresponde a una variante: la del producto, o 0 si no cobra IVA. */
function ivaDe(p: ProductoVendible, v: ProductoVendible["variantes"][number] | undefined) {
  if (!v) return p.ivaTasa != null ? String(p.ivaTasa) : "0";
  return v.cobraIva && p.ivaTasa != null ? String(p.ivaTasa) : "0";
}

/** Sin producto ni plan: un trabajo puntual escrito a mano. */
const esPersonalizada = (l: Linea) => !l.productoId && !l.suscripcionId;

/**
 * Armar una orden desde el teléfono, en una sola pantalla como Shopify: el
 * cliente arriba, los productos con sus dos botones —del catálogo, o un ítem
 * personalizado—, lo que se cobra, y las notas. Se crea en borrador;
 * facturarla es el paso siguiente, desde su ficha.
 */
export default function NuevaOrdenScreen() {
  const router = useRouter();
  const { cliente: clienteInicial, visita: visitaInicial } = useLocalSearchParams<{
    cliente?: string;
    visita?: string;
  }>();
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(clienteInicial ?? null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pendientes, setPendientes] = useState<PeriodoPendiente[]>([]);
  const [visitas, setVisitas] = useState<VisitaDetail[]>([]);
  const [visitaIds, setVisitaIds] = useState<string[]>(visitaInicial ? [visitaInicial] : []);
  const [notas, setNotas] = useState("");
  const [eligiendoProductos, setEligiendoProductos] = useState(false);
  const [agregandoPersonalizado, setAgregandoPersonalizado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ClientesListResponse>("/api/mobile/clientes", { query: { limit: 500 } })
      .then((r) => setClientes(r.items))
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar los clientes")))
      .finally(() => setCargando(false));
  }, []);

  // Lo del cliente: sus períodos de plan sin orden y sus visitas, para marcar.
  useEffect(() => {
    if (!clienteId) {
      setPendientes([]);
      setVisitas([]);
      return;
    }
    apiRequest<{ items: PeriodoPendiente[] }>("/api/mobile/ordenes/pendientes", {
      query: { clienteId },
    })
      .then((r) => setPendientes(r.items))
      .catch(() => setPendientes([]));
    apiRequest<{ items: VisitaDetail[] }>("/api/mobile/visitas", {
      query: { clienteId, limit: 100 },
    })
      .then((r) => setVisitas(r.items.filter((v) => v.estado !== "CANCELADA")))
      .catch(() => setVisitas([]));
  }, [clienteId]);

  const elegirCliente = (id: string) => {
    setClienteId(id);
    // Las líneas de períodos eran de otro cliente: no valen más.
    setLineas((prev) => prev.filter((l) => !l.suscripcionId));
    setVisitaIds([]);
  };

  const actualizar = (uid: string, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const quitar = (uid: string) => setLineas((prev) => prev.filter((l) => l.uid !== uid));

  /**
   * Lo que el selector devuelve es la selección **entera**: entran las
   * variantes nuevas, con su precio de lista, y salen las que se desmarcaron.
   * Las que ya estaban se quedan como estén, precio tocado incluido.
   */
  const aplicarSeleccion = (elegidas: VarianteElegida[]) => {
    const ids = new Set(elegidas.map((e) => e.variante.id));
    setLineas((prev) => {
      const quedan = prev.filter((l) => !l.varianteId || ids.has(l.varianteId));
      const nuevas = elegidas
        .filter((e) => !prev.some((l) => l.varianteId === e.variante.id))
        .map<Linea>((e) => ({
          uid: nuevoUid(),
          descripcion: e.variante.nombre
            ? `${e.producto.nombre} · ${e.variante.nombre}`
            : e.producto.nombre,
          cantidad: "1",
          precioUnitario: String(e.variante.precio),
          ivaTasa: ivaDe(e.producto, e.variante),
          productoId: e.producto.id,
          varianteId: e.variante.id,
          suscripcionId: null,
          periodoInicio: null,
          periodoFin: null,
        }));
      return [...quedan, ...nuevas];
    });
    setEligiendoProductos(false);
  };

  const agregarPersonalizado = (l: {
    descripcion: string;
    cantidad: string;
    precioUnitario: string;
    ivaTasa: string;
  }) => {
    setLineas((prev) => [
      ...prev,
      {
        uid: nuevoUid(),
        ...l,
        productoId: null,
        varianteId: null,
        suscripcionId: null,
        periodoInicio: null,
        periodoFin: null,
      },
    ]);
    setAgregandoPersonalizado(false);
  };

  /** Una orden es de un plan **o** de unas visitas, nunca de las dos. */
  const tienePeriodo = lineas.some((l) => l.suscripcionId);
  const yaEnLaOrden = new Set(
    lineas.filter((l) => l.suscripcionId).map((l) => `${l.suscripcionId}:${l.periodoInicio}`)
  );
  const periodosPendientes = pendientes.filter(
    (p) => !yaEnLaOrden.has(`${p.suscripcionId}:${p.periodoInicio}`)
  );

  const agregarPeriodo = (p: PeriodoPendiente) => {
    if (visitaIds.length > 0) {
      return setError("Esta orden es por unas visitas. Los períodos de suscripción van en otra.");
    }
    if (lineas.some((l) => l.suscripcionId && l.suscripcionId !== p.suscripcionId)) {
      return setError("Esta orden ya es de otra suscripción. Arma una orden por plan.");
    }
    setError(null);
    setLineas((prev) => [
      ...prev,
      {
        uid: nuevoUid(),
        descripcion: p.descripcion,
        cantidad: "1",
        precioUnitario: String(p.precio),
        ivaTasa: String(p.ivaTasa),
        productoId: null,
        varianteId: null,
        suscripcionId: p.suscripcionId,
        periodoInicio: p.periodoInicio,
        periodoFin: p.periodoFin,
      },
    ]);
  };

  const alternarVisita = (id: string) => {
    if (tienePeriodo) {
      return setError("Esta orden cubre un período de suscripción. Las visitas van en otra.");
    }
    setError(null);
    setVisitaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const totales = lineas.reduce(
    (acc, l) => {
      const i = importes(l);
      return { subtotal: acc.subtotal + i.subtotal, iva: acc.iva + i.iva, total: acc.total + i.total };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  async function crear() {
    if (!clienteId) return setError("Selecciona un cliente.");
    if (lineas.length === 0) return setError("Agrega al menos un producto.");
    const sinDescripcion = lineas.find((l) => !l.descripcion.trim());
    if (sinDescripcion) return setError("Hay un ítem sin descripción.");
    const negativo = lineas.find((l) => Number(l.precioUnitario) < 0);
    if (negativo) return setError(`El precio de "${negativo.descripcion}" es negativo.`);
    setError(null);
    setGuardando(true);
    try {
      const creada = await apiRequest<{ id: string; numero: number }>("/api/mobile/ordenes", {
        method: "POST",
        body: {
          clienteId,
          notas: notas.trim() || undefined,
          visitaIds,
          lineas: lineas.map((l) => ({
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad) || 1,
            precioUnitario: Number(l.precioUnitario) || 0,
            ivaTasa: Number(l.ivaTasa) || 0,
            productoId: l.productoId,
            varianteId: l.varianteId,
            suscripcionId: l.suscripcionId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        },
      });
      router.replace(`/(personal)/ordenes/${creada.id}`);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos crear la orden"));
      setGuardando(false);
    }
  }

  const encabezado = (
    <EncabezadoDeFormulario
      titulo="Nueva orden"
      accion="Crear"
      onAccion={crear}
      onCancelar={() => router.back()}
      cargando={guardando}
      deshabilitado={!clienteId || lineas.length === 0}
    />
  );

  if (cargando) {
    return (
      <View style={styles.flex}>
        {encabezado}
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
    {encabezado}
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.contenedor}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Secciones separadas por bandas, como Shopify: cada bloque es una
            pregunta —para quién, qué, cuánto— y la banda es lo que las separa
            sin recuadrar cada una. */}
        <Seccion titulo="Cliente">
          <SelectorCliente clientes={clientes} valor={clienteId} onElegir={elegirCliente} />
        </Seccion>

        <Seccion titulo="Productos">
          {/* Dos botones, como Shopify: del catálogo —varios de una, en su
              propia hoja— o un ítem personalizado escrito a mano. */}
          <View style={styles.dosBotones}>
            <PressableScale
              onPress={() => setEligiendoProductos(true)}
              estiloExterno={styles.mitad}
              style={styles.primario}
            >
              <Text style={styles.primarioTexto}>Agregar producto</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setAgregandoPersonalizado(true)}
              estiloExterno={styles.mitad}
              style={styles.secundario}
            >
              <Text style={styles.secundarioTexto}>Ítem personalizado</Text>
            </PressableScale>
          </View>

          {lineas.map((l) => {
            const i = importes(l);
            return (
              <View key={l.uid} style={styles.linea}>
                <View style={styles.lineaCabecera}>
                  <View style={styles.lineaTexto}>
                    {esPersonalizada(l) ? (
                      /* La personalizada se escribe acá: no hay catálogo del
                         que tomar el nombre. */
                      <Campo
                        label="Descripción"
                        required
                        value={l.descripcion}
                        onChangeText={(v) => actualizar(l.uid, { descripcion: v })}
                      />
                    ) : (
                      <Text variant="bodyMedium" style={styles.lineaNombre}>
                        {l.descripcion}
                      </Text>
                    )}
                    {l.periodoInicio && l.periodoFin ? (
                      <Text variant="bodySmall" style={styles.apagado}>
                        Suscripción ·{" "}
                        {fechaSola(l.periodoInicio, { day: "2-digit", month: "short" })} →{" "}
                        {fechaSola(l.periodoFin, { day: "2-digit", month: "short", year: "numeric" })}
                      </Text>
                    ) : esPersonalizada(l) ? null : (
                      <Text variant="bodySmall" style={styles.apagado}>
                        {l.varianteId ? "Del catálogo" : ""}
                      </Text>
                    )}
                  </View>
                  <PressableScale onPress={() => quitar(l.uid)} hitSlop={8} accessibilityLabel="Quitar">
                    <Ionicons name="trash-outline" size={18} color={tema.texto3} />
                  </PressableScale>
                </View>
                <View style={styles.tres}>
                  <View style={styles.tercio}>
                    <Campo
                      label="Cant."
                      value={l.cantidad}
                      onChangeText={(v) => actualizar(l.uid, { cantidad: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.tercio}>
                    <Campo
                      label="Precio"
                      required
                      value={l.precioUnitario}
                      onChangeText={(v) => actualizar(l.uid, { precioUnitario: v })}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={styles.tercio}>
                    <Campo
                      label="IVA %"
                      value={l.ivaTasa}
                      onChangeText={(v) => actualizar(l.uid, { ivaTasa: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <Text style={styles.lineaTotal}>Total {plata(i.total)}</Text>
              </View>
            );
          })}

          {/* Los períodos de plan sin orden, uno por fila. Con visitas
              marcadas no se ofrecen: una orden es de un plan o de visitas. */}
          {clienteId && visitaIds.length === 0 && periodosPendientes.length > 0 ? (
            <>
              <Text style={styles.subtitulo}>Períodos por facturar</Text>
              {periodosPendientes.map((p) => (
                <View key={`${p.suscripcionId}:${p.periodoInicio}`} style={styles.filaPeriodo}>
                  <View style={styles.lineaTexto}>
                    <Text variant="bodyMedium" style={styles.lineaNombre}>
                      {fechaSola(p.periodoInicio, { day: "2-digit", month: "short" })} →{" "}
                      {fechaSola(p.periodoFin, { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                    <Text variant="bodySmall" style={styles.apagado} numberOfLines={1}>
                      Suscripción #{p.suscripcionNumero} · {p.propiedad} · {plata(p.precio)}
                    </Text>
                  </View>
                  <PressableScale onPress={() => agregarPeriodo(p)} style={styles.botonChico}>
                    <Text style={styles.botonChicoTexto}>Agregar</Text>
                  </PressableScale>
                </View>
              ))}
            </>
          ) : null}
        </Seccion>

        <Seccion titulo="Pago">
          <Fila etiqueta="Subtotal" valor={plata(totales.subtotal)} />
          <Fila etiqueta="IVA" valor={plata(totales.iva)} />
          <Fila etiqueta="Total" valor={plata(totales.total)} fuerte />
        </Seccion>

        {/* De qué visitas es la orden: una etiqueta, no carga líneas. */}
        {clienteId && visitas.length > 0 ? (
          <Seccion titulo="Visitas">
            {tienePeriodo ? (
              <Text style={styles.ayuda}>
                Esta orden cubre un período de suscripción. Las visitas van en otra orden.
              </Text>
            ) : (
              <>
                <Text style={styles.ayuda}>
                  Deja dicho por qué existe esta orden y permite ir de una a la otra. No
                  carga productos.
                </Text>
                {visitas.map((v) => {
                  const marcada = visitaIds.includes(v.id);
                  const tareas = tareasHechas(v).map((t) => t.nombre);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => alternarVisita(v.id)}
                      style={({ pressed }) => [styles.filaVisita, pressed && styles.presionada]}
                    >
                      <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
                        {marcada ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                      <View style={styles.lineaTexto}>
                        <Text variant="bodyMedium" style={styles.lineaNombre}>
                          Visita #{v.numero} ·{" "}
                          {fechaSola(v.fechaProgramada, { day: "2-digit", month: "short", year: "numeric" })}
                        </Text>
                        <Text variant="bodySmall" style={styles.apagado} numberOfLines={1}>
                          {tareas.length > 0 ? tareas.join(", ") : "Sin tareas registradas"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </Seccion>
        ) : null}

        <Seccion titulo="Notas">
          <Campo label="Notas" value={notas} onChangeText={setNotas} multiline placeholder="Opcional" />
        </Seccion>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <SelectorProductos
        visible={eligiendoProductos}
        yaElegidas={lineas.map((l) => l.varianteId).filter((id): id is string => !!id)}
        onCerrar={() => setEligiendoProductos(false)}
        onGuardar={aplicarSeleccion}
      />
      <HojaItemPersonalizado
        visible={agregandoPersonalizado}
        onCerrar={() => setAgregandoPersonalizado(false)}
        onAgregar={agregarPersonalizado}
      />
    </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Un ítem personalizado: un trabajo puntual que no vale la pena dar de alta
 * como producto. La pantalla de Shopify: a pantalla completa, con la ✕ y el
 * título arriba, el nombre, el precio con su "$" y el teclado numérico, la
 * cantidad con −/+ y la casilla de si cobra IVA. Entra como una línea más e
 * imprime un código genérico en la factura.
 */
function HojaItemPersonalizado({
  visible,
  onCerrar,
  onAgregar,
}: {
  visible: boolean;
  onCerrar: () => void;
  onAgregar: (l: { descripcion: string; cantidad: string; precioUnitario: string; ivaTasa: string }) => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  /** Como texto: se escribe con el teclado numérico o se mueve con −/+. */
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  // En Ecuador un trabajo de jardinería tributa al 15 %; el 0 es la excepción.
  // Marcado, se puede escribir otra tasa.
  const [cobraIva, setCobraIva] = useState(true);
  const [iva, setIva] = useState("15");
  const listo =
    descripcion.trim() !== "" && precio.trim() !== "" && Number(cantidad) > 0;

  const limpiar = () => {
    setDescripcion("");
    setCantidad("1");
    setPrecio("");
    setCobraIva(true);
    setIva("15");
  };

  const mover = (delta: number) =>
    setCantidad((c) => String(Math.max(1, (Number(c) || 0) + delta)));

  const agregar = () => {
    onAgregar({
      descripcion: descripcion.trim(),
      cantidad: String(Number(cantidad) || 1),
      precioUnitario: precio,
      ivaTasa: cobraIva ? iva.trim() || "0" : "0",
    });
    limpiar();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      <View style={hoja.pantalla}>
        <View style={hoja.cabecera}>
          <PressableScale onPress={onCerrar} hitSlop={8} style={hoja.cerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={22} color={tema.texto} />
          </PressableScale>
          <Text style={hoja.titulo}>Ítem personalizado</Text>
          <PressableScale onPress={agregar} disabled={!listo} hitSlop={8} style={hoja.boton}>
            <Text style={[hoja.agregar, !listo && hoja.apagado]}>Agregar</Text>
          </PressableScale>
        </View>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={hoja.cuerpo} keyboardShouldPersistTaps="handled">
            <Campo label="Nombre del ítem" required value={descripcion} onChangeText={setDescripcion} autoFocus />
            <Campo
              label="Precio"
              required
              value={precio}
              onChangeText={setPrecio}
              keyboardType="decimal-pad"
              placeholder="0.00"
              prefijo="$"
            />
            {/* Cantidad: se escribe con el teclado numérico o se mueve con
                −/+, que en un teléfono es más rápido para el 1 o 2 de
                siempre. Los dos tocan el mismo valor. */}
            <View style={hoja.cantidad}>
              {/* Rótulo fijo y no flotante: el flotante de paper quedaba
                  tapado por el recuadro y el campo parecía sin nombre. */}
              <View style={styles.lineaTexto}>
                <Text style={hoja.cantidadLabel}>Cantidad</Text>
                <TextInput
                  value={cantidad}
                  onChangeText={(v) => setCantidad(v.replace(/[^0-9]/g, ""))}
                  onBlur={() => setCantidad((c) => String(Math.max(1, Number(c) || 1)))}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={hoja.cantidadValor}
                  accessibilityLabel="Cantidad"
                />
              </View>
              <View style={hoja.pasos}>
                <PressableScale
                  onPress={() => mover(-1)}
                  disabled={Number(cantidad) <= 1}
                  style={[hoja.paso, Number(cantidad) <= 1 && hoja.pasoApagado]}
                  accessibilityLabel="Menos"
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={Number(cantidad) <= 1 ? tema.texto3 : tema.texto}
                  />
                </PressableScale>
                <PressableScale onPress={() => mover(1)} style={hoja.paso} accessibilityLabel="Más">
                  <Ionicons name="add" size={20} color={tema.texto} />
                </PressableScale>
              </View>
            </View>
            <Pressable onPress={() => setCobraIva((v) => !v)} style={hoja.casillaFila}>
              <View style={[styles.casilla, cobraIva && styles.casillaMarcada]}>
                {cobraIva ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text variant="bodyLarge" style={hoja.casillaTexto}>
                Cobra IVA
              </Text>
            </Pressable>
            {/* Marcado, la tasa se escribe: 15 es lo usual, pero no lo único. */}
            {cobraIva ? (
              <Campo
                label="IVA %"
                value={iva}
                onChangeText={setIva}
                keyboardType="decimal-pad"
                placeholder="15"
              />
            ) : null}
            <Text style={styles.ayuda}>
              Un trabajo puntual sin producto en el catálogo. Lo que se vendió lo dice el
              nombre.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text variant="bodyMedium" style={[styles.filaEtiqueta, fuerte && styles.filaFuerte]}>
        {etiqueta}
      </Text>
      <Text variant="bodyMedium" style={[styles.filaValor, fuerte && styles.filaFuerte]}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tema.lienzo },
  contenedor: { flex: 1, backgroundColor: tema.lienzo },
  scroll: { paddingBottom: 40 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  apagado: { color: tema.texto3 },
  ayuda: { color: tema.texto3, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  error: { color: tema.rojo, textAlign: "center", paddingVertical: 12 },

  /* La banda gris del lienzo entre secciones blancas: lo que separa una
     pregunta de la siguiente sin recuadrar ninguna. */
  seccion: { backgroundColor: tema.superficie, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  seccionTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto, marginBottom: 10 },
  subtitulo: { fontSize: 13, fontWeight: "600", color: tema.texto2, marginTop: 8, marginBottom: 4 },

  dosBotones: { flexDirection: "row", gap: 10, marginBottom: 10 },
  mitad: { flex: 1 },
  primario: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: tema.verde,
  },
  primarioTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secundario: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  secundarioTexto: { color: tema.texto, fontWeight: "600", fontSize: 15 },

  linea: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea2,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  lineaCabecera: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  lineaTexto: { flex: 1, gap: 2 },
  lineaNombre: { color: tema.texto, fontWeight: "500" },
  lineaTotal: { color: tema.texto, fontWeight: "700", textAlign: "right" },
  tres: { flexDirection: "row", gap: 8 },
  tercio: { flex: 1 },

  filaPeriodo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  botonChico: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  botonChicoTexto: { color: tema.texto, fontWeight: "600", fontSize: 13 },

  fila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea2 },
  filaEtiqueta: { color: tema.texto2 },
  filaValor: { color: tema.texto },
  filaFuerte: { fontWeight: "700", color: tema.texto },

  filaVisita: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  presionada: { backgroundColor: tema.lienzo },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },
});

const hoja = StyleSheet.create({
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
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  boton: { minWidth: 76, paddingHorizontal: 6, paddingVertical: 6 },
  titulo: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: tema.texto },
  agregar: { color: tema.verde, fontSize: 16, fontWeight: "700", textAlign: "right" },
  apagado: { color: tema.texto3 },
  cuerpo: { padding: 16, paddingBottom: 40 },
  cantidad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 12,
  },
  cantidadLabel: { fontSize: 12, color: tema.texto3 },
  cantidadValor: { fontSize: 17, color: tema.texto, padding: 0, paddingVertical: 2 },
  pasos: { flexDirection: "row", gap: 6 },
  paso: {
    width: 44,
    height: 40,
    borderRadius: 10,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  pasoApagado: { opacity: 0.5 },
  casillaFila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  casillaTexto: { color: tema.texto },
});
