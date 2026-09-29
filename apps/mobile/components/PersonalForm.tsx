import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { BotonEliminar, Campo, Titulo } from "@/components/ui/Formulario";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";

export interface DatosPersonal {
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: string;
  usuario?: string | null;
}

const TIPOS = ["JARDINERO", "CHOFER", "SUPERVISOR", "MECANICO"] as const;

const ETIQUETA_TIPO: Record<string, string> = {
  JARDINERO: "Jardinero",
  CHOFER: "Chofer",
  SUPERVISOR: "Supervisor",
  MECANICO: "Mecánico",
};

/**
 * La ficha de alguien del vivero.
 *
 * **La cuenta nace con la ficha**, en la misma transacción: cargarla en dos
 * pasos garantiza que alguien se saltee el segundo y quede gente que no puede
 * abrir la app. Una cuenta sin contraseña no entra a ningún lado, así que
 * crearla siempre no abre nada.
 *
 * El **usuario** —con lo que entra a la app— se muestra al editar y solo un
 * ADMIN lo cambia: se genera solo al crear la ficha (inicial del nombre más el
 * apellido) y se corrige acá cuando el generador se equivoca. Borrar la cuenta
 * para arreglar un tipeo se llevaría el historial de quién cargó cada parte.
 *
 * *Cancelar* · título · *Crear* / *Guardar* arriba (`EncabezadoDeFormulario`),
 * como los demás formularios; al editar, *Guardar* se prende solo cuando algo
 * difiere de la ficha cargada.
 */
export function PersonalForm({
  inicial,
  usuario,
  titulo,
  accion,
  onSubmit,
  onCancelar,
  onEliminar,
}: {
  inicial?: DatosPersonal;
  /** El usuario actual de su cuenta. Solo al editar. */
  usuario?: string | null;
  titulo: string;
  /** "Crear" o "Guardar". */
  accion: string;
  onSubmit: (valores: DatosPersonal) => Promise<void>;
  onCancelar: () => void;
  onEliminar?: () => void;
}) {
  const rol = useAuthStore((s) => s.user?.role);
  const esAdmin = rol === "ADMIN";

  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [apellido, setApellido] = useState(inicial?.apellido ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [especialidad, setEspecialidad] = useState(inicial?.especialidad ?? "");
  const [tipo, setTipo] = useState<string | null>(inicial?.tipo ?? "JARDINERO");
  const [activo, setActivo] = useState((inicial?.estado ?? "ACTIVO") === "ACTIVO");
  const [nuevoUsuario, setNuevoUsuario] = useState(usuario ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valores: DatosPersonal = {
    nombre: nombre.trim(),
    apellido: apellido.trim() || null,
    telefono: telefono.trim() || null,
    especialidad: especialidad.trim() || null,
    tipo,
    estado: activo ? "ACTIVO" : "INACTIVO",
    // Solo viaja si esta pantalla lo muestra: el servidor lo aplica
    // únicamente si cambió, así que mandarlo igual no molesta.
    ...(usuario !== undefined ? { usuario: nuevoUsuario.trim() || null } : {}),
  };
  const hayCambios = inicial
    ? valores.nombre !== inicial.nombre ||
      valores.apellido !== inicial.apellido ||
      valores.telefono !== inicial.telefono ||
      valores.especialidad !== inicial.especialidad ||
      valores.tipo !== inicial.tipo ||
      valores.estado !== inicial.estado ||
      (usuario !== undefined && (valores.usuario ?? null) !== usuario)
    : valores.nombre.length > 0;

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {usuario !== undefined ? (
          <>
            {/* Primero el usuario: es lo que se dicta por teléfono para que
                entre, y lo que alguien abre esta ficha a buscar. */}
            <Titulo>Entra a la app con</Titulo>
            {esAdmin ? (
              <Campo
                label="Usuario"
                value={nuevoUsuario}
                onChangeText={setNuevoUsuario}
                autoCapitalize="none"
              />
            ) : (
              <View style={styles.soloLectura}>
                <Text variant="bodyLarge" style={styles.soloLecturaTexto}>
                  {usuario ?? "Sin cuenta"}
                </Text>
                <Text variant="bodySmall" style={styles.nota}>
                  Solo un administrador puede cambiarlo.
                </Text>
              </View>
            )}
          </>
        ) : null}

        <Titulo>Nombre</Titulo>
        <Campo label="Nombre" required value={nombre} onChangeText={setNombre} />
        <Campo label="Apellido" value={apellido} onChangeText={setApellido} />

        <Titulo>Contacto</Titulo>
        <Campo
          label="Teléfono"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />

        <Titulo>Trabajo</Titulo>
        <View style={styles.tipos}>
          {TIPOS.map((t) => {
            const elegido = tipo === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTipo(t)}
                style={[styles.chip, elegido && styles.chipElegido]}
              >
                <Text style={[styles.chipTexto, elegido && styles.chipTextoElegido]}>
                  {ETIQUETA_TIPO[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Campo
          label="Especialidad"
          value={especialidad}
          onChangeText={setEspecialidad}
        />
        <View style={styles.interruptor}>
          <View style={styles.interruptorTexto}>
            <Text variant="bodyLarge" style={styles.interruptorTitulo}>
              Activo
            </Text>
            <Text variant="bodySmall" style={styles.nota}>
              Inactivo deja de ofrecerse al asignar una visita.
            </Text>
          </View>
          <Switch
            value={activo}
            onValueChange={setActivo}
            trackColor={{ true: tema.verde100, false: undefined }}
            thumbColor={activo ? tema.verde : undefined}
          />
        </View>

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        {onEliminar ? (
          <BotonEliminar etiqueta="Archivar y quitar acceso" onPress={onEliminar} />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  soloLectura: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  soloLecturaTexto: { color: tema.texto, fontWeight: "600" },
  nota: { color: tema.texto3 },

  tipos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
  },
  chipElegido: { backgroundColor: tema.verde50 },
  chipTexto: { color: tema.texto2, fontSize: 14 },
  chipTextoElegido: { color: tema.verde700, fontWeight: "600" },

  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  interruptorTexto: { flex: 1, gap: 2 },
  interruptorTitulo: { color: tema.texto },

  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
