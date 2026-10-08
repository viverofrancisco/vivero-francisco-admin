import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  precioDelCatalogo,
  type ProductoDelCatalogoDetalle,
} from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { tema } from "@/lib/tema";

const ANCHO = Dimensions.get("window").width;

/**
 * La ficha de un producto del catálogo: las fotos para pasar con el dedo, el
 * precio con IVA, las variantes con el suyo y la descripción. Al pie, fijo,
 * *Solicitar cotización*: es lo único que se hace desde acá, y en un servicio
 * es la única forma de saber el precio. La misma para el cliente y para el
 * invitado.
 */
export function FichaDelProducto({
  id,
  publico = false,
  onSolicitar,
}: {
  id: string;
  /** Sin sesión: el modo invitado. */
  publico?: boolean;
  onSolicitar: (producto: { id: string; nombre: string }) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [producto, setProducto] = useState<ProductoDelCatalogoDetalle | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [foto, setFoto] = useState(0);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setProducto(
        await apiRequest<ProductoDelCatalogoDetalle>(
          publico ? `/api/mobile/publico/catalogo/${id}` : `/api/mobile/catalogo/${id}`,
          { authenticated: !publico }
        )
      );
    } catch (e) {
      setError(e);
    }
  }, [id, publico]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoDeFicha titulo="Producto" />
        <AvisoDeCarga
          error={error}
          tipo="producto"
          onVolver={() => router.back()}
          onReintentar={cargar}
        />
      </View>
    );
  }

  if (!producto) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoDeFicha titulo="" />
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      </View>
    );
  }

  const conVariantes = producto.variantes.length > 1;

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha titulo={producto.nombre} />
      <ScrollView contentContainerStyle={styles.cuerpo}>
        {producto.imagenes.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setFoto(Math.round(e.nativeEvent.contentOffset.x / ANCHO))
              }
            >
              {producto.imagenes.map((url) => (
                <Image
                  key={url}
                  source={url}
                  style={{ width: ANCHO, height: ANCHO }}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={150}
                />
              ))}
            </ScrollView>
            {producto.imagenes.length > 1 ? (
              <View style={styles.puntos}>
                {producto.imagenes.map((url, i) => (
                  <View
                    key={url}
                    style={[styles.punto, i === foto && styles.puntoActivo]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.sinFoto, { height: ANCHO * 0.6 }]}>
            <Ionicons
              name={producto.tipo === "SERVICIO" ? "construct-outline" : "leaf-outline"}
              size={48}
              color={tema.texto3}
            />
          </View>
        )}

        <View style={styles.datos}>
          <Text style={styles.nombre}>{producto.nombre}</Text>
          <Text
            style={[styles.precio, producto.precioDesde === null && styles.precioCotiza]}
          >
            {precioDelCatalogo(producto)}
          </Text>
          {producto.precioDesde !== null ? (
            <Text style={styles.iva}>Incluye IVA</Text>
          ) : null}
          {producto.categorias.length > 0 ? (
            <Text style={styles.categorias}>{producto.categorias.join(" · ")}</Text>
          ) : null}
        </View>

        {conVariantes ? (
          <View style={styles.seccion}>
            <Text style={styles.rotulo}>OPCIONES</Text>
            <View style={styles.caja}>
              {producto.variantes.map((v, i) => (
                <View key={v.id}>
                  {i > 0 ? <View style={styles.divisor} /> : null}
                  <View style={styles.variante}>
                    <Text style={styles.varianteNombre}>{v.nombre || producto.nombre}</Text>
                    <Text style={styles.variantePrecio}>
                      {v.precio === null ? "Se cotiza" : `$${v.precio.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {producto.descripcion ? (
          <View style={styles.seccion}>
            <Text style={styles.rotulo}>DESCRIPCIÓN</Text>
            <Text style={styles.descripcion}>{producto.descripcion}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.pie, { paddingBottom: insets.bottom + 10 }]}>
        <Button
          mode="contained"
          onPress={() => onSolicitar({ id: producto.id, nombre: producto.nombre })}
          contentStyle={styles.botonContenido}
          style={styles.boton}
        >
          Solicitar cotización
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  cuerpo: { paddingBottom: 24 },
  sinFoto: {
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  puntos: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
  },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: tema.linea },
  puntoActivo: { backgroundColor: tema.verde },
  datos: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  nombre: { fontSize: 22, fontWeight: "700", color: tema.texto },
  precio: { fontSize: 20, fontWeight: "600", color: tema.texto, marginTop: 4 },
  precioCotiza: { color: tema.texto2, fontWeight: "500" },
  iva: { fontSize: 12, color: tema.texto3 },
  categorias: { fontSize: 13, color: tema.texto3, marginTop: 4 },
  seccion: { paddingHorizontal: 16, paddingTop: 20, gap: 6 },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4 },
  caja: { backgroundColor: tema.fondo, borderRadius: 12, paddingHorizontal: 14 },
  divisor: { height: StyleSheet.hairlineWidth, backgroundColor: tema.linea },
  variante: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  varianteNombre: { color: tema.texto, flexShrink: 1 },
  variantePrecio: { color: tema.texto, fontWeight: "600" },
  descripcion: { color: tema.texto2, fontSize: 15, lineHeight: 22 },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
    backgroundColor: "#fff",
  },
  boton: { borderRadius: 12 },
  botonContenido: { paddingVertical: 6 },
});
