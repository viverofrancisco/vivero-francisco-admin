import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotonRedondoDeHoja } from "@vivero/app-ui/components/ui/CabeceraDeHoja";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@vivero/app-ui/components/ui/PressableScale";
import { useAuthStore } from "@vivero/app-ui/lib/auth-store";
import { tema } from "@vivero/app-ui/lib/tema";

interface Item {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  visible: boolean;
  /** Va bajo el rótulo *Configuración*, como en el menú del portal. */
  configuracion?: boolean;
}

/**
 * El menú completo, como el del portal en móvil.
 *
 * Es la misma forma: una lista de filas grandes con su icono, y abajo la
 * tarjeta de quién está adentro, que abre su cuenta. Era una lista de tres ítems con
 * el aspecto de un panel de ajustes de iOS, así que la app y el portal —que son
 * el mismo producto— se veían distintos justo en la pantalla que se usa para
 * saber dónde está uno.
 *
 * Los atajos de la barra no se repiten acá: están a un toque abajo, y
 * repetirlos haría de esto una lista con todo dos veces. Clientes sí está,
 * porque salió de la barra: se entra a la ficha de un cliente desde su visita
 * o buscándolo, no todos los días desde abajo.
 */
export default function MasMenuScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

  const items: Item[] = [
    {
      label: "Clientes",
      icon: "people-outline",
      href: "/(personal)/clientes",
      visible: isAdminOrStaff,
    },
    {
      label: "Solicitudes",
      icon: "mail-unread-outline",
      href: "/(personal)/solicitudes",
      visible: isAdminOrStaff,
    },
    {
      label: "Suscripciones",
      icon: "sync-outline",
      href: "/(personal)/suscripciones",
      visible: isAdminOrStaff,
    },
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
      configuracion: true,
    },
    {
      label: "Grupos",
      icon: "git-merge-outline",
      href: "/(personal)/grupos",
      visible: isAdminOrStaff,
      configuracion: true,
    },
    {
      label: "Empresa",
      icon: "business-outline",
      href: "/(personal)/empresa",
      visible: isAdmin,
      configuracion: true,
    },
    {
      label: "Ubicaciones",
      icon: "location-outline",
      href: "/(personal)/ubicaciones",
      visible: isAdmin,
      configuracion: true,
    },
    {
      label: "Facturación electrónica",
      icon: "document-lock-outline",
      href: "/(personal)/facturacion",
      visible: isAdmin,
      configuracion: true,
    },
    {
      label: "Usuarios",
      icon: "person-add-outline",
      href: "/(personal)/usuarios",
      visible: isAdmin,
      configuracion: true,
    },
  ];

  const visibles = items.filter((i) => i.visible);

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

  return (
    <View style={styles.contenedor}>
      {/* Sin barra nativa, el margen de arriba lo pone el safe area. La ✕
          vuelve a la pestaña anterior (`backBehavior: "history"`): *Más* es
          un menú, y un menú se cierra; sin ella parecía que no había salida.
          No aparece cuando no hay adónde volver, como al abrir la app acá. */}
      <View style={[styles.cabecera, { paddingTop: insets.top + 8 }]}>
        {navigation.canGoBack() ? (
          <BotonRedondoDeHoja
            icono="close-outline"
            etiqueta="Cerrar"
            onPress={() => router.back()}
          />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.lista}>
        {[
          visibles.filter((i) => !i.configuracion),
          visibles.filter((i) => i.configuracion),
        ].map((grupo, g) =>
          grupo.length === 0 ? null : (
            <View key={g}>
              {g === 1 ? <Text style={styles.rotulo}>CONFIGURACIÓN</Text> : null}
              {grupo.map((item) => (
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
            </View>
          )
        )}
      </ScrollView>

      {/* Quién está adentro, al pie, y tocarlo abre *Cuenta*: lo mismo que el
          portal pone abajo de su menú. Es la respuesta a "¿con qué cuenta
          entré?", y la cuenta es donde se cambia la contraseña y se cierra la
          sesión —una fila *Cuenta* en la lista y un botón de salir acá decían
          dos veces lo mismo, y salir a un toque de distancia es salir sin querer. */}
      <View style={styles.pie}>
        <PressableScale
          onPress={() => router.push("/(personal)/configuracion" as never)}
          style={styles.cuenta}
          accessibilityRole="button"
          accessibilityLabel="Cuenta"
        >
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
          <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.superficie },
  cabecera: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "flex-end",
    justifyContent: "center",
  },
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
  rotulo: {
    color: tema.texto3,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 4,
  },

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
    paddingRight: 12,
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
});
