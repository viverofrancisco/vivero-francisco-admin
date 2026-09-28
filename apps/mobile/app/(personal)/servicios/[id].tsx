import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ESTADO_PRODUCTO_LABEL } from "@vivero/shared";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { PressableScale } from "@/components/ui/PressableScale";
import { Fila, Seccion, estilosDeFicha } from "@/components/ui/SeccionDeFicha";
import { CuerpoDeVariante } from "@/components/productos/FichaDeVariante";
import { FotosDeProducto } from "@/components/productos/FotosDeProducto";
import { SelectorDeCategorias } from "@/components/productos/SelectorDeCategorias";
import { EditorDeOpciones } from "@/components/productos/EditorDeOpciones";
import { ListaDeVariantes } from "@/components/productos/ListaDeVariantes";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ServicioDetail } from "@/lib/types";
import { tema } from "@/lib/tema";

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/**
 * La ficha de un producto: la del portal, en el teléfono, con la forma de
 * la de Shopify.
 *
 * El encabezado es el de las demás fichas —la flecha al lado del nombre, fijo
 * mientras el cuerpo scrollea, el ⋯ con *Editar*— y debajo las secciones:
 * las fotos, la información general, la descripción, y lo que se vende.
 *
 * **Todas las filas están, con "—" cuando no hay dato**: una fila que falta
 * se lee como un dato que nadie cargó y nadie va a cargar. Un bien lleva
 * además **Opciones** —cada eje con sus valores como pastillas y *Editar*,
 * que abre el editor de Shopify— y, con opciones, un renglón *N variantes*
 * que abre la lista; sin opciones, la variante única se lee como el producto
 * y su precio y su inventario van acá mismo, igual que en el portal.
 */
export default function ServicioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "ADMIN" || role === "STAFF";
  const [data, setData] = useState<ServicioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  /** Lo que tiró la carga, tal cual: la pantalla dice si fue acceso, borrado o señal. */
  const [error, setError] = useState<unknown>(null);
  const [editandoOpciones, setEditandoOpciones] = useState(false);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [eligiendoCategorias, setEligiendoCategorias] = useState(false);

  const load = useCallback(
    async (silencioso = false) => {
      if (!id) return;
      if (!silencioso) setLoading(true);
      try {
        const res = await apiRequest<ServicioDetail>(`/api/mobile/servicios/${id}`);
        setData(res);
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Al volver de editar, la ficha tiene que mostrar lo nuevo. En silencio:
  // prender el spinner en cada foco haría parpadear la pantalla entera.
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  if (loading) {
    return (
      <View style={estilosDeFicha.flex}>
        <EncabezadoDeFicha titulo="Producto" />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <AvisoDeCarga
        error={error}
        tipo="producto"
        onVolver={() => router.back()}
        onReintentar={() => load()}
      />
    );
  }

  const esBien = data.tipo === "BIEN";
  const conOpciones = data.opciones.length > 0;
  /** La única, cuando la hay: es la que se lee como "del producto". */
  const unica = !conOpciones && data.variantes.length === 1 ? data.variantes[0] : null;
  const recargar = () => load(true);

  const menu = canEdit
    ? [{ etiqueta: "Editar", onPress: () => router.push(`/(personal)/servicios/editar/${id}`) }]
    : [];

  return (
    <View style={estilosDeFicha.flex}>
      <EncabezadoDeFicha
        titulo={data.nombre}
        derecha={menu.length > 0 ? <MenuDeEncabezado opciones={menu} /> : undefined}
      />
      <ScrollView style={estilosDeFicha.flex} contentContainerStyle={estilosDeFicha.container}>
        {/* Las fotos primero, como la sección *Media* de Shopify: se agregan,
            se ordenan y se quitan desde acá. */}
        <FotosDeProducto
          productoId={data.id}
          imagenes={data.imagenes}
          canEdit={canEdit}
          onRecargar={recargar}
        />

        {/* La descripción pegada a las fotos, como en Shopify: es lo que
            describe lo que se acaba de ver. */}
        <View style={estilosDeFicha.section}>
          <Text variant="labelMedium" style={estilosDeFicha.sectionLabel}>
            DESCRIPCIÓN
          </Text>
          <View style={styles.notasBox}>
            <Text variant="bodyMedium" style={data.descripcion ? styles.notasText : estilosDeFicha.muted}>
              {data.descripcion || "Sin descripción."}
            </Text>
          </View>
        </View>

        <Seccion titulo="Información general">
          <Fila label="Estado" value={<Pastilla estado={data.estado} />} />
          <Fila label="Tipo" value={TIPO_LABEL[data.tipo] ?? data.tipo} />
          <Fila label="IVA" value={data.ivaTasa === null ? "—" : `${data.ivaTasa}%`} />
          <Fila label="Creado" value={fechaDeAlta(data.createdAt)} />
        </Seccion>

        {/* Las opciones, como las muestra Shopify: cada eje con su nombre,
            cuántos valores tiene y los valores como pastillas. *Editar* abre
            el editor, donde se agregan, se renombran y se reordenan. */}
        {esBien ? (
          <View style={estilosDeFicha.section}>
            <View style={estilosDeFicha.sectionHeader}>
              <Text variant="labelMedium" style={estilosDeFicha.sectionLabel}>
                OPCIONES
              </Text>
              {canEdit ? (
                <PressableScale onPress={() => setEditandoOpciones(true)} hitSlop={8}>
                  <Text style={estilosDeFicha.sectionAction}>Editar</Text>
                </PressableScale>
              ) : null}
            </View>
            <View style={[estilosDeFicha.sectionContent, styles.opciones]}>
              {data.opciones.length === 0 ? (
                <Text style={estilosDeFicha.vacio}>
                  Sin opciones. Agrega color o tamaño para tener variantes.
                </Text>
              ) : (
                data.opciones.map((o) => (
                  <View key={o.id} style={styles.opcion}>
                    <Text style={styles.opcionNombre}>
                      {o.nombre} ({o.valores.length})
                    </Text>
                    <View style={styles.valores}>
                      {o.valores.map((v) => (
                        <View key={v.id} style={styles.valor}>
                          <Text style={styles.valorTexto}>{v.valor}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* Con opciones, un renglón a la lista: la miniatura, cuántas son y
            el chevron, como en Shopify. Cada una lleva su precio y su stock. */}
        {esBien && conOpciones ? (
          <Seccion titulo="Variantes">
            <PressableScale onPress={() => setListaAbierta(true)} estiloExterno={estilosDeFicha.ancho} style={styles.filaVariantes}>
              {data.imagenes[0] ? (
                <Image source={{ uri: data.imagenes[0].url }} style={styles.miniatura} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[styles.miniatura, styles.sinFoto]}>
                  <Ionicons name="image-outline" size={18} color={tema.texto3} />
                </View>
              )}
              <Text style={styles.variantesTexto}>
                {data.variantes.length} {data.variantes.length === 1 ? "variante" : "variantes"}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          </Seccion>
        ) : null}

        {/* Sin opciones, la variante única se lee como el producto: su precio
            y su inventario van acá, con las mismas secciones que la ficha de
            una variante. */}
        {esBien && unica ? (
          <CuerpoDeVariante variante={unica} canEdit={canEdit} onRecargar={recargar} />
        ) : null}

        {!esBien && unica ? (
          <Seccion titulo="SKU">
            <Fila label="SKU" value={unica.sku || "—"} />
          </Seccion>
        ) : null}

        {/* Cómo se agrupa, al final y como un renglón con su ícono: las
            *Collections* de Shopify. Los nombres debajo, con un punto entre
            medio, y tocarlo abre la lista con casillas. */}
        <Seccion titulo="Organización">
          <PressableScale
            onPress={canEdit ? () => setEligiendoCategorias(true) : undefined}
            disabled={!canEdit}
            estiloExterno={estilosDeFicha.ancho}
            style={styles.filaCategorias}
            accessibilityRole="button"
          >
            <Ionicons name="pricetags-outline" size={20} color={tema.texto2} />
            <View style={styles.filaCategoriasTexto}>
              <Text style={styles.filaCategoriasTitulo}>Categorías</Text>
              <Text style={styles.filaCategoriasDetalle} numberOfLines={1}>
                {data.categorias.map((c) => c.nombre).join(" • ") || "Sin categorías"}
              </Text>
            </View>
            {canEdit ? <Ionicons name="chevron-forward" size={16} color={tema.texto3} /> : null}
          </PressableScale>
        </Seccion>
      </ScrollView>

      {editandoOpciones ? (
        <EditorDeOpciones
          productoId={data.id}
          opciones={data.opciones}
          variantes={data.variantes.length}
          onCerrar={() => setEditandoOpciones(false)}
          onGuardado={() => {
            setEditandoOpciones(false);
            recargar();
          }}
        />
      ) : null}

      {eligiendoCategorias ? (
        <SelectorDeCategorias
          productoId={data.id}
          elegidas={data.categorias.map((c) => c.id)}
          onCerrar={() => setEligiendoCategorias(false)}
          onGuardado={() => {
            setEligiendoCategorias(false);
            recargar();
          }}
        />
      ) : null}

      {listaAbierta ? (
        <ListaDeVariantes
          producto={data}
          canEdit={canEdit}
          onCerrar={() => setListaAbierta(false)}
          onRecargar={recargar}
        />
      ) : null}
    </View>
  );
}

function Pastilla({ estado }: { estado: ServicioDetail["estado"] }) {
  const activo = estado === "ACTIVO";
  return (
    <View style={[styles.pastilla, activo ? styles.pastillaActiva : styles.pastillaBorrador]}>
      <Text style={[styles.pastillaTexto, activo ? styles.pastillaTextoActiva : styles.pastillaTextoBorrador]}>
        {ESTADO_PRODUCTO_LABEL[estado]}
      </Text>
    </View>
  );
}

/** "29 jun 2026", como el portal. Es un instante: se lee en la hora local. */
function fechaDeAlta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  notasBox: { backgroundColor: "#fafafa", borderRadius: 12, padding: 14 },
  notasText: { color: "#222", lineHeight: 22 },

  opciones: { paddingVertical: 8 },
  opcion: { paddingVertical: 8, gap: 8 },
  opcionNombre: { color: tema.texto2, fontWeight: "600", fontSize: 14 },
  valores: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  valor: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: tema.lienzo,
  },
  valorTexto: { color: tema.texto, fontSize: 15 },

  filaVariantes: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  filaCategorias: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  filaCategoriasTexto: { flex: 1, gap: 2 },
  filaCategoriasTitulo: { fontSize: 16, color: tema.texto },
  filaCategoriasDetalle: { fontSize: 14, color: tema.texto3 },
  miniatura: { width: 44, height: 44, borderRadius: 8, backgroundColor: tema.lienzo },
  sinFoto: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: tema.linea },
  variantesTexto: { flex: 1, fontSize: 16, color: tema.texto },

  pastilla: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pastillaActiva: { backgroundColor: tema.verde50 },
  pastillaBorrador: { backgroundColor: "#f1f1f1" },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
  pastillaTextoActiva: { color: tema.verde700 },
  pastillaTextoBorrador: { color: tema.texto2 },
});
