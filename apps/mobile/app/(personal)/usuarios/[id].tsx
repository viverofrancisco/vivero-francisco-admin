import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado, type OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { Fila, Seccion, estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { HojaDeEnlace } from "@/components/personal/HojaDeEnlace";
import { PastillaDeAcceso } from "@/components/personal/PastillaDeAcceso";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { EnlaceGenerado, UsuarioDelEquipo } from "@/lib/types";
import { tema } from "@/lib/tema";

const ROL: Record<string, string> = { ADMIN: "Administrador", STAFF: "Staff" };

/**
 * La ficha de una cuenta del equipo, de solo lectura, como la del personal:
 * con qué entra y cómo está su acceso primero, después los datos, y en el ⋯
 * *Editar*, *Enviar invitación* o *Restablecer contraseña* —el enlace se
 * muestra para copiarlo, compartirlo o mandarlo por correo— y *Revocar* o
 * *Restaurar acceso*, que a uno mismo no se le ofrece.
 */
export default function UsuarioFichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const yo = useAuthStore((s) => s.user?.id);
  const [u, setU] = useState<UsuarioDelEquipo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [enlace, setEnlace] = useState<EnlaceGenerado | null>(null);
  const [confirmandoRevocar, setConfirmandoRevocar] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      setU(await apiRequest<UsuarioDelEquipo>(`/api/mobile/users/${id}`));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }, [id]);

  // Al volver de editar, la ficha tiene que mostrar lo nuevo.
  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  const tipoDeEnlace: "invitacion" | "restablecer" =
    u?.acceso === "PENDIENTE" ? "invitacion" : "restablecer";

  async function emitirEnlace() {
    setOcupado(true);
    setAviso(null);
    try {
      setEnlace(
        await apiRequest<EnlaceGenerado>(`/api/mobile/users/${id}/enlace-acceso`, {
          method: "POST",
          body: { tipo: tipoDeEnlace, enviarCorreo: false },
        })
      );
      await cargar();
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
      setU(
        await apiRequest<UsuarioDelEquipo>(`/api/mobile/users/${id}/acceso`, {
          method: "POST",
          body: { revocado },
        })
      );
      setConfirmandoRevocar(false);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos cambiar el acceso"));
    } finally {
      setOcupado(false);
    }
  }

  if (cargando && !u) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Usuario" />
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }
  if (error || !u) {
    return (
      <AvisoDeCarga
        error={error}
        tipo="personal"
        onVolver={() => router.back()}
        onReintentar={() => void cargar()}
      />
    );
  }

  const nombre = [u.name, u.apellido].filter(Boolean).join(" ") || "Sin nombre";
  const esUnoMismo = u.id === yo;
  const opciones: OpcionDeMenu[] = [
    { etiqueta: "Editar", onPress: () => router.push(`/(personal)/usuarios/editar/${id}`) },
    {
      etiqueta: tipoDeEnlace === "invitacion" ? "Enviar invitación" : "Restablecer contraseña",
      onPress: () => void emitirEnlace(),
    },
  ];
  if (!esUnoMismo) {
    opciones.push(
      u.acceso === "REVOCADO"
        ? { etiqueta: "Restaurar acceso", onPress: () => void cambiarAcceso(false) }
        : { etiqueta: "Revocar acceso", onPress: () => setConfirmandoRevocar(true) }
    );
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFicha titulo={nombre} derecha={<MenuDeEncabezado opciones={opciones} />} />
      <ScrollView style={styles.flex} contentContainerStyle={estilosDeFicha.container}>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        {ocupado ? <ActivityIndicator style={styles.ocupado} /> : null}

        <Seccion titulo="Entra con">
          <Fila label="Correo" value={u.email ?? "—"} />
          {u.usuario ? <Fila label="Usuario" value={u.usuario} /> : null}
          <Fila label="Acceso" value={<PastillaDeAcceso acceso={u.acceso} />} />
        </Seccion>

        <Seccion titulo="Información general">
          <Fila label="Nombre" value={u.name || "—"} />
          <Fila label="Apellido" value={u.apellido || "—"} />
          <Fila label="Rol" value={ROL[u.role] ?? u.role} />
          <Fila
            label="Usuario desde"
            value={new Date(u.createdAt).toLocaleDateString("es-EC", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </Seccion>
      </ScrollView>

      <HojaDeEnlace
        datos={enlace}
        nombre={nombre}
        tipo={tipoDeEnlace}
        correo={u.email}
        userId={u.id}
        onCerrar={() => setEnlace(null)}
      />

      <DialogoConfirmar
        visible={confirmandoRevocar}
        titulo={`Revocar el acceso de ${nombre}`}
        detalle="No va a poder entrar hasta que se lo devuelvas. Su cuenta y su historial quedan como están."
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
