import { useRouter } from "expo-router";
import { GrupoForm } from "@/components/GrupoForm";
import { apiRequest } from "@/lib/api";

export default function GrupoNuevoScreen() {
  const router = useRouter();
  return (
    <GrupoForm
      titulo="Nuevo grupo"
      accion="Crear"
      onCancelar={() => router.back()}
      onSubmit={async (valores) => {
        await apiRequest("/api/mobile/grupos", { method: "POST", body: valores });
        router.back();
      }}
    />
  );
}
