import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  precioDelCatalogo,
  textoDePrecio as dinero,
  type ProductoDelCatalogoDetalle,
  type VarianteDelCatalogo,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { lineaDeLaFicha, type LineaDelCarrito } from "@/lib/carrito";
import { HojaInferior } from "@vivero/app-ui/components/ui/HojaInferior";
import { guardarProducto, productoEnCache } from "@/lib/cache-de-productos";
import { tema } from "@vivero/app-ui/lib/tema";
import { Cantidad, Disponibilidad } from "./partes";
import { TecladoDeCantidad } from "./TecladoDeCantidad";
import { SelectorDeOpciones, seleccionInicial, varianteDe } from "./SelectorDeOpciones";

/**
 * *Elegir opciones* de una tarjeta del catálogo: la variante y la cantidad en
 * un drawer, sin salir de la lista. Es lo mismo que la ficha —las variantes
 * con su precio y *N en stock* / *Agotado*— sin las fotos ni la descripción,
 * que para eso está la ficha.
 */
export function HojaDeOpciones({
  productoId,
  publico,
  onCerrar,
  onAnadir,
}: {
  /** `null` cerrada. */
  productoId: string | null;
  publico: boolean;
  onCerrar: () => void;
  /** Devuelve si quedó añadido; si sí, la hoja se cierra. */
  onAnadir: (linea: LineaDelCarrito) => boolean;
}) {
  return (
    <HojaInferior visible={productoId !== null} onCerrar={onCerrar} maxAlto={0.85}>
      {productoId ? (
        <Contenido
          key={productoId}
          productoId={productoId}
          publico={publico}
          onCerrar={onCerrar}
          onAnadir={onAnadir}
        />
      ) : null}
    </HojaInferior>
  );
}

/** Montado con la hoja, así cada apertura empieza de cero sin resetear en un efecto. */
function Contenido({
  productoId,
  publico,
  onCerrar,
  onAnadir,
}: {
  productoId: string;
  publico: boolean;
  onCerrar: () => void;
  onAnadir: (linea: LineaDelCarrito) => boolean;
}) {
  // Si ya se abrió, se pinta al instante y la respuesta lo refresca detrás.
  const [producto, setProducto] = useState<ProductoDelCatalogoDetalle | null>(() =>
    productoEnCache(productoId)
  );
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>(() => {
    const p = productoEnCache(productoId);
    return p ? seleccionInicial(p.variantes) : [];
  });
  const [cantidad, setCantidad] = useState(1);
  /** Tocar el número de la cantidad cambia las opciones por el teclado numérico. */
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    apiRequest<ProductoDelCatalogoDetalle>(
      // `ligero`: sin las recomendaciones de la ficha, que aquí no se ven.
      publico
        ? `/api/mobile/publico/catalogo/${productoId}?ligero=1`
        : `/api/mobile/catalogo/${productoId}?ligero=1`,
      { authenticated: !publico }
    )
      .then((p) => {
        if (!vivo) return;
        guardarProducto(p);
        setProducto(p);
        // Lo que ya eligió mientras cargaba se respeta.
        setSeleccion((s) => (s.length ? s : seleccionInicial(p.variantes)));
      })
      .catch((e) => {
        // Con algo ya pintado desde la memoria, un fallo no tapa la pantalla.
        if (vivo && !productoEnCache(productoId)) {
          setError(mensajeDeError(e, "No pudimos cargar el producto."));
        }
      });
    return () => {
      vivo = false;
    };
  }, [productoId, publico]);

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!producto) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={tema.verde} />
      </View>
    );
  }

  const elegida = varianteDe(producto.variantes, seleccion)!;
  const agotada = !elegida || elegida.disponible === 0;
  const foto = elegida?.imagenUrl ?? producto.imagenUrl ?? producto.imagenes[0] ?? null;

  function elegir(v: VarianteDelCatalogo) {
    setSeleccion(v.valores);
    setCantidad((c) => Math.max(1, Math.min(c, v.disponible ?? 999)));
  }

  function anadir() {
    if (agotada || !producto) return;
    if (onAnadir(lineaDeLaFicha(producto, elegida, cantidad))) onCerrar();
  }

  if (escribiendo && elegida) {
    return (
      <TecladoDeCantidad
        titulo={producto.nombre}
        detalle={elegida.nombre}
        precio={elegida.precio}
        valor={cantidad}
        maximo={elegida.disponible}
        onListo={(n) => {
          setCantidad(n);
          setEscribiendo(false);
        }}
      />
    );
  }

  return (
    <View style={styles.contenido}>
      <View style={styles.cabeza}>
        <View style={styles.miniatura}>
          {foto ? (
            <Image source={foto} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
          ) : (
            <Ionicons name="leaf-outline" size={24} color={tema.texto3} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.nombre} numberOfLines={2}>
            {producto.nombre}
          </Text>
          <Text style={styles.combo}>{precioDelCatalogo(producto)}</Text>
        </View>
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
        <SelectorDeOpciones
          compacto
          opciones={producto.opciones}
          variantes={producto.variantes}
          seleccion={seleccion}
          onElegir={elegir}
        />
        {elegida ? (
          <View style={styles.existencias}>
            <Text style={styles.precio}>{dinero(elegida.precio)}</Text>
            <Disponibilidad disponible={elegida.disponible} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.pie}>
        {!agotada ? (
          <Cantidad
            ancha
            valor={cantidad}
            onCambio={setCantidad}
            maximo={elegida.disponible}
            onTocarNumero={() => setEscribiendo(true)}
          />
        ) : null}
        <Button
          mode="contained"
          onPress={anadir}
          disabled={agotada}
          contentStyle={styles.botonContenido}
          style={styles.boton}
        >
          {agotada ? "Agotado" : "Añadir al carrito"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { height: 200, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: tema.texto2, textAlign: "center" },
  contenido: { paddingTop: 4, gap: 8, flexShrink: 1 },
  cabeza: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 8, paddingHorizontal: 16 },
  miniatura: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  precio: { color: tema.texto, fontSize: 20, fontWeight: "700" },
  combo: { color: tema.texto2, fontSize: 14, marginTop: 2 },
  lista: { flexGrow: 0, flexShrink: 1 },
  listaContenido: { paddingVertical: 4 },
  existencias: { paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "baseline", gap: 10 },
  // Como la ficha: la cantidad arriba y *Añadir al carrito* debajo.
  pie: { gap: 12, paddingTop: 8, paddingHorizontal: 16 },
  boton: { alignSelf: "stretch", borderRadius: 12 },
  botonContenido: { paddingVertical: 6 },
});
