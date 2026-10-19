import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  HORARIO_POR_DEFECTO,
  type HorarioSemanal,
  type Ubicacion,
  type UbicacionBody,
} from "@vivero/shared";
import { EncabezadoDeFicha } from "@vivero/app-ui/components/ui/EncabezadoDeFicha";
import { EncabezadoDeFormulario } from "@vivero/app-ui/components/ui/EncabezadoDeFormulario";
import { MenuDeEncabezado } from "@vivero/app-ui/components/ui/MenuDeEncabezado";
import { HojaDeOpciones, type OpcionElegible } from "@vivero/app-ui/components/ui/SelectorOpcion";
import { CabeceraDeHoja, PastillaDeHoja } from "@vivero/app-ui/components/ui/CabeceraDeHoja";
import { Campo } from "@vivero/app-ui/components/ui/Formulario";
import { mensajeDeError } from "@vivero/app-ui/lib/api";
import { tema } from "@vivero/app-ui/lib/tema";
import { HorarioEnHoja } from "@/components/HorarioEnHoja";
import { CamposDeDireccion, type DireccionDeUbicacion } from "@/components/CamposDeDireccion";

/** Lo que se edita en la ficha, como se escribe en pantalla. */
interface Borrador {
  nombre: string;
  telefono: string;
  activa: boolean;
  retiro: boolean;
  direccion: DireccionDeUbicacion;
  horarios: HorarioSemanal;
}

/**
 * El horario con las claves en orden fijo: Postgres devuelve el JSON
 * reordenado, y la comparación daba "hay cambios" sin haber tocado nada. Una
 * sin horario cargado muestra el de siempre.
 */
function horarioOrdenado(h: HorarioSemanal | null): HorarioSemanal {
  return (h ?? HORARIO_POR_DEFECTO).map((d) => ({ abierto: d.abierto, desde: d.desde, hasta: d.hasta }));
}

function borradorDe(u: Ubicacion): Borrador {
  return {
    nombre: u.nombre,
    telefono: u.telefono ?? "",
    activa: u.activa,
    retiro: u.retiro,
    direccion: {
      direccion: u.direccion ?? "",
      ciudad: u.ciudad ?? "",
      referencia: u.referencia ?? "",
      punto: u.lat != null && u.lng != null ? { lat: u.lat, lng: u.lng } : null,
    },
    horarios: horarioOrdenado(u.horarios),
  };
}

const texto = (t: string) => t.trim() || null;

function cuerpoDe(b: Borrador): UbicacionBody {
  return {
    nombre: b.nombre.trim(),
    telefono: texto(b.telefono),
    activa: b.activa,
    retiro: b.retiro,
    direccion: texto(b.direccion.direccion),
    ciudad: texto(b.direccion.ciudad),
    referencia: texto(b.direccion.referencia),
    lat: b.direccion.punto?.lat ?? null,
    lng: b.direccion.punto?.lng ?? null,
    horarios: b.horarios,
  };
}

/**
 * Una ubicación ya creada, como una ficha de Shopify. El nombre y el teléfono
 * se escriben en el lugar; *Estado* y *Retiro* son filas con su pastilla que
 * abren una hoja de opciones, como el *Product status*; la dirección con su
 * pin y el horario se leen y se cambian en su hoja (*Editar* junto al
 * rótulo), que sale con *Listo*. **Nada se guarda solo**: con algo distinto
 * de lo guardado, el encabezado se vuelve *Cancelar* / *Guardar*, y *Guardar*
 * manda todo junto.
 */
export function FichaDeUbicacion({
  ubicacion,
  onGuardar,
  onEliminar,
}: {
  ubicacion: Ubicacion;
  /** Guarda (un `PUT`) y devuelve la ubicación como quedó. */
  onGuardar: (cambios: UbicacionBody) => Promise<Ubicacion>;
  onEliminar: () => void;
}) {
  const [guardada, setGuardada] = useState(() => borradorDe(ubicacion));
  const [b, setB] = useState(guardada);
  const [hoja, setHoja] = useState<"direccion" | "estado" | "retiro" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (cambio: Partial<Borrador>) => setB((x) => ({ ...x, ...cambio }));

  const cambio = JSON.stringify(cuerpoDe(b)) !== JSON.stringify(cuerpoDe(guardada));

  async function guardar() {
    if (!b.nombre.trim()) {
      Alert.alert("Falta el nombre", "Ponle un nombre a la ubicación.");
      return;
    }
    setGuardando(true);
    try {
      const nueva = borradorDe(await onGuardar(cuerpoDe(b)));
      setGuardada(nueva);
      setB(nueva);
    } catch (e) {
      Alert.alert("No se pudo guardar", mensajeDeError(e, "Intenta de nuevo en un momento."));
    } finally {
      setGuardando(false);
    }
  }

  const d = b.direccion;
  const lineas = [d.direccion, d.ciudad].map((t) => t.trim()).filter(Boolean);

  return (
    <View style={styles.flex}>
      {cambio ? (
        <EncabezadoDeFormulario
          titulo=""
          accion="Guardar"
          onAccion={guardar}
          onCancelar={() => setB(guardada)}
          cargando={guardando}
          pastillas
        />
      ) : (
        <EncabezadoDeFicha
          titulo=""
          derecha={<MenuDeEncabezado opciones={[{ etiqueta: "Eliminar ubicación", onPress: onEliminar }]} />}
        />
      )}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView style={styles.flex} contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
          <FilaConPastilla
            etiqueta="Estado"
            valor={b.activa ? "Activa" : "Inactiva"}
            prendida={b.activa}
            onPress={() => setHoja("estado")}
          />
          <FilaConPastilla
            etiqueta="Retiro en este local"
            valor={b.retiro ? "Sí" : "No"}
            prendida={b.retiro}
            onPress={() => setHoja("retiro")}
          />

          <View style={styles.campos}>
            <Campo label="Nombre" required value={b.nombre} onChangeText={(v) => set({ nombre: v })} />
            <Campo
              label="Teléfono"
              value={b.telefono}
              onChangeText={(v) => set({ telefono: v })}
              keyboardType="phone-pad"
            />
          </View>

          <Rotulo titulo="Dirección" onEditar={() => setHoja("direccion")} />
          <View style={styles.direccion}>
            {lineas.length > 0 ? (
              <Text style={styles.texto}>{lineas.join(", ")}</Text>
            ) : (
              <Text style={styles.apagado}>Sin dirección</Text>
            )}
            {d.referencia.trim() ? <Text style={styles.apagado}>{d.referencia}</Text> : null}
            {d.punto ? (
              <Pressable
                hitSlop={6}
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${d.punto!.lat},${d.punto!.lng}`
                  )
                }
              >
                {({ pressed }) => (
                  <Text style={[styles.enlace, pressed && styles.tocado]}>Ver en el mapa</Text>
                )}
              </Pressable>
            ) : (
              <Text style={styles.apagado}>Sin pin en el mapa</Text>
            )}
          </View>

          <HorarioEnHoja valor={b.horarios} onCambio={(h) => set({ horarios: h })} />
        </ScrollView>
      </KeyboardAvoidingView>

      <HojaDeOpciones
        visible={hoja === "estado"}
        titulo="Estado"
        opciones={OPCIONES_DE_ESTADO}
        valor={b.activa ? "si" : "no"}
        onElegir={(v) => set({ activa: v === "si" })}
        onCerrar={() => setHoja(null)}
      />
      <HojaDeOpciones
        visible={hoja === "retiro"}
        titulo="Retiro en este local"
        opciones={OPCIONES_DE_RETIRO}
        valor={b.retiro ? "si" : "no"}
        onElegir={(v) => set({ retiro: v === "si" })}
        onCerrar={() => setHoja(null)}
      />
      {hoja === "direccion" ? (
        <HojaDeDireccion
          inicial={b.direccion}
          onCerrar={() => setHoja(null)}
          onListo={(direccion) => {
            set({ direccion });
            setHoja(null);
          }}
        />
      ) : null}
    </View>
  );
}

const OPCIONES_DE_ESTADO: OpcionElegible[] = [
  { clave: "si", etiqueta: "Activa", detalle: "Se ofrece en la app y en los pedidos" },
  { clave: "no", etiqueta: "Inactiva", detalle: "No se ofrece en ningún lado, pero sigue nombrando sus pedidos" },
];

const OPCIONES_DE_RETIRO: OpcionElegible[] = [
  { clave: "si", etiqueta: "Sí", detalle: "El cliente puede elegirlo para retirar su pedido en la app" },
  { clave: "no", etiqueta: "No", detalle: "No aparece entre los lugares de retiro" },
];

/** Una fila que abre sus opciones: el rótulo, la pastilla con el valor y el chevron. */
function FilaConPastilla({
  etiqueta,
  valor,
  prendida,
  onPress,
}: {
  etiqueta: string;
  valor: string;
  prendida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.filaPastilla, pressed && styles.tocado]}
    >
      <Text style={styles.filaPastillaTexto}>{etiqueta}</Text>
      <View style={[styles.pastilla, prendida ? styles.pastillaVerde : styles.pastillaGris]}>
        <Text style={[styles.pastillaTexto, prendida ? styles.pastillaTextoVerde : styles.pastillaTextoGris]}>
          {valor}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
    </Pressable>
  );
}

/** El rótulo de una sección con *Editar* a la derecha, como el del horario. */
function Rotulo({ titulo, onEditar }: { titulo: string; onEditar: () => void }) {
  return (
    <View style={styles.rotuloFila}>
      <Text style={styles.rotulo}>{titulo.toUpperCase()}</Text>
      <Pressable onPress={onEditar} hitSlop={8} accessibilityRole="button">
        {({ pressed }) => <Text style={[styles.enlace, pressed && styles.tocado]}>Editar</Text>}
      </Pressable>
    </View>
  );
}

/** La calle, la ciudad, la referencia y el pin, en su hoja; *Listo* los deja en la ficha. */
function HojaDeDireccion({
  inicial,
  onCerrar,
  onListo,
}: {
  inicial: DireccionDeUbicacion;
  onCerrar: () => void;
  onListo: (d: DireccionDeUbicacion) => void;
}) {
  const [d, setD] = useState(inicial);
  const hayCambios = JSON.stringify(d) !== JSON.stringify(inicial);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.hoja}>
        <CabeceraDeHoja
          titulo="Dirección"
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={<PastillaDeHoja texto="Listo" primaria onPress={() => onListo(d)} disabled={!hayCambios} />}
        />
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpoHoja} keyboardShouldPersistTaps="handled">
            <CamposDeDireccion valor={d} onCambio={setD} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  cuerpo: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  campos: { marginTop: 14 },
  filaPastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  filaPastillaTexto: { flex: 1, color: tema.texto, fontSize: 15, fontWeight: "600" },
  pastilla: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pastillaVerde: { backgroundColor: tema.verde100 },
  pastillaGris: { backgroundColor: tema.lienzo },
  pastillaTexto: { fontSize: 13, fontWeight: "600" },
  pastillaTextoVerde: { color: tema.verde700 },
  pastillaTextoGris: { color: tema.texto2 },
  texto: { color: tema.texto, fontSize: 14 },
  apagado: { color: tema.texto3, fontSize: 14 },
  rotuloFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 8,
  },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8 },
  enlace: { color: tema.verde, fontSize: 14, fontWeight: "600" },
  tocado: { opacity: 0.5 },
  direccion: { gap: 4, paddingHorizontal: 4 },
  hoja: { flex: 1, backgroundColor: tema.superficie },
  cuerpoHoja: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
});
