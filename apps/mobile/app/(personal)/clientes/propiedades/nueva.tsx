import { useLocalSearchParams, useRouter } from "expo-router";
import type { CreatePropiedadBody } from "@vivero/shared";
import { PropiedadForm } from "@/components/PropiedadForm";
import { apiRequest, ApiError } from "@/lib/api";

/**
 * Agregarle otra propiedad a un cliente.
 *
 * La primera nace con el cliente, en el mismo formulario. Las demás llegan
 * después —la casa de la playa, la oficina— y hasta ahora había que esperar a
 * estar en el portal para cargarlas, que es justo lo contrario de donde se
 * está cuando uno se entera de que existen.
 */
export default function PropiedadNuevaScreen() {
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();
  const router = useRouter();

  async function submit(values: CreatePropiedadBody) {
    try {
      await apiRequest(`/api/mobile/clientes/${clienteId}/propiedades`, {
        method: "POST",
        body: values,
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos guardar la propiedad");
    }
  }

  return <PropiedadForm submitLabel="Agregar propiedad" onSubmit={submit} />;
}
