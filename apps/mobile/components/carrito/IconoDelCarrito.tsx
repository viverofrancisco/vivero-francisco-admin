import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/lib/tema";

/**
 * El carrito con cuántas unidades lleva: una pastilla verde chica con borde
 * blanco, **colgada de la esquina de arriba a la derecha y corrida hacia
 * afuera**, así con dos o tres cifras crece hacia la derecha y no tapa el
 * carrito (la de iOS, centrada en la esquina, lo tapaba). Desde 100, "99+".
 */
export function IconoDelCarrito({ color, size, cuantas }: { color: string; size: number; cuantas: number }) {
  const texto = cuantas > 99 ? "99+" : String(cuantas);
  // Un ancho por cifras: sin él, la pastilla se achicaba al ancho del ícono
  // y "99+" salía cortado como "9..".
  const ancho = texto.length === 1 ? 18 : texto.length === 2 ? 23 : 29;
  return (
    <View style={{ width: size, height: size }}>
      <Ionicons name="cart-outline" size={size} color={color} />
      {cuantas > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -5,
            left: size * 0.62,
            width: ancho,
            height: 18,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: "#fff",
            backgroundColor: tema.verde,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 }}>{texto}</Text>
        </View>
      ) : null}
    </View>
  );
}
