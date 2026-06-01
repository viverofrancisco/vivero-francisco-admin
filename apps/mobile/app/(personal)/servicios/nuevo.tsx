import { useRouter } from "expo-router";
import type { CreateServicioBody } from "@vivero/shared";
import { ServicioForm } from "@/components/ServicioForm";
import { apiRequest, ApiError } from "@/lib/api";

export default function ServicioNuevoScreen() {
  const router = useRouter();

  async function submit(values: CreateServicioBody) {
    try {
      const created = await apiRequest<{ id: string }>(
        "/api/mobile/servicios",
        { method: "POST", body: values }
      );
      router.replace(`/(personal)/servicios/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos crear el servicio");
    }
  }

  return <ServicioForm submitLabel="Crear servicio" onSubmit={submit} />;
}
