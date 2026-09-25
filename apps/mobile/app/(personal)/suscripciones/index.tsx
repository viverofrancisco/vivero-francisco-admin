import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ESTADO_SUSCRIPCION_LABEL,
  PERIODICIDAD_LABEL,
  fechaSola,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  FILA_LISTA,
  PantallaLista,
  type GrupoDeFiltro,
} from "@/components/ui/PantallaLista";
import type { SuscripcionListItem } from "@/lib/types";
import { tema } from "@/lib/tema";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** El color de cada estado del plan. */
const COLOR_ESTADO: Record<string, { texto: string; fondo: string }> = {
  ACTIVO: { texto: tema.verde700, fondo: tema.verde50 },
  PAUSADO: { texto: tema.ambarTexto, fondo: tema.ambar50 },
  CANCELADO: { texto: tema.texto2, fondo: tema.linea2 },
};

/** Cuántos meses abarca cada período, para el equivalente mensual. */
const MESES: Record<string, number> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/**
 * Los planes: la misma lista que el portal muestra en el teléfono.
 *
 * Se filtra acá y no en el servidor, como allá: la lista no viene de a
 * páginas —son decenas, no miles— y abre en las activas, que es lo que se
 * viene a mirar. El ⋯ tiene lo que la pantalla puede hacer: crear un plan y
 * generar las órdenes de los períodos vencidos, que es lo que hace el cron
 * cada noche.
 */
export default function SuscripcionesListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SuscripcionListItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("ACTIVO");
  const [pendientes, setPendientes] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: SuscripcionListItem[] }>(
        "/api/mobile/suscripciones"
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las suscripciones"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  /**
   * Lo mismo que hace el cron todas las noches, a pedido. Idempotente:
   * apretarlo de más no duplica nada.
   */
  async function generarOrdenes() {
    setGenerando(true);
    try {
      const r = await apiRequest<{ creadas: number }>(
        "/api/mobile/suscripciones/renovar",
        { method: "POST" }
      );
      setError(
        r.creadas === 0
          ? "No había períodos por generar."
          : `${r.creadas} ${r.creadas === 1 ? "orden creada" : "órdenes creadas"} en borrador.`
      );
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos generar las órdenes"));
    } finally {
      setGenerando(false);
    }
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (s) =>
        (!estado || s.estado === estado) &&
        (!pendientes || s.periodosPendientes > 0) &&
        (!q ||
          String(s.numero).includes(q) ||
          s.cliente.nombre.toLowerCase().includes(q) ||
          s.propiedad.nombre.toLowerCase().includes(q))
    );
  }, [items, busqueda, estado, pendientes]);

  // Lo que factura por mes el conjunto visible, normalizando cada periodicidad.
  const mensualizado = visibles
    .filter((s) => s.estado === "ACTIVO")
    .reduce((acc, s) => acc + s.totalPeriodo / (MESES[s.periodicidad] ?? 1), 0);

  const conPendientes = items.filter((s) => s.periodosPendientes > 0).length;

  const grupos: GrupoDeFiltro[] = [
    {
      id: "estado",
      titulo: "Estado",
      valor: estado,
      onElegir: setEstado,
      opciones: [
        { clave: "", etiqueta: "Todas" },
        { clave: "ACTIVO", etiqueta: "Activas" },
        { clave: "PAUSADO", etiqueta: "Pausadas" },
        { clave: "CANCELADO", etiqueta: "Canceladas" },
      ],
    },
    // Con el cron sano no hay ninguna, y un filtro que nunca encuentra nada
    // solo ocupa lugar. Se muestra igual si está prendido, para poder apagarlo.
    ...(conPendientes > 0 || pendientes
      ? [
          {
            id: "pendientes",
            titulo: "Períodos sin orden",
            valor: pendientes,
            onElegir: setPendientes,
            opciones: [
              { clave: "", etiqueta: "Todas" },
              { clave: "1", etiqueta: `Con períodos sin orden (${conPendientes})` },
            ],
          },
        ]
      : []),
  ];

  return (
    <PantallaLista
      titulo="Suscripciones"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por cliente o propiedad..."
      grupos={grupos}
      acciones={[
        {
          etiqueta: "Nueva suscripción",
          onPress: () => router.push("/(personal)/suscripciones/nueva"),
        },
        ...(conPendientes > 0 && !generando
          ? [{ etiqueta: "Generar órdenes", onPress: generarOrdenes }]
          : []),
      ]}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
          }
          ListHeaderComponent={
            <>
              {error ? <Text style={styles.aviso}>{error}</Text> : null}
              {/* El número que resume la pantalla entera, pegado arriba de
                  la lista como en el portal en móvil. */}
              {mensualizado > 0 ? (
                <Text style={styles.mensual}>
                  Equivalente mensual:{" "}
                  <Text style={styles.mensualNumero}>{plata(mensualizado)}</Text>
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {busqueda || estado || pendientes
                  ? "Sin coincidencias"
                  : "No hay suscripciones"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                Un plan es un precio por período para mantener una propiedad.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = COLOR_ESTADO[item.estado] ?? COLOR_ESTADO.CANCELADO;
            return (
              <PressableScale
                onPress={() => router.push(`/(personal)/suscripciones/${item.id}`)}
                style={FILA_LISTA}
              >
                <View style={styles.filaTexto}>
                  <Text variant="bodyLarge" style={styles.cliente} numberOfLines={1}>
                    <Text style={styles.numero}>#{item.numero}</Text>{" "}
                    {item.cliente.nombre}
                  </Text>
                  <Text variant="bodySmall" style={styles.donde} numberOfLines={1}>
                    {item.propiedad.nombre}
                  </Text>
                  <Text variant="bodySmall" style={styles.donde} numberOfLines={1}>
                    {PERIODICIDAD_LABEL[item.periodicidad] ?? item.periodicidad}
                    {" · "}
                    {plata(item.totalPeriodo)}
                    {" · "}
                    {item.visitasPorPeriodo} visita
                    {item.visitasPorPeriodo === 1 ? "" : "s"}
                    {" · desde "}
                    {fechaSola(item.fechaInicio, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                  {item.periodosPendientes > 0 ? (
                    <Text variant="bodySmall" style={styles.pendiente}>
                      {item.periodosPendientes} período
                      {item.periodosPendientes === 1 ? "" : "s"} sin orden
                    </Text>
                  ) : null}
                </View>
                <View style={styles.derecha}>
                  <View style={[styles.pastilla, { backgroundColor: color.fondo }]}>
                    <Text style={[styles.pastillaTexto, { color: color.texto }]}>
                      {ESTADO_SUSCRIPCION_LABEL[item.estado] ?? item.estado}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  filaTexto: { flex: 1, gap: 2 },
  numero: { color: tema.texto2, fontWeight: "700" },
  cliente: { color: tema.texto, fontWeight: "700" },
  donde: { color: tema.texto3 },
  pendiente: { color: tema.ambarTexto, fontWeight: "600" },
  derecha: { flexDirection: "row", alignItems: "center", gap: 6 },
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pastillaTexto: { fontSize: 11, fontWeight: "600" },
  mensual: {
    color: tema.texto3,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mensualNumero: { color: tema.texto, fontWeight: "700" },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center", paddingHorizontal: 24 },
  aviso: { color: tema.texto2, textAlign: "center", padding: 12 },
});
