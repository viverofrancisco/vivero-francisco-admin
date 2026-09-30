import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fechaSola } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Campo, Titulo } from "@/components/ui/Formulario";
import { SelectorOpcion } from "@/components/ui/SelectorOpcion";
import { PressableScale } from "@/components/ui/PressableScale";
import type {
  DatoFacturacionResumen,
  EmisorOpcion,
  OrdenDetalle,
} from "@/lib/types";
import { tema } from "@/lib/tema";
import { Conmutador } from "@/components/ui/Conmutador";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Un dato de facturación mientras se carga, como texto. */
interface NuevoDato {
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string;
  telefono: string;
  email: string;
  guardarEnFicha: boolean;
}

const NUEVO_VACIO: NuevoDato = {
  tipoIdentificacion: "CEDULA",
  identificacion: "",
  razonSocial: "",
  tipoPersona: "NATURAL",
  direccion: "",
  telefono: "",
  email: "",
  guardarEnFicha: true,
};

/**
 * Emitir la factura de una orden, desde el teléfono.
 *
 * Es el armador del portal sin la parte de armar: con qué RUC se emite y a
 * nombre de quién, y las líneas de la orden **tal cual**. Juntar varios
 * trabajos en una sola línea de "servicio de mantenimiento" sigue siendo del
 * portal, donde hay pantalla para ver que el documento cuadre; acá el caso es
 * el común, que en el portal también es un clic. Emitir manda el comprobante
 * al SRI en el momento y no se deshace.
 */
export default function EmitirOrdenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [emisores, setEmisores] = useState<EmisorOpcion[]>([]);
  const [datos, setDatos] = useState<DatoFacturacionResumen[]>([]);
  const [emisorId, setEmisorId] = useState<string | null>(null);
  const [datoId, setDatoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  /** El formulario de "Usar otros datos", abierto debajo del selector. */
  const [nuevo, setNuevo] = useState<NuevoDato | null>(null);
  const [guardandoDato, setGuardandoDato] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const o = await apiRequest<OrdenDetalle>(`/api/mobile/ordenes/${id}`);
        const [e, d] = await Promise.all([
          apiRequest<{ items: EmisorOpcion[] }>("/api/mobile/emisores"),
          apiRequest<{ items: DatoFacturacionResumen[] }>(
            `/api/mobile/clientes/${o.cliente.id}/facturacion`
          ),
        ]);
        setOrden(o);
        setEmisores(e.items);
        setDatos(d.items);
        setEmisorId(e.items.find((x) => x.predeterminado)?.id ?? e.items[0]?.id ?? null);
        setDatoId(d.items.find((x) => x.esPredeterminado)?.id ?? d.items[0]?.id ?? null);
      } catch (e) {
        setError(mensajeDeError(e, "No pudimos cargar la orden"));
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  const emisor = emisores.find((e) => e.id === emisorId) ?? null;

  /** Carga el dato nuevo en la ficha del cliente y lo deja elegido. */
  async function guardarNuevoDato() {
    if (!nuevo || !orden) return;
    if (!nuevo.identificacion.trim()) return setError("Pon la identificación.");
    if (!nuevo.razonSocial.trim()) return setError("Pon la razón social.");
    setError(null);
    setGuardandoDato(true);
    try {
      const creado = await apiRequest<DatoFacturacionResumen>(
        `/api/mobile/clientes/${orden.cliente.id}/facturacion`,
        {
          method: "POST",
          body: {
            tipoIdentificacion: nuevo.tipoIdentificacion,
            identificacion: nuevo.identificacion.trim(),
            razonSocial: nuevo.razonSocial.trim(),
            tipoPersona: nuevo.tipoPersona,
            direccion: nuevo.direccion.trim() || null,
            telefono: nuevo.telefono.trim() || null,
            email: nuevo.email.trim() || null,
            // El primero que se carga queda como predeterminado; uno "solo por
            // esta vez" se crea archivado y no vuelve a ofrecerse.
            esPredeterminado: nuevo.guardarEnFicha && datos.length === 0,
            archivado: !nuevo.guardarEnFicha,
          },
        }
      );
      setDatos((d) => [...d, creado]);
      setDatoId(creado.id);
      setNuevo(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar los datos"));
    } finally {
      setGuardandoDato(false);
    }
  }

  async function emitir() {
    if (!orden) return;
    if (!emisorId) return setError("No hay ningún emisor configurado.");
    if (!datoId) return setError("Falta elegir a nombre de quién se emite.");
    setError(null);
    setEmitiendo(true);
    try {
      const r = await apiRequest<{
        factura: { numero: string } | null;
        errorFactura: string | null;
      }>(`/api/mobile/ordenes/${id}/facturar`, {
        method: "POST",
        body: { emisorId, datoFacturacionId: datoId },
      });
      if (!r.factura) {
        // La orden se queda en borrador: es el estado en el que se arregla.
        setError(`No se pudo emitir: ${r.errorFactura}`);
        return;
      }
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos emitir"));
    } finally {
      setEmitiendo(false);
    }
  }

  if (cargando || !orden) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Emitir factura"
          accion="Emitir"
          onAccion={() => {}}
          onCancelar={() => router.back()}
          deshabilitado
        />
        <View style={styles.centro}>
          {error ? (
            <Text style={styles.apagado}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" />
          )}
        </View>
      </View>
    );
  }

  const bloqueo =
    emisores.length === 0
      ? "No hay ningún emisor configurado con su firma. Se carga en el portal, en Configuración."
      : !datoId
        ? "Falta elegir a nombre de quién se emite."
        : null;

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={`Emitir orden #${orden.numero}`}
        accion="Emitir"
        onAccion={emitir}
        onCancelar={() => router.back()}
        cargando={emitiendo}
        deshabilitado={bloqueo !== null || nuevo !== null}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          style={styles.contenedor}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodyMedium" style={[styles.apagado, styles.subtitulo]}>
            {orden.cliente.nombre} · {fechaSola(orden.fecha, { day: "numeric", month: "short", year: "numeric" })}
          </Text>

          <Titulo>Documento</Titulo>
          {emisores.length > 1 ? (
            <SelectorOpcion
              label="Emitir con"
              valor={emisorId}
              onElegir={setEmisorId}
              opciones={emisores.map((e) => ({
                clave: e.id,
                etiqueta: e.razonSocial,
                detalle: `${e.ruc}${e.ambiente === "PRUEBAS" ? " · pruebas" : ""}`,
              }))}
            />
          ) : emisor ? (
            <View style={styles.fijo}>
              <Text style={styles.label}>Emitir con</Text>
              <Text variant="bodyLarge" style={styles.valor}>
                {emisor.razonSocial} · {emisor.ruc}
              </Text>
            </View>
          ) : null}
          {emisor?.ambiente === "PRUEBAS" ? (
            <Text style={styles.aviso}>
              Este emisor está en el ambiente de pruebas del SRI: la factura se
              va a autorizar, pero no vale como comprobante ni le sirve al
              cliente.
            </Text>
          ) : null}

          <Titulo>Datos de facturación</Titulo>
          {datos.length > 0 ? (
            <SelectorOpcion
              label="A nombre de"
              valor={datoId}
              onElegir={setDatoId}
              placeholder="Elegir"
              opciones={datos.map((d) => ({
                clave: d.id,
                etiqueta: d.razonSocial,
                detalle: `${d.tipoIdentificacion === "RUC" ? "RUC" : "Cédula"} ${d.identificacion}`,
              }))}
            />
          ) : (
            <Text style={styles.ayuda}>
              Este cliente no tiene datos de facturación cargados.
            </Text>
          )}
          {nuevo === null ? (
            <PressableScale onPress={() => setNuevo(NUEVO_VACIO)} style={styles.enlace}>
              <Text style={styles.enlaceTexto}>
                {datos.length > 0 ? "Usar otros datos" : "Cargar datos de facturación"}
              </Text>
            </PressableScale>
          ) : (
            <View style={styles.nuevo}>
              <SelectorOpcion
                label="Identificación"
                valor={nuevo.tipoIdentificacion}
                onElegir={(v) =>
                  setNuevo({ ...nuevo, tipoIdentificacion: v as "CEDULA" | "RUC" })
                }
                opciones={[
                  { clave: "CEDULA", etiqueta: "Cédula" },
                  { clave: "RUC", etiqueta: "RUC" },
                ]}
              />
              <Campo
                label={nuevo.tipoIdentificacion === "RUC" ? "RUC" : "Cédula"}
                required
                value={nuevo.identificacion}
                onChangeText={(v) => setNuevo({ ...nuevo, identificacion: v })}
                keyboardType="number-pad"
              />
              <Campo
                label="Razón social"
                required
                value={nuevo.razonSocial}
                onChangeText={(v) => setNuevo({ ...nuevo, razonSocial: v })}
                autoCapitalize="words"
              />
              <SelectorOpcion
                label="Tipo"
                valor={nuevo.tipoPersona}
                onElegir={(v) =>
                  setNuevo({ ...nuevo, tipoPersona: v as "NATURAL" | "JURIDICA" })
                }
                opciones={[
                  { clave: "NATURAL", etiqueta: "Persona natural" },
                  { clave: "JURIDICA", etiqueta: "Persona jurídica" },
                ]}
              />
              <Campo
                label="Dirección"
                value={nuevo.direccion}
                onChangeText={(v) => setNuevo({ ...nuevo, direccion: v })}
              />
              <Campo
                label="Teléfono"
                value={nuevo.telefono}
                onChangeText={(v) => setNuevo({ ...nuevo, telefono: v })}
                keyboardType="phone-pad"
              />
              <Campo
                label="Correo"
                value={nuevo.email}
                onChangeText={(v) => setNuevo({ ...nuevo, email: v })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {/* Un dato "solo por esta vez" se guarda archivado: la factura lo
                  referencia, pero la ficha del cliente no se llena de casos
                  puntuales. */}
              <View style={styles.interruptor}>
                <Text variant="bodyMedium" style={styles.valor}>
                  Guardar en la ficha del cliente
                </Text>
                <Conmutador
                  value={nuevo.guardarEnFicha}
                  onValueChange={(v) => setNuevo({ ...nuevo, guardarEnFicha: v })}
                />
              </View>
              <View style={styles.botones}>
                <PressableScale
                  onPress={() => setNuevo(null)}
                  disabled={guardandoDato}
                  estiloExterno={styles.mitad}
                  style={styles.secundario}
                >
                  <Text style={styles.secundarioTexto}>Cancelar</Text>
                </PressableScale>
                <PressableScale
                  onPress={guardarNuevoDato}
                  disabled={guardandoDato}
                  estiloExterno={styles.mitad}
                  style={styles.primario}
                >
                  <Text style={styles.primarioTexto}>
                    {guardandoDato ? "Guardando…" : "Usar estos datos"}
                  </Text>
                </PressableScale>
              </View>
            </View>
          )}

          <Titulo>Qué se imprime</Titulo>
          <View style={styles.tarjeta}>
            {orden.lineas.map((l) => (
              <View key={l.id} style={styles.linea}>
                <View style={styles.lineaTexto}>
                  <Text variant="bodyMedium" style={styles.valor}>
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
            <View style={styles.totalFila}>
              <Text variant="bodyMedium" style={styles.apagado}>
                Total
              </Text>
              <Text variant="bodyMedium" style={styles.totalTexto}>
                {plata(orden.total)}
              </Text>
            </View>
          </View>
          <Text style={styles.ayuda}>
            Las líneas salen de la orden tal cual. Para juntarlas en una sola
            —&quot;servicio de mantenimiento&quot;— emite desde el portal.
          </Text>

          {bloqueo ? <Text style={styles.ayuda}>{bloqueo}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tema.fondo },
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  scroll: { padding: 16, paddingBottom: 40 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  subtitulo: { marginBottom: 4 },
  apagado: { color: tema.texto3 },
  label: { fontSize: 12, color: tema.texto3 },
  valor: { color: tema.texto },
  fijo: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 8,
    gap: 1,
  },
  aviso: {
    color: tema.ambarTexto,
    backgroundColor: tema.ambar50,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  ayuda: { color: tema.texto3, fontSize: 12, paddingHorizontal: 4, marginBottom: 8 },
  enlace: { alignSelf: "flex-start", paddingHorizontal: 4, paddingVertical: 6 },
  enlaceTexto: { color: tema.verde700, fontWeight: "600" },
  nuevo: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
    gap: 2,
  },
  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  botones: { flexDirection: "row", gap: 10, marginTop: 6 },
  mitad: { flex: 1 },
  secundario: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  secundarioTexto: { color: tema.texto2, fontWeight: "600" },
  primario: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: tema.verde,
  },
  primarioTexto: { color: "#fff", fontWeight: "600" },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 6,
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
  lineaTotal: { color: tema.texto, fontWeight: "600" },
  totalFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  totalTexto: { color: tema.texto, fontWeight: "700" },
  error: { color: tema.rojo, textAlign: "center", paddingVertical: 10 },
});
