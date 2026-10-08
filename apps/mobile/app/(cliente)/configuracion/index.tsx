import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Button,
  Text,
} from "react-native-paper";
import { nombreCliente } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteProfileResponse } from "@/lib/types";
import { tema } from "@/lib/tema";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";

export default function ClienteConfiguracionScreen() {
  const router = useRouter();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [data, setData] = useState<ClienteProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [eliminando, setEliminando] = useState(false);

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

  /**
   * Eliminar la cuenta, como pide Apple a toda app donde uno se registra. Se
   * va la forma de entrar; la ficha queda solo si tiene visitas o facturas,
   * que el vivero tiene que conservar. Lo dice antes de confirmar.
   */
  function eliminarCuenta() {
    Alert.alert(
      "¿Eliminar tu cuenta?",
      "Ya no podrás entrar a la app con este correo. Si tienes visitas o facturas con nosotros, las conservamos porque la ley nos lo exige. Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setEliminando(true);
            try {
              await apiRequest("/api/mobile/auth/cuenta", { method: "DELETE" });
              await clear();
            } catch (e) {
              setEliminando(false);
              Alert.alert(
                "No pudimos eliminar tu cuenta",
                mensajeDeError(e, "Intenta de nuevo en un momento.")
              );
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const cliente = data?.cliente;
  const displayName = cliente ? nombreCliente(cliente) : "";
  const initials = cliente
    ? displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "?"
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
          {cliente ? displayName : "Mi cuenta"}
        </Text>
        {/* Su primera propiedad. Con varias, las demás se ven en la sección
            de abajo: acá solo entra una línea. */}
        {cliente?.propiedades[0]?.sector?.nombre ? (
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            {cliente.propiedades[0].sector.nombre}
          </Text>
        ) : null}
      </View>

      {/* Datos */}
      {cliente?.telefono || cliente?.email ? (
        <Section title="Datos de contacto">
          {cliente.email ? <Row label="Correo" value={cliente.email} /> : null}
          {cliente.telefono ? <Row label="Teléfono" value={cliente.telefono} /> : null}
        </Section>
      ) : null}

      <Section title="Pedidos">
        <Pressable
          onPress={() => router.push("/(cliente)/solicitudes")}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text variant="bodyMedium" style={styles.rowLink}>
            Mis solicitudes
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#aaa" />
        </Pressable>
      </Section>

      {/* Dónde se le trabaja. Una fila por propiedad: quien tiene dos las ve
          las dos, en vez de una dirección elegida a dedo. */}
      {cliente && cliente.propiedades.length > 0 ? (
        <Section
          title={
            cliente.propiedades.length === 1 ? "Mi propiedad" : "Mis propiedades"
          }
        >
          {cliente.propiedades.map((p) => (
            <Row
              key={p.id}
              label={p.nombre}
              value={
                [p.direccion, p.ciudad ?? p.sector?.nombre]
                  .filter(Boolean)
                  .join(", ") || "Sin dirección"
              }
            />
          ))}
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

      <Button
        mode="text"
        onPress={eliminarCuenta}
        loading={eliminando}
        disabled={eliminando || loggingOut}
        textColor="#c62828"
        style={styles.eliminar}
      >
        Eliminar mi cuenta
      </Button>

      <LogoDeLaEmpresa style={styles.footerLogo} />
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
    color: tema.verde,
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
  rowLink: { color: "#111", flex: 1 },
  rowPressed: { opacity: 0.6 },
  eliminar: { marginTop: 12 },
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
