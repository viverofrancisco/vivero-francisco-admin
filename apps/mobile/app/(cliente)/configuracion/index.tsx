import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Text,
} from "react-native-paper";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";
import type { ClienteProfileResponse } from "@/lib/types";

export default function ClienteConfiguracionScreen() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const branding = useBranding();
  const [data, setData] = useState<ClienteProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const profile = await apiRequest<ClienteProfileResponse>(
        "/api/mobile/clientes/me"
      );
      setData(profile);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  async function logout() {
    setLoggingOut(true);
    if (refreshToken) {
      apiRequest("/api/mobile/auth/logout", {
        method: "POST",
        body: { refreshToken },
        authenticated: false,
      }).catch(() => {});
    }
    await clear();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const cliente = data?.cliente;
  const initials = cliente
    ? `${cliente.nombre[0] ?? ""}${cliente.apellido?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load()} />
      }
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          {cliente
            ? `${cliente.nombre} ${cliente.apellido ?? ""}`.trim()
            : "Mi cuenta"}
        </Text>
        {cliente?.sector?.nombre ? (
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            {cliente.sector.nombre}
          </Text>
        ) : null}
      </View>

      {/* Datos */}
      {cliente?.telefono || cliente?.direccion ? (
        <Section title="Datos de contacto">
          {cliente?.telefono ? (
            <Row label="Teléfono" value={cliente.telefono} />
          ) : null}
          {cliente?.direccion ? (
            <Row
              label="Dirección"
              value={
                cliente.ciudad
                  ? `${cliente.direccion}, ${cliente.ciudad}`
                  : cliente.direccion
              }
            />
          ) : null}
        </Section>
      ) : null}

      {/* Sesión */}
      <Button
        mode="contained"
        onPress={logout}
        loading={loggingOut}
        disabled={loggingOut}
        buttonColor="#c62828"
        textColor="#fff"
        style={styles.logoutBtn}
        contentStyle={styles.logoutContent}
        labelStyle={styles.logoutLabel}
      >
        Cerrar sesión
      </Button>

      {branding.logoUrl ? (
        <Image
          source={{ uri: branding.logoUrl }}
          style={styles.footerLogo}
          resizeMode="contain"
        />
      ) : (
        <Text variant="bodySmall" style={styles.footer}>
          {branding.nombre ?? "Vivero Francisco"}
        </Text>
      )}
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: "#2e7d32",
    fontWeight: "600",
    fontSize: 26,
  },
  heroTitle: { color: "#111", fontWeight: "700", textAlign: "center" },
  heroSubtitle: { color: "#777" },

  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
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
    paddingVertical: 12,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
  },

  logoutBtn: {
    marginTop: 24,
    borderRadius: 14,
  },
  logoutContent: { paddingVertical: 8 },
  logoutLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  footer: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 32,
  },
  footerLogo: {
    alignSelf: "center",
    height: 56,
    width: 200,
    marginTop: 32,
  },
});
