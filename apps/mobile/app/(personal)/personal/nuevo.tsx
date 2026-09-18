import { useRouter } from "expo-router";
import { PersonalForm } from "@/components/PersonalForm";
import { apiRequest } from "@/lib/api";

/**
 * Alta de una persona. La cuenta se crea con la ficha, del lado del servidor:
 * acá no hay nada que marcar para eso, y por eso no se puede olvidar.
 */
export default function PersonalNuevoScreen() {
  const router = useRouter();
  return (
    <PersonalForm
      etiqueta="Crear ficha"
      onSubmit={async (valores) => {
        await apiRequest("/api/mobile/personal", {
          method: "POST",
          body: valores,
        });
        router.back();
      }}
    />
  );
}
