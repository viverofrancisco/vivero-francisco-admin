import { useRouter } from "expo-router";
import { TareaForm } from "@/components/TareaForm";
import { apiRequest } from "@/lib/api";

export default function TareaNuevaScreen() {
  const router = useRouter();
  return (
    <TareaForm
      etiqueta="Crear tarea"
      onSubmit={async (valores) => {
        await apiRequest("/api/mobile/tareas", {
          method: "POST",
          body: valores,
        });
        router.back();
      }}
    />
  );
}
