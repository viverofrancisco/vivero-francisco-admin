import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

export default function ClienteTabsLayout() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data ?? {};
      const visitaId = data.visitaId;
      if (typeof visitaId !== "string") return;
      // El de calificar abre directo el formulario: el aviso dice "contanos
      // qué te pareció", y hacerlo aterrizar en la ficha para que busque el
      // botón es pedirle un paso que ya había aceptado dar.
      router.push(
        data.type === "calificar_visita"
          ? `/(cliente)/visitas/calificar/${visitaId}`
          : `/(cliente)/visitas/${visitaId}`
      );
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
        name="configuracion"
        options={{
          title: "Cuenta",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
