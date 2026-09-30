import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText } from "react-native-paper";
import { Campo, Titulo } from "@/components/ui/Formulario";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

export interface DatosUsuario {
  name: string;
  apellido: string | null;
  email: string;
}

/**
 * Una cuenta del equipo: nombre y correo, nada más. La contraseña no se
 * escribe acá —la elige su dueño con un enlace— y el rol es STAFF. Como el
 * portal: *Cancelar* · título · *Crear* / *Guardar* arriba, y al editar
 * *Guardar* se prende solo con cambios.
 */
export function UsuarioForm({
  inicial,
  titulo,
  accion,
  onSubmit,
  onCancelar,
}: {
  inicial?: DatosUsuario;
  titulo: string;
  accion: string;
  onSubmit: (valores: DatosUsuario) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.name ?? "");
  const [apellido, setApellido] = useState(inicial?.apellido ?? "");
  const [correo, setCorreo] = useState(inicial?.email ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valores: DatosUsuario = {
    name: nombre.trim(),
    apellido: apellido.trim() || null,
    email: correo.trim().toLowerCase(),
  };
  const completo = valores.name.length > 0 && valores.email.includes("@");
  const hayCambios = inicial
    ? valores.name !== inicial.name ||
      valores.apellido !== (inicial.apellido || null) ||
      valores.email !== inicial.email
    : true;

  async function guardar() {
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
        deshabilitado={!completo || !hayCambios}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Titulo>Nombre</Titulo>
          <Campo label="Nombre" required value={nombre} onChangeText={setNombre} />
          <Campo label="Apellido" value={apellido} onChangeText={setApellido} />
          <Titulo>Correo</Titulo>
          <Campo
            label="Correo"
            required
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
