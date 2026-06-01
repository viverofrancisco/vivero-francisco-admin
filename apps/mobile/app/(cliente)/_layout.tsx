import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/api";

export default function ClienteTabsLayout() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data ?? {};
      const visitaId = data.visitaId;
      if (typeof visitaId !== "string") return;
      if (data.type === "chat_message") {
        router.push(`/(cliente)/visitas/chat/${visitaId}`);
      } else {
        router.push(`/(cliente)/visitas/${visitaId}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  // Poll the unread count so the tab badge stays roughly fresh.
  useEffect(() => {
    let active = true;
    async function fetchCount() {
      try {
        const res = await apiRequest<{ count: number }>(
          "/api/mobile/messages/unread-count"
        );
        if (active) setUnread(res.count);
      } catch {
        // ignore
      }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
        name="mensajes"
        options={{
          title: "Mensajes",
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
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
