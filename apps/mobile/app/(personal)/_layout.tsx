import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";
import { usePermisoDeUbicacion } from "@/lib/use-permiso-ubicacion";

export default function PersonalTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";
  /**
   * El jardinero ve dos pestañas: sus visitas y su cuenta.
   *
   * *Clientes* era la agenda de la oficina —todos los clientes del vivero— y él
   * no tiene nada que hacer ahí: los datos del cliente de la visita que le toca
   * los tiene adentro de la visita. Y *Más* escondía un solo ítem, Cuenta, así
   * que era un rodeo de dos toques hacia la única cosa que había detrás.
   */
  const esJardinero = role === "PERSONAL";

  // Solo al jardinero: es el único que marca, y pedirle la ubicación a la
  // oficina sería pedirla para nada.
  usePermisoDeUbicacion(role === "PERSONAL");

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
        tabBarActiveTintColor: tema.verde,
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
          href: esJardinero ? null : undefined,
          tabBarItemStyle: esJardinero ? { display: "none" } : undefined,
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
          // Al jardinero se le muestra directo; al resto le sigue llegando por
          // el menú de Más, que para ellos tiene tres cosas adentro.
          tabBarItemStyle: esJardinero ? undefined : { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: "Más",
          href: esJardinero ? null : undefined,
          tabBarItemStyle: esJardinero ? { display: "none" } : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
