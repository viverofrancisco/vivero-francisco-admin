import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import {
  ALTO_BARRA_SELECCION,
  BarraSeleccion,
} from "@/components/ui/BarraSeleccion";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { avisoDeLote, eliminarEnLote } from "@/lib/lote";
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
  const [marcadas, setMarcadas] = useState<string[]>([]);
  /**
   * Marcar es un **modo**, que prende el ⋯ del encabezado: en una pantalla de
   * 375 px no hay dónde poner una casilla en cada fila sin gastar ese ancho
   * para siempre. Es lo mismo que hace el portal en el teléfono.
   */
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
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

  function alternar(id: string) {
    setMarcadas((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id]
    );
  }

  async function eliminarMarcadas() {
    setEliminando(true);
    try {
      const res = await eliminarEnLote("/api/mobile/personal/eliminar", elegidas);
      setError(avisoDeLote(res, "personas"));
      setConfirmando(false);
      setSeleccionando(false);
      setMarcadas([]);
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos eliminar"));
      setConfirmando(false);
    } finally {
      setEliminando(false);
    }
  }

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

  // Marcar y filtrar después dejaría una cuenta de seleccionadas que ya no
  // están en pantalla, y un botón que borra lo que no se ve.
  const enPantalla = new Set(visibles.map((p) => p.id));
  const elegidas = marcadas.filter((id) => enPantalla.has(id));

  return (
    <PantallaLista
      titulo="Personal"
      acciones={
        puedeEditar
          ? [
              {
                etiqueta: "Nueva persona",
                onPress: () => router.push("/(personal)/personal/nuevo"),
              },
              // Prender la selección solo cuando hay algo que marcar y no se
              // está marcando ya.
              ...(!seleccionando && visibles.length > 0
                ? [
                    {
                      etiqueta: "Seleccionar personal",
                      onPress: () => setSeleccionando(true),
                    },
                  ]
                : []),
            ]
          : []
      }
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
          ListFooterComponent={
            seleccionando ? (
              <View style={{ height: ALTO_BARRA_SELECCION }} />
            ) : null
          }
          renderItem={({ item }) => {
            const aviso = ACCESO[item.acceso];
            const marcada = marcadas.includes(item.id);
            return (
              <PressableScale
                // Marcando **no navega**: una fila que a veces abre la ficha y
                // a veces marca es una trampa.
                onPress={() =>
                  seleccionando
                    ? alternar(item.id)
                    : router.push(`/(personal)/personal/${item.id}`)
                }
                estiloExterno={styles.ancho}
                style={[FILA_LISTA, marcada && styles.filaMarcada]}
              >
                {seleccionando ? (
                  <Ionicons
                    name={marcada ? "checkbox" : "square-outline"}
                    size={22}
                    color={marcada ? tema.verde : tema.texto3}
                  />
                ) : null}
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
                {seleccionando ? null : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={tema.texto3}
                  />
                )}
              </PressableScale>
            );
          }}
        />
      )}

      {seleccionando ? (
        <BarraSeleccion
          cuantas={elegidas.length}
          onSalir={() => {
            setSeleccionando(false);
            setMarcadas([]);
          }}
        >
          <PressableScale
            onPress={() => setConfirmando(true)}
            disabled={elegidas.length === 0}
            style={[styles.accionBarra, elegidas.length === 0 && styles.apagado]}
          >
            <Text style={styles.accionBarraTexto}>Eliminar</Text>
          </PressableScale>
        </BarraSeleccion>
      ) : null}

      <DialogoConfirmar
        visible={confirmando}
        titulo={
          elegidas.length === 1
            ? "¿Eliminar 1 persona?"
            : `¿Eliminar ${elegidas.length} personas?`
        }
        detalle="Sus fichas salen de las listas y su cuenta deja de entrar a la app. No se borra nada de lo que hicieron: su nombre sigue firmando los partes que cargaron."
        confirmar="Eliminar"
        peligro
        cargando={eliminando}
        onConfirmar={eliminarMarcadas}
        onCancelar={() => setConfirmando(false)}
      />
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
  filaMarcada: { backgroundColor: tema.verde50 },
  renglon: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombre: { flexShrink: 1, color: tema.texto, fontWeight: "700" },
  detalle: { color: tema.texto3 },
  pastilla: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pastillaTexto: { fontSize: 11, fontWeight: "700" },
  /* Claro sobre oscuro, nunca el rojo de la casa: sobre la pastilla oscura
     desaparece. El rojo lo pone la confirmación, que es donde se decide. */
  accionBarra: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },
  apagado: { opacity: 0.45 },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
