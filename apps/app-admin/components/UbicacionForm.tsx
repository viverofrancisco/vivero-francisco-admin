import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText } from "react-native-paper";
import { HORARIO_POR_DEFECTO, type UbicacionBody } from "@vivero/shared";
import { EditorDeHorario } from "@/components/EditorDeHorario";
import { CamposDeDireccion, type DireccionDeUbicacion } from "@/components/CamposDeDireccion";
import { Campo, Interruptor, Titulo } from "@vivero/app-ui/components/ui/Formulario";
import { EncabezadoDeFormulario } from "@vivero/app-ui/components/ui/EncabezadoDeFormulario";
import { mensajeDeError } from "@vivero/app-ui/lib/api";
import { tema } from "@vivero/app-ui/lib/tema";

/**
 * *Nueva ubicación*, como el *Add location* de Shopify: si está **activa** y
 * si el cliente puede **retirar** ahí su pedido, el nombre y el teléfono, la
 * dirección con su pin y el horario, todo en una pantalla con *Cancelar* ·
 * título · *Crear* arriba. Una ya creada se ve en su ficha
 * (`FichaDeUbicacion`), que edita cada parte en su hoja.
 */
export function UbicacionForm({
  onSubmit,
  onCancelar,
}: {
  onSubmit: (valores: UbicacionBody) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState<DireccionDeUbicacion>({
    direccion: "",
    ciudad: "",
    referencia: "",
    punto: null,
  });
  const [horarios, setHorarios] = useState(HORARIO_POR_DEFECTO);
  const [retiro, setRetiro] = useState(true);
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const texto = (t: string) => t.trim() || null;

  async function guardar() {
    if (!nombre.trim()) {
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
      await onSubmit({
        nombre: nombre.trim(),
        telefono: texto(telefono),
        direccion: texto(direccion.direccion),
        ciudad: texto(direccion.ciudad),
        referencia: texto(direccion.referencia),
        lat: direccion.punto?.lat ?? null,
        lng: direccion.punto?.lng ?? null,
        horarios,
        retiro,
        activa,
      });
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo="Nueva ubicación"
        accion="Crear"
        onAccion={guardar}
        onCancelar={onCancelar}
        cargando={guardando}
        deshabilitado={!nombre.trim()}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
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
          <Campo label="Nombre" required value={nombre} onChangeText={setNombre} placeholder="Vivero Hipódromo" />
          <Campo label="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

          <Titulo>Dirección</Titulo>
          <CamposDeDireccion valor={direccion} onCambio={setDireccion} />

          <Titulo>Horario</Titulo>
          <EditorDeHorario valor={horarios} onCambio={setHorarios} />

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
