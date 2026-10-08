import { useLocalSearchParams, useRouter } from "expo-router";
import { FichaDelProducto } from "@/components/catalogo/FichaDelProducto";

export default function ProductoDelCatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <FichaDelProducto
      id={id}
      onSolicitar={(p) =>
        router.push({
          pathname: "/(cliente)/solicitudes/nueva",
          params: { productoId: p.id, producto: p.nombre },
        })
      }
    />
  );
}
