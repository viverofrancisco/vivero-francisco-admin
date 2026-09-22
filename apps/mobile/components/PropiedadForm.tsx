import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import {
  ActivityIndicator,
  HelperText,
  Text,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CreatePropiedadBody } from "@vivero/shared";
import { BuscadorDeDireccion } from "@/components/BuscadorDeDireccion";
import { SelectorSector } from "@/components/SelectorSector";
import { PressableScale } from "@/components/ui/PressableScale";
import { avisarFaltaUbicacion, ubicacionActual } from "@/lib/ubicacion";
import type { PropiedadResumen } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Una propiedad: el lugar donde se trabaja.
 *
 * La dirección era del cliente y se mudó acá — un cliente con dos casas tiene
 * dos direcciones y ninguna es "la suya" —, y el sector vino con ella porque es
 * geográfico: es del lugar, no de la persona.
 *
 * Los números de abajo son **lo que hay que mantener**, que es con lo que se
 * cotiza: cuántos metros de césped cortar, cuántos metros lineales de seto y a
 * qué altura. Todos opcionales, porque se miden con el tiempo y una propiedad
 * recién cargada ya sirve para agendarle una visita.
 *
 * **El punto se toma acá, el mapa está en el portal.** Poner un mapa en la app
 * es otra clave de Google, la de iOS y la de Android, y un mapa de 300 px para
 * arrastrar un pin con el pulgar. Lo que el teléfono hace mejor que el portal
 * es lo otro: quien carga la propiedad suele estar parado en la puerta, así que
 * el GPS de ese momento es mejor dato que cualquier arrastre hecho de memoria
 * al día siguiente. El ajuste fino, si hace falta, se hace después sobre el
 * mapa.
 */
export interface PropiedadFormProps {
  initial?: PropiedadResumen | null;
  submitLabel: string;
  onSubmit: (values: CreatePropiedadBody) => Promise<void>;
  /** Solo al editar. El servidor se niega si la propiedad tiene visitas. */
  onEliminar?: () => Promise<void>;
}

/** Las siete medidas, como texto mientras se escriben. */
type Medidas = Record<
  | "m2Total"
  | "m2Cesped"
  | "numeroArboles"
  | "mlVegetacionBaja"
  | "mlVegetacionMedia"
  | "mlVegetacionAlta",
  string
>;

const MEDIDAS_VACIAS: Medidas = {
  m2Total: "",
  m2Cesped: "",
  numeroArboles: "",
  mlVegetacionBaja: "",
  mlVegetacionMedia: "",
  mlVegetacionAlta: "",
};

function comoTexto(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

export function PropiedadForm({
  initial,
  submitLabel,
  onSubmit,
  onEliminar,
}: PropiedadFormProps) {
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [sectorId, setSectorId] = useState<string | null>(
    initial?.sector?.id ?? null
  );
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");
  const [numeroCasa, setNumeroCasa] = useState(initial?.numeroCasa ?? "");
  const [ciudad, setCiudad] = useState(initial?.ciudad ?? "");
  const [referencia, setReferencia] = useState(initial?.referencia ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [jardineras, setJardineras] = useState(
    initial?.jardinerasPlantaAlta ?? false
  );
  const [medidas, setMedidas] = useState<Medidas>(() =>
    initial
      ? {
          m2Total: comoTexto(initial.m2Total),
          m2Cesped: comoTexto(initial.m2Cesped),
          numeroArboles: comoTexto(initial.numeroArboles),
          mlVegetacionBaja: comoTexto(initial.mlVegetacionBaja),
          mlVegetacionMedia: comoTexto(initial.mlVegetacionMedia),
          mlVegetacionAlta: comoTexto(initial.mlVegetacionAlta),
        }
      : MEDIDAS_VACIAS
  );

  /** El punto, y con cuántos metros de error llegó. */
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    initial?.lat !== null && initial?.lat !== undefined && initial?.lng !== null
      ? { lat: initial.lat, lng: initial.lng as number }
      : null
  );
  const [precision, setPrecision] = useState<number | null>(null);
  const [ubicando, setUbicando] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarMedida = (clave: keyof Medidas) => (t: string) =>
    setMedidas((m) => ({ ...m, [clave]: t.replace(/[^\d.]/g, "") }));

  async function tomarUbicacion() {
    setUbicando(true);
    const res = await ubicacionActual();
    setUbicando(false);

    if (res.estado === "sin-permiso") {
      avisarFaltaUbicacion(
        "Sin ubicación no podemos marcar dónde queda la propiedad.",
        res.ajustes
      );
      return;
    }
    if (res.estado === "sin-senal") {
      Alert.alert(
        "No pudimos ubicarte",
        "No llegó una posición. Prueba afuera, o carga la dirección y pon el punto después desde el portal."
      );
      return;
    }

    setPunto({ lat: res.ubicacion.lat, lng: res.ubicacion.lng });
    setPrecision(res.ubicacion.precision);
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponle un nombre a la propiedad");
      return;
    }

    // Un campo vacío es "todavía no se midió" (null); uno con letras es un
    // error de tipeo que conviene decir acá y no como un 400 sin contexto.
    const numeros: Record<string, number | null> = {};
    for (const [clave, texto] of Object.entries(medidas)) {
      const limpio = texto.trim();
      if (!limpio) {
        numeros[clave] = null;
        continue;
      }
      const n = Number(limpio);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${ETIQUETAS[clave as keyof Medidas]} tiene que ser un número`);
        return;
      }
      numeros[clave] = clave === "numeroArboles" ? Math.round(n) : n;
    }

    setError(null);
    setGuardando(true);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        sectorId: sectorId ?? null,
        direccion: direccion.trim() || null,
        numeroCasa: numeroCasa.trim() || null,
        ciudad: ciudad.trim() || null,
        referencia: referencia.trim() || null,
        notas: notas.trim() || null,
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
        jardinerasPlantaAlta: jardineras,
        m2Total: numeros.m2Total,
        m2Cesped: numeros.m2Cesped,
        numeroArboles: numeros.numeroArboles,
        mlVegetacionBaja: numeros.mlVegetacionBaja,
        mlVegetacionMedia: numeros.mlVegetacionMedia,
        mlVegetacionAlta: numeros.mlVegetacionAlta,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  function confirmarEliminar() {
    if (!onEliminar) return;
    Alert.alert(
      `Eliminar ${nombre.trim() || "la propiedad"}`,
      "Deja de aparecer al agendar. Si tiene visitas hechas no se puede eliminar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setBorrando(true);
            try {
              await onEliminar();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo eliminar");
            } finally {
              setBorrando(false);
            }
          },
        },
      ]
    );
  }

  const ocupado = guardando || borrando;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Titulo>Nombre</Titulo>
        <Campo
          label="Nombre"
          required
          value={nombre}
          onChangeText={setNombre}
          placeholder="Casa, Oficina, Quinta…"
        />

        <Titulo>Sector</Titulo>
        <SelectorSector value={sectorId} onChange={setSectorId} />

        <Titulo>Dirección</Titulo>
        {/* Buscar completa los campos de abajo; el pin no sale de acá —ver
            `BuscadorDeDireccion`—. */}
        <BuscadorDeDireccion
          onElegir={(d) => {
            if (d.direccion) setDireccion(d.direccion);
            if (d.numeroCasa) setNumeroCasa(d.numeroCasa);
            if (d.ciudad) setCiudad(d.ciudad);
          }}
        />
        <Campo label="Calle" value={direccion} onChangeText={setDireccion} />
        <Campo
          label="Número de casa"
          value={numeroCasa}
          onChangeText={setNumeroCasa}
        />
        <Campo label="Ciudad" value={ciudad} onChangeText={setCiudad} />
        <Campo
          label="Referencia"
          value={referencia}
          onChangeText={setReferencia}
        />

        <Titulo>Ubicación</Titulo>
        <View style={styles.ubicacion}>
          {punto ? (
            <>
              <Text style={styles.coordenadas}>
                {punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}
              </Text>
              {precision !== null ? (
                <Text
                  style={[
                    styles.ayuda,
                    precision > 150 ? styles.ayudaAtencion : null,
                  ]}
                >
                  {precision > 150
                    ? `Llegó con ±${Math.round(
                        precision
                      )} m: conviene corregirlo en el mapa del portal.`
                    : `±${Math.round(precision)} m`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.ayuda}>
              Sin punto en el mapa. Si estás en la propiedad, tomalo ahora: es
              mejor dato que ubicarla después de memoria.
            </Text>
          )}

          <View style={styles.ubicacionBotones}>
            <PressableScale
              onPress={tomarUbicacion}
              disabled={ubicando}
              estiloExterno={styles.crece}
              style={styles.botonSuave}
            >
              {ubicando ? (
                <ActivityIndicator size="small" color={tema.verde} />
              ) : (
                <Text style={styles.botonSuaveTexto}>
                  {punto ? "Volver a tomar" : "Usar mi ubicación"}
                </Text>
              )}
            </PressableScale>
            {punto ? (
              <PressableScale
                onPress={() => {
                  setPunto(null);
                  setPrecision(null);
                }}
                style={styles.botonSuave}
              >
                <Text style={styles.botonSuaveTexto}>Quitar</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>

        <Titulo>Lo que hay que mantener</Titulo>
        <Campo
          label={ETIQUETAS.m2Total}
          value={medidas.m2Total}
          onChangeText={cambiarMedida("m2Total")}
          keyboardType="decimal-pad"
        />
        <Campo
          label={ETIQUETAS.m2Cesped}
          value={medidas.m2Cesped}
          onChangeText={cambiarMedida("m2Cesped")}
          keyboardType="decimal-pad"
        />
        <Campo
          label={ETIQUETAS.numeroArboles}
          value={medidas.numeroArboles}
          onChangeText={cambiarMedida("numeroArboles")}
          keyboardType="number-pad"
        />
        <Campo
          label={ETIQUETAS.mlVegetacionBaja}
          value={medidas.mlVegetacionBaja}
          onChangeText={cambiarMedida("mlVegetacionBaja")}
          keyboardType="decimal-pad"
        />
        <Campo
          label={ETIQUETAS.mlVegetacionMedia}
          value={medidas.mlVegetacionMedia}
          onChangeText={cambiarMedida("mlVegetacionMedia")}
          keyboardType="decimal-pad"
        />
        <Campo
          label={ETIQUETAS.mlVegetacionAlta}
          value={medidas.mlVegetacionAlta}
          onChangeText={cambiarMedida("mlVegetacionAlta")}
          keyboardType="decimal-pad"
        />
        <View style={styles.interruptor}>
          <Text variant="bodyLarge" style={styles.interruptorTexto}>
            Jardineras en planta alta
          </Text>
          <Switch
            value={jardineras}
            onValueChange={setJardineras}
            trackColor={{ true: tema.verde100, false: undefined }}
            thumbColor={jardineras ? tema.verde : undefined}
          />
        </View>

        <Titulo>Notas</Titulo>
        <TextInput
          mode="outlined"
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={5}
          placeholder="Portón lateral, perro suelto, la llave la tiene el guardia…"
          outlineColor={tema.linea}
          activeOutlineColor={tema.verde}
          outlineStyle={styles.borde}
          style={[styles.campo, styles.notas]}
          contentStyle={styles.notasContenido}
        />

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        {onEliminar ? (
          <PressableScale
            onPress={confirmarEliminar}
            disabled={ocupado}
            estiloExterno={styles.eliminarExterno}
            style={styles.eliminar}
          >
            <Text style={styles.eliminarTexto}>
              {borrando ? "Eliminando…" : "Eliminar propiedad"}
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>

      <View
        style={[styles.pie, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <PressableScale
          onPress={guardar}
          disabled={ocupado || !nombre.trim()}
          estiloExterno={styles.ancho}
          style={[
            styles.guardar,
            (ocupado || !nombre.trim()) && styles.guardarApagado,
          ]}
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.guardarTexto}>{submitLabel}</Text>
          )}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const ETIQUETAS: Record<keyof Medidas, string> = {
  m2Total: "Metros² totales",
  m2Cesped: "Metros² de césped",
  numeroArboles: "Número de árboles",
  mlVegetacionBaja: "Metros lineales de vegetación baja",
  mlVegetacionMedia: "Metros lineales de vegetación media",
  mlVegetacionAlta: "Metros lineales de vegetación alta",
};

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="labelMedium" style={styles.tituloSeccion}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function Campo({
  label,
  required,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  placeholder?: string;
}) {
  return (
    <TextInput
      mode="outlined"
      label={required ? `${label} *` : label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      outlineColor={tema.linea}
      activeOutlineColor={tema.verde}
      outlineStyle={styles.borde}
      style={styles.campo}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  tituloSeccion: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginTop: 18,
    marginBottom: 8,
  },

  campo: { marginBottom: 8, backgroundColor: "#fff" },
  borde: { borderRadius: 12 },

  ubicacion: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  coordenadas: {
    color: tema.texto,
    fontVariant: ["tabular-nums"],
    fontSize: 15,
  },
  ayuda: { color: tema.texto3, fontSize: 13, lineHeight: 19 },
  ayudaAtencion: { color: tema.ambarTexto },
  ubicacionBotones: { flexDirection: "row", gap: 8 },
  crece: { flex: 1 },
  botonSuave: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: tema.verde50,
  },
  botonSuaveTexto: { color: tema.verde700, fontWeight: "600", fontSize: 15 },

  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  interruptorTexto: { color: tema.texto, flexShrink: 1 },

  notas: { minHeight: 110 },
  notasContenido: { paddingTop: 12, paddingBottom: 12 },

  error: { textAlign: "center", marginTop: 16 },

  eliminarExterno: { marginTop: 24 },
  eliminar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tema.rojo50,
  },
  eliminarTexto: { color: tema.rojo, fontWeight: "600", fontSize: 15 },

  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  ancho: { alignSelf: "stretch" },
  guardar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: tema.verde,
  },
  guardarApagado: { backgroundColor: tema.linea },
  guardarTexto: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
