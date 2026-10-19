import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { HORARIO_POR_DEFECTO, type Ubicacion, type UbicacionBody } from "@vivero/shared";
import { EncabezadoDeFicha } from "@vivero/app-ui/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado } from "@vivero/app-ui/components/ui/MenuDeEncabezado";
import { CabeceraDeHoja, PastillaDeHoja } from "@vivero/app-ui/components/ui/CabeceraDeHoja";
import { Campo, Interruptor } from "@vivero/app-ui/components/ui/Formulario";
import { mensajeDeError } from "@vivero/app-ui/lib/api";
import { tema } from "@vivero/app-ui/lib/tema";
import { HorarioEnHoja } from "@/components/HorarioEnHoja";
import { CamposDeDireccion, type DireccionDeUbicacion } from "@/components/CamposDeDireccion";

/**
 * Una ubicación ya creada, como la ficha de *Locations* de Shopify: se lee, y
 * cada parte se cambia en su hoja, que guarda solo esa parte —*Editar* en el
 * ⋯ del encabezado para el nombre, el teléfono y los dos interruptores;
 * *Editar* junto a *Dirección* y junto a *Horario* para lo suyo—. Era el
 * formulario entero abierto, y una ubicación se mira mucho más de lo que se
 * corrige.
 */
export function FichaDeUbicacion({
  ubicacion,
  onGuardar,
  onEliminar,
}: {
  ubicacion: Ubicacion;
  /** Guarda lo que venga (un `PUT` parcial) y devuelve la ubicación como quedó. */
  onGuardar: (cambios: Partial<UbicacionBody>) => Promise<Ubicacion>;
  onEliminar: () => void;
}) {
  const [u, setU] = useState(ubicacion);
  const [hoja, setHoja] = useState<"datos" | "direccion" | null>(null);

  const guardar = async (cambios: Partial<UbicacionBody>) => {
    setU(await onGuardar(cambios));
    setHoja(null);
  };

  const lineas = [u.direccion, u.ciudad].filter(Boolean);

  return (
    <View style={styles.flex}>
      <EncabezadoDeFicha
        titulo={u.nombre}
        derecha={
          <MenuDeEncabezado
            opciones={[
              { etiqueta: "Editar", onPress: () => setHoja("datos") },
              { etiqueta: "Eliminar ubicación", onPress: onEliminar },
            ]}
          />
        }
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.cuerpo}>
        <View style={styles.filas}>
          <Renglon etiqueta="Estado" valor={u.activa ? "Activa" : "Inactiva"} apagado={!u.activa} />
          <Renglon etiqueta="Retiro en este local" valor={u.retiro ? "Sí" : "No"} apagado={!u.retiro} />
          <Renglon etiqueta="Teléfono" valor={u.telefono ?? "—"} apagado={!u.telefono} />
        </View>

        <Rotulo titulo="Dirección" onEditar={() => setHoja("direccion")} />
        <View style={styles.direccion}>
          {lineas.length > 0 ? (
            <Text style={styles.texto}>{lineas.join(", ")}</Text>
          ) : (
            <Text style={styles.apagado}>Sin dirección</Text>
          )}
          {u.referencia ? <Text style={styles.apagado}>{u.referencia}</Text> : null}
          {u.lat != null && u.lng != null ? (
            <Pressable
              hitSlop={6}
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`
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

        <HorarioEnHoja
          valor={horarioOrdenado(u)}
          onGuardar={async (horarios) => {
            setU(await onGuardar({ horarios }));
          }}
        />
      </ScrollView>

      {hoja === "datos" ? (
        <HojaDeDatos ubicacion={u} onCerrar={() => setHoja(null)} onGuardar={guardar} />
      ) : null}
      {hoja === "direccion" ? (
        <HojaDeDireccion ubicacion={u} onCerrar={() => setHoja(null)} onGuardar={guardar} />
      ) : null}
    </View>
  );
}

function Renglon({ etiqueta, valor, apagado }: { etiqueta: string; valor: string; apagado?: boolean }) {
  return (
    <View style={styles.renglon}>
      <Text style={styles.texto}>{etiqueta}</Text>
      <Text style={[styles.texto, apagado && styles.apagado]}>{valor}</Text>
    </View>
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

/** El marco de las dos hojas: *Cancelar* / ✕, el título y *Guardar*. */
function Hoja({
  titulo,
  hayCambios,
  onCerrar,
  onGuardar,
  children,
}: {
  titulo: string;
  hayCambios: boolean;
  onCerrar: () => void;
  /** Devuelve el motivo si no se puede guardar. */
  onGuardar: () => Promise<string | null>;
  children: React.ReactNode;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const motivo = await onGuardar();
      if (motivo) setError(motivo);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    }
    setGuardando(false);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.hoja}>
        <CabeceraDeHoja
          titulo={titulo}
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={guardar}
              disabled={!hayCambios}
              cargando={guardando}
            />
          }
        />
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.cuerpoHoja} keyboardShouldPersistTaps="handled">
            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * El horario con las claves en orden fijo: Postgres devuelve el JSON
 * reordenado, y la hoja daba "hay cambios" sin haber tocado nada. Una sin
 * horario cargado muestra el de siempre.
 */
function horarioOrdenado(u: Ubicacion) {
  return (u.horarios ?? HORARIO_POR_DEFECTO).map((d) => ({
    abierto: d.abierto,
    desde: d.desde,
    hasta: d.hasta,
  }));
}

const texto = (t: string) => t.trim() || null;

/** El nombre, el teléfono y los dos interruptores. */
function HojaDeDatos({
  ubicacion: u,
  onCerrar,
  onGuardar,
}: {
  ubicacion: Ubicacion;
  onCerrar: () => void;
  onGuardar: (c: Partial<UbicacionBody>) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(u.nombre);
  const [telefono, setTelefono] = useState(u.telefono ?? "");
  const [activa, setActiva] = useState(u.activa);
  const [retiro, setRetiro] = useState(u.retiro);
  const hayCambios =
    nombre.trim() !== u.nombre ||
    texto(telefono) !== u.telefono ||
    activa !== u.activa ||
    retiro !== u.retiro;

  return (
    <Hoja
      titulo="Editar ubicación"
      hayCambios={hayCambios}
      onCerrar={onCerrar}
      onGuardar={async () => {
        if (!nombre.trim()) return "Ponle un nombre";
        await onGuardar({ nombre: nombre.trim(), telefono: texto(telefono), activa, retiro });
        return null;
      }}
    >
      <Interruptor
        label="Activa"
        nota="Apagada no se ofrece en ningún lado, pero sigue nombrando sus pedidos"
        value={activa}
        onValueChange={setActiva}
      />
      <Interruptor
        label="Retiro en este local"
        nota="El cliente puede elegirlo para retirar su pedido en la app"
        value={retiro}
        onValueChange={setRetiro}
      />
      <Campo label="Nombre" required value={nombre} onChangeText={setNombre} />
      <Campo label="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
    </Hoja>
  );
}

/** La calle, la ciudad, la referencia y el pin. */
function HojaDeDireccion({
  ubicacion: u,
  onCerrar,
  onGuardar,
}: {
  ubicacion: Ubicacion;
  onCerrar: () => void;
  onGuardar: (c: Partial<UbicacionBody>) => Promise<void>;
}) {
  const [d, setD] = useState<DireccionDeUbicacion>({
    direccion: u.direccion ?? "",
    ciudad: u.ciudad ?? "",
    referencia: u.referencia ?? "",
    punto: u.lat != null && u.lng != null ? { lat: u.lat, lng: u.lng } : null,
  });
  const hayCambios =
    texto(d.direccion) !== u.direccion ||
    texto(d.ciudad) !== u.ciudad ||
    texto(d.referencia) !== u.referencia ||
    (d.punto?.lat ?? null) !== u.lat ||
    (d.punto?.lng ?? null) !== u.lng;

  return (
    <Hoja
      titulo="Dirección"
      hayCambios={hayCambios}
      onCerrar={onCerrar}
      onGuardar={async () => {
        await onGuardar({
          direccion: texto(d.direccion),
          ciudad: texto(d.ciudad),
          referencia: texto(d.referencia),
          lat: d.punto?.lat ?? null,
          lng: d.punto?.lng ?? null,
        });
        return null;
      }}
    >
      <CamposDeDireccion valor={d} onCambio={setD} />
    </Hoja>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  cuerpo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  filas: { gap: 8, paddingHorizontal: 4 },
  renglon: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  texto: { color: tema.texto, fontSize: 14 },
  apagado: { color: tema.texto3, fontSize: 14 },
  rotuloFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 22,
    marginBottom: 8,
  },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8 },
  enlace: { color: tema.verde, fontSize: 14, fontWeight: "600" },
  tocado: { opacity: 0.5 },
  direccion: { gap: 4, paddingHorizontal: 4 },
  hoja: { flex: 1, backgroundColor: tema.superficie },
  cuerpoHoja: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  error: { textAlign: "center", color: tema.rojo, marginBottom: 4 },
});
