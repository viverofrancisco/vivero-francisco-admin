import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";
import { usePermisoDeUbicacion } from "@/lib/use-permiso-ubicacion";

export default function PersonalTabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /**
   * El último rol conocido, no el de este instante.
   *
   * Al cerrar sesión el usuario pasa a `null` un momento antes de que la
   * puerta de `_layout` saque esta pantalla, y en ese momento cada pestaña
   * recalculaba su `href` como si no hubiera rol: la barra entera se
   * reacomodaba mientras se desmontaba, y en Android Fabric se caía
   * (`addViewAt: failed to insert view … already has a parent`). Con el rol
   * anterior la barra no cambia en su último render.
   */
  const rolActual = useAuthStore((s) => s.user?.role);
  const ultimoRol = useRef(rolActual);
  if (rolActual) ultimoRol.current = rolActual;
  const role = rolActual ?? ultimoRol.current;
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
      // Un aviso de chat abre el chat; el resto, la visita.
      const chatId = data.chatId;
      if (typeof chatId === "string") {
        router.push({ pathname: "/(personal)/chats/[id]", params: { id: chatId } });
        return;
      }
      const visitaId = data.visitaId;
      if (typeof visitaId !== "string") return;
      router.push(`/(personal)/visitas/${visitaId}`);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Tabs
      // "Atrás" vuelve a la pestaña anterior, no a la primera: es lo que
      // cierra *Más* desde su ✕ y desde un segundo toque en la pestaña.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tema.verde,
        tabBarInactiveTintColor: tema.texto3,
        /*
         * La barra del portal en móvil: blanca, con una línea arriba, 64 de
         * alto y la etiqueta en 11 semibold. La de Expo viene con el fondo
         * translúcido de iOS y su propia tipografía, así que las dos
         * aplicaciones —que son el mismo producto— se veían distintas justo en
         * lo que está siempre a la vista.
         */
        tabBarStyle: {
          backgroundColor: tema.superficie,
          borderTopColor: tema.linea,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      {/* El orden es el del portal —Visitas, Chats, Órdenes, Informes, Más—.
          **Clientes no está en la barra**: se entra a la ficha de un cliente
          desde su visita o buscándolo, no todos los días desde abajo, y con
          Chats adentro eran seis pestañas peleando por 375 px. Vive en Más, a
          un toque. Al jardinero, que solo tiene dos, Visitas le queda primera
          igual. */}
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          href: esJardinero ? null : undefined,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitas"
        options={{
          title: "Visitas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Chats: **para todos**, jardinero incluido. Es de las dos cosas que se
          abren todos los días, así que va en la barra y no adentro de Más. */}
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Órdenes e Informes van **en la barra**: son dos de las cosas que la
          oficina abre todos los días —cuánto se le debe a quién, qué informe
          salió— y estaban a dos toques adentro de Más, que es donde se guarda
          lo que se usa de vez en cuando. */}
      <Tabs.Screen
        name="ordenes"
        options={{
          title: "Órdenes",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: isAdminOrStaff ? undefined : { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />

      {/* El resto vive en el menú de Más, para que la barra no pase de cinco:
          `tabBarItemStyle: { display: "none" }` deja la ruta navegable y la
          saca de la barra. */}
      <Tabs.Screen
        name="suscripciones"
        options={{
          title: "Suscripciones",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sync-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="servicios"
        options={{
          // "Productos", como en el portal: es el mismo catálogo —servicios y
          // bienes— y dos nombres para una cosa son dos cosas hasta que alguien
          // abre las dos.
          title: "Productos",
          href: isAdmin ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      {/* La oficina administra desde el teléfono lo mismo que desde el
          portal: el catálogo de tareas, la gente y las cuadrillas. Entran por
          el menú de Más para que la barra siga teniendo tres cosas. */}
      <Tabs.Screen
        name="tareas"
        options={{
          title: "Tareas",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="personal"
        options={{
          title: "Personal",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="empresa"
        options={{
          title: "Empresa",
          href: isAdmin ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="facturacion"
        options={{
          title: "Facturación electrónica",
          href: isAdmin ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-lock-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: "Usuarios",
          href: isAdmin ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-add-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="grupos"
        options={{
          title: "Grupos",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-merge-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="informes"
        options={{
          title: "Informes",
          href: isAdminOrStaff ? undefined : null,
          tabBarItemStyle: isAdminOrStaff ? undefined : { display: "none" },
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
        // Tocar *Más* estando en *Más* lo cierra, como en el portal: con la
        // pestaña ya activa el toque no hacía nada y parecía que no había
        // salida.
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (navigation.isFocused() && navigation.canGoBack()) {
              e.preventDefault();
              navigation.goBack();
            }
          },
        })}
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
