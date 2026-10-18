import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tema } from "@/lib/tema";

/**
 * El código de verificación: una casilla por dígito.
 *
 * Por dentro es **un solo campo**, invisible, y las casillas solo dibujan lo
 * que tiene: seis campos de verdad, saltando el foco de uno a otro, rompen lo
 * que más se usa — iOS ofrece el código del correo encima del teclado
 * (`oneTimeCode`) y lo pega de una vez, y pegar en el primero de seis no llega
 * a los otros cinco; borrar en una casilla vacía tampoco vuelve a la anterior
 * sin lógica de más. Con uno solo, escribir avanza, borrar retrocede y pegar
 * llena las seis.
 *
 * `alCompletar` se llama con el sexto dígito: no hay botón que apretar.
 */
export function CampoDeCodigo({
  valor,
  onCambiar,
  alCompletar,
  largo = 6,
  deshabilitado = false,
  conError = false,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  alCompletar: (codigo: string) => void;
  largo?: number;
  deshabilitado?: boolean;
  conError?: boolean;
}) {
  const campo = useRef<TextInput>(null);

  function cambiar(texto: string) {
    const limpio = texto.replace(/\D/g, "").slice(0, largo);
    onCambiar(limpio);
    if (limpio.length === largo && valor.length !== largo) alCompletar(limpio);
  }

  // La casilla activa es la siguiente a llenar; con todas llenas, la última.
  const activa = Math.min(valor.length, largo - 1);

  return (
    <Pressable onPress={() => campo.current?.focus()} style={styles.fila} disabled={deshabilitado}>
      {Array.from({ length: largo }, (_, i) => (
        <View
          key={i}
          style={[
            styles.casilla,
            i === activa && !deshabilitado && styles.casillaActiva,
            conError && styles.casillaError,
          ]}
        >
          <Text style={styles.digito}>{valor[i] ?? ""}</Text>
        </View>
      ))}
      <TextInput
        ref={campo}
        value={valor}
        onChangeText={cambiar}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={largo}
        autoFocus
        editable={!deshabilitado}
        caretHidden
        style={styles.oculto}
        accessibilityLabel="Código de verificación"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  casilla: {
    width: 46,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaActiva: { borderColor: tema.verde, borderWidth: 2 },
  casillaError: { borderColor: "#b3261e" },
  digito: { fontSize: 24, fontWeight: "600", color: tema.texto },
  // Fuera de la vista pero enfocable: con `display: none` el teclado no abre.
  oculto: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
