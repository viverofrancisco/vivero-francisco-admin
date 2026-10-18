import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/lib/tema";
import { unidadesEnElCarrito, useCarrito } from "@/lib/carrito";
import { IconoDelCarrito } from "@/components/carrito/IconoDelCarrito";

/**
 * Las pestañas del invitado: las del cliente que tienen sentido sin cuenta
 * —Visitas, Catálogo, Carrito y Cuenta—, en el mismo orden y con los mismos
 * íconos. Compra sin cuenta: deja nombre y teléfono en el checkout y el
 * servidor le crea su ficha. Sin Pedidos: sin cuenta no hay de quién son. Abre
 * en el Catálogo, que es a lo que viene quien toca *Seguir como invitado*.
 */
export const unstable_settings = { initialRouteName: "catalogo" };

export default function InvitadoTabsLayout() {
  const router = useRouter();
  const lineas = useCarrito((s) => s.lineas);
  const hidratar = useCarrito((s) => s.hidratar);
  const enElCarrito = unidadesEnElCarrito(lineas);

  // Su propio carrito, aparte del de la cuenta (ver `lib/carrito.ts`).
  useEffect(() => {
    void hidratar("invitado");
  }, [hidratar]);

  return (
    <Tabs
      initialRouteName="catalogo"
      screenOptions={{
        tabBarActiveTintColor: tema.verde,
        headerShown: false,
      }}
    >
      {/* Sin cuenta no hay visitas que listar: la pestaña abre directo el
          formulario para pedir una, y la pantalla de detrás no se ve. */}
      <Tabs.Screen
        name="visitas"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/(invitado)/solicitar");
          },
        }}
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
      <Tabs.Screen
        name="carrito"
        options={{
          title: "Carrito",
          tabBarIcon: ({ color, size }) => (
            <IconoDelCarrito color={color} size={size} cuantas={enElCarrito} />
          ),
        }}
      />
      <Tabs.Screen
        name="cuenta"
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
