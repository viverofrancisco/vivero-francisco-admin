import React, { useCallback, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";
import { tema } from "@/lib/tema";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  STAFF: "Staff",
  PERSONAL: "Personal",
  CLIENTE: "Cliente",
};

/**
 * Los permisos del sistema, leídos cada vez que se entra.
 *
 * Se cambian en Ajustes —o sea, afuera de la app—, así que leerlos una sola vez
 * al montar deja la pantalla mintiendo apenas alguien vuelve de activarlos.
 * `null` mientras todavía no se sabe: decir "Desactivada" antes de haber
 * preguntado es peor que no decir nada.
 */
function usePermisos(pedirUbicacion: boolean) {
  const [estado, setEstado] = useState<{
    ubicacion: boolean | null;
    notificaciones: boolean | null;
  }>({ ubicacion: null, notificaciones: null });

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      (async () => {
        const [u, n] = await Promise.all([
          pedirUbicacion
            ? Location.getForegroundPermissionsAsync().catch(() => null)
            : Promise.resolve(null),
          Notifications.getPermissionsAsync().catch(() => null),
        ]);
        if (!vivo) return;
        setEstado({
          ubicacion: pedirUbicacion ? (u?.granted ?? false) : null,
          notificaciones: n?.granted ?? false,
        });
      })();
      return () => {
        vivo = false;
      };
    }, [pedirUbicacion])
  );

  return estado;
}

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
  // La ubicación solo le hace falta a quien marca entrada y salida.
  const esJardinero = user?.role === "PERSONAL";
  const permisos = usePermisos(esJardinero);
  const version = Constants.expoConfig?.version ?? null;

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
      <Section title="Cuenta">
        {/* Lo primero: es lo que la oficina dicta por teléfono y lo primero
            que se olvida. El jardinero no tiene correo, así que muchas veces
            es lo único que hay acá. */}
        {user?.usuario ? <Row label="Usuario" value={user.usuario} /> : null}
        {user?.email ? <Row label="Email" value={user.email} /> : null}
      </Section>

      {/* Permisos. Se cambian en Ajustes, que es adonde lleva la fila. */}
      <Section title="Permisos">
        {esJardinero ? (
          <FilaPermiso
            etiqueta="Ubicación"
            concedido={permisos.ubicacion}
            nota="Se guarda desde dónde marcas tu entrada y tu salida."
          />
        ) : null}
        <FilaPermiso
          etiqueta="Notificaciones"
          concedido={permisos.notificaciones}
          nota="Avisos de visitas y mensajes."
        />
      </Section>

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

      {version ? (
        <Text variant="bodySmall" style={styles.version}>
          Versión {version}
        </Text>
      ) : null}

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

/**
 * Un permiso del sistema: cómo está y, si está apagado, cómo prenderlo.
 *
 * Toca en Ajustes y no acá porque una vez negado iOS no vuelve a mostrar su
 * diálogo: la app no tiene forma de conceder nada, solo de llevar hasta el
 * interruptor. `Linking.openSettings()` abre la página de esta app, que es
 * donde está.
 */
function FilaPermiso({
  etiqueta,
  concedido,
  nota,
}: {
  etiqueta: string;
  concedido: boolean | null;
  nota: string;
}) {
  const cuerpo = (
    <View style={styles.permiso}>
      <View style={styles.permisoTexto}>
        <Text variant="bodyMedium" style={styles.permisoEtiqueta}>
          {etiqueta}
        </Text>
        <Text variant="bodySmall" style={styles.permisoNota}>
          {nota}
        </Text>
      </View>
      {concedido === null ? (
        <Text variant="bodySmall" style={styles.permisoNota}>
          —
        </Text>
      ) : concedido ? (
        <View style={styles.permisoEstado}>
          <Ionicons name="checkmark-circle" size={18} color={tema.verde} />
          <Text variant="bodySmall" style={styles.permisoActivo}>
            Activo
          </Text>
        </View>
      ) : (
        <View style={styles.permisoEstado}>
          <Text variant="bodySmall" style={styles.permisoActivar}>
            Activar
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tema.ambarTexto} />
        </View>
      )}
    </View>
  );

  if (concedido === false) {
    return (
      <Pressable onPress={() => Linking.openSettings()}>{cuerpo}</Pressable>
    );
  }
  return cuerpo;
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

  permiso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  permisoTexto: { flex: 1, gap: 1 },
  permisoEtiqueta: { color: "#111" },
  permisoNota: { color: "#888" },
  permisoEstado: { flexDirection: "row", alignItems: "center", gap: 3 },
  permisoActivo: { color: tema.verde, fontWeight: "600" },
  permisoActivar: { color: tema.ambarTexto, fontWeight: "700" },

  version: { textAlign: "center", color: "#aaa", marginTop: 20 },

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
