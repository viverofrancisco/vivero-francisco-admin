import { useRouter } from "expo-router";
import type { CreateClienteBody } from "@vivero/shared";
import { ClienteForm } from "@/components/ClienteForm";
import { apiRequest, ApiError } from "@/lib/api";

export default function ClienteNuevoScreen() {
  const router = useRouter();

  async function submit(values: CreateClienteBody) {
    try {
      const created = await apiRequest<{ id: string }>(
        "/api/mobile/clientes",
        { method: "POST", body: values }
      );
      router.replace(`/(personal)/clientes/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos crear el cliente");
    }
  }

  return <ClienteForm submitLabel="Crear cliente" onSubmit={submit} />;
}
