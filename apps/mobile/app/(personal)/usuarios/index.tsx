import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import type { EstadoAcceso, UsuarioDelEquipo } from "@/lib/types";
import { tema } from "@/lib/tema";

const ROL: Record<string, string> = { ADMIN: "Administrador", STAFF: "Staff" };

/** Solo lo que espera algo, como en el portal: "Activo" es lo normal. */
const ACCESO: Partial<Record<EstadoAcceso, { etiqueta: string; color: string; fondo: string }>> = {
  PENDIENTE: { etiqueta: "Pendiente", color: tema.ambarTexto, fondo: tema.ambar50 },
  REVOCADO: { etiqueta: "Revocado", color: tema.rojo, fondo: tema.rojo50 },
};

function nombreDe(u: UsuarioDelEquipo) {
  return [u.name, u.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

/**
 * Las cuentas del equipo —administradores y staff—, solo para un ADMIN. La
 * misma pantalla que Usuarios del portal en el teléfono; el personal de campo
 * no está acá, su cuenta vive en su ficha.
 */
export default function UsuariosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<UsuarioDelEquipo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [acceso, setAcceso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: UsuarioDelEquipo[] }>("/api/mobile/users");
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar los usuarios"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      items.filter((u) => {
        if (acceso && u.acceso !== acceso) return false;
        if (!q) return true;
        return (
          nombreDe(u).toLowerCase().includes(q) ||
          (u.email?.toLowerCase().includes(q) ?? false) ||
          (u.usuario?.includes(q) ?? false)
        );
      }),
    [items, acceso, q]
  );

  return (
    <PantallaLista
      titulo="Usuarios"
      acciones={[
        { etiqueta: "Nuevo usuario", onPress: () => router.push("/(personal)/usuarios/nuevo") },
      ]}
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por nombre o correo..."
      grupos={[
        {
          id: "acceso",
          titulo: "Acceso",
          valor: acceso,
          onElegir: setAcceso,
          opciones: [
            { clave: "", etiqueta: "Todos" },
            { clave: "ACTIVO", etiqueta: "Activos" },
            { clave: "PENDIENTE", etiqueta: "Pendientes" },
            { clave: "REVOCADO", etiqueta: "Revocados" },
          ],
        },
      ]}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(u) => u.id}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                No se encontraron usuarios
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const aviso = ACCESO[item.acceso];
            const nombre = nombreDe(item);
            return (
              <PressableScale
                onPress={() => router.push(`/(personal)/usuarios/${item.id}`)}
                estiloExterno={styles.ancho}
                style={FILA_LISTA}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexto}>
                    {nombre
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.filaTexto}>
                  <View style={styles.renglon}>
                    <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                      {nombre}
                    </Text>
                    {aviso ? (
                      <View style={[styles.pastilla, { backgroundColor: aviso.fondo }]}>
                        <Text style={[styles.pastillaTexto, { color: aviso.color }]}>
                          {aviso.etiqueta}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="bodySmall" style={styles.detalle} numberOfLines={1}>
                    {[ROL[item.role] ?? item.role, item.email ?? item.usuario]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              </PressableScale>
            );
          }}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  ancho: { alignSelf: "stretch" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: tema.verde700, fontWeight: "700", fontSize: 15 },
  filaTexto: { flex: 1, gap: 2 },
  renglon: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombre: { flexShrink: 1, color: tema.texto, fontWeight: "700" },
  detalle: { color: tema.texto3 },
  pastilla: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pastillaTexto: { fontSize: 11, fontWeight: "700" },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
