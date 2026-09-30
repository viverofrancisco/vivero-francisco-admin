import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado, type OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { Fila, Seccion, estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { PastillasDeEmisor } from "@/components/facturacion/PastillasDeEmisor";
import { HojaDeCertificado } from "@/components/facturacion/HojaDeCertificado";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { EmisorConfig } from "@/lib/types";
import { tema } from "@/lib/tema";

interface ResultadoPrueba {
  estado: string;
  numero: string;
  claveAcceso: string;
  mensajes: { identificador?: string; mensaje?: string; informacionAdicional?: string }[];
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Faltan menos de 30 días: hay que renovar antes de quedarse sin facturar. */
const porVencer = (iso: string) => new Date(iso).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

/**
 * La ficha de un emisor, de solo lectura como las demás: sus datos, la firma
 * —que es lo que separa "configurado" de "puede emitir"— y, en pruebas, el
 * resultado de la última factura de prueba. En el ⋯: *Editar*, *Cargar* o
 * *Reemplazar firma*, *Emitir prueba* (solo en pruebas: en producción sería
 * una factura de verdad) y *Eliminar*.
 */
export default function EmisorFichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [emisor, setEmisor] = useState<EmisorConfig | null>(null);
  const [cifradoListo, setCifradoListo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargandoFirma, setCargandoFirma] = useState(false);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await apiRequest<{ items: EmisorConfig[]; cifradoListo: boolean }>(
        "/api/mobile/configuracion/emisores"
      );
      setEmisor(r.items.find((e) => e.id === id) ?? null);
      setCifradoListo(r.cifradoListo);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos cargar el emisor"));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  async function probar() {
    setOcupado(true);
    setAviso(null);
    try {
      setPrueba(
        await apiRequest<ResultadoPrueba>(`/api/mobile/configuracion/emisores/${id}/probar`, {
          method: "POST",
        })
      );
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos emitir la prueba"));
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    setOcupado(true);
    try {
      await apiRequest(`/api/mobile/configuracion/emisores/${id}`, { method: "DELETE" });
      router.back();
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos eliminarlo"));
      setConfirmandoBorrar(false);
    } finally {
      setOcupado(false);
    }
  }

  if (cargando && !emisor) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Emisor" />
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }
  if (!emisor) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Emisor" />
        <View style={styles.centro}>
          <Text style={styles.apagado}>{aviso ?? "Este emisor ya no existe."}</Text>
        </View>
      </View>
    );
  }

  const opciones: OpcionDeMenu[] = [
    { etiqueta: "Editar", onPress: () => router.push(`/(personal)/facturacion/editar/${id}`) },
  ];
  if (cifradoListo) {
    opciones.push({
      etiqueta: emisor.certificadoSujeto ? "Reemplazar firma" : "Cargar firma",
      onPress: () => setCargandoFirma(true),
    });
  }
  if (emisor.ambiente === "PRUEBAS" && emisor.certificadoSujeto) {
    opciones.push({ etiqueta: "Emitir prueba", onPress: () => void probar() });
  }
  opciones.push({ etiqueta: "Eliminar", onPress: () => setConfirmandoBorrar(true) });

  return (
    <View style={styles.flex}>
      <EncabezadoDeFicha
        titulo={emisor.razonSocial}
        derecha={<MenuDeEncabezado opciones={opciones} />}
      />
      <ScrollView style={styles.flex} contentContainerStyle={estilosDeFicha.container}>
        <View style={styles.pastillas}>
          <PastillasDeEmisor emisor={emisor} />
        </View>
        {aviso ? <Text style={styles.error}>{aviso}</Text> : null}
        {hecho ? <Text style={styles.hecho}>{hecho}</Text> : null}
        {ocupado ? <ActivityIndicator style={styles.ocupado} /> : null}

        {prueba ? (
          <View
            style={[
              styles.prueba,
              prueba.estado === "AUTORIZADO" ? styles.pruebaBien : styles.pruebaMal,
            ]}
          >
            <Text style={styles.pruebaTitulo}>
              {prueba.estado} · {prueba.numero}
            </Text>
            <Text style={styles.pruebaClave} selectable>
              {prueba.claveAcceso}
            </Text>
            {prueba.mensajes.map((m, i) => (
              <Text key={i} style={styles.pruebaMensaje}>
                {m.identificador ? `${m.identificador} · ` : ""}
                {m.mensaje}
                {m.informacionAdicional ? ` — ${m.informacionAdicional}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        <Seccion titulo="Firma electrónica">
          {emisor.certificadoSujeto ? (
            <>
              <Fila label="Titular" value={emisor.certificadoSujeto} />
              {emisor.certificadoVence ? (
                <Fila
                  label="Vence"
                  value={
                    <Text style={porVencer(emisor.certificadoVence) ? styles.porVencer : undefined}>
                      {fecha(emisor.certificadoVence)}
                    </Text>
                  }
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.sinFirma}>
              Sin firma electrónica: este RUC todavía no puede emitir.
            </Text>
          )}
        </Seccion>

        <Seccion titulo="Datos">
          <Fila label="RUC" value={emisor.ruc} />
          <Fila label="Nombre comercial" value={emisor.nombreComercial || "—"} />
          <Fila label="Serie" value={`${emisor.establecimiento}-${emisor.puntoEmision}`} />
          <Fila label="Matriz" value={emisor.dirMatriz} />
          <Fila label="Establecimiento" value={emisor.direccionEstablecimiento || "—"} />
          <Fila label="Obligado a llevar contabilidad" value={emisor.obligadoContabilidad ? "Sí" : "No"} />
          <Fila label="Contribuyente especial" value={emisor.contribuyenteEspecial || "—"} />
          <Fila label="Agente de retención" value={emisor.agenteRetencion || "—"} />
          <Fila label="Facturas emitidas" value={String(emisor.facturas)} />
        </Seccion>
      </ScrollView>

      <HojaDeCertificado
        emisor={cargandoFirma ? emisor : null}
        onCerrar={() => setCargandoFirma(false)}
        onCargado={(sujeto) => {
          setCargandoFirma(false);
          setAviso(null);
          setHecho(`Firma cargada: ${sujeto}`);
          void cargar();
        }}
      />

      <DialogoConfirmar
        visible={confirmandoBorrar}
        titulo={`¿Eliminar ${emisor.razonSocial}?`}
        detalle={
          emisor.facturas > 0
            ? `Ya emitió ${emisor.facturas} factura${emisor.facturas === 1 ? "" : "s"}, así que no se puede borrar. Desactívalo para dejar de usarlo.`
            : "Se borra la configuración y su certificado. No se puede deshacer."
        }
        confirmar="Eliminar"
        peligro
        cargando={ocupado}
        onConfirmar={() => void borrar()}
        onCancelar={() => setConfirmandoBorrar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  apagado: { color: tema.texto3, textAlign: "center" },
  pastillas: { paddingBottom: 4 },
  error: { color: tema.rojo, textAlign: "center", paddingVertical: 8 },
  ocupado: { paddingVertical: 8 },
  hecho: { color: tema.verde700, textAlign: "center", paddingVertical: 8 },
  sinFirma: { color: tema.ambarTexto, fontSize: 14, paddingVertical: 10 },
  porVencer: { color: tema.ambarTexto, fontWeight: "600" },
  prueba: { borderRadius: 12, padding: 12, gap: 4, marginTop: 8 },
  pruebaBien: { backgroundColor: tema.verde50 },
  pruebaMal: { backgroundColor: tema.ambar50 },
  pruebaTitulo: { fontWeight: "700", color: tema.texto },
  pruebaClave: { fontSize: 11, fontFamily: "Menlo", color: tema.texto2 },
  pruebaMensaje: { fontSize: 13, color: tema.texto2 },
});
