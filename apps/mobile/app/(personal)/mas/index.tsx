import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/lib/auth-store";

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  visible: boolean;
}

export default function MasMenuScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

  const items: MenuItem[] = [
    {
      label: "Servicios",
      icon: "briefcase-outline",
      href: "/(personal)/servicios",
      visible: isAdmin,
    },
    {
      label: "Informes",
      icon: "document-text-outline",
      href: "/(personal)/informes",
      visible: isAdminOrStaff,
    },
    {
      label: "Cuenta",
      icon: "settings-outline",
      href: "/(personal)/configuracion",
      visible: true,
    },
  ];

  const visible = items.filter((i) => i.visible);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {visible.map((item, idx) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href as never)}
          style={({ pressed }) => [
            styles.row,
            idx === 0 && styles.rowFirst,
            idx === visible.length - 1 && styles.rowLast,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name={item.icon} size={22} color="#2e7d32" />
          </View>
          <Text variant="bodyLarge" style={styles.rowLabel}>
            {item.label}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowFirst: { borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  rowLast: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomWidth: 0,
  },
  rowPressed: { backgroundColor: "#f5f5f5" },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontWeight: "500" },
});
