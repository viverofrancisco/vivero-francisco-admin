import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { FichaDelProducto } from "@/components/catalogo/FichaDelProducto";
import { lineaDeLaFicha, useCarrito } from "@/lib/carrito";

export default function ProductoDelCatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const anadir = useCarrito((s) => s.anadir);
  return (
    <FichaDelProducto
      id={id}
      onAbrirProducto={(pid) => router.push(`/(cliente)/catalogo/${pid}`)}
      onAnadir={(producto, variante, cantidad) => {
        anadir(lineaDeLaFicha(producto, variante, cantidad));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return true;
      }}
    />
  );
}
