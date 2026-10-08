import { useLocalSearchParams, useRouter } from "expo-router";
import { FichaDelProducto } from "@/components/catalogo/FichaDelProducto";

export default function ProductoInvitadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <FichaDelProducto
      id={id}
      publico
      onSolicitar={(p) =>
        router.push({
          pathname: "/(invitado)/solicitar",
          params: { productoId: p.id, producto: p.nombre },
        })
      }
    />
  );
}
