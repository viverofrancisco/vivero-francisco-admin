import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ListaDelCatalogo } from "@/components/catalogo/ListaDelCatalogo";
import { useCarrito } from "@/lib/carrito";

export default function CatalogoScreen() {
  const router = useRouter();
  const anadir = useCarrito((s) => s.anadir);
  return (
    <ListaDelCatalogo
      onAbrir={(id) => router.push(`/(cliente)/catalogo/${id}`)}
      onAnadir={(linea) => {
        anadir(linea);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return true;
      }}
    />
  );
}
