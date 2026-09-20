import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { useAuthStore } from "@/lib/auth-store";
import type { EstadoAcceso, PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

const ETIQUETA_TIPO: Record<string, string> = {
  JARDINERO: "Jardinero",
  CHOFER: "Chofer",
  SUPERVISOR: "Supervisor",
  MECANICO: "Mecánico",
};

/**
 * Cómo se ve cada estado de acceso. El mismo criterio que el portal: solo se
 * muestra lo que espera algo. "Sin cuenta" es lo normal para la mayoría —casi
 * nadie necesita entrar a la app— y llenaría la lista de etiquetas que no
 * dicen nada; "Activo" tampoco se avisa, porque es lo esperable.
 */
const ACCESO: Partial<
  Record<EstadoAcceso, { etiqueta: string; color: string; fondo: string }>
> = {
  PENDIENTE: {
    etiqueta: "Pendiente",
    color: tema.ambarTexto,
    fondo: tema.ambar50,
  },
  REVOCADO: { etiqueta: "Revocado", color: tema.rojo, fondo: tema.rojo50 },
};

function nombreCompleto(p: PersonalFicha): string {
  return `${p.nombre} ${p.apellido ?? ""}`.trim();
}

function iniciales(p: PersonalFicha): string {
  return `${p.nombre.slice(0, 1)}${(p.apellido ?? "").slice(0, 1)}`.toUpperCase();
}

function cuadrillas(p: PersonalFicha): string[] {
  return (p.grupos ?? []).map((g) => g.grupo.nombre);
}

/**
 * El renglón de abajo: lo mismo, en el mismo orden, que en el portal.
 *
 * El usuario va segundo porque en un renglón truncado es lo que más se viene a
 * buscar: es lo que la oficina dicta por teléfono para que alguien entre, y lo
 * primero que la persona olvida.
 */
function resumen(p: PersonalFicha): string {
  const grupos = cuadrillas(p);
  const partes = [
    p.especialidad ?? (p.tipo ? (ETIQUETA_TIPO[p.tipo] ?? p.tipo) : null),
    p.user?.usuario,
    grupos.length > 0 ? grupos.join(", ") : null,
    p.telefono,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin datos";
}

/**
 * La gente del vivero. **La misma pantalla que el portal en el teléfono**: la
 * misma fila, los mismos dos filtros y la misma búsqueda.
 */
export default function PersonalListScreen() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const puedeEditar = rol === "ADMIN" || rol === "STAFF";
  const [items, setItems] = useState<PersonalFicha[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: PersonalFicha[] }>(
        "/api/mobile/personal"
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar el personal"));
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
      items.filter((p) => {
        if (estado && p.estado !== estado) return false;
        if (tipo && p.tipo !== tipo) return false;
        if (!q) return true;
        return (
          nombreCompleto(p).toLowerCase().includes(q) ||
          (p.user?.usuario?.toLowerCase().includes(q) ?? false) ||
          (p.telefono?.includes(q) ?? false) ||
          (p.especialidad?.toLowerCase().includes(q) ?? false)
        );
      }),
    [items, estado, tipo, q]
  );

  return (
    <PantallaLista
      titulo="Personal"
      onCrear={
        puedeEditar ? () => router.push("/(personal)/personal/nuevo") : undefined
      }
      etiquetaCrear="Nueva persona"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por nombre, usuario o teléfono..."
      grupos={[
        {
          id: "estado",
          titulo: "Estado",
          valor: estado,
          onElegir: setEstado,
          opciones: [
            { clave: "", etiqueta: "Todos" },
            { clave: "ACTIVO", etiqueta: "Activos" },
            { clave: "INACTIVO", etiqueta: "Inactivos" },
          ],
        },
        {
          id: "tipo",
          titulo: "Tipo",
          valor: tipo,
          onElegir: setTipo,
          opciones: [
            { clave: "", etiqueta: "Todos" },
            { clave: "JARDINERO", etiqueta: "Jardineros" },
            { clave: "CHOFER", etiqueta: "Choferes" },
            { clave: "SUPERVISOR", etiqueta: "Supervisores" },
            { clave: "MECANICO", etiqueta: "Mecánicos" },
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
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                No se encontró personal
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const aviso = ACCESO[item.acceso];
            return (
              <PressableScale
                onPress={() => router.push(`/(personal)/personal/${item.id}`)}
                estiloExterno={styles.ancho}
                style={FILA_LISTA}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexto}>{iniciales(item)}</Text>
                </View>
                <View style={styles.filaTexto}>
                  <View style={styles.renglon}>
                    <Text
                      variant="bodyLarge"
                      style={styles.nombre}
                      numberOfLines={1}
                    >
                      {nombreCompleto(item)}
                    </Text>
                    {item.estado !== "ACTIVO" ? (
                      <Pastilla
                        texto="Inactivo"
                        color={tema.texto3}
                        fondo={tema.linea2}
                      />
                    ) : null}
                    {aviso ? (
                      <Pastilla
                        texto={aviso.etiqueta}
                        color={aviso.color}
                        fondo={aviso.fondo}
                      />
                    ) : null}
                  </View>
                  <Text
                    variant="bodySmall"
                    style={styles.detalle}
                    numberOfLines={1}
                  >
                    {resumen(item)}
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

function Pastilla({
  texto,
  color,
  fondo,
}: {
  texto: string;
  color: string;
  fondo: string;
}) {
  return (
    <View style={[styles.pastilla, { backgroundColor: fondo }]}>
      <Text style={[styles.pastillaTexto, { color }]}>{texto}</Text>
    </View>
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
  pastilla: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pastillaTexto: { fontSize: 11, fontWeight: "700" },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
