import { useLocalSearchParams, useRouter } from "expo-router";
import { FichaDelProducto } from "@/components/catalogo/FichaDelProducto";
import * as Haptics from "expo-haptics";
import { lineaDeLaFicha, useCarrito } from "@/lib/carrito";

export default function ProductoInvitadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const anadir = useCarrito((s) => s.anadir);
  return (
    <FichaDelProducto
      id={id}
      onAbrirProducto={(pid) => router.push(`/(invitado)/(tabs)/catalogo/producto/${pid}`)}
      publico
      onAnadir={(producto, variante, cantidad) => {
        anadir(lineaDeLaFicha(producto, variante, cantidad));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return true;
      }}
    />
  );
}
