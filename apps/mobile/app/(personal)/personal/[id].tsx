import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado, type OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { Fila, Seccion, estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { SelectorDeGrupos } from "@/components/personal/SelectorDeGrupos";
import { HojaDeEnlace } from "@/components/personal/HojaDeEnlace";
import { PastillaDeAcceso } from "@/components/personal/PastillaDeAcceso";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { EnlaceGenerado, PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

const TIPO_LABEL: Record<string, string> = {
  JARDINERO: "Jardinero",
  CHOFER: "Chofer",
  SUPERVISOR: "Supervisor",
  MECANICO: "Mecánico",
};

/**
 * La ficha de alguien del vivero, de solo lectura: como la del cliente en la
 * app y como la del portal. Era el formulario de edición directamente, y ahí
 * no cabían las demás cosas que se hacen con una persona; ahora viven en el
 * ⋯ del encabezado —*Editar*, *Restablecer contraseña* o *Enviar invitación*,
 * *Revocar* o *Restaurar acceso*, *Archivar*— y abajo están sus grupos, que
 * se editan desde acá como las categorías de un producto.
 */
export default function PersonalFichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const esAdmin = rol === "ADMIN";
  const puedeEditar = rol === "ADMIN" || rol === "STAFF";
  const [ficha, setFicha] = useState<PersonalFicha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [eligiendoGrupos, setEligiendoGrupos] = useState(false);
  const [enlace, setEnlace] = useState<EnlaceGenerado | null>(null);
  const [confirmandoRevocar, setConfirmandoRevocar] = useState(false);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!id) return;
      if (!silencioso) setCargando(true);
      try {
        setFicha(await apiRequest<PersonalFicha>(`/api/mobile/personal/${id}`));
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setCargando(false);
      }
    },
    [id]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al volver de editar, la ficha tiene que mostrar lo nuevo. En silencio.
  useFocusEffect(
    useCallback(() => {
      cargar(true);
    }, [cargar])
  );

  /** La invitación de quien nunca entró dura una semana; el restablecimiento, una hora. */
  const tipoDeEnlace: "invitacion" | "restablecer" =
    ficha?.acceso === "PENDIENTE" ? "invitacion" : "restablecer";

  async function emitirEnlace() {
    if (!ficha?.user) return;
    setOcupado(true);
    setAviso(null);
    try {
      const datos = await apiRequest<EnlaceGenerado>(
        `/api/mobile/users/${ficha.user.id}/enlace-acceso`,
        { method: "POST", body: { tipo: tipoDeEnlace, enviarCorreo: false } }
      );
      setEnlace(datos);
      await cargar(true);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos generar el enlace"));
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarAcceso(revocado: boolean) {
    setOcupado(true);
    setAviso(null);
    try {
      await apiRequest(`/api/mobile/personal/${id}/acceso`, {
        method: "POST",
        body: { revocado },
      });
      setConfirmandoRevocar(false);
      await cargar(true);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos cambiar el acceso"));
    } finally {
      setOcupado(false);
    }
  }

  function archivar() {
    Alert.alert(
      "Archivar a esta persona",
      "Sale de las listas y pierde el acceso a la app. La cuenta no se borra: su nombre firma los partes que cargó.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/mobile/personal/${id}`, { method: "DELETE" });
              router.back();
            } catch (e) {
              setAviso(mensajeDeError(e, "No pudimos archivarla"));
            }
          },
        },
      ]
    );
  }

  if (cargando && !ficha) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Personal" />
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }
  if (error || !ficha) {
    return (
      <AvisoDeCarga
        error={error}
        tipo="personal"
        onVolver={() => router.back()}
        onReintentar={() => cargar()}
      />
    );
  }

  const nombre = `${ficha.nombre} ${ficha.apellido ?? ""}`.trim();
  const revocado = ficha.acceso === "REVOCADO";
  const opciones: OpcionDeMenu[] = [];
  if (puedeEditar) {
    opciones.push({
      etiqueta: "Editar",
      onPress: () => router.push(`/(personal)/personal/editar/${id}`),
    });
  }
  // Dar o quitar acceso es del ADMIN, y solo si la persona tiene cuenta.
  if (esAdmin && ficha.user) {
    opciones.push({
      etiqueta: tipoDeEnlace === "invitacion" ? "Enviar invitación" : "Restablecer contraseña",
      onPress: () => void emitirEnlace(),
    });
    opciones.push(
      revocado
        ? { etiqueta: "Restaurar acceso", onPress: () => void cambiarAcceso(false) }
        : { etiqueta: "Revocar acceso", onPress: () => setConfirmandoRevocar(true) }
    );
  }
  if (puedeEditar) opciones.push({ etiqueta: "Archivar", onPress: archivar });

  const grupos = (ficha.grupos ?? []).map((g) => g.grupo);

  return (
    <View style={styles.flex}>
      <EncabezadoDeFicha
        titulo={nombre}
        derecha={opciones.length > 0 ? <MenuDeEncabezado opciones={opciones} /> : undefined}
      />
      <ScrollView style={styles.flex} contentContainerStyle={estilosDeFicha.container}>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        {ocupado ? <ActivityIndicator style={styles.ocupado} /> : null}

        {/* Primero con qué entra: es lo que se dicta por teléfono y lo que
            alguien abre la ficha a buscar. */}
        <Seccion titulo="Entra a la app con">
          <Fila label="Usuario" value={ficha.user?.usuario ?? "—"} />
          <Fila label="Acceso" value={<PastillaDeAcceso acceso={ficha.acceso} />} />
        </Seccion>

        <Seccion titulo="Información general">
          <Fila label="Nombre" value={ficha.nombre} />
          <Fila label="Apellido" value={ficha.apellido || "—"} />
          <Fila label="Teléfono" value={ficha.telefono || "—"} />
          <Fila label="Trabajo" value={ficha.tipo ? (TIPO_LABEL[ficha.tipo] ?? ficha.tipo) : "—"} />
          <Fila label="Especialidad" value={ficha.especialidad || "—"} />
          <Fila label="Estado" value={ficha.estado === "ACTIVO" ? "Activo" : "Inactivo"} />
        </Seccion>

        {/* Sus cuadrillas, editables desde acá como las categorías de un
            producto: cada una es una fila, y *Editar* abre la lista entera. */}
        <Seccion
          titulo="Grupos"
          accion={puedeEditar ? { etiqueta: "Editar", onPress: () => setEligiendoGrupos(true) } : null}
        >
          {grupos.length === 0 ? (
            <Text style={estilosDeFicha.vacio}>No está en ningún grupo.</Text>
          ) : (
            grupos.map((g) => (
              <Fila
                key={g.id}
                label={g.nombre}
                value=""
                onPress={() => router.push(`/(personal)/grupos/${g.id}`)}
              />
            ))
          )}
        </Seccion>
      </ScrollView>

      {eligiendoGrupos ? (
        <SelectorDeGrupos
          personalId={id}
          elegidos={grupos.map((g) => g.id)}
          onCerrar={() => setEligiendoGrupos(false)}
          onGuardado={() => {
            setEligiendoGrupos(false);
            void cargar(true);
          }}
        />
      ) : null}

      <HojaDeEnlace
        datos={enlace}
        nombre={nombre}
        tipo={tipoDeEnlace}
        onCerrar={() => setEnlace(null)}
      />

      <DialogoConfirmar
        visible={confirmandoRevocar}
        titulo={`Revocar el acceso de ${nombre}`}
        detalle="No va a poder entrar a la app hasta que se lo devuelvas. Su cuenta y su historial quedan como están."
        confirmar="Revocar acceso"
        peligro
        cargando={ocupado}
        onConfirmar={() => void cambiarAcceso(true)}
        onCancelar={() => setConfirmandoRevocar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  aviso: { color: tema.rojo, textAlign: "center", paddingVertical: 8 },
  ocupado: { paddingVertical: 8 },
});
