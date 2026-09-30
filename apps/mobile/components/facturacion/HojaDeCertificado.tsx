import { useState } from "react";
import { StyleSheet } from "react-native";
import { Text, TextInput } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { EmisorConfig } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Carga el `.p12` de un emisor desde el teléfono: el archivo —del correo de
 * la certificadora o de Archivos— y su contraseña. El servidor verifica la
 * contraseña al recibirlo, así que si está mal se sabe acá y no con una
 * factura armada; el archivo se guarda cifrado y no vuelve a salir.
 */
export function HojaDeCertificado({
  emisor,
  onCerrar,
  onCargado,
}: {
  emisor: EmisorConfig | null;
  onCerrar: () => void;
  onCargado: (sujeto: string) => void;
}) {
  const [archivo, setArchivo] = useState<{ uri: string; nombre: string } | null>(null);
  const [password, setPassword] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setArchivo(null);
    setPassword("");
    setError(null);
    onCerrar();
  }

  async function elegir() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    if (!/\.(p12|pfx)$/i.test(a.name)) {
      setError("Elige el archivo .p12 (o .pfx) de la firma.");
      return;
    }
    setError(null);
    setArchivo({ uri: a.uri, nombre: a.name });
  }

  async function cargar() {
    if (!emisor || !archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const certificado = await FileSystem.readAsStringAsync(archivo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const r = await apiRequest<{ sujeto: string }>(
        `/api/mobile/configuracion/emisores/${emisor.id}/certificado`,
        { method: "POST", body: { certificado, password } }
      );
      setArchivo(null);
      setPassword("");
      onCargado(r.sujeto);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargarlo"));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <HojaInferior visible={emisor !== null} onCerrar={cerrar}>
      <Text style={styles.titulo}>Firma electrónica</Text>
      <Text style={styles.nota}>
        El archivo .p12 que emitió la entidad certificadora (Security Data, UANATACA, Banco
        Central, ANF). Se guarda cifrado y solo lo usa el servidor al firmar.
      </Text>
      <PressableScale onPress={elegir} disabled={subiendo} style={styles.archivo}>
        <Ionicons
          name={archivo ? "document-attach" : "document-attach-outline"}
          size={20}
          color={archivo ? tema.verde : tema.texto2}
        />
        <Text style={styles.archivoTexto} numberOfLines={1}>
          {archivo ? archivo.nombre : "Elegir archivo .p12"}
        </Text>
      </PressableScale>
      <TextInput
        mode="outlined"
        label="Contraseña de la firma"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.campo}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PressableScale
        onPress={cargar}
        disabled={!archivo || !password || subiendo}
        style={[styles.boton, (!archivo || !password || subiendo) && styles.apagado]}
      >
        <Text style={styles.botonTexto}>{subiendo ? "Cargando…" : "Cargar firma"}</Text>
      </PressableScale>
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto, paddingHorizontal: 4, paddingTop: 4 },
  nota: { fontSize: 14, color: tema.texto2, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 12 },
  archivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  archivoTexto: { flex: 1, fontSize: 15, color: tema.texto },
  campo: { marginTop: 10, backgroundColor: "#fff" },
  error: { color: tema.rojo, fontSize: 13, paddingTop: 8, paddingHorizontal: 4 },
  boton: {
    marginTop: 14,
    marginBottom: 4,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: tema.verde,
  },
  botonTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
  apagado: { opacity: 0.45 },
});
