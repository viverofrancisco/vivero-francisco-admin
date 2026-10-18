import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text } from "react-native-paper";
import {
  HORARIO_POR_DEFECTO,
  textoDelHorario,
  type HorarioSemanal,
  type Ubicacion,
  type UbicacionBody,
} from "@vivero/shared";
import { EditorDeHorario } from "@/components/EditorDeHorario";
import { BotonEliminar, Campo, Interruptor, Titulo } from "@/components/ui/Formulario";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { BuscadorDeDireccion } from "@/components/BuscadorDeDireccion";
import {
  MapaDePropiedad,
  ZOOM_DE_BARRIO,
  zoomSegunPrecision,
  type Destino,
  type Punto,
} from "@/components/MapaDePropiedad";
import { avisarFaltaUbicacion, ubicacionActual } from "@/lib/ubicacion";
import { mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";
import { SelectorDeCiudad } from "@/components/SelectorDeCiudad";

/**
 * Una ubicación del vivero, como el *Add location* de Shopify: el nombre, la
 * dirección con el pin en el mapa, teléfono y horario, y dos interruptores
 * —si el cliente puede **retirar** ahí su pedido y si está **activa**—.
 *
 * *Cancelar* · título · *Crear* / *Guardar* arriba; al editar, *Guardar* se
 * prende solo cuando algo difiere de lo cargado.
 */
/**
 * El horario con las claves en orden fijo: Postgres devuelve el JSON
 * reordenado (`desde`, `hasta`, `abierto`), y compararlo tal cual con lo de la
 * pantalla daba "hay cambios" sin haber tocado nada.
 */
function ordenado(h: HorarioSemanal): HorarioSemanal {
  return h.map((d) => ({ abierto: d.abierto, desde: d.desde, hasta: d.hasta }));
}

export function UbicacionForm({
  inicial,
  titulo,
  accion,
  onSubmit,
  onCancelar,
  onEliminar,
}: {
  inicial?: Ubicacion;
  titulo: string;
  /** "Crear" o "Guardar". */
  accion: string;
  onSubmit: (valores: UbicacionBody) => Promise<void>;
  onCancelar: () => void;
  onEliminar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [direccion, setDireccion] = useState(inicial?.direccion ?? "");
  const [ciudad, setCiudad] = useState(inicial?.ciudad ?? "");
  const [referencia, setReferencia] = useState(inicial?.referencia ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  // Una sin horario cargado arranca con el de siempre, listo para corregir.
  const [horarios, setHorarios] = useState(() => ordenado(inicial?.horarios ?? HORARIO_POR_DEFECTO));
  const [retiro, setRetiro] = useState(inicial?.retiro ?? true);
  const [activa, setActiva] = useState(inicial?.activa ?? true);
  const [punto, setPunto] = useState<Punto | null>(
    inicial?.lat != null && inicial?.lng != null ? { lat: inicial.lat, lng: inicial.lng } : null
  );
  const [precision, setPrecision] = useState<number | null>(null);
  const [ubicando, setUbicando] = useState(false);
  /** A dónde llevar el mapa: lo mueven el GPS y el buscador, nunca el dedo. */
  const [destino, setDestino] = useState<Destino | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viajarA = (p: Punto, zoom: number) =>
    setDestino((d) => ({ ...p, zoom, n: (d?.n ?? 0) + 1 }));

  async function tomarUbicacion() {
    setUbicando(true);
    const res = await ubicacionActual();
    setUbicando(false);
    if (res.estado === "sin-permiso") {
      avisarFaltaUbicacion("Sin ubicación no podemos marcar dónde queda el local.", res);
      return;
    }
    if (res.estado === "sin-senal") {
      Alert.alert("No pudimos ubicarte", "Pon el punto tocando el mapa.");
      return;
    }
    const p = { lat: res.ubicacion.lat, lng: res.ubicacion.lng };
    setPunto(p);
    setPrecision(res.ubicacion.precision);
    viajarA(p, zoomSegunPrecision(res.ubicacion.precision));
  }

  const texto = (t: string) => t.trim() || null;
  const valores = {
    nombre: nombre.trim(),
    direccion: texto(direccion),
    ciudad: texto(ciudad),
    referencia: texto(referencia),
    telefono: texto(telefono),
    horarios,
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    retiro,
    activa,
  };
  const hayCambios = inicial
    ? valores.nombre !== inicial.nombre ||
      valores.direccion !== inicial.direccion ||
      valores.ciudad !== inicial.ciudad ||
      valores.referencia !== inicial.referencia ||
      valores.telefono !== inicial.telefono ||
      JSON.stringify(horarios) !== JSON.stringify(ordenado(inicial.horarios ?? HORARIO_POR_DEFECTO)) ||
      valores.lat !== inicial.lat ||
      valores.lng !== inicial.lng ||
      valores.retiro !== inicial.retiro ||
      valores.activa !== inicial.activa
    : valores.nombre.length > 0;

  async function guardar() {
    if (!valores.nombre) {
      setError("Ponle un nombre");
      return;
    }
    if (horarios.some((d) => d.abierto && d.desde >= d.hasta)) {
      setError("Revisa el horario: un día cierra antes de abrir");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onSubmit(valores);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={titulo}
        accion={accion}
        onAccion={guardar}
        onCancelar={onCancelar}
        cargando={guardando}
        deshabilitado={!valores.nombre || !hayCambios}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
            placeholder="Vivero Hipódromo"
          />

          <Titulo>Dirección</Titulo>
          {/* Buscar completa los campos y lleva el mapa al barrio; el pin no sale de acá. */}
          <BuscadorDeDireccion
            onElegir={(d) => {
              if (d.direccion) {
                setDireccion([d.direccion, d.numeroCasa].filter(Boolean).join(" "));
              }
              if (d.ciudad) setCiudad(d.ciudad);
              if (d.lat !== null && d.lng !== null) viajarA({ lat: d.lat, lng: d.lng }, ZOOM_DE_BARRIO);
            }}
          />
          <Campo label="Dirección" value={direccion} onChangeText={setDireccion} />
          <SelectorDeCiudad valor={ciudad} onCambio={setCiudad} />
          <Campo label="Referencia" value={referencia} onChangeText={setReferencia} />

          <Titulo>En el mapa</Titulo>
          <MapaDePropiedad
            punto={punto}
            precision={precision}
            destino={destino}
            ubicando={ubicando}
            onCambio={(p) => {
              setPunto(p);
              setPrecision(null);
            }}
            onUsarMiUbicacion={tomarUbicacion}
          />

          <Titulo>Contacto</Titulo>
          <Campo
            label="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />

          <Titulo>Horario</Titulo>
          <Text style={styles.resumenHorario}>El cliente lo ve así: {textoDelHorario(horarios)}</Text>
          <EditorDeHorario valor={horarios} onCambio={setHorarios} />

          <Titulo>Para los clientes</Titulo>
          <Interruptor
            label="Retiro en este local"
            nota="El cliente puede elegirlo para retirar su pedido en la app"
            value={retiro}
            onValueChange={setRetiro}
          />
          <Interruptor
            label="Activa"
            nota="Apagada no se ofrece en ningún lado, pero sigue nombrando sus pedidos"
            value={activa}
            onValueChange={setActiva}
          />

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}

          {onEliminar ? <BotonEliminar etiqueta="Eliminar ubicación" onPress={onEliminar} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  resumenHorario: { color: tema.texto3, fontSize: 13, marginTop: -4, marginBottom: 8 },
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
