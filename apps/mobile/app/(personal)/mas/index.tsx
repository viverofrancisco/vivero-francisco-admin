import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";

interface Item {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  visible: boolean;
}

/**
 * El menú completo, como el del portal en móvil.
 *
 * Es la misma forma: una lista de filas grandes con su icono, y abajo la
 * tarjeta de quién está adentro con la salida. Era una lista de tres ítems con
 * el aspecto de un panel de ajustes de iOS, así que la app y el portal —que son
 * el mismo producto— se veían distintos justo en la pantalla que se usa para
 * saber dónde está uno.
 *
 * Los cuatro atajos de la barra no se repiten acá: están a un toque abajo, y
 * repetirlos haría de esto una lista con todo dos veces.
 */
export default function MasMenuScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [saliendo, setSaliendo] = useState(false);

  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

  const items: Item[] = [
    {
      label: "Productos",
      icon: "pricetags-outline",
      href: "/(personal)/servicios",
      visible: isAdmin,
    },
    {
      label: "Tareas",
      icon: "checkbox-outline",
      href: "/(personal)/tareas",
      visible: isAdminOrStaff,
    },
    {
      label: "Personal",
      icon: "people-circle-outline",
      href: "/(personal)/personal",
      visible: isAdminOrStaff,
    },
    {
      label: "Grupos",
      icon: "git-merge-outline",
      href: "/(personal)/grupos",
      visible: isAdminOrStaff,
    },
    {
      label: "Cuenta",
      icon: "settings-outline",
      href: "/(personal)/configuracion",
      visible: true,
    },
  ];

  const nombre =
    `${user?.name ?? ""} ${user?.apellido ?? ""}`.trim() || "Mi cuenta";
  const iniciales =
    nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  async function salir() {
    setSaliendo(true);
    if (refreshToken) {
      apiRequest("/api/mobile/auth/logout", {
        method: "POST",
        body: { refreshToken },
        authenticated: false,
      }).catch(() => {});
    }
    await clear();
  }

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={styles.lista}>
        {items
          .filter((i) => i.visible)
          .map((item) => (
            <PressableScale
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={styles.fila}
            >
              <Ionicons name={item.icon} size={22} color={tema.texto2} />
              <Text variant="bodyLarge" style={styles.etiqueta}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          ))}
      </ScrollView>

      {/* Quién está adentro y cómo salir, al pie: lo mismo que el portal pone
          abajo de su menú. Es la respuesta a "¿con qué cuenta entré?", que es
          la pregunta que trae a alguien a este menú cuando algo no aparece. */}
      <View style={styles.pie}>
        <View style={styles.cuenta}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{iniciales}</Text>
          </View>
          <View style={styles.cuentaTexto}>
            <Text variant="bodyMedium" style={styles.cuentaNombre} numberOfLines={1}>
              {nombre}
            </Text>
            <Text variant="bodySmall" style={styles.cuentaDetalle} numberOfLines={1}>
              {user?.usuario ?? user?.email ?? ""}
            </Text>
          </View>
          <PressableScale
            onPress={salir}
            disabled={saliendo}
            style={styles.salir}
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={20} color={tema.texto2} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.superficie },
  lista: { padding: 12 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  etiqueta: { flex: 1, color: tema.texto, fontWeight: "500" },

  pie: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  cuenta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tema.lienzo,
    borderRadius: 12,
    padding: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cuentaTexto: { flex: 1, gap: 1 },
  cuentaNombre: { color: tema.texto, fontWeight: "700" },
  cuentaDetalle: { color: tema.texto3 },
  salir: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
