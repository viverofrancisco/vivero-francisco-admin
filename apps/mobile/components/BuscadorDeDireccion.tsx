import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, ApiError } from "@/lib/api";
import { tema } from "@/lib/tema";

interface Sugerencia {
  id: string;
  principal: string;
  secundario: string;
}

export interface DireccionElegida {
  direccion: string | null;
  numeroCasa: string | null;
  ciudad: string | null;
}

/**
 * Buscar una dirección y que complete los campos.
 *
 * **No pone el punto del mapa, y eso es a propósito.** Lo que Google contesta
 * por "Blue Bay, Isla Mocolí" es el centro de la urbanización: doscientas casas
 * comparten ese punto, que es justo el dato que el pin viene a reemplazar.
 * Guardarlo como si fuera la puerta es peor que no tener pin, porque después
 * nadie sabe que era aproximado. En el portal el buscador tampoco pone el pin —
 * mueve el mapa y el ajuste fino se hace tocando—; acá no hay mapa, así que lo
 * que aporta es ahorrarse tipear la calle y la ciudad con el pulgar.
 *
 * La búsqueda pasa por nuestro servidor, que es donde vive la clave, y viaja
 * con un identificador de sesión: Google cobra todas las teclas de una misma
 * búsqueda como una sola consulta si comparten ese token.
 *
 * Si el servidor no tiene configurado el buscador (404), el campo desaparece:
 * el resto de la ficha se carga igual.
 */
export function BuscadorDeDireccion({
  onElegir,
}: {
  onElegir: (datos: DireccionElegida) => void;
}) {
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<Sugerencia[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const sesion = useRef<string | null>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) {
      setItems(null);
      return;
    }
    let vigente = true;
    const reloj = setTimeout(async () => {
      setBuscando(true);
      try {
        // El token de sesión se crea al empezar a escribir y se renueva al
        // elegir: es lo que junta todas las teclas en una sola consulta.
        sesion.current ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
        const res = await apiRequest<{ items: Sugerencia[] }>(
          "/api/mobile/lugares",
          { query: { q, sesion: sesion.current } }
        );
        if (vigente) setItems(res.items);
      } catch (e) {
        if (!vigente) return;
        // 404 = el servidor no tiene la clave con Places habilitado. No es un
        // error de quien está cargando la ficha, así que el campo se va.
        if (e instanceof ApiError && e.status === 404) setDisponible(false);
        setItems(null);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [texto]);

  async function elegir(s: Sugerencia) {
    try {
      const datos = await apiRequest<DireccionElegida>(
        `/api/mobile/lugares/${s.id}`,
        { query: { sesion: sesion.current ?? undefined } }
      );
      onElegir(datos);
    } catch {
      // Sin detalle, al menos queda el nombre en la calle.
      onElegir({ direccion: s.principal, numeroCasa: null, ciudad: null });
    } finally {
      // Pedir el detalle cierra la sesión: de acá en más hace falta otra.
      sesion.current = null;
      setTexto("");
      setItems(null);
    }
  }

  if (!disponible) return null;

  return (
    <View style={styles.caja}>
      <TextInput
        mode="outlined"
        label="Buscar una dirección"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        left={<TextInput.Icon icon="magnify" />}
        right={
          buscando ? (
            <TextInput.Icon icon={() => <ActivityIndicator size={16} />} />
          ) : texto ? (
            <TextInput.Icon icon="close" onPress={() => setTexto("")} />
          ) : undefined
        }
        outlineColor={tema.linea}
        activeOutlineColor={tema.verde}
        outlineStyle={styles.borde}
        style={styles.campo}
      />

      {items && items.length > 0 ? (
        <View style={styles.lista}>
          {items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => elegir(s)}
              style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
            >
              <Ionicons name="location-outline" size={18} color={tema.texto3} />
              <View style={styles.filaTexto}>
                <Text variant="bodyMedium" style={styles.principal} numberOfLines={1}>
                  {s.principal}
                </Text>
                {s.secundario ? (
                  <Text variant="bodySmall" style={styles.secundario} numberOfLines={1}>
                    {s.secundario}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text variant="bodySmall" style={styles.nota}>
        Completa la calle y la ciudad. El punto en el mapa se toma parado en la
        propiedad.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginBottom: 8 },
  campo: { backgroundColor: "#fff" },
  borde: { borderRadius: 12 },
  lista: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    overflow: "hidden",
    marginTop: 4,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  filaPresionada: { backgroundColor: "#fafafa" },
  filaTexto: { flex: 1, gap: 1 },
  principal: { color: tema.texto },
  secundario: { color: tema.texto3 },
  nota: { color: tema.texto3, marginTop: 6, paddingHorizontal: 4 },
});
