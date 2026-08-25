import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { nombreCliente, nombrePersona } from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteStaffDetail } from "@/lib/types";

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "ADMIN" || role === "PERSONAL_ADMIN";
  const [data, setData] = useState<ClienteStaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<ClienteStaffDetail>(
        `/api/mobile/clientes/${id}`
      );
      setData(res);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos cargar el cliente"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text variant="bodyMedium" style={styles.muted}>
          {error ?? "Cliente no encontrado"}
        </Text>
      </View>
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
  const direccion = [data.direccion, data.numeroCasa, data.ciudad]
    .filter(Boolean)
    .join(", ");
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
          {data.empresa && tienePersona ? (
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              {data.empresa}
            </Text>
          ) : null}
          {data.sector?.nombre ? (
            <Text variant="bodyMedium" style={styles.heroSubtitle}>
              {data.sector.nombre}
            </Text>
          ) : null}
        </View>
        {canEdit ? (
          <Button
            mode="text"
            compact
            onPress={() => router.push(`/(personal)/clientes/editar/${id}`)}
          >
            Editar
          </Button>
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

      {/* Dirección */}
      {direccion || data.referencia || data.metrosCuadrados ? (
        <Section title="Dirección">
          {direccion ? <Row label="Calle" value={direccion} /> : null}
          {data.referencia ? (
            <Row label="Referencia" value={data.referencia} />
          ) : null}
          {data.metrosCuadrados ? (
            <Row label="Metros²" value={String(data.metrosCuadrados)} />
          ) : null}
        </Section>
      ) : null}

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
    color: "#2e7d32",
    fontWeight: "600",
    fontSize: 20,
  },
  heroText: { flex: 1, gap: 2 },
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
  },

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
  servicioPrecio: { color: "#2e7d32", fontWeight: "600" },

  muted: { color: "#888" },
});
