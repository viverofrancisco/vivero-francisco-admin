import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import {
  cobroLabel,
  diaISO,
  estadoCobro,
  fechaSola,
  resumenDePropiedades,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado, type OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { SelectorOpcion } from "@/components/ui/SelectorOpcion";
import { Campo } from "@/components/ui/Formulario";
import { SelectorFecha } from "@/components/SelectorFecha";
import type { FormaDePago, OrdenDetalle } from "@/lib/types";
import { tema } from "@/lib/tema";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const ESTADO_FACTURA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  FIRMADO: "Firmada",
  ENVIADO_SRI: "Enviada al SRI",
  AUTORIZADO: "Autorizada",
  RECHAZADO: "Rechazada",
};

const FORMAS_DE_PAGO: { clave: FormaDePago; etiqueta: string }[] = [
  { clave: "EFECTIVO", etiqueta: "Efectivo" },
  { clave: "TRANSFERENCIA", etiqueta: "Transferencia" },
  { clave: "TARJETA", etiqueta: "Tarjeta" },
  { clave: "CHEQUE", etiqueta: "Cheque" },
  { clave: "OTRO", etiqueta: "Otro" },
];

/**
 * Una orden: por qué existe, qué se cobra y cómo viene el cobro.
 *
 * Armarla sigue siendo del portal, donde están el catálogo y los precios;
 * **emitir y cobrar se hacen acá también**, como allá: sin documento, la
 * acción principal es emitirlo; con la factura emitida, el ⋯ del encabezado
 * tiene lo que se le hace a una factura —registrar el cobro, ver el RIDE,
 * mandársela al cliente, consultarle al SRI, la nota de crédito—, el mismo
 * menú de la tarjeta de la factura en el portal.
 */
export default function OrdenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [acreditando, setAcreditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Lo que contestó la última acción sobre la factura, debajo de la plata. */
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(() => {
    apiRequest<OrdenDetalle>(`/api/mobile/ordenes/${id}`)
      .then(setOrden)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la orden")));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  if (error && !orden) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Orden" />
        <View style={styles.centro}>
          <Text style={styles.apagado}>{error}</Text>
        </View>
      </View>
    );
  }
  if (!orden) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Orden" />
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  const anulada = orden.estado === "ANULADA";
  const cobro = estadoCobro(orden.total, orden.factura?.saldo ?? null);
  const donde = resumenDePropiedades(orden.propiedades);
  const factura = orden.factura;
  const autorizada = factura?.estado === "AUTORIZADO";

  /** El RIDE se arma en el servidor y se abre en el visor del sistema. */
  async function verRide() {
    if (!factura) return;
    setOcupado(true);
    try {
      const r = await apiRequest<{ url: string }>(`/api/mobile/facturas/${factura.id}/ride`);
      await WebBrowser.openBrowserAsync(r.url);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos abrir la factura"));
    } finally {
      setOcupado(false);
    }
  }

  /** Le pregunta al SRI por una factura que quedó sin resolver. */
  async function consultarAlSri() {
    if (!factura) return;
    setOcupado(true);
    try {
      const r = await apiRequest<{ estado: string; resuelta: boolean }>(
        `/api/mobile/facturas/${factura.id}/consultar-sri`,
        { method: "POST" }
      );
      // Sin respuesta todavía no es un error: es lo normal mientras procesa.
      setAviso(
        r.resuelta
          ? `El SRI respondió: ${r.estado}.`
          : "El SRI todavía no la resolvió. Se vuelve a consultar solo."
      );
      cargar();
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos consultar al SRI"));
    } finally {
      setOcupado(false);
    }
  }

  /** Le manda al cliente el RIDE y el XML. */
  async function enviarAlCliente(correo: string) {
    if (!factura) return;
    setOcupado(true);
    try {
      const r = await apiRequest<{ a: string; conXml: boolean }>(
        `/api/mobile/facturas/${factura.id}/enviar`,
        { method: "POST", body: { correo: correo.trim() || null } }
      );
      setAviso(
        r.conXml
          ? `Enviada a ${r.a}.`
          : `Enviada a ${r.a}, pero sin el XML: no se pudo leer de R2.`
      );
      setEnviando(false);
      cargar();
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos enviar la factura"));
    } finally {
      setOcupado(false);
    }
  }

  /** La nota de crédito que corrige la factura: queda acreditada y la orden vuelve a borrador. */
  async function emitirNota(motivo: string) {
    if (!factura) return;
    setOcupado(true);
    try {
      const r = await apiRequest<{ numero: string; estado: string }>(
        `/api/mobile/facturas/${factura.id}/nota-credito`,
        { method: "POST", body: { motivo } }
      );
      setAviso(
        r.estado === "AUTORIZADO"
          ? `El SRI autorizó la nota de crédito ${r.numero}.`
          : `La nota quedó en ${r.estado}: la factura sigue viva.`
      );
      setAcreditando(false);
      cargar();
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos emitir la nota de crédito"));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Lo que se le hace a la factura, en el ⋯: el mismo menú que la tarjeta de
   * la factura en el portal. Sin documento no hay menú: lo que toca es
   * emitirlo, y eso es el botón grande.
   */
  const opciones: OpcionDeMenu[] =
    !factura || anulada || ocupado
      ? []
      : [
          // `saldo === null` es una factura sin sincronizar: se asume todo
          // pendiente, que es el número prudente.
          ...(factura.saldo === null || factura.saldo > 0
            ? [{ etiqueta: "Registrar cobro", onPress: () => setCobrando(true) }]
            : []),
          // El RIDE se arma desde lo guardado, así que está apenas el SRI la
          // autoriza; antes no hay comprobante que entregar.
          ...(autorizada
            ? [
                { etiqueta: "Ver factura (RIDE)", onPress: verRide },
                {
                  etiqueta: factura.enviadoEl
                    ? "Volver a enviar al cliente"
                    : "Enviar al cliente",
                  onPress: () => setEnviando(true),
                },
                { etiqueta: "Emitir nota de crédito", onPress: () => setAcreditando(true) },
              ]
            : [{ etiqueta: "Consultar al SRI", onPress: consultarAlSri }]),
        ];

  return (
    <View style={styles.flex}>
    {/* La flecha al lado del número, y fija: es el encabezado de toda ficha
        en la app. A la derecha, el ⋯ con lo que se le hace a la factura. */}
    <EncabezadoDeFicha
      titulo={`Orden #${orden.numero}`}
      derecha={opciones.length > 0 ? <MenuDeEncabezado opciones={opciones} /> : undefined}
    />
    <ScrollView style={styles.contenedor} contentContainerStyle={styles.scroll}>
      <View style={styles.encabezado}>
        <Text variant="bodyMedium" style={styles.apagado}>
          {orden.cliente.nombre} ·{" "}
          {fechaSola(orden.fecha, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        {donde ? (
          <Text variant="bodySmall" style={styles.apagado}>
            {donde}
          </Text>
        ) : null}
      </View>

      {/* Lo primero: cuánto es y si entró. Es a lo que se abre esta pantalla. */}
      <View style={[styles.tarjetaPlata, anulada && styles.tarjetaAnulada]}>
        <Text style={styles.plataGrande}>{plata(orden.total)}</Text>
        {/* Sin factura, el estado de la orden: `estadoCobro` sin saldo dice
            "sin sincronizar", que es lo que dice de una factura vieja, no de
            un borrador que todavía no se emitió. */}
        <Text style={styles.plataEstado}>
          {anulada ? "Orden anulada" : !factura ? "Borrador" : cobroLabel[cobro]}
        </Text>
        {!anulada && orden.factura?.saldo ? (
          <Text style={styles.plataSaldo}>
            Falta cobrar {plata(orden.factura.saldo)}
          </Text>
        ) : null}
      </View>

      {/* Sin documento, lo que toca es emitirlo: el cobro se registra
          **contra** un comprobante, así que antes no hay nada que cobrar. */}
      {!anulada && !factura ? (
        <PressableScale
          onPress={() => router.push(`/(personal)/ordenes/emitir/${orden.id}`)}
          estiloExterno={styles.accionExterno}
          style={styles.accion}
        >
          <Text style={styles.accionTexto}>Emitir factura</Text>
        </PressableScale>
      ) : null}
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      <Seccion titulo="Detalle">
        {orden.lineas.map((l) => (
          <View key={l.id} style={styles.linea}>
            <View style={styles.lineaTexto}>
              <Text variant="bodyMedium" style={styles.lineaNombre}>
                {l.descripcion}
              </Text>
              <Text variant="bodySmall" style={styles.apagado}>
                {l.cantidad} × {plata(l.precioUnitario)}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.lineaTotal}>
              {plata(l.total)}
            </Text>
          </View>
        ))}
        <View style={styles.totales}>
          <Fila etiqueta="Subtotal" valor={plata(orden.subtotal)} />
          <Fila etiqueta="IVA" valor={plata(orden.iva)} />
          <Fila etiqueta="Total" valor={plata(orden.total)} fuerte />
        </View>
      </Seccion>

      {orden.factura ? (
        <Seccion titulo="Factura">
          <Fila etiqueta="Número" valor={orden.factura.numero} />
          <Fila
            etiqueta="Estado"
            valor={ESTADO_FACTURA[orden.factura.estado] ?? orden.factura.estado}
          />
          <Fila
            etiqueta="Emitida"
            valor={fechaSola(orden.factura.fechaEmision, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </Seccion>
      ) : null}

      {/* De qué es la orden: el plan o las visitas que cubre. */}
      {orden.visitas.length > 0 ? (
        <Seccion
          titulo={orden.visitas.length === 1 ? "Visita" : "Visitas"}
        >
          {orden.visitas.map((v) => (
            <PressableScale
              key={v.id}
              onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
              style={styles.visita}
            >
              <Text variant="bodyMedium" style={styles.lineaNombre}>
                Visita #{v.numero}
              </Text>
              <Text style={styles.apagado}>›</Text>
            </PressableScale>
          ))}
        </Seccion>
      ) : null}

      {orden.notas ? (
        <Seccion titulo="Notas">
          <Text variant="bodyMedium" style={styles.notas}>
            {orden.notas}
          </Text>
        </Seccion>
      ) : null}

    </ScrollView>

    {factura ? (
      <>
        <CobroSheet
          visible={cobrando}
          facturaId={factura.id}
          numero={factura.numero}
          saldo={factura.saldo ?? orden.total}
          onCerrar={() => setCobrando(false)}
          onRegistrado={() => {
            setCobrando(false);
            setAviso("Cobro registrado.");
            cargar();
          }}
        />
        {/* El motivo sale impreso en la nota y es lo que explica la
            devolución meses después, así que se pide. */}
        <HojaDeTexto
          visible={acreditando}
          titulo={`Nota de crédito de la factura ${factura.numero}`}
          detalle={`Se emite al SRI una nota de crédito por ${plata(orden.total)}, el total de la factura. Queda acreditada y la orden vuelve a borrador.`}
          label="Motivo"
          confirmar="Emitir nota de crédito"
          peligro
          cargando={ocupado}
          onConfirmar={emitirNota}
          onCerrar={() => setAcreditando(false)}
        />
        <HojaDeTexto
          visible={enviando}
          titulo="Enviar al cliente"
          detalle="Le llega el RIDE en PDF y el XML autorizado."
          label="Correo"
          valorInicial={orden.cliente.email ?? ""}
          teclado="email-address"
          confirmar="Enviar"
          cargando={ocupado}
          onConfirmar={enviarAlCliente}
          onCerrar={() => setEnviando(false)}
        />
      </>
    ) : null}
    </View>
  );
}

/** Una hoja con un solo campo de texto y un botón: el motivo, el correo. */
function HojaDeTexto({
  visible,
  titulo,
  detalle,
  label,
  valorInicial = "",
  teclado,
  confirmar,
  peligro = false,
  cargando = false,
  onConfirmar,
  onCerrar,
}: {
  visible: boolean;
  titulo: string;
  detalle?: string;
  label: string;
  valorInicial?: string;
  teclado?: "default" | "email-address";
  confirmar: string;
  /** Para lo que no se deshace: el botón va en rojo. */
  peligro?: boolean;
  cargando?: boolean;
  onConfirmar: (valor: string) => void;
  onCerrar: () => void;
}) {
  const [valor, setValor] = useState(valorInicial);
  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <View style={hoja.cuerpo}>
        <Text style={hoja.titulo}>{titulo}</Text>
        {detalle ? <Text style={hoja.detalle}>{detalle}</Text> : null}
        <Campo
          label={label}
          required
          value={valor}
          onChangeText={setValor}
          keyboardType={teclado}
          autoCapitalize={teclado === "email-address" ? "none" : "sentences"}
        />
        <PressableScale
          onPress={() => onConfirmar(valor)}
          disabled={cargando || !valor.trim()}
          estiloExterno={hoja.botonExterno}
          style={[
            hoja.boton,
            peligro && hoja.botonPeligro,
            (cargando || !valor.trim()) && hoja.botonApagado,
          ]}
        >
          <Text style={hoja.botonTexto}>{cargando ? "Un momento…" : confirmar}</Text>
        </PressableScale>
      </View>
    </HojaInferior>
  );
}

/**
 * Registrar un cobro contra la factura: cuánto, cómo, cuándo y con qué
 * referencia. El mismo diálogo del portal, en una hoja.
 */
function CobroSheet({
  visible,
  facturaId,
  numero,
  saldo,
  onCerrar,
  onRegistrado,
}: {
  visible: boolean;
  facturaId: string;
  numero: string;
  saldo: number;
  onCerrar: () => void;
  onRegistrado: () => void;
}) {
  const [monto, setMonto] = useState(String(saldo));
  const [formaPago, setFormaPago] = useState<FormaDePago>("TRANSFERENCIA");
  const [fecha, setFecha] = useState(diaISO(new Date()));
  const [referencia, setReferencia] = useState("");
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar() {
    const valor = Number(monto);
    if (!(valor > 0)) return setError("Ingresa un monto mayor a cero.");
    setError(null);
    setGuardando(true);
    try {
      await apiRequest(`/api/mobile/facturas/${facturaId}/cobro`, {
        method: "POST",
        body: {
          monto: valor,
          formaPago,
          fecha,
          referencia: referencia.trim() || null,
        },
      });
      onRegistrado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos registrar el cobro"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} maxAlto={0.9}>
      <ScrollView style={hoja.cuerpo} keyboardShouldPersistTaps="handled">
        <Text style={hoja.titulo}>Registrar cobro</Text>
        <Text style={hoja.detalle}>
          Factura {numero} · falta cobrar {plata(saldo)}
        </Text>
        <Campo
          label="Monto"
          required
          value={monto}
          onChangeText={setMonto}
          keyboardType="decimal-pad"
        />
        <SelectorOpcion
          label="Forma de pago"
          valor={formaPago}
          onElegir={(v) => setFormaPago(v as FormaDePago)}
          opciones={FORMAS_DE_PAGO}
        />
        <Pressable
          onPress={() => setEligiendoFecha(true)}
          style={({ pressed }) => [hoja.fecha, pressed && hoja.fechaPresionada]}
        >
          <View style={hoja.fechaTexto}>
            <Text style={hoja.label}>Fecha</Text>
            <Text variant="bodyLarge" style={hoja.valor}>
              {fechaSola(fecha)}
            </Text>
          </View>
          <Ionicons name="calendar-outline" size={18} color={tema.texto3} />
        </Pressable>
        <SelectorFecha
          visible={eligiendoFecha}
          valor={new Date(`${fecha}T12:00:00`)}
          onElegir={(d) => {
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
            setFecha(diaISO(local));
            setEligiendoFecha(false);
          }}
          onCerrar={() => setEligiendoFecha(false)}
        />
        {/* Una sola referencia en vez de un campo por forma de pago: el
            número de la transferencia, los últimos dígitos de la tarjeta. */}
        <Campo
          label="Referencia"
          value={referencia}
          onChangeText={setReferencia}
          placeholder="N.º de transferencia, cheque…"
        />
        {error ? <Text style={hoja.error}>{error}</Text> : null}
        <PressableScale
          onPress={registrar}
          disabled={guardando}
          estiloExterno={hoja.botonExterno}
          style={[hoja.boton, guardando && hoja.botonApagado]}
        >
          <Text style={hoja.botonTexto}>
            {guardando ? "Registrando…" : "Registrar"}
          </Text>
        </PressableScale>
      </ScrollView>
    </HojaInferior>
  );
}

const hoja = StyleSheet.create({
  cuerpo: { paddingHorizontal: 16, paddingBottom: 24 },
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto, paddingTop: 6 },
  detalle: { color: tema.texto3, marginBottom: 12 },
  label: { fontSize: 12, color: tema.texto3 },
  valor: { color: tema.texto },
  fecha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 8,
  },
  fechaPresionada: { backgroundColor: tema.lienzo },
  fechaTexto: { flex: 1, gap: 1 },
  error: { color: tema.rojo, textAlign: "center", paddingVertical: 6 },
  botonExterno: { alignSelf: "stretch", marginTop: 8 },
  boton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: tema.verde,
  },
  botonPeligro: { backgroundColor: tema.rojo },
  botonApagado: { backgroundColor: tema.linea },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.seccion}>
      <Text variant="labelMedium" style={styles.seccionRotulo}>
        {titulo.toUpperCase()}
      </Text>
      <View style={styles.seccionCuerpo}>{children}</View>
    </View>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text variant="bodyMedium" style={styles.apagado}>
        {etiqueta}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.filaValor, fuerte && styles.filaFuerte]}
      >
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tema.fondo },
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  scroll: { padding: 16, paddingBottom: 40 },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },

  encabezado: { gap: 3, marginBottom: 16 },
  apagado: { color: tema.texto3 },

  tarjetaPlata: {
    backgroundColor: tema.verdeProfundo,
    borderRadius: 16,
    padding: 18,
    gap: 2,
    marginBottom: 8,
  },
  tarjetaAnulada: { backgroundColor: tema.texto2 },
  accionExterno: { alignSelf: "stretch", marginTop: 4 },
  accion: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tema.verde,
  },
  accionTexto: { color: "#fff", fontSize: 16, fontWeight: "600" },
  aviso: { color: tema.texto2, textAlign: "center", paddingVertical: 8 },
  plataGrande: { color: "#fff", fontSize: 30, fontWeight: "700" },
  plataEstado: { color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  plataSaldo: { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  seccion: { marginTop: 20, gap: 6 },
  seccionRotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  seccionCuerpo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  linea: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  lineaTexto: { flex: 1, gap: 2 },
  lineaNombre: { color: tema.texto },
  lineaTotal: { color: tema.texto, fontWeight: "600" },
  totales: { paddingTop: 6 },

  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  filaValor: { color: tema.texto },
  filaFuerte: { fontWeight: "700" },

  visita: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },

  notas: { color: tema.texto2, paddingVertical: 8, lineHeight: 21 },
  pie: { color: tema.texto3, textAlign: "center", marginTop: 24 },
});
