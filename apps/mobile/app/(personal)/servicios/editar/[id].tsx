import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ServicioForm,
  datosDeVariante,
  type ValoresDeProducto,
} from "@/components/ServicioForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { apiRequest, ApiError } from "@/lib/api";
import type { ServicioDetail } from "@/lib/types";

/**
 * Editar un producto: el mismo formulario del alta, cargado con la ficha.
 * El producto va por `PUT` y lo de su variante única por el `PATCH` gemelo
 * del portal; con opciones, cada variante lleva lo suyo y acá no se toca.
 */
export default function ServicioEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ServicioDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<ServicioDetail>(`/api/mobile/servicios/${id}`)
      .then(setInitial)
      .catch(() => {});
  }, [id]);

  /**
   * El id de la variante única, si la hay: es a la que va el `PATCH`. Con
   * opciones no hay una "del producto" y el formulario tampoco la pide.
   */
  const varianteUnicaId =
    initial && initial.opciones.length === 0 && initial.variantes.length === 1
      ? initial.variantes[0].id
      : null;

  async function submit(v: ValoresDeProducto) {
    try {
      await apiRequest(`/api/mobile/servicios/${id}`, {
        method: "PUT",
        body: {
          nombre: v.nombre,
          descripcion: v.descripcion,
          tipo: v.tipo,
          estado: v.estado,
          // Con opciones el formulario lo manda nulo y acá no viaja: el
          // código es de cada combinación.
          ...(varianteUnicaId ? { codigo: v.codigo } : {}),
        },
      });
      // El stock no va acá: se mueve desde la ficha, como un movimiento.
      if (v.variante && varianteUnicaId) {
        await apiRequest(`/api/mobile/variantes/${varianteUnicaId}`, {
          method: "PATCH",
          body: datosDeVariante(v.variante),
        });
      }
      router.back();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos guardar los cambios");
    }
  }

  if (!initial) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Editar producto"
          accion="Guardar"
          onAccion={() => {}}
          onCancelar={() => router.back()}
          deshabilitado
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  const conOpciones = initial.opciones.length > 0;
  const unica =
    !conOpciones && initial.variantes.length === 1 ? initial.variantes[0] : null;

  return (
    <ServicioForm
      titulo="Editar producto"
      accion="Guardar"
      modo="editar"
      conOpciones={conOpciones}
      initial={{
        nombre: initial.nombre,
        descripcion: initial.descripcion,
        tipo: initial.tipo,
        estado: initial.estado,
        codigo: unica?.sku ?? null,
        variante:
          unica && initial.tipo === "BIEN"
            ? {
                precio: unica.precio,
                costo: unica.costo,
                cobraIva: unica.cobraIva,
                manejaInventario: unica.manejaInventario,
                permiteNegativo: unica.permiteNegativo,
                peso: unica.peso,
                pesoUnidad: unica.pesoUnidad,
                stockInicial: null,
              }
            : null,
      }}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
