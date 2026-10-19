import { useRouter } from "expo-router";
import { UbicacionForm } from "@/components/UbicacionForm";
import { apiRequest } from "@vivero/app-ui/lib/api";

export default function UbicacionNuevaScreen() {
  const router = useRouter();
  return (
    <UbicacionForm
      onCancelar={() => router.back()}
      onSubmit={async (valores) => {
        await apiRequest("/api/mobile/ubicaciones", { method: "POST", body: valores });
        router.back();
      }}
    />
  );
}
