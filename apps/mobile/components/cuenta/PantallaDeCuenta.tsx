import React, { useCallback, useState } from "react";
import { ETIQUETA_DE_ROL, correoDeRegistro, errorDe } from "@vivero/shared";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { CampoDeCodigo } from "@vivero/app-ui/components/ui/CampoDeCodigo";
import { HojaInferior } from "@vivero/app-ui/components/ui/HojaInferior";
import { PressableScale } from "@vivero/app-ui/components/ui/PressableScale";
import { useAuthStore } from "@vivero/app-ui/lib/auth-store";
import { tema } from "@vivero/app-ui/lib/tema";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";
import { pendientesSinEnviar } from "@/lib/datos-de-la-cuenta";

const ROLE_LABEL: Record<string, string> = ETIQUETA_DE_ROL;

/**
 * Los permisos del sistema, leídos cada vez que se entra.
 *
 * Se cambian en Ajustes —o sea, afuera de la app—, así que leerlos una sola vez
 * al montar deja la pantalla mintiendo apenas alguien vuelve de activarlos.
 * `null` mientras todavía no se sabe: decir "Desactivada" antes de haber
 * preguntado es peor que no decir nada.
 */
function usePermisos(pedirUbicacion: boolean) {
  const [estado, setEstado] = useState<{
    ubicacion: boolean | null;
    notificaciones: boolean | null;
  }>({ ubicacion: null, notificaciones: null });

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      (async () => {
        const [u, n] = await Promise.all([
          pedirUbicacion
            ? Location.getForegroundPermissionsAsync().catch(() => null)
            : Promise.resolve(null),
          Notifications.getPermissionsAsync().catch(() => null),
        ]);
        if (!vivo) return;
        setEstado({
          ubicacion: pedirUbicacion ? (u?.granted ?? false) : null,
          notificaciones: n?.granted ?? false,
        });
      })();
      return () => {
        vivo = false;
      };
    }, [pedirUbicacion])
  );

  return estado;
}

/**
 * La pantalla de Cuenta, **la misma para todos los roles**: el nombre, la
 * cuenta (usuario o correo, *Cambiar contraseña*), lo que falte activar,
 * *Cerrar sesión*, el logo y la versión. Cada rol le agrega lo suyo —el
 * cliente, su teléfono, sus solicitudes, sus propiedades y *Eliminar mi
 * cuenta*— en vez de tener una pantalla aparte que se va pareciendo cada vez
 * menos (la del cliente tenía otro encabezado, un *Cerrar sesión* en bloque
 * rojo y no podía cambiar su contraseña).
 */
export function PantallaDeCuenta({
  filasDeCuenta,
  children,
  onEliminarCuenta,
  eliminando = false,
  refreshControl,
}: {
  /** Filas que se suman a la sección Cuenta, debajo del correo. */
  filasDeCuenta?: { label: string; value: string }[];
  /** Secciones propias del rol, entre Cuenta y *Cerrar sesión*. */
  children?: React.ReactNode;
  /** El cliente puede borrar su cuenta (Apple lo exige a quien se registra). */
  onEliminarCuenta?: () => void;
  eliminando?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
}) {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * Con algo esperando señal, se avisa antes: si después entra otra cuenta en
   * este teléfono, se descarta (ver `datos-de-la-cuenta.ts`). Volver a entrar
   * con la misma lo conserva.
   */
  function pedirSalir() {
    const n = pendientesSinEnviar();
    if (n === 0) {
      void logout();
      return;
    }
    Alert.alert(
      "Tienes cosas sin enviar",
      `${n === 1 ? "Hay 1 envío" : `Hay ${n} envíos`} esperando señal (mensajes, marcas o fotos). Si cierras sesión y entra otra cuenta en este teléfono, se pierden.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Cerrar sesión", style: "destructive", onPress: () => void logout() },
      ]
    );
  }

  async function logout() {
    setLoggingOut(true);
    if (refreshToken) {
      apiRequest("/api/mobile/auth/logout", {
        method: "POST",
        body: { refreshToken },
        authenticated: false,
      }).catch(() => {});
    }
    await clear();
  }

  const fullName = user
    ? `${user.name ?? ""} ${user.apellido ?? ""}`.trim() || "Mi cuenta"
    : "Mi cuenta";
  const initials = user
    ? `${user.name?.[0] ?? ""}${user.apellido?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";
  const roleLabel = user ? ROLE_LABEL[user.role] ?? user.role : "";
  // La ubicación solo le hace falta a quien marca entrada y salida.
  const esJardinero = user?.role === "PERSONAL";
  const permisos = usePermisos(esJardinero);
  const version = Constants.expoConfig?.version ?? null;
  const insets = useSafeAreaInsets();
  const [cambiando, setCambiando] = useState(false);
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false);
  // El cliente cambia su correo él mismo, probándolo con un código; el del
  // equipo lo cambia un administrador desde el portal.
  const esCliente = user?.role === "CLIENTE";
  // El de la ubicación es el mismo texto del cartel que sale al abrir la app:
  // dos formas de decir lo mismo son dos que se despegan.
  const faltan = [
    permisos.ubicacion === false
      ? "La app usa tu ubicación para algunas de sus funciones."
      : null,
    permisos.notificaciones === false
      ? "Sin notificaciones no te avisamos de tus visitas."
      : null,
  ].filter((t): t is string => t !== null);

  return (
    // Sin encabezado nativo no hay nadie que descuente la barra de estado: sin
    // esto el avatar queda debajo de la hora y la señal.
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}
      refreshControl={refreshControl}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          {fullName}
        </Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>
          {roleLabel}
        </Text>
      </View>

      {/* Cuenta */}
      <Section title="Cuenta">
        {/* Lo primero: es lo que la oficina dicta por teléfono y lo primero
            que se olvida. El jardinero no tiene correo, así que muchas veces
            es lo único que hay acá. */}
        {user?.usuario ? <Row label="Usuario" value={user.usuario} /> : null}
        {user?.email ? <Row label="Correo" value={user.email} /> : null}
        {filasDeCuenta?.map((f) => <Row key={f.label} label={f.label} value={f.value} />)}
        {/* Sin enlace: el de un solo uso es para quien **no puede** entrar, y
            el jardinero no tiene correo al cual mandárselo. Estando adentro
            alcanza con escribir la que se está usando. */}
        {esCliente ? (
          <FilaAccion texto="Cambiar correo" onPress={() => setCambiandoCorreo(true)} />
        ) : null}
        <FilaAccion texto="Cambiar contraseña" onPress={() => setCambiando(true)} />
      </Section>

      {children}

      {/* Un permiso solo ocupa lugar cuando falta. Decir "Ubicación · Activo"
          es informarle de algo que ya funciona a alguien que no vino a
          revisarlo; lo que sí hace falta decir es que algo está apagado. */}
      {faltan.length > 0 ? (
        <Aviso
          textos={faltan}
          onActivar={() => Linking.openSettings()}
        />
      ) : null}

      {/* Un bloque rojo a todo el ancho para algo que se hace una vez cada
          tanto —y que además no es destructivo: se vuelve a entrar— gritaba
          más fuerte que todo lo demás de la pantalla. Texto rojo alcanza. */}
      <Button
        mode="text"
        onPress={pedirSalir}
        loading={loggingOut}
        disabled={loggingOut}
        textColor={tema.rojo}
        style={styles.logoutBtn}
        labelStyle={styles.logoutLabel}
      >
        Cerrar sesión
      </Button>

      {onEliminarCuenta ? (
        <Button
          mode="text"
          onPress={onEliminarCuenta}
          loading={eliminando}
          disabled={eliminando || loggingOut}
          textColor={tema.texto3}
          style={styles.eliminar}
        >
          Eliminar mi cuenta
        </Button>
      ) : null}

      <LogoDeLaEmpresa style={styles.footerLogo} />

      {version ? (
        <Text variant="bodySmall" style={styles.version}>
          Versión {version}
        </Text>
      ) : null}

      <CambiarContrasena
        visible={cambiando}
        onCerrar={() => setCambiando(false)}
      />
      {esCliente ? (
        <CambiarCorreo
          visible={cambiandoCorreo}
          onCerrar={() => setCambiandoCorreo(false)}
        />
      ) : null}
    </ScrollView>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text variant="labelMedium" style={styles.sectionLabel}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Una fila que lleva a otra pantalla, con su chevron: *Cambiar contraseña*, *Mis solicitudes*. */
export function FilaAccion({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.accionFila}>
      <Text variant="bodyMedium" style={styles.accionTexto}>
        {texto}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
    </Pressable>
  );
}

/**
 * Lo que falta activar, y el atajo a Ajustes.
 *
 * Se toca en Ajustes y no acá porque una vez negado iOS no vuelve a mostrar su
 * diálogo: la app no tiene forma de conceder nada, solo de llevar hasta el
 * interruptor. `Linking.openSettings()` abre la página de esta app, que es
 * donde está.
 */
function Aviso({
  textos,
  onActivar,
}: {
  textos: string[];
  onActivar: () => void;
}) {
  return (
    <View style={styles.aviso}>
      <Ionicons
        name="alert-circle-outline"
        size={20}
        color={tema.ambarTexto}
        style={styles.avisoIcono}
      />
      <View style={styles.avisoTexto}>
        {textos.map((t) => (
          <Text key={t} variant="bodySmall" style={styles.avisoLinea}>
            {t}
          </Text>
        ))}
        <Pressable onPress={onActivar} hitSlop={8}>
          <Text style={styles.avisoAccion}>Activar en Ajustes</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Cambiar la propia contraseña, sin salir de la app.
 *
 * Pide la actual porque es lo que prueba quién es: la sesión sola no alcanza
 * —el teléfono puede quedar abierto sobre una mesa—. Al guardar, el servidor
 * revoca las demás sesiones, que es el motivo por el que se suele cambiar.
 */
function CambiarContrasena({
  visible,
  onCerrar,
}: {
  visible: boolean;
  onCerrar: () => void;
}) {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setActual("");
    setNueva("");
    setRepetir("");
    setError(null);
    onCerrar();
  }

  const puede =
    actual.length > 0 && nueva.length >= 6 && nueva === repetir && !guardando;

  async function guardar() {
    if (!puede) return;
    setGuardando(true);
    setError(null);
    try {
      await apiRequest("/api/mobile/auth/cambiar-password", {
        method: "POST",
        body: { actual, nueva, refreshToken },
      });
      cerrar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cambiarla"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <HojaInferior visible={visible} onCerrar={cerrar}>
      <View style={styles.hoja}>
        <Text variant="titleMedium" style={styles.hojaTitulo}>
          Cambiar contraseña
        </Text>
        <TextInput
          mode="outlined"
          label="Contraseña actual"
          value={actual}
          onChangeText={setActual}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Contraseña nueva"
          value={nueva}
          onChangeText={setNueva}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Repetir la nueva"
          value={repetir}
          onChangeText={setRepetir}
          secureTextEntry
          autoCapitalize="none"
        />
        {/* Lo que falta, dicho antes de apretar y no después. */}
        <Text variant="bodySmall" style={error ? styles.hojaError : styles.hojaPista}>
          {error ??
            (nueva.length > 0 && nueva.length < 6
              ? "La nueva tiene que tener al menos 6 caracteres."
              : repetir.length > 0 && nueva !== repetir
                ? "Las dos nuevas no coinciden."
                : "Se cierran las sesiones que tengas en otros teléfonos.")}
        </Text>
        <PressableScale
          onPress={guardar}
          disabled={!puede}
          style={[styles.hojaBoton, !puede && styles.hojaBotonApagado]}
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.hojaBotonTexto}>Guardar</Text>
          )}
        </PressableScale>
      </View>
    </HojaInferior>
  );
}

export /**
 * Cambiar el correo, en dos pasos dentro de la misma hoja: el correo nuevo, y
 * el código que le llega **a ese correo** —sin el código, cualquiera con el
 * teléfono en la mano podría poner el suyo y quedarse con la cuenta—. El
 * código se valida solo al sexto dígito, como en el registro, y al cambiar se
 * actualiza la sesión para que la pantalla muestre el nuevo.
 */
function CambiarCorreo({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setPaso("correo");
    setCorreo("");
    setCodigo("");
    setError(null);
    onCerrar();
  }

  const limpio = correo.trim().toLowerCase();
  const errorFormato = limpio ? errorDe(correoDeRegistro, limpio) : null;

  async function pedir() {
    if (!limpio || errorFormato) return;
    setEnviando(true);
    setError(null);
    try {
      await apiRequest("/api/mobile/auth/correo", { method: "POST", body: { email: limpio } });
      setCodigo("");
      setPaso("codigo");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos enviarte el código"));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(c: string) {
    setEnviando(true);
    setError(null);
    try {
      const r = await apiRequest<{ email: string }>("/api/mobile/auth/correo/confirmar", {
        method: "POST",
        body: { codigo: c },
      });
      if (user) setUser({ ...user, email: r.email });
      cerrar();
      Alert.alert("Correo actualizado exitosamente");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cambiar tu correo"));
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <HojaInferior visible={visible} onCerrar={cerrar}>
      <View style={styles.hoja}>
        <Text variant="titleMedium" style={styles.hojaTitulo}>
          {paso === "correo" ? "Cambiar correo" : "Revisa tu correo"}
        </Text>
        {paso === "correo" ? (
          <>
            <TextInput
              mode="outlined"
              label="Correo nuevo"
              value={correo}
              onChangeText={(t) => {
                setCorreo(t);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              error={!!error}
              autoFocus
            />
            <Text variant="bodySmall" style={error ? styles.hojaError : styles.hojaPista}>
              {error ?? "Te enviaremos un código a ese correo para confirmar que es tuyo."}
            </Text>
            <PressableScale
              onPress={pedir}
              disabled={!limpio || !!errorFormato || enviando}
              style={[
                styles.hojaBoton,
                (!limpio || !!errorFormato || enviando) && styles.hojaBotonApagado,
              ]}
            >
              {enviando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.hojaBotonTexto}>Enviar código</Text>
              )}
            </PressableScale>
          </>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.hojaPista}>
              Te enviamos un código de 6 dígitos a{" "}
              <Text style={styles.hojaCorreo}>{limpio}</Text>.
            </Text>
            <CampoDeCodigo
              valor={codigo}
              onCambiar={(c) => {
                setCodigo(c);
                if (error) setError(null);
              }}
              alCompletar={confirmar}
              deshabilitado={enviando}
              conError={!!error}
            />
            {error ? (
              <Text variant="bodySmall" style={[styles.hojaError, styles.centrado]}>
                {error}
              </Text>
            ) : null}
            {enviando ? <ActivityIndicator color={tema.verde} /> : null}
            <Button mode="text" onPress={() => setPaso("correo")} disabled={enviando}>
              Usar otro correo
            </Button>
          </>
        )}
      </View>
    </HojaInferior>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: tema.verde,
    fontWeight: "600",
    fontSize: 26,
  },
  heroTitle: { color: "#111", fontWeight: "700", textAlign: "center" },
  heroSubtitle: { color: "#777" },

  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
  },

  logoutBtn: { marginTop: 20, alignSelf: "center" },
  eliminar: { alignSelf: "center" },
  logoutLabel: { fontSize: 15, fontWeight: "600" },

  aviso: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tema.ambar50,
  },
  avisoIcono: { marginTop: 1 },
  avisoTexto: { flex: 1, gap: 4 },
  avisoLinea: { color: tema.ambarTexto, lineHeight: 18 },
  avisoAccion: { color: tema.ambarTexto, fontWeight: "700", marginTop: 2 },

  accionFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  accionTexto: { color: tema.verde, fontWeight: "600" },

  hoja: { paddingHorizontal: 20, gap: 10 },
  hojaTitulo: { color: "#111", fontWeight: "700" },
  hojaPista: { color: tema.texto3 },
  hojaError: { color: "#b3261e" },
  hojaCorreo: { fontWeight: "700", color: tema.texto },
  centrado: { textAlign: "center", marginTop: -12 },
  hojaBoton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  hojaBotonApagado: { backgroundColor: "#bdbdbd" },
  hojaBotonTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },

  version: { textAlign: "center", color: "#aaa", marginTop: 10 },

  footer: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 32,
  },
  footerLogo: {
    alignSelf: "center",
    height: 56,
    width: 200,
    marginTop: 28,
  },
});
