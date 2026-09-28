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
import { HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { CreatePropiedadBody } from "@vivero/shared";
import { BuscadorDeDireccion } from "@/components/BuscadorDeDireccion";
import {
  MapaDePropiedad,
  ZOOM_DE_BARRIO,
  zoomSegunPrecision,
  type Destino,
  type Punto,
} from "@/components/MapaDePropiedad";
import { SelectorSector } from "@/components/SelectorSector";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
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
 * **El punto se elige acá, en el mismo mapa que el portal** (`MapaDePropiedad`,
 * nativo): tocando, arrastrando, o con el GPS de quien está parado en la
 * puerta —que sigue siendo el mejor dato— y el ajuste fino en el acto. Antes
 * la app solo tomaba el GPS y el mapa se dejaba al portal, por no pagar dos
 * claves más; el ajuste esperaba a una computadora.
 *
 * **Los campos están separados del formulario** (`useCamposDePropiedad` +
 * `CamposDePropiedad`) porque el alta del cliente los pide también: el cliente
 * nace con su primera propiedad, y ese formulario pedía la dirección y los
 * metros totales y nada más —ni el punto, ni las otras medidas, ni las
 * notas—, así que la propiedad quedaba a medio cargar hasta que alguien la
 * reabría. Dos listas de los mismos campos son dos listas que se separan.
 */
export interface PropiedadFormProps {
  initial?: PropiedadResumen | null;
  /** "Nueva propiedad", o el nombre de la que se edita. */
  titulo: string;
  /** "Agregar", "Guardar": la acción, a la derecha del encabezado. */
  accion: string;
  onSubmit: (values: CreatePropiedadBody) => Promise<void>;
  /** Por defecto vuelve atrás. */
  onCancelar?: () => void;
  /** Solo al editar. El servidor se niega si la propiedad tiene visitas. */
  onEliminar?: () => Promise<void>;
}

/** Con qué arranca: lo guardado, o lo que otro formulario ya traía. */
export type PropiedadInicial = Partial<CreatePropiedadBody>;

/** Lo que devuelve el servidor, en la forma que se manda. */
export function propiedadInicialDesde(p: PropiedadResumen): PropiedadInicial {
  return {
    nombre: p.nombre,
    sectorId: p.sector?.id ?? null,
    direccion: p.direccion,
    numeroCasa: p.numeroCasa,
    ciudad: p.ciudad,
    referencia: p.referencia,
    notas: p.notas,
    lat: p.lat,
    lng: p.lng,
    jardinerasPlantaAlta: p.jardinerasPlantaAlta,
    m2Total: p.m2Total,
    m2Cesped: p.m2Cesped,
    numeroArboles: p.numeroArboles,
    mlVegetacionBaja: p.mlVegetacionBaja,
    mlVegetacionMedia: p.mlVegetacionMedia,
    mlVegetacionAlta: p.mlVegetacionAlta,
  };
}

/** Las seis medidas, como texto mientras se escriben. */
type Medidas = Record<
  | "m2Total"
  | "m2Cesped"
  | "numeroArboles"
  | "mlVegetacionBaja"
  | "mlVegetacionMedia"
  | "mlVegetacionAlta",
  string
>;

function comoTexto(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

/**
 * El estado de los campos y cómo se convierte en lo que se manda.
 *
 * `armar` valida y devuelve los valores o el error que hay que mostrar: los
 * números vacíos son "todavía no se midió" (null), y uno con letras es un
 * error de tipeo que conviene decir acá y no como un 400 sin contexto.
 */
export function useCamposDePropiedad(initial?: PropiedadInicial | null) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [sectorId, setSectorId] = useState<string | null>(
    initial?.sectorId ?? null
  );
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");
  const [numeroCasa, setNumeroCasa] = useState(initial?.numeroCasa ?? "");
  const [ciudad, setCiudad] = useState(initial?.ciudad ?? "");
  const [referencia, setReferencia] = useState(initial?.referencia ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [jardineras, setJardineras] = useState(
    initial?.jardinerasPlantaAlta ?? false
  );
  const [medidas, setMedidas] = useState<Medidas>(() => ({
    m2Total: comoTexto(initial?.m2Total),
    m2Cesped: comoTexto(initial?.m2Cesped),
    numeroArboles: comoTexto(initial?.numeroArboles),
    mlVegetacionBaja: comoTexto(initial?.mlVegetacionBaja),
    mlVegetacionMedia: comoTexto(initial?.mlVegetacionMedia),
    mlVegetacionAlta: comoTexto(initial?.mlVegetacionAlta),
  }));

  /** El punto, y con cuántos metros de error llegó si lo trajo el GPS. */
  const [punto, setPunto] = useState<Punto | null>(
    initial?.lat !== null &&
      initial?.lat !== undefined &&
      initial?.lng !== null &&
      initial?.lng !== undefined
      ? { lat: initial.lat, lng: initial.lng }
      : null
  );
  const [precision, setPrecision] = useState<number | null>(null);
  const [ubicando, setUbicando] = useState(false);
  /** A dónde llevar el mapa: lo mueven el GPS y el buscador, nunca el dedo. */
  const [destino, setDestino] = useState<Destino | null>(null);

  const viajarA = (p: Punto, zoom: number) =>
    setDestino((d) => ({ ...p, zoom, n: (d?.n ?? 0) + 1 }));

  /** Tocar o arrastrar: el pin queda donde el dedo lo puso, sin error de GPS. */
  function ponerPunto(p: Punto | null) {
    setPunto(p);
    setPrecision(null);
  }

  /** Una dirección buscada: el mapa va al barrio y el pin no se toca. */
  function irA(p: Punto) {
    viajarA(p, ZOOM_DE_BARRIO);
  }

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
        "No llegó una posición. Prueba afuera, o pon el punto tocando el mapa."
      );
      return;
    }

    const p = { lat: res.ubicacion.lat, lng: res.ubicacion.lng };
    setPunto(p);
    setPrecision(res.ubicacion.precision);
    viajarA(p, zoomSegunPrecision(res.ubicacion.precision));
  }

  function quitarUbicacion() {
    setPunto(null);
    setPrecision(null);
  }

  function armar(opciones?: {
    /**
     * En el alta del cliente el nombre puede quedar vacío y se llama
     * "Principal": la mayoría tiene una sola propiedad y no hay nada que
     * distinguir.
     */
    nombreOpcional?: boolean;
  }):
    | { ok: true; valores: CreatePropiedadBody }
    | { ok: false; error: string } {
    if (!opciones?.nombreOpcional && !nombre.trim()) {
      return { ok: false, error: "Ponle un nombre a la propiedad" };
    }

    const numeros: Record<string, number | null> = {};
    for (const [clave, texto] of Object.entries(medidas)) {
      const limpio = texto.trim();
      if (!limpio) {
        numeros[clave] = null;
        continue;
      }
      const n = Number(limpio);
      if (!Number.isFinite(n) || n < 0) {
        return {
          ok: false,
          error: `${ETIQUETAS[clave as keyof Medidas]} tiene que ser un número`,
        };
      }
      numeros[clave] = clave === "numeroArboles" ? Math.round(n) : n;
    }

    return {
      ok: true,
      valores: {
        nombre: nombre.trim() || "Principal",
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
      },
    };
  }

  return {
    nombre,
    setNombre,
    sectorId,
    setSectorId,
    direccion,
    setDireccion,
    numeroCasa,
    setNumeroCasa,
    ciudad,
    setCiudad,
    referencia,
    setReferencia,
    notas,
    setNotas,
    jardineras,
    setJardineras,
    medidas,
    cambiarMedida,
    punto,
    precision,
    destino,
    ubicando,
    tomarUbicacion,
    quitarUbicacion,
    ponerPunto,
    irA,
    armar,
  };
}

export type CamposDePropiedadState = ReturnType<typeof useCamposDePropiedad>;

/**
 * Los campos, en el orden en que se cargan parado en la puerta: nombre,
 * sector, dirección, el punto, las medidas y las notas.
 */
export function CamposDePropiedad({
  campos,
  dentroDelCliente = false,
}: {
  campos: CamposDePropiedadState;
  /**
   * En el alta del cliente: el bloque se llama "Propiedad" (el cliente ya tuvo
   * su "Nombre" arriba), el nombre es opcional y las notas dicen de quién son.
   */
  dentroDelCliente?: boolean;
}) {
  const c = campos;

  return (
    <>
      <Titulo>{dentroDelCliente ? "Propiedad" : "Nombre"}</Titulo>
      <Campo
        label={dentroDelCliente ? "Nombre de la propiedad" : "Nombre"}
        required={!dentroDelCliente}
        value={c.nombre}
        onChangeText={c.setNombre}
        placeholder="Casa, Oficina, Quinta…"
      />
      {dentroDelCliente ? (
        <Text style={styles.ayudaCampo}>
          Para distinguirla si el cliente tiene más de una. Si la dejas vacía
          se llama Principal.
        </Text>
      ) : null}

      <Titulo>Sector</Titulo>
      <SelectorSector value={c.sectorId} onChange={c.setSectorId} />

      <Titulo>Dirección</Titulo>
      {/* Buscar completa los campos de abajo; el pin no sale de acá —ver
          `BuscadorDeDireccion`—. */}
      <BuscadorDeDireccion
        onElegir={(d) => {
          if (d.direccion) c.setDireccion(d.direccion);
          if (d.numeroCasa) c.setNumeroCasa(d.numeroCasa);
          if (d.ciudad) c.setCiudad(d.ciudad);
          if (d.lat !== null && d.lng !== null) c.irA({ lat: d.lat, lng: d.lng });
        }}
      />
      <Campo label="Calle" value={c.direccion} onChangeText={c.setDireccion} />
      <Campo
        label="Número de casa"
        value={c.numeroCasa}
        onChangeText={c.setNumeroCasa}
      />
      <Campo label="Ciudad" value={c.ciudad} onChangeText={c.setCiudad} />
      <Campo
        label="Referencia"
        value={c.referencia}
        onChangeText={c.setReferencia}
      />

      {/* El punto exacto: la dirección escrita no alcanza para encontrar una
          casa adentro de una urbanización. */}
      <Titulo>En el mapa</Titulo>
      <MapaDePropiedad
        punto={c.punto}
        precision={c.precision}
        destino={c.destino}
        ubicando={c.ubicando}
        onCambio={c.ponerPunto}
        onUsarMiUbicacion={c.tomarUbicacion}
      />

      <Titulo>Lo que hay que mantener</Titulo>
      <Campo
        label={ETIQUETAS.m2Total}
        value={c.medidas.m2Total}
        onChangeText={c.cambiarMedida("m2Total")}
        keyboardType="decimal-pad"
      />
      <Campo
        label={ETIQUETAS.m2Cesped}
        value={c.medidas.m2Cesped}
        onChangeText={c.cambiarMedida("m2Cesped")}
        keyboardType="decimal-pad"
      />
      <Campo
        label={ETIQUETAS.numeroArboles}
        value={c.medidas.numeroArboles}
        onChangeText={c.cambiarMedida("numeroArboles")}
        keyboardType="number-pad"
      />
      <Campo
        label={ETIQUETAS.mlVegetacionBaja}
        value={c.medidas.mlVegetacionBaja}
        onChangeText={c.cambiarMedida("mlVegetacionBaja")}
        keyboardType="decimal-pad"
      />
      <Campo
        label={ETIQUETAS.mlVegetacionMedia}
        value={c.medidas.mlVegetacionMedia}
        onChangeText={c.cambiarMedida("mlVegetacionMedia")}
        keyboardType="decimal-pad"
      />
      <Campo
        label={ETIQUETAS.mlVegetacionAlta}
        value={c.medidas.mlVegetacionAlta}
        onChangeText={c.cambiarMedida("mlVegetacionAlta")}
        keyboardType="decimal-pad"
      />
      <View style={styles.interruptor}>
        <Text variant="bodyLarge" style={styles.interruptorTexto}>
          Jardineras en planta alta
        </Text>
        <Switch
          value={c.jardineras}
          onValueChange={c.setJardineras}
          trackColor={{ true: tema.verde100, false: undefined }}
          thumbColor={c.jardineras ? tema.verde : undefined}
        />
      </View>

      <Titulo>{dentroDelCliente ? "Notas de la propiedad" : "Notas"}</Titulo>
      <TextInput
        mode="outlined"
        value={c.notas}
        onChangeText={c.setNotas}
        multiline
        numberOfLines={5}
        placeholder="Portón lateral, perro suelto, la llave la tiene el guardia…"
        outlineColor={tema.linea}
        activeOutlineColor={tema.verde}
        outlineStyle={styles.borde}
        style={[styles.campo, styles.notas]}
        contentStyle={styles.notasContenido}
      />
    </>
  );
}

export function PropiedadForm({
  initial,
  titulo,
  accion,
  onSubmit,
  onCancelar,
  onEliminar,
}: PropiedadFormProps) {
  const router = useRouter();
  const campos = useCamposDePropiedad(
    initial ? propiedadInicialDesde(initial) : null
  );

  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const armado = campos.armar();
    if (!armado.ok) {
      setError(armado.error);
      return;
    }

    setError(null);
    setGuardando(true);
    try {
      await onSubmit(armado.valores);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  function confirmarEliminar() {
    if (!onEliminar) return;
    Alert.alert(
      `Eliminar ${campos.nombre.trim() || "la propiedad"}`,
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

  /* La acción va en el encabezado, como en Nueva orden: es lo único que no se
     va scrolleando, y un botón al pie quedaba debajo del teclado. El error se
     muestra arriba, pegado a él, que es donde se mira al tocarlo. */
  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={titulo}
        accion={accion}
        onAccion={guardar}
        onCancelar={onCancelar ?? (() => router.back())}
        cargando={guardando}
        deshabilitado={borrando || !campos.nombre.trim()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}

          <CamposDePropiedad campos={campos} />

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
      </KeyboardAvoidingView>
    </View>
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
  ayudaCampo: {
    color: tema.texto3,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: -2,
    marginBottom: 8,
  },

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

  error: { textAlign: "center", marginTop: 4 },

  eliminarExterno: { marginTop: 24 },
  eliminar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tema.rojo50,
  },
  eliminarTexto: { color: tema.rojo, fontWeight: "600", fontSize: 15 },
});
