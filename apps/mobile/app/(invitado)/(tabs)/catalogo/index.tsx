import { useRouter } from "expo-router";
import { ListaDelCatalogo } from "@/components/catalogo/ListaDelCatalogo";
import * as Haptics from "expo-haptics";
import { useCarrito } from "@/lib/carrito";

export default function CatalogoInvitadoScreen() {
  const router = useRouter();
  const anadir = useCarrito((s) => s.anadir);
  return (
    <ListaDelCatalogo
      publico
      // Al carrito del invitado, como el del cliente: compra sin cuenta.
      onAnadir={(linea) => {
        anadir(linea);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return true;
      }}
      onAbrir={(id) => router.push(`/(invitado)/(tabs)/catalogo/producto/${id}`)}
      // Sin *Iniciar sesión* al lado del título: entrar está en la pestaña
      // Cuenta, y repetido acá le quitaba lugar a la búsqueda del catálogo.
      acciones={[
        {
          etiqueta: "Solicitar una visita",
          onPress: () => router.push("/(invitado)/solicitar"),
        },
      ]}
    />
  );
}

