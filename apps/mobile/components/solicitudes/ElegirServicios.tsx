import { useCallback, useEffect, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Searchbar, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  OTROS_SERVICIOS,
  SERVICIO_OTRO,
  type ServicioParaSolicitar,
} from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { tema } from "@/lib/tema";

/**
 * *¿Qué servicios necesitas?*, **obligatorio** (al menos uno, y va primero:
 * es lo que le dice al vivero qué trabajo es): una fila *Seleccionar servicios* que abre un cajón
 * con la lista para marcar o desmarcar, y debajo de la fila los elegidos como
 * pastillas con su ✕. Los servicios no están en el catálogo —una poda no se
 * mete al carrito, se cotiza—; se piden acá, junto con el mensaje.
 *
 * Un cajón y no la lista entera en el formulario: son una veintena, y
 * desplegados empujaban el teléfono y la dirección fuera de la pantalla por
 * algo que la mayoría ni toca. Lo marcado se aplica al tocar; el cajón se
 * cierra con *Listo* o arrastrándolo.
 *
 * Si la lista no carga, la fila lo dice y se toca para reintentar: sin
 * servicios no se puede enviar.
 */
export function ElegirServicios({
  elegidos,
  onCambio,
  error = false,
}: {
  elegidos: string[];
  onCambio: (ids: string[]) => void;
  /** Se tocó *Enviar* sin elegir ninguno: la fila en rojo, con el aviso. */
  error?: boolean;
}) {
  const [servicios, setServicios] = useState<ServicioParaSolicitar[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(() => {
    setFallo(false);
    apiRequest<{ items: ServicioParaSolicitar[] }>("/api/mobile/publico/servicios", {
      authenticated: false,
    })
      .then((r) => setServicios(r.items))
      .catch(() => setFallo(true));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * *Otros* al final de la lista, siempre: para lo que no está. Viaja entre
   * los elegidos como `SERVICIO_OTRO` y el formulario lo separa al enviar.
   */
  const lista: ServicioParaSolicitar[] = servicios
    ? [
        ...servicios,
        {
          id: SERVICIO_OTRO,
          nombre: OTROS_SERVICIOS,
          descripcion: null,
        },
      ]
    : [];

  const marcados = lista.filter((s) => elegidos.includes(s.id));
  const alternar = (id: string) =>
    onCambio(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  const q = busqueda.trim().toLowerCase();
  // *Otros* no se esconde al buscar: es justo lo que sirve cuando no aparece.
  const visibles = q
    ? lista.filter((s) => s.id === SERVICIO_OTRO || s.nombre.toLowerCase().includes(q))
    : lista;
  const cerrar = () => {
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <View>
      <Text style={styles.rotulo}>¿QUÉ SERVICIOS NECESITAS?</Text>
      <Pressable
        disabled={servicios === null && !fallo}
        onPress={() => {
          if (fallo) return cargar();
          // Que el teclado no quede abierto debajo del cajón.
          Keyboard.dismiss();
          setAbierto(true);
        }}
        style={({ pressed }) => [styles.campo, error && styles.campoError, pressed && styles.tocado]}
      >
        <Ionicons name="construct-outline" size={18} color={tema.verde700} />
        <Text style={styles.campoTexto}>
          {fallo
            ? "No pudimos cargar los servicios. Toca para reintentar."
            : servicios === null
              ? "Cargando servicios…"
              : marcados.length === 0
            ? "Seleccionar servicios"
            : marcados.length === 1
              ? "1 servicio seleccionado"
              : `${marcados.length} servicios seleccionados`}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
      </Pressable>
      {error ? <Text style={styles.textoError}>Elige al menos un servicio.</Text> : null}

      {marcados.length > 0 ? (
        <View style={styles.pastillas}>
          {marcados.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => alternar(s.id)}
              style={({ pressed }) => [styles.pastilla, pressed && styles.tocado]}
              accessibilityLabel={`Quitar ${s.nombre}`}
            >
              <Text style={styles.pastillaTexto}>{s.nombre}</Text>
              <Ionicons name="close" size={15} color={tema.verde700} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <HojaInferior visible={abierto} onCerrar={cerrar} maxAlto={0.85}>
        <View style={styles.cabecera}>
          <Text style={styles.titulo}>Servicios</Text>
          <Pressable onPress={cerrar} hitSlop={10}>
            <Text style={styles.listo}>Listo</Text>
          </Pressable>
        </View>
        <View style={styles.buscadorCaja}>
          <Searchbar
            placeholder="Buscar servicio"
            value={busqueda}
            onChangeText={setBusqueda}
            elevation={0}
            style={styles.buscador}
            inputStyle={styles.buscadorTexto}
          />
        </View>
        <ScrollView
          style={styles.lista}
          contentContainerStyle={styles.listaCuerpo}
          keyboardShouldPersistTaps="handled"
        >
          {visibles.map((s) => {
            const marcado = elegidos.includes(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => alternar(s.id)}
                style={({ pressed }) => [styles.fila, pressed && styles.filaTocada]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcado }}
              >
                <Ionicons
                  name={marcado ? "checkbox" : "square-outline"}
                  size={22}
                  color={marcado ? tema.verde : tema.texto3}
                />
                <View style={styles.filaTexto}>
                  <Text style={styles.nombre}>{s.nombre}</Text>
                  {s.descripcion ? (
                    <Text style={styles.descripcion} numberOfLines={1}>
                      {s.descripcion}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

        </ScrollView>
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 8 },
  campo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  campoError: { borderColor: tema.rojo, borderWidth: 2 },
  textoError: { color: tema.rojo, fontSize: 12, paddingLeft: 12, paddingTop: 4 },
  campoTexto: { flex: 1, color: tema.texto, fontSize: 15 },
  tocado: { opacity: 0.7 },
  pastillas: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 6,
    backgroundColor: tema.verde50,
  },
  pastillaTexto: { color: tema.verde700, fontSize: 14, fontWeight: "600" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  listo: { color: tema.verde700, fontSize: 16, fontWeight: "600" },
  buscadorCaja: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  buscador: { backgroundColor: tema.lienzo, borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },
  lista: { flexGrow: 0 },
  listaCuerpo: { paddingBottom: 24 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  filaTocada: { backgroundColor: tema.lienzo },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontSize: 15 },
  descripcion: { color: tema.texto3, fontSize: 13 },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
});
