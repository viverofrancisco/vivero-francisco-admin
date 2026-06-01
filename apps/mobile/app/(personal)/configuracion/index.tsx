import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  STAFF: "Staff",
  PERSONAL_ADMIN: "Supervisor",
  PERSONAL: "Personal",
  CLIENTE: "Cliente",
};

export default function PersonalConfiguracionScreen() {
  const user = useAuthStore((s) => s.user);
  const branding = useBranding();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const fullName = user
    ? `${user.name ?? ""} ${user.apellido ?? ""}`.trim() || "Mi cuenta"
    : "Mi cuenta";
  const initials = user
    ? `${user.name?.[0] ?? ""}${user.apellido?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";
  const roleLabel = user ? ROLE_LABEL[user.role] ?? user.role : "";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          {fullName}
        </Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>
          {roleLabel}
        </Text>
      </View>

      {/* Cuenta */}
      {user?.email ? (
        <Section title="Cuenta">
          <Row label="Email" value={user.email} />
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
