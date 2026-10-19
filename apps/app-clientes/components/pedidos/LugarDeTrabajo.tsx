import { useState } from "react";
import {
  Alert,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  DIAS_DE_LA_SEMANA,
  enlaceParaLlegar,
  horaLegible,
  type HorarioSemanal,
} from "@vivero/shared";
import type { PropiedadResumen } from "@vivero/app-ui/lib/types";
import {
  avisarFaltaUbicacion,
  ubicacionActual,
} from "@vivero/app-ui/lib/ubicacion";
import { BuscadorDeDireccion } from "@vivero/app-ui/components/BuscadorDeDireccion";
import {
  MapaDePropiedad,
  ZOOM_DE_BARRIO,
  zoomSegunPrecision,
  type Destino,
  type Punto,
} from "@vivero/app-ui/components/MapaDePropiedad";
import { tema } from "@vivero/app-ui/lib/tema";
import { SelectorDeCiudad } from "@vivero/app-ui/components/SelectorDeCiudad";

/**
 * Dónde es algo del cliente —adónde se lleva un pedido, dónde es el trabajo de
 * una solicitud—: **una de sus propiedades**, u **otra dirección** con los
 * campos de una propiedad y el pin en el mapa. Lo usan el checkout y
 * *Solicitar visita*, para que pregunten lo mismo de la misma forma.
 */
export type Direccion =
  | { tipo: "PROPIEDAD"; propiedadId: string }
  | {
      tipo: "OTRA";
      direccion: string;
      numeroCasa: string;
      ciudad: string;
      referencia: string;
      punto: Punto | null;
      /**
       * *Guardar dirección para futuros pedidos*, marcado de entrada: si queda
       * así, el servidor la vuelve una propiedad suya. Es su decisión —un
       * regalo a la casa de un pariente no tiene por qué quedar guardado—.
       */
      guardar: boolean;
    };

export const OTRA_DIRECCION: Extract<Direccion, { tipo: "OTRA" }> = {
  tipo: "OTRA",
  direccion: "",
  numeroCasa: "",
  ciudad: "",
  referencia: "",
  punto: null,
  guardar: true,
};

/** Con lo que arranca: la primera de sus propiedades, o otra dirección. */
export function direccionInicial(propiedades: PropiedadResumen[]): Direccion {
  return propiedades[0]
    ? { tipo: "PROPIEDAD", propiedadId: propiedades[0].id }
    : OTRA_DIRECCION;
}

/** Si alcanza para seguir: una propiedad que existe, o calle y pin. */
export function direccionLista(
  d: Direccion | null,
  propiedades: PropiedadResumen[],
): boolean {
  if (!d) return false;
  if (d.tipo === "PROPIEDAD")
    return propiedades.some((p) => p.id === d.propiedadId);
  // La ciudad también: "Calle 5" no dice nada sin saber si es Guayaquil o
  // Samborondón.
  return (
    d.direccion.trim().length >= 3 &&
    d.ciudad.trim().length > 0 &&
    d.punto !== null
  );
}

/** Los campos de *Otra dirección* como los recibe el servidor. */
export function camposDeOtra(d: Extract<Direccion, { tipo: "OTRA" }>) {
  return {
    direccion: d.direccion.trim(),
    numeroCasa: d.numeroCasa.trim() || undefined,
    ciudad: d.ciudad.trim() || undefined,
    referencia: d.referencia.trim() || undefined,
    lat: d.punto?.lat,
    lng: d.punto?.lng,
  };
}

/** "Urb. Isla Mocolí, Villa 12, Samborondón": la dirección de una propiedad en una línea. */
export const lineaDeDireccion = (p: {
  direccion: string | null;
  numeroCasa: string | null;
  ciudad: string | null;
}) => [p.direccion, p.numeroCasa, p.ciudad].filter(Boolean).join(", ") || null;

/** Abre el mapa del teléfono con la ruta hasta el pin; sin pin, nada que abrir. */
export const comoLlegar = (u: { lat: number | null; lng: number | null }) =>
  u.lat !== null && u.lng !== null
    ? () =>
        void Linking.openURL(enlaceParaLlegar(u.lat as number, u.lng as number))
    : undefined;

/**
 * Elegir dónde: una tarjeta por propiedad y *Otra dirección*, que abre el
 * buscador —completa la calle, el número y la ciudad y lleva el mapa al
 * barrio, pero **no pone el pin**: el de la urbanización no es la puerta—,
 * los campos y el mapa para marcar el punto.
 */
export function ElegirDireccion({
  propiedades,
  valor,
  onCambio,
  onElegirOtra,
  marcarFaltantes = false,
  sinGuardar = false,
  textoGuardar = "Guardar dirección para futuros pedidos",
}: {
  propiedades: PropiedadResumen[];
  valor: Direccion | null;
  onCambio: (d: Direccion) => void;
  /**
   * Al pasar a *Otra dirección*: dónde empieza su tarjeta, medido desde el
   * borde de arriba de este componente. Los campos y el mapa aparecen debajo
   * de la última tarjeta, que suele quedar al pie de la pantalla, y sin
   * moverse nadie se entera de que salieron: la pantalla usa esto para
   * subir hasta ahí.
   */
  onElegirOtra?: (y: number) => void;
  /**
   * Se intentó seguir sin terminar *Otra dirección*: la calle vacía y el pin
   * que falta se marcan en rojo, como cualquier campo obligatorio.
   */
  marcarFaltantes?: boolean;
  /**
   * Sin la casilla de guardar: el invitado no tiene cuenta
   * (su dirección pasa a ser la primera propiedad de la ficha que se le crea).
   */
  sinGuardar?: boolean;
  /** El rótulo de la casilla de guardar: los pedidos o las solicitudes. */
  textoGuardar?: string;
}) {
  const [precision, setPrecision] = useState<number | null>(null);
  const [yOtra, setYOtra] = useState(0);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [ubicando, setUbicando] = useState(false);
  // Sin propiedades no hay nada que elegir: los campos van directo, sin la
  // tarjeta *Otra dirección* (que solo tiene sentido frente a otras).
  const sinPropiedades = propiedades.length === 0;
  const otra =
    valor?.tipo === "OTRA" ? valor : sinPropiedades ? OTRA_DIRECCION : null;
  const cambiarOtra = (c: Partial<Extract<Direccion, { tipo: "OTRA" }>>) =>
    onCambio({ ...(otra ?? OTRA_DIRECCION), ...c } as Direccion);

  async function tomarUbicacion() {
    setUbicando(true);
    const res = await ubicacionActual();
    setUbicando(false);
    if (res.estado === "sin-permiso") {
      avisarFaltaUbicacion("Sin ubicación no podemos marcar el lugar.", res);
      return;
    }
    if (res.estado === "sin-senal") {
      Alert.alert("No pudimos ubicarte", "Pon el punto tocando el mapa.");
      return;
    }
    const p = { lat: res.ubicacion.lat, lng: res.ubicacion.lng };
    cambiarOtra({ punto: p });
    setPrecision(res.ubicacion.precision);
    setDestino((d) => ({
      ...p,
      zoom: zoomSegunPrecision(res.ubicacion.precision),
      n: (d?.n ?? 0) + 1,
    }));
  }

  return (
    <View style={styles.elegir}>
      {sinPropiedades ? null : (
        <View style={styles.tarjetas}>
          {propiedades.map((p) => (
            <TarjetaDeLugar
              key={p.id}
              activa={valor?.tipo === "PROPIEDAD" && valor.propiedadId === p.id}
              titulo={p.nombre}
              datos={[
                { icono: "location-outline", texto: lineaDeDireccion(p) },
                { icono: "flag-outline", texto: p.referencia },
              ]}
              onPress={() => onCambio({ tipo: "PROPIEDAD", propiedadId: p.id })}
            />
          ))}
          {/* Las tarjetas empiezan arriba de todo, así que su `y` es la de
            este componente. */}
          <View onLayout={(e) => setYOtra(e.nativeEvent.layout.y)}>
            <TarjetaDeLugar
              activa={valor?.tipo === "OTRA"}
              titulo="Otra dirección"
              detalle="Escríbela y marca el punto en el mapa."
              onPress={() => {
                const yaEstaba = valor?.tipo === "OTRA";
                onCambio(otra ?? OTRA_DIRECCION);
                if (!yaEstaba) onElegirOtra?.(yOtra);
              }}
            />
          </View>
        </View>
      )}
      {otra ? (
        <View style={styles.otra}>
          <BuscadorDeDireccion
            onElegir={(d) => {
              cambiarOtra({
                ...(d.direccion ? { direccion: d.direccion } : {}),
                ...(d.numeroCasa ? { numeroCasa: d.numeroCasa } : {}),
                ...(d.ciudad ? { ciudad: d.ciudad } : {}),
              });
              if (d.lat !== null && d.lng !== null) {
                const lat = d.lat;
                const lng = d.lng;
                setDestino((x) => ({
                  lat,
                  lng,
                  zoom: ZOOM_DE_BARRIO,
                  n: (x?.n ?? 0) + 1,
                }));
              }
            }}
          />
          <TextInput
            mode="outlined"
            label="Calle *"
            value={otra.direccion}
            onChangeText={(t) => cambiarOtra({ direccion: t })}
            error={marcarFaltantes && otra.direccion.trim().length < 3}
          />
          <TextInput
            mode="outlined"
            label="Número de casa"
            value={otra.numeroCasa}
            onChangeText={(t) => cambiarOtra({ numeroCasa: t })}
          />
          <SelectorDeCiudad
            etiqueta="Ciudad *"
            valor={otra.ciudad}
            onCambio={(ciudad) => cambiarOtra({ ciudad })}
            error={marcarFaltantes && !otra.ciudad.trim()}
            textoDeError="Elige la ciudad."
          />
          <TextInput
            mode="outlined"
            label="Referencia"
            value={otra.referencia}
            onChangeText={(t) => cambiarOtra({ referencia: t })}
            placeholder="Junto a la garita, casa esquinera…"
          />
          <MapaDePropiedad
            punto={otra.punto}
            precision={precision}
            destino={destino}
            ubicando={ubicando}
            onCambio={(p) => {
              cambiarOtra({ punto: p });
              setPrecision(null);
            }}
            onUsarMiUbicacion={tomarUbicacion}
            faltaPunto={marcarFaltantes && !otra.punto}
          />
          {sinGuardar ? null : (
            <Pressable
              onPress={() => cambiarOtra({ guardar: !otra.guardar })}
              style={({ pressed }) => [
                styles.guardar,
                pressed && styles.tocado,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: otra.guardar }}
            >
              <Ionicons
                name={otra.guardar ? "checkbox" : "square-outline"}
                size={22}
                color={otra.guardar ? tema.verde : tema.texto3}
              />
              <Text style={styles.guardarTexto}>{textoGuardar}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** La pastilla *Cómo llegar*: abre el mapa del teléfono con la ruta. */
export function BotonComoLlegar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.llegar, pressed && styles.tocado]}
      accessibilityRole="link"
    >
      <Ionicons name="navigate-outline" size={14} color={tema.verde} />
      <Text style={styles.llegarTexto}>Cómo llegar</Text>
    </Pressable>
  );
}

type Dato = { icono: keyof typeof Ionicons.glyphMap; texto: string | null };

/**
 * Un lugar para elegir —un vivero, una propiedad, otra dirección— en **su
 * propia tarjeta**: borde verde y fondo verde claro la elegida. Debajo del
 * nombre, sus datos con su ícono, *Ver horarios* si tiene y *Cómo llegar* si
 * tiene pin.
 */
export function TarjetaDeLugar({
  activa,
  titulo,
  detalle,
  datos,
  horarios,
  onComoLlegar,
  onPress,
}: {
  activa: boolean;
  titulo: string;
  detalle?: string;
  /** Renglones con su ícono —dirección, referencia, teléfono—; los vacíos no salen. */
  datos?: Dato[];
  horarios?: HorarioSemanal | null;
  /** *Cómo llegar*, cuando el lugar tiene pin. */
  onComoLlegar?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      // Elegir un lugar es salir del campo que se estaba escribiendo: con
      // `keyboardShouldPersistTaps` el toque llega, pero el teclado se quedaba.
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      style={({ pressed }) => [
        styles.lugar,
        activa && styles.lugarActivo,
        pressed && styles.tocado,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
    >
      <View style={styles.lugarCabeza}>
        <Text style={[styles.lugarTitulo, activa && styles.lugarTituloActivo]}>
          {titulo}
        </Text>
        <Ionicons
          name={activa ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={activa ? tema.verde : tema.texto3}
        />
      </View>
      {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}
      {datos
        ?.filter((d) => d.texto)
        .map((d) => (
          <View key={d.icono} style={styles.dato}>
            <Ionicons
              name={d.icono}
              size={14}
              color={tema.texto3}
              style={styles.datoIcono}
            />
            <Text style={[styles.detalle, styles.datoTexto]}>{d.texto}</Text>
          </View>
        ))}
      <HorarioPlegable horarios={horarios} />
      {onComoLlegar ? <BotonComoLlegar onPress={onComoLlegar} /> : null}
    </Pressable>
  );
}

/**
 * *Ver horarios*, que se despliega en los siete días, **uno por fila** aunque
 * se repitan: "¿abren el sábado?" se contesta mirando el sábado. Nada si el
 * lugar no tiene horario cargado.
 */
export function HorarioPlegable({
  horarios,
}: {
  horarios?: HorarioSemanal | null;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!horarios || horarios.length !== 7) return null;
  return (
    <View style={styles.horario}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        hitSlop={6}
        style={styles.horarioBoton}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <Ionicons name="time-outline" size={14} color={tema.verde} />
        <Text style={styles.horarioBotonTexto}>
          {abierto ? "Ocultar horarios" : "Ver horarios"}
        </Text>
        <Ionicons
          name={abierto ? "chevron-up" : "chevron-down"}
          size={14}
          color={tema.verde}
        />
      </Pressable>
      {abierto
        ? DIAS_DE_LA_SEMANA.map((dia, i) => (
            <View key={dia} style={styles.horarioFila}>
              <Text style={styles.horarioDia}>{dia}</Text>
              <Text
                style={[
                  styles.horarioHoras,
                  !horarios[i].abierto && styles.horarioCerrado,
                ]}
              >
                {horarios[i].abierto
                  ? `${horaLegible(horarios[i].desde)} – ${horaLegible(horarios[i].hasta)}`
                  : "Cerrado"}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  guardar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  guardarTexto: { color: tema.texto, fontSize: 15, flex: 1 },
  elegir: { gap: 10 },
  tarjetas: { gap: 10 },
  tocado: { opacity: 0.7 },
  lugar: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: "#fff",
    gap: 2,
  },
  lugarActivo: {
    borderColor: tema.verde,
    borderWidth: 2,
    padding: 13,
    backgroundColor: tema.verde50,
  },
  lugarCabeza: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  lugarTitulo: { flex: 1, color: tema.texto, fontSize: 16, fontWeight: "600" },
  lugarTituloActivo: { color: tema.verde700 },
  detalle: { color: tema.texto3, fontSize: 13, marginTop: 2 },
  dato: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 3,
  },
  datoIcono: { marginTop: 3 },
  datoTexto: { flex: 1, marginTop: 0 },
  horario: { marginTop: 6 },
  horarioBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  horarioBotonTexto: { color: tema.verde, fontSize: 13, fontWeight: "600" },
  horarioFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingLeft: 19,
  },
  horarioDia: { color: tema.texto2, fontSize: 13 },
  horarioHoras: {
    color: tema.texto,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  horarioCerrado: { color: tema.texto3 },
  llegar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tema.verde,
    backgroundColor: "#fff",
  },
  llegarTexto: { color: tema.verde, fontSize: 13, fontWeight: "600" },
  otra: { gap: 8 },
});
