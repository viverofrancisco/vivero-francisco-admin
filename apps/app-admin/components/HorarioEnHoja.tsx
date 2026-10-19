import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  DIAS_DE_LA_SEMANA,
  horaLegible,
  type HorarioSemanal,
} from "@vivero/shared";
import { CabeceraDeHoja, PastillaDeHoja } from "@vivero/app-ui/components/ui/CabeceraDeHoja";
import { mensajeDeError } from "@vivero/app-ui/lib/api";
import { tema } from "@vivero/app-ui/lib/tema";
import { EditorDeHorario } from "@/components/EditorDeHorario";

/**
 * El horario de una ubicación ya creada: un desglose día por día que, al
 * tocarlo, abre la hoja para editarlo —como el *Precio* de una variante—. Al
 * crear se edita en línea; al editar se lee mucho más de lo que se cambia, y
 * siete filas de selectores abiertas son media pantalla para mirar.
 *
 * *Guardar* lo guarda ahí mismo, solo el horario, como la hoja del precio:
 * cerrar la hoja con el horario listo y tener que acordarse de guardar otra
 * vez el formulario era una forma de perderlo.
 */
export function HorarioEnHoja({
  valor,
  onGuardar,
}: {
  valor: HorarioSemanal;
  /** Lo guarda en el servidor; si falla, la hoja queda abierta con el motivo. */
  onGuardar: (h: HorarioSemanal) => Promise<void>;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAbierta(true)}
        style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}
        accessibilityRole="button"
        accessibilityLabel="Editar horario"
      >
        <View style={styles.dias}>
          {DIAS_DE_LA_SEMANA.map((dia, i) => {
            const d = valor[i];
            return (
              <View key={dia} style={styles.fila}>
                <Text style={styles.dia}>{dia}</Text>
                <Text style={[styles.horas, !d?.abierto && styles.cerrado]}>
                  {d?.abierto ? `${horaLegible(d.desde)} – ${horaLegible(d.hasta)}` : "Cerrado"}
                </Text>
              </View>
            );
          })}
        </View>
        <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
      </Pressable>
      {abierta ? (
        <HojaDeHorario
          inicial={valor}
          onCerrar={() => setAbierta(false)}
          onGuardar={async (h) => {
            await onGuardar(h);
            setAbierta(false);
          }}
        />
      ) : null}
    </>
  );
}

/** La hoja: su propia copia del horario, que solo sale guardada. */
function HojaDeHorario({
  inicial,
  onCerrar,
  onGuardar,
}: {
  inicial: HorarioSemanal;
  onCerrar: () => void;
  onGuardar: (h: HorarioSemanal) => Promise<void>;
}) {
  const [horario, setHorario] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hayCambios = JSON.stringify(horario) !== JSON.stringify(inicial);

  async function guardar() {
    if (horario.some((d) => d.abierto && d.desde >= d.hasta)) {
      setError("Revisa el horario: un día cierra antes de abrir");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(horario);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el horario"));
      setGuardando(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo="Horario"
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
        <ScrollView contentContainerStyle={styles.cuerpo}>
          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
          <EditorDeHorario valor={horario} onCambio={setHorario} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: tema.superficie,
  },
  presionada: { backgroundColor: tema.lienzo },
  dias: { flex: 1, gap: 4 },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  dia: { color: tema.texto, fontSize: 14 },
  horas: { color: tema.texto, fontSize: 14, fontVariant: ["tabular-nums"] },
  cerrado: { color: tema.texto3 },
  error: { color: tema.rojo, textAlign: "center", marginBottom: 4 },
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cuerpo: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
});
