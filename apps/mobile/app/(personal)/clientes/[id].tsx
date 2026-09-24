import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
} from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { nombreCliente, nombrePersona } from "@vivero/shared";
import { PressableScale } from "@/components/ui/PressableScale";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteStaffDetail } from "@/lib/types";
import { tema } from "@/lib/tema";

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "ADMIN" || role === "STAFF";
  const [data, setData] = useState<ClienteStaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  /** Lo que tiró la carga, tal cual: la pantalla dice si fue acceso, borrado o señal. */
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (silencioso = false) => {
    if (!id) return;
    if (!silencioso) setLoading(true);
    try {
      const res = await apiRequest<ClienteStaffDetail>(
        `/api/mobile/clientes/${id}`
      );
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * Inactivo: no se le agendan visitas y sale atenuado en los selectores,
   * con todo su historial en su lugar. Reactivar es lo mismo al revés.
   */
  async function cambiarActividad(inactivo: boolean) {
    try {
      await apiRequest(`/api/mobile/clientes/${id}/inactivo`, {
        method: "POST",
        body: JSON.stringify({ inactivo }),
      });
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(mensajeDeError(e, "No se pudo guardar")));
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Al volver de agregar o editar una propiedad, la ficha tiene que mostrarla.
   * En silencio: prender el spinner en cada foco haría parpadear la pantalla
   * entera por una fila que cambió.
   */
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <AvisoDeCarga
        error={error}
        tipo="cliente"
        onVolver={() => router.back()}
        onReintentar={() => load()}
      />
    );
  }

  const displayName = nombreCliente(data);
  const tienePersona = nombrePersona(data).length > 0;
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  // El detalle ya excluye las canceladas; se muestran activas y pausadas.
  const suscripcionesVisibles = data.suscripciones;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "?"}</Text>
        </View>
        <View style={styles.heroText}>
          <Text variant="headlineSmall" style={styles.heroTitle}>
            {displayName}
          </Text>
          {data.inactivoDesde ? (
            <View style={styles.inactivo}>
              <Text style={styles.inactivoTexto}>Inactivo</Text>
            </View>
          ) : null}
          {data.empresa && tienePersona ? (
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              {data.empresa}
            </Text>
          ) : null}
          {data.propiedades[0]?.sector?.nombre ? (
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              {data.propiedades[0].sector.nombre}
            </Text>
          ) : null}
        </View>
        {canEdit ? (
          <View style={styles.acciones}>
            <Button
              mode="text"
              compact
              onPress={() => router.push(`/(personal)/clientes/editar/${id}`)}
            >
              Editar
            </Button>
            {/* Lo que se hace una vez por cliente va detrás del ⋯. */}
            <MenuDeEncabezado
              opciones={[
                {
                  etiqueta: data.inactivoDesde ? "Reactivar cliente" : "Marcar como inactivo",
                  onPress: () => cambiarActividad(!data.inactivoDesde),
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      {/* Contacto */}
      {data.telefono || data.email ? (
        <Section title="Contacto">
          {data.telefono ? (
            <Row label="Teléfono" value={data.telefono} />
          ) : null}
          {data.email ? <Row label="Email" value={data.email} /> : null}
        </Section>
      ) : null}

      {/* Dónde se le trabaja. Una tarjeta por propiedad, porque un cliente
          puede tener varias y ninguna es más "la suya" que otra. */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            PROPIEDADES
          </Text>
          {canEdit ? (
            <Button
              mode="text"
              compact
              style={styles.sectionAction}
              onPress={() =>
                router.push({
                  pathname: "/(personal)/clientes/propiedades/nueva",
                  params: { clienteId: id },
                })
              }
            >
              Agregar
            </Button>
          ) : null}
        </View>

        {data.propiedades.length === 0 ? (
          <HelperText type="info" visible style={styles.muted}>
            Sin propiedades. Agrega una para poder agendarle visitas.
          </HelperText>
        ) : (
          data.propiedades.map((p) => {
            const filas: { label: string; value: string }[] = [];
            const direccion = [p.direccion, p.numeroCasa, p.ciudad]
              .filter(Boolean)
              .join(", ");
            if (direccion) filas.push({ label: "Dirección", value: direccion });
            if (p.sector) filas.push({ label: "Sector", value: p.sector.nombre });
            if (p.referencia)
              filas.push({ label: "Referencia", value: p.referencia });
            if (p.m2Total)
              filas.push({ label: "Metros²", value: String(p.m2Total) });
            if (p.m2Cesped)
              filas.push({ label: "Césped", value: `${p.m2Cesped} m²` });
            if (p.numeroArboles)
              filas.push({ label: "Árboles", value: String(p.numeroArboles) });

            const cuerpo = (
              <>
                <View style={styles.propiedadHeader}>
                  <Text variant="bodyLarge" style={styles.propiedadNombre}>
                    {p.nombre}
                  </Text>
                  {canEdit ? (
                    <Text style={styles.propiedadChevron}>›</Text>
                  ) : null}
                </View>
                {filas.map((f, i) => (
                  <View key={f.label}>
                    {i === 0 ? null : <View style={styles.rowDivider} />}
                    <Row label={f.label} value={f.value} />
                  </View>
                ))}
                {filas.length === 0 ? (
                  <Text style={[styles.muted, styles.propiedadVacia]}>
                    Sin dirección ni medidas todavía.
                  </Text>
                ) : null}
              </>
            );

            /* Toda la tarjeta abre la propiedad: un lápiz en la esquina gasta
               espacio permanente en algo que además es más chico que el dedo. */
            return canEdit ? (
              <PressableScale
                key={p.id}
                onPress={() =>
                  router.push({
                    pathname: "/(personal)/clientes/propiedades/[propiedadId]",
                    params: { propiedadId: p.id, clienteId: id },
                  })
                }
                style={styles.sectionContent}
              >
                {cuerpo}
              </PressableScale>
            ) : (
              <View key={p.id} style={styles.sectionContent}>
                {cuerpo}
              </View>
            );
          })
        )}
      </View>

      {/* Notas */}
      {data.notas ? (
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            NOTAS
          </Text>
          <View style={styles.notasBox}>
            <Text variant="bodyMedium" style={styles.notasText}>
              {data.notas}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Suscripciones — solo lectura: se arman desde el portal. */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            SUSCRIPCIONES
          </Text>
        </View>
        {suscripcionesVisibles.length === 0 ? (
          <HelperText type="info" visible style={styles.muted}>
            Sin suscripciones activas.
          </HelperText>
        ) : (
          <View style={styles.serviciosList}>
            {suscripcionesVisibles.map((sus) => (
              <View key={sus.id}>
                <Text variant="labelSmall" style={styles.muted}>
                  {formatPeriodicidad(sus.periodicidad)}
                  {sus.estado !== "ACTIVO" ? ` · ${sus.estado}` : ""}
                </Text>
                {sus.items.map((item) => (
                  <View key={item.id} style={styles.servicioRow}>
                    <View style={styles.servicioText}>
                      <Text variant="bodyLarge" style={styles.servicioTitle}>
                        {item.producto.nombre}
                      </Text>
                      <Text variant="bodySmall" style={styles.muted}>
                        {item.visitasPorPeriodo
                          ? `${item.visitasPorPeriodo}${sufijoPeriodo(sus.periodicidad)}`
                          : "Sin visitas declaradas"}
                      </Text>
                    </View>
                    <Text variant="bodyMedium" style={styles.servicioPrecio}>
                      ${formatPrice(item.precio)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text variant="labelMedium" style={styles.sectionLabel}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const PERIODICIDAD_LABELS: Record<string, string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

function formatPeriodicidad(p: string): string {
  return PERIODICIDAD_LABELS[p] ?? p;
}

const PERIODICIDAD_SUFIJOS: Record<string, string> = {
  MENSUAL: "/mes",
  TRIMESTRAL: "/trimestre",
  SEMESTRAL: "/semestre",
  ANUAL: "/año",
};

/** Las visitas incluidas se cuentan por período de cobro, no por mes. */
function sufijoPeriodo(p: string): string {
  return PERIODICIDAD_SUFIJOS[p] ?? "";
}

function formatPrice(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: tema.verde,
    fontWeight: "600",
    fontSize: 20,
  },
  heroText: { flex: 1, gap: 2 },
  acciones: { flexDirection: "row", alignItems: "center", gap: 6 },
  inactivo: {
    alignSelf: "flex-start",
    backgroundColor: tema.lienzo,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  inactivoTexto: { fontSize: 11, fontWeight: "600", color: tema.texto2 },
  heroTitle: { color: "#111", fontWeight: "700" },
  heroSubtitle: { color: "#777" },

  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionAction: { marginRight: -8 },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },

  propiedadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  propiedadNombre: { color: "#111", fontWeight: "600", flexShrink: 1 },
  propiedadChevron: { fontSize: 22, color: "#bbb" },
  propiedadVacia: { paddingBottom: 12 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
  },

  notasBox: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 14,
  },
  notasText: { color: "#222", lineHeight: 22 },

  serviciosList: { gap: 6 },
  servicioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    gap: 12,
  },
  servicioText: { flex: 1, gap: 2 },
  servicioTitle: { color: "#111", fontWeight: "500" },
  servicioPrecio: { color: tema.verde, fontWeight: "600" },

  muted: { color: "#888" },
});
