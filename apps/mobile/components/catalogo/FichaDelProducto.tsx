import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  precioDelCatalogo,
  textoDePrecio,
  type ProductoDelCatalogo,
  type ProductoDelCatalogoDetalle,
  type VarianteDelCatalogo,
} from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { guardarProducto, productoEnCache } from "@/lib/cache-de-productos";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { tema } from "@/lib/tema";
import { Cantidad } from "./partes";
import { SelectorDeOpciones, seleccionInicial, varianteDe } from "./SelectorDeOpciones";

const ANCHO = Dimensions.get("window").width;

/** Desde cuántas se avisa *N en stock* en ámbar. */
const POCAS = 5;

/**
 * La ficha de un producto, en el orden de Amazon y **sin nada fijo al pie**:
 * las fotos, el nombre, **una fila por opción** (`SelectorDeOpciones`), el
 * precio, si hay o no, la cantidad y *Añadir al carrito*; después *Se pide junto con* y
 * *También te puede gustar*, y al final la descripción. Solo bienes: los
 * servicios se piden en la solicitud de visita. La misma para el cliente y
 * para el invitado.
 */
export function FichaDelProducto({
  id,
  publico = false,
  onAnadir,
  onAbrirProducto,
}: {
  id: string;
  /** Sin sesión: el modo invitado. */
  publico?: boolean;
  /** Devuelve si quedó añadido, para el ✓ (también el invitado, que compra sin cuenta). */
  onAnadir: (
    producto: ProductoDelCatalogoDetalle,
    variante: VarianteDelCatalogo,
    cantidad: number
  ) => boolean;
  /** Abrir uno de los recomendados. */
  onAbrirProducto: (id: string) => void;
}) {
  const router = useRouter();
  // Lo ya abierto se pinta al instante; la respuesta lo refresca detrás.
  const [producto, setProducto] = useState<ProductoDelCatalogoDetalle | null>(() => productoEnCache(id));
  const [error, setError] = useState<unknown>(null);
  const [foto, setFoto] = useState(0);
  /** Un valor por opción, en el orden de `producto.opciones`. */
  const [seleccion, setSeleccion] = useState<string[]>(() => {
    const p = productoEnCache(id);
    return p ? seleccionInicial(p.variantes) : [];
  });
  const [cantidad, setCantidad] = useState(1);
  const [anadido, setAnadido] = useState(false);
  const galeria = useRef<ScrollView>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const p = await apiRequest<ProductoDelCatalogoDetalle>(
        publico ? `/api/mobile/publico/catalogo/${id}` : `/api/mobile/catalogo/${id}`,
        { authenticated: !publico }
      );
      guardarProducto(p);
      setProducto(p);
      // Arranca elegida la primera que se puede pedir.
      setSeleccion((prev) => (prev.length ? prev : seleccionInicial(p.variantes)));
    } catch (e) {
      // Con lo ya abierto en pantalla, un fallo de red no lo tapa.
      if (!productoEnCache(id)) setError(e);
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

  const elegida = varianteDe(producto.variantes, seleccion);
  const agotada = !elegida || elegida.disponible === 0;
  const conVariantes = producto.variantes.length > 1;

  function elegir(v: VarianteDelCatalogo) {
    setSeleccion(v.valores);
    setCantidad((c) => Math.max(1, Math.min(c, v.disponible ?? 999)));
    // Si la variante tiene foto, la galería va a esa foto.
    const k = v.imagenUrl ? producto!.imagenes.indexOf(v.imagenUrl) : -1;
    if (k >= 0) {
      galeria.current?.scrollTo({ x: k * ANCHO, animated: true });
      setFoto(k);
    }
  }

  function anadir() {
    if (!elegida || agotada || !producto) return;
    if (!onAnadir(producto, elegida, cantidad)) return;
    setAnadido(true);
    setTimeout(() => setAnadido(false), 1500);
  }

  const precio = conVariantes && elegida ? elegida.precio : producto.precioDesde;
  const precioTexto =
    conVariantes && elegida ? textoDePrecio(elegida.precio) : precioDelCatalogo(producto);

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha titulo={producto.nombre} />
      <ScrollView
        contentContainerStyle={styles.cuerpo}
      >
        {producto.imagenes.length > 0 ? (
          <View>
            <ScrollView
              ref={galeria}
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
                  <View key={url} style={[styles.punto, i === foto && styles.puntoActivo]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.sinFoto, { height: ANCHO * 0.6 }]}>
            <Ionicons
              name="leaf-outline"
              size={48}
              color={tema.texto3}
            />
          </View>
        )}

        <View style={styles.bloque}>
          <Text style={styles.nombre}>{producto.nombre}</Text>
          {/* El rango del producto, como Amazon bajo el título; el precio de
              la combinación elegida va más abajo, junto al botón. */}
          {conVariantes ? (
            <Text style={styles.rango}>{precioDelCatalogo(producto)}</Text>
          ) : null}
          {producto.categorias.length > 0 ? (
            <Text style={styles.categorias}>{producto.categorias.join(" · ")}</Text>
          ) : null}
        </View>

        {producto.opciones.length > 0 ? (
          <View style={styles.selector}>
            <SelectorDeOpciones
              opciones={producto.opciones}
              variantes={producto.variantes}
              seleccion={seleccion}
              onElegir={elegir}
            />
          </View>
        ) : null}

        <View style={styles.bloque}>
          <Text style={[styles.precio, (precio ?? 0) === 0 && styles.precioSinIva]}>
            {precioTexto}
          </Text>
          {precio ? <Text style={styles.iva}>Incluye IVA</Text> : null}
          {elegida ? <Existencias disponible={elegida.disponible} /> : null}

          <View style={styles.comprar}>
            {!agotada ? (
              <Cantidad
                ancha
                valor={cantidad}
                onCambio={setCantidad}
                maximo={elegida?.disponible ?? null}
                teclado={{
                  titulo: producto.nombre,
                  detalle: elegida?.nombre ?? "",
                  precio: elegida?.precio ?? null,
                }}
              />
            ) : null}
            <Button
              mode="contained"
              onPress={anadir}
              disabled={agotada}
              icon={anadido ? "check" : undefined}
              contentStyle={styles.botonContenido}
              style={styles.boton}
            >
              {agotada ? "Agotado" : anadido ? "Añadido" : "Añadir al carrito"}
            </Button>
          </View>
        </View>

        <Carrusel titulo="Se pide junto con" productos={producto.compradosJuntos} onAbrir={onAbrirProducto} />
        <Carrusel titulo="También te puede gustar" productos={producto.teGustaria} onAbrir={onAbrirProducto} />

        {producto.descripcion ? (
          <View style={[styles.bloque, styles.separado]}>
            <Text style={styles.seccionTitulo}>Sobre este producto</Text>
            <Text style={styles.descripcion}>{producto.descripcion}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** *Disponible* en verde, *N en stock* cuando quedan pocas, *Agotado*; nada si no se cuenta. */
function Existencias({ disponible }: { disponible: number | null }) {
  if (disponible === null) return null;
  const texto =
    disponible === 0
      ? "Agotado"
      : disponible <= POCAS
        ? `${disponible} en stock`
        : "Disponible";
  return (
    <Text
      style={[
        styles.existencias,
        disponible === 0 ? styles.existenciasAgotado : disponible <= POCAS ? styles.existenciasPocas : null,
      ]}
    >
      {texto}
    </Text>
  );
}

/** Una fila de productos para deslizar: foto, nombre y precio. Nada si está vacía. */
function Carrusel({
  titulo,
  productos,
  onAbrir,
}: {
  titulo: string;
  productos: ProductoDelCatalogo[];
  onAbrir: (id: string) => void;
}) {
  if (productos.length === 0) return null;
  return (
    <View style={styles.separado}>
      <Text style={[styles.seccionTitulo, styles.carruselTitulo]}>{titulo}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carrusel}
      >
        {productos.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onAbrir(p.id)}
            style={({ pressed }) => [styles.mini, pressed && styles.tocado]}
          >
            <View style={styles.miniFoto}>
              {p.imagenUrl ? (
                <Image
                  source={p.imagenUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={150}
                />
              ) : (
                <Ionicons
                  name="leaf-outline"
                  size={26}
                  color={tema.texto3}
                />
              )}
            </View>
            <Text style={styles.miniNombre} numberOfLines={2}>
              {p.nombre}
            </Text>
            <Text style={styles.miniPrecio}>
              {p.agotado ? "Agotado" : precioDelCatalogo(p)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  cuerpo: { paddingBottom: 32 },
  sinFoto: { backgroundColor: tema.lienzo, alignItems: "center", justifyContent: "center" },
  puntos: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 10 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: tema.linea },
  puntoActivo: { backgroundColor: tema.verde },
  bloque: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  separado: {
    marginTop: 20,
    borderTopWidth: 8,
    borderTopColor: tema.fondo,
  },
  nombre: { fontSize: 20, fontWeight: "700", color: tema.texto },
  categorias: { fontSize: 13, color: tema.texto3 },
  rango: { fontSize: 16, color: tema.texto2, fontWeight: "600" },
  selector: { paddingTop: 18 },
  precio: { fontSize: 26, fontWeight: "700", color: tema.texto },
  precioSinIva: { fontSize: 20, color: tema.texto2, fontWeight: "600" },
  iva: { fontSize: 12, color: tema.texto3 },
  existencias: { fontSize: 16, fontWeight: "600", color: tema.verde, marginTop: 6 },
  existenciasPocas: { color: "#8a5a00" },
  existenciasAgotado: { color: tema.texto3 },
  // La cantidad arriba y *Añadir al carrito* debajo, a todo el ancho.
  comprar: { gap: 12, marginTop: 12 },
  boton: { alignSelf: "stretch", borderRadius: 12 },
  botonContenido: { paddingVertical: 6 },
  seccionTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  carruselTitulo: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  carrusel: { paddingHorizontal: 16, gap: 12 },
  mini: { width: 132, gap: 3 },
  tocado: { opacity: 0.7 },
  miniFoto: {
    width: 132,
    height: 132,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  miniNombre: { color: tema.texto, fontSize: 13, fontWeight: "600" },
  miniPrecio: { color: tema.texto, fontSize: 13 },
  descripcion: { color: tema.texto2, fontSize: 15, lineHeight: 22, marginTop: 6 },
});
