import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Dialog, Portal, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fechaSola, nombreCliente, resumenDePropiedades, textoPlanoDeHtml } from "@vivero/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import { MiniaturaDePdf, VisorDePdf } from "@/components/informes/VisorDePdf";
import { tema } from "@/lib/tema";

/** Lo que devuelve `GET /api/mobile/informes/[id]`: la ficha del portal. */
export interface InformeDetail {
  id: string;
  numero: number;
  versionActual: number;
  titulo: string;
  encabezado: string | null;
  /** La fecha impresa, `YYYY-MM-DD`. */
  fecha: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  generadoPor: string | null;
  actualizadoEl: string | null;
  actualizadoPor: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa: string | null;
  };
  visitasCount: number;
  visitas: {
    id: string;
    numero: number;
    estado: string;
    fecha: string;
    propiedad: string | null;
  }[];
  /** En qué propiedades pasó. Sale de las visitas; vacío si no cubre ninguna. */
  propiedades: string[];
  firmantes: { nombre: string; cedula: string | null }[];
  secciones: {
    tareaId: string | null;
    titulo: string;
    descripcion: string;
    saltoDePagina: boolean;
    fotosPorFila: 2 | 3 | 4 | 5 | 6;
    fotosAlineacion: "IZQUIERDA" | "CENTRO" | "DERECHA";
    fotos: { visitaMediaId: string | null; mediaId: string | null; url: string }[];
  }[];
}

/**
 * La ficha del informe: la miniatura del PDF con lo esencial al lado, los
 * datos, las secciones, los firmantes y las visitas —lo que muestra la del
 * portal—, y en el ⋯ editar, ver el PDF y eliminar. Editar abre el mismo
 * asistente con el que se creó, cargado con el informe.
 */
export default function InformeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<InformeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viendoPdf, setViendoPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiRequest<InformeDetail>(`/api/mobile/informes/${id}`));
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar el informe"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiRequest(`/api/mobile/informes/${id}`, { method: "DELETE" });
      setConfirmOpen(false);
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos eliminar el informe"));
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "No encontrado"}</Text>
        <Button onPress={() => router.back()}>Volver</Button>
      </View>
    );
  }

  const generado = `${data.generadoPor ? `${data.generadoPor} · ` : ""}${fechaYHora(data.generatedAt)}`;

  return (
    <View style={styles.pantalla}>
      {/* El mismo encabezado que la ficha de la visita: la flecha, el nombre
          del cliente en grande y el ⋯ con lo que se hace con el informe. */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} hitSlop={8} style={styles.volver}>
          <Ionicons name="chevron-back" size={24} color={tema.texto} />
        </PressableScale>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.heroTitulo} numberOfLines={2}>
            {nombreCliente(data.cliente)}
          </Text>
        </View>
        <MenuDeEncabezado
          opciones={[
            {
              etiqueta: "Editar informe",
              onPress: () =>
                router.push({ pathname: "/(personal)/informes/nuevo", params: { id: data.id } }),
            },
            { etiqueta: "Ver PDF", onPress: () => setViendoPdf(true) },
            { etiqueta: "Eliminar informe", onPress: () => setConfirmOpen(true) },
          ]}
        />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* La miniatura y, al lado, lo que identifica al informe. Tocar la
            tarjeta abre el PDF. */}
        <Pressable
          onPress={() => setViendoPdf(true)}
          style={({ pressed }) => [styles.tarjeta, styles.portada, pressed && styles.tocado]}
          accessibilityRole="button"
          accessibilityLabel="Ver el PDF"
        >
          <MiniaturaDePdf url={data.pdfUrl} />
          <View style={styles.portadaTexto}>
            <Text style={styles.portadaTitulo}>
              Informe #{data.numero}
              {data.versionActual > 1 ? ` · v${data.versionActual}` : ""}
            </Text>
            <Text style={styles.portadaLinea} numberOfLines={2}>
              {data.titulo}
            </Text>
            <Text style={styles.portadaDetalle}>
              Fecha impresa: {fechaSola(data.fecha, { day: "numeric", month: "long", year: "numeric" })}
            </Text>
            <Text style={styles.portadaDetalle} numberOfLines={2}>
              Generado: {generado}
            </Text>
            {data.actualizadoEl ? (
              <Text style={styles.portadaDetalle} numberOfLines={2}>
                Actualizado: {data.actualizadoPor ? `${data.actualizadoPor} · ` : ""}
                {fechaYHora(data.actualizadoEl)}
              </Text>
            ) : null}
            <View style={styles.verPdf}>
              <Ionicons name="document-text-outline" size={16} color={tema.verde700} />
              <Text style={styles.verPdfTexto}>Ver PDF</Text>
            </View>
          </View>
        </Pressable>

        {/* Las visitas: el período y las propiedades que salen de ellas, y
            debajo cada una, para saltar a su ficha. Sin visitas, se dice. */}
        <Seccion rotulo={`Visitas (${data.visitas.length})`}>
          {data.fechaDesde && data.fechaHasta ? (
            <Fila label="Período" value={formatRange(data.fechaDesde, data.fechaHasta)} />
          ) : null}
          {data.propiedades.length > 0 ? (
            <Fila
              label={data.propiedades.length === 1 ? "Propiedad" : "Propiedades"}
              value={resumenDePropiedades(data.propiedades) ?? ""}
            />
          ) : null}
          {data.visitas.length === 0 ? (
            <Text style={styles.vacio}>Este informe no cubre ninguna visita.</Text>
          ) : null}
          {data.visitas.map((v, i) => (
            <Pressable
              key={v.id}
              onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
              style={({ pressed }) => [
                styles.filaLista,
                i === data.visitas.length - 1 && styles.filaUltima,
                pressed && styles.tocado,
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={20} color={tema.texto3} />
              <View style={{ flex: 1 }}>
                <Text style={styles.filaTitulo}>
                  Visita #{v.numero} · {fechaSola(v.fecha, { day: "numeric", month: "short", year: "numeric" })}
                </Text>
                {v.propiedad ? <Text style={styles.filaDetalle}>{v.propiedad}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </Pressable>
          ))}
        </Seccion>

        <Seccion rotulo={`Secciones (${data.secciones.length})`}>
          {data.secciones.map((s, i) => (
            <View key={i} style={[styles.filaLista, i === data.secciones.length - 1 && styles.filaUltima]}>
              <View style={styles.numero}>
                <Text style={styles.numeroTexto}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.filaTitulo} numberOfLines={1}>
                  {textoPlanoDeHtml(s.titulo) || "Sin título"}
                </Text>
                <Text style={styles.filaDetalle} numberOfLines={1}>
                  {s.fotos.length === 1 ? "1 foto" : `${s.fotos.length} fotos`}
                  {s.descripcion ? ` · ${textoPlanoDeHtml(s.descripcion)}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </Seccion>

        {data.firmantes.length > 0 ? (
          <Seccion rotulo="Firmantes">
            {data.firmantes.map((f, i) => (
              <View key={i} style={[styles.filaLista, i === data.firmantes.length - 1 && styles.filaUltima]}>
                <Ionicons name="person-outline" size={20} color={tema.texto3} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.filaTitulo}>{f.nombre}</Text>
                  {f.cedula ? <Text style={styles.filaDetalle}>{f.cedula}</Text> : null}
                </View>
              </View>
            ))}
          </Seccion>
        ) : null}

        <Portal>
          <Dialog visible={confirmOpen} onDismiss={() => !deleting && setConfirmOpen(false)}>
            <Dialog.Title>Eliminar informe</Dialog.Title>
            <Dialog.Content>
              <Text>¿Seguro que quieres eliminar este informe? El PDF también será eliminado.</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setConfirmOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button onPress={handleDelete} loading={deleting} textColor="#c62828">
                Eliminar
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
      {viendoPdf ? (
        <VisorDePdf
          url={data.pdfUrl}
          titulo={`Informe #${data.numero}`}
          onCerrar={() => setViendoPdf(false)}
        />
      ) : null}
    </View>
  );
}

/** Un bloque de la ficha: el rótulo en versalitas y el cuerpo blanco redondeado. */
function Seccion({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.rotulo}>{rotulo.toUpperCase()}</Text>
      <View style={styles.tarjeta}>{children}</View>
    </View>
  );
}

function Fila({ label, value, ultima = false }: { label: string; value: string; ultima?: boolean }) {
  return (
    <View style={[styles.fila, ultima && styles.filaUltima]}>
      <Text style={styles.filaLabel}>{label}</Text>
      <Text style={styles.filaValor} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function fechaYHora(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(fromIso: string, toIso: string): string {
  const fmt = (iso: string) => fechaSola(iso, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(fromIso)} — ${fmt(toIso)}`;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { color: "#c62828", textAlign: "center" },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  volver: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  encabezadoTexto: { flex: 1 },
  heroTitulo: { fontSize: 22, fontWeight: "700", color: tema.texto },
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 40, gap: 14 },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
  },
  tocado: { opacity: 0.7 },
  portada: { flexDirection: "row", gap: 14, padding: 12 },
  portadaTexto: { flex: 1, gap: 4 },
  portadaTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  portadaLinea: { fontSize: 13, color: tema.texto2 },
  portadaDetalle: { fontSize: 12, color: tema.texto3 },
  verPdf: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: "auto" },
  verPdfTexto: { color: tema.verde700, fontWeight: "600", fontSize: 13 },
  seccion: { gap: 6 },
  rotulo: { fontSize: 11, letterSpacing: 0.8, color: tema.texto3, paddingHorizontal: 4 },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  filaUltima: { borderBottomWidth: 0 },
  vacio: { color: tema.texto3, fontSize: 13, paddingHorizontal: 14, paddingVertical: 12 },
  filaLabel: { color: tema.texto2, fontSize: 14 },
  filaValor: { color: tema.texto, fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  filaLista: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  filaTitulo: { fontSize: 15, color: tema.texto, fontWeight: "500" },
  filaDetalle: { fontSize: 13, color: tema.texto3, marginTop: 2 },
  numero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  numeroTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
