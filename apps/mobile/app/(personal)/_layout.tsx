import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/lib/auth-store";

export default function PersonalTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data ?? {};
      const visitaId = data.visitaId;
      if (typeof visitaId !== "string") return;
      router.push(`/(personal)/visitas/${visitaId}`);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2e7d32",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="visitas"
        options={{
          title: "Visitas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs — accessible via the "Más" menu so the tab bar stays
          short. `tabBarItemStyle: { display: "none" }` keeps the route
          navigable while removing it from the bar. */}
      <Tabs.Screen
        name="servicios"
        options={{
          title: "Servicios",
          href: isAdmin ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="informes"
        options={{
          title: "Informes",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="configuracion"
        options={{
          title: "Cuenta",
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: "Más",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
