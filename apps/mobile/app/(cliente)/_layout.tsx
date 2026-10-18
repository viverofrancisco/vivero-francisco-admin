import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@vivero/app-ui/lib/tema";
import { unidadesEnElCarrito, useCarrito } from "@/lib/carrito";
import { IconoDelCarrito } from "@/components/carrito/IconoDelCarrito";

export default function ClienteTabsLayout() {
  const router = useRouter();
  const lineas = useCarrito((s) => s.lineas);
  const hidratar = useCarrito((s) => s.hidratar);
  const enElCarrito = unidadesEnElCarrito(lineas);

  useEffect(() => {
    void hidratar();
  }, [hidratar]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data ?? {};
      // Su pedido cambió de estado: a Pedidos, donde se ve.
      if (data.type === "pedido_cliente") {
        router.push("/(cliente)/solicitudes");
        return;
      }
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
        name="catalogo"
        options={{
          title: "Catálogo",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf-outline" size={size} color={color} />
          ),
        }}
      />
      {/* El número es cuántas unidades lleva: lo que se ve en cualquier
          tienda, y lo que dice que el + del catálogo hizo algo. */}
      <Tabs.Screen
        name="carrito"
        options={{
          title: "Carrito",
          tabBarIcon: ({ color, size }) => (
            <IconoDelCarrito color={color} size={size} cuantas={enElCarrito} />
          ),
        }}
      />
      {/* Lo que le pidió al vivero —sus compras del carrito y sus solicitudes
          de visita o cotización— en una pestaña propia: "¿me vieron el
          pedido?" es de lo primero que alguien vuelve a mirar. La carpeta se
          sigue llamando `solicitudes`. */}
      <Tabs.Screen
        name="solicitudes"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
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
