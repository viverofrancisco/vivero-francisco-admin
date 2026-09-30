import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Campo, Titulo } from "@/components/ui/Formulario";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { subirArchivoLocal } from "@/lib/subida";
import { tema } from "@/lib/tema";

interface Empresa {
  nombre: string | null;
  logoKey: string | null;
  logoUrl: string | null;
}

/**
 * El nombre y el logo del vivero —lo que se ve en el sistema y en los
 * informes—, como la pantalla *Empresa* del portal. Guarda desde el
 * encabezado, y *Guardar* se prende solo con cambios. El logo se sube al
 * elegirlo pero no se aplica hasta guardar.
 */
export default function EmpresaScreen() {
  const router = useRouter();
  const [inicial, setInicial] = useState<Empresa | null>(null);
  const [nombre, setNombre] = useState("");
  const [logo, setLogo] = useState<{ key: string | null; url: string | null }>({
    key: null,
    url: null,
  });
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Empresa>("/api/mobile/empresa")
      .then((e) => {
        setInicial(e);
        setNombre(e.nombre ?? "");
        setLogo({ key: e.logoKey, url: e.logoUrl });
      })
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la empresa")));
  }, []);

  const hayCambios =
    inicial !== null &&
    ((nombre.trim() || null) !== (inicial.nombre || null) || logo.key !== inicial.logoKey);

  async function elegirLogo() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (r.canceled) return;
    const a = r.assets[0];
    const contentType = a.mimeType ?? "image/jpeg";
    setSubiendo(true);
    setError(null);
    try {
      const firma = await apiRequest<{ uploadUrl: string; key: string; publicUrl: string }>(
        "/api/mobile/empresa/logo-upload-url",
        {
          method: "POST",
          body: {
            fileName: a.fileName ?? "logo.jpg",
            contentType,
            size: a.fileSize ?? undefined,
          },
        }
      );
      const status = await subirArchivoLocal(a.uri, firma.uploadUrl, contentType);
      if (status < 200 || status >= 300) throw new Error("No pudimos subir el logo");
      setLogo({ key: firma.key, url: firma.publicUrl });
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos subir el logo"));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const e = await apiRequest<Empresa>("/api/mobile/empresa", {
        method: "PUT",
        body: { nombre: nombre.trim() || null, logoKey: logo.key, logoUrl: logo.url },
      });
      setInicial(e);
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo="Empresa"
        accion="Guardar"
        onAccion={guardar}
        onCancelar={() => router.back()}
        cargando={guardando}
        deshabilitado={!hayCambios || subiendo}
      />
      {!inicial ? (
        <View style={styles.centro}>
          {error ? <Text style={styles.apagado}>{error}</Text> : <ActivityIndicator size="large" />}
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.nota}>
              El nombre y el logo que se muestran en el sistema y en los informes.
            </Text>
            <Titulo>Nombre</Titulo>
            <Campo label="Nombre de la empresa" value={nombre} onChangeText={setNombre} />

            <Titulo>Logo</Titulo>
            <View style={styles.logoCaja}>
              {logo.url ? (
                <Image source={{ uri: logo.url }} style={styles.logo} resizeMode="contain" />
              ) : (
                <Ionicons name="image-outline" size={36} color={tema.texto3} />
              )}
              {subiendo ? <ActivityIndicator style={styles.subiendo} /> : null}
            </View>
            <View style={styles.botones}>
              <PressableScale onPress={elegirLogo} disabled={subiendo} estiloExterno={styles.mitad} style={styles.boton}>
                <Text style={styles.botonTexto}>{logo.url ? "Cambiar logo" : "Elegir logo"}</Text>
              </PressableScale>
              {logo.url ? (
                <PressableScale
                  onPress={() => setLogo({ key: null, url: null })}
                  disabled={subiendo}
                  estiloExterno={styles.mitad}
                  style={styles.boton}
                >
                  <Text style={[styles.botonTexto, { color: tema.rojo }]}>Quitar</Text>
                </PressableScale>
              ) : null}
            </View>
            <Text style={styles.nota}>PNG, JPG o WEBP, de hasta 2 MB.</Text>

            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  apagado: { color: tema.texto3, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  nota: { color: tema.texto3, fontSize: 13, paddingVertical: 6 },
  logoCaja: {
    height: 140,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "80%", height: "80%" },
  subiendo: { position: "absolute" },
  botones: { flexDirection: "row", gap: 10, marginTop: 10 },
  mitad: { flex: 1 },
  boton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
  },
  botonTexto: { fontSize: 15, fontWeight: "600", color: tema.texto },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
