import { useState } from "react";
import { Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export interface OpcionFiltro {
  clave: string;
  etiqueta: string;
}

export interface GrupoDeFiltro {
  id: string;
  titulo: string;
  opciones: OpcionFiltro[];
  valor: string;
  onElegir: (v: string) => void;
}

/**
 * El encabezado de una lista, con la forma del portal en móvil.
 *
 * Tres cosas cambian respecto de lo que traía la app:
 *
 * - **No hay barra de navegación con el título centrado.** El portal pone el
 *   título grande, alineado a la izquierda, arriba de su contenido; la barra
 *   nativa gastaba una franja entera en repetir el nombre de la pestaña que ya
 *   está marcada abajo.
 * - **Los filtros viven detrás de un botón**, no desplegados. En pastillas
 *   ocupaban dos renglones permanentes —y con cuatro grupos serían cuatro— para
 *   algo que se toca de vez en cuando. El botón muestra cuántos hay puestos,
 *   que es lo único que hace falta saber sin abrirlo.
 * - **La búsqueda no scrollea.** Estaba adentro de la lista, así que bajar tres
 *   filas la hacía desaparecer y volver a buscar era subir hasta arriba.
 */
export function PantallaLista({
  titulo,
  accion,
  onCrear,
  etiquetaCrear = "Crear",
  busqueda,
  onBuscar,
  placeholder,
  grupos = [],
  onFiltrar,
  filtrosActivos = 0,
  children,
}: {
  titulo: string;
  /** Lo que va a la derecha del título: un botón, un menú. */
  accion?: React.ReactNode;
  /**
   * Crear, arriba y en verde.
   *
   * Era un botón flotante sobre la esquina inferior derecha, que es donde
   * Android pone el suyo; en esta app tapaba la última fila y quedaba encima
   * de la barra de pestañas. Arriba, al lado del título, comparte renglón con
   * algo que ya estaba y no tapa nada.
   */
  onCrear?: () => void;
  etiquetaCrear?: string;
  busqueda?: string;
  onBuscar?: (v: string) => void;
  placeholder?: string;
  grupos?: GrupoDeFiltro[];
  /**
   * Para las pantallas cuyos filtros no entran en pastillas —un rango de
   * fechas necesita un calendario— y viven en su propia pantalla. Con esto, el
   * botón la abre en vez de la hoja.
   */
  onFiltrar?: () => void;
  /** Cuántos filtros hay puestos cuando los maneja otra pantalla. */
  filtrosActivos?: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [abierto, setAbierto] = useState(false);

  const puestos = onFiltrar
    ? filtrosActivos
    : grupos.filter((g) => g.valor !== "").length;
  const hayFiltros = onFiltrar !== undefined || grupos.length > 0;

  return (
    <View style={styles.pantalla}>
      {/* Fijo: el título, la búsqueda y el botón de filtros se quedan mientras
          la lista corre debajo. */}
      <View style={[styles.cabecera, { paddingTop: insets.top + 8 }]}>
        <View style={styles.tituloFila}>
          <Text style={styles.titulo}>{titulo}</Text>
          <View style={styles.acciones}>
            {accion}
            {onCrear ? (
              /* Solo la palabra: el "+" al lado de "Crear" decía la misma cosa
                 dos veces, y el botón entero compite con un título de 26 —lo
                 que se crea acá se crea de a ratos, no todo el tiempo—. */
              <PressableScale
                onPress={onCrear}
                style={styles.crear}
                accessibilityLabel={etiquetaCrear}
              >
                <Text style={styles.crearTexto}>Crear</Text>
              </PressableScale>
            ) : null}
            {/* Sin buscador el botón de filtros no tiene con quién compartir
                renglón, así que sube al lado del título. */}
            {hayFiltros && !onBuscar ? (
              <PressableScale
                onPress={() => (onFiltrar ? onFiltrar() : setAbierto(true))}
                style={[
                  styles.botonFiltro,
                  puestos > 0 && styles.botonFiltroActivo,
                ]}
                accessibilityLabel="Filtros"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={puestos > 0 ? tema.verde700 : tema.texto2}
                />
                {puestos > 0 ? (
                  <View style={styles.contador}>
                    <Text style={styles.contadorTexto}>{puestos}</Text>
                  </View>
                ) : null}
              </PressableScale>
            ) : null}
          </View>
        </View>

        {onBuscar ? (
          <View style={styles.buscarFila}>
            <View style={styles.buscador}>
              <Ionicons name="search" size={18} color={tema.texto3} />
              <TextInput
                value={busqueda}
                onChangeText={onBuscar}
                placeholder={placeholder}
                placeholderTextColor={tema.texto3}
                style={styles.buscadorTexto}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            {hayFiltros ? (
              <PressableScale
                onPress={() => (onFiltrar ? onFiltrar() : setAbierto(true))}
                style={[styles.botonFiltro, puestos > 0 && styles.botonFiltroActivo]}
                accessibilityLabel="Filtros"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={puestos > 0 ? tema.verde700 : tema.texto2}
                />
                {puestos > 0 ? (
                  <View style={styles.contador}>
                    <Text style={styles.contadorTexto}>{puestos}</Text>
                  </View>
                ) : null}
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.cuerpo}>{children}</View>

      {/* A pantalla completa, como el del portal en móvil: los controles
          ocupan el renglón entero y abajo quedan Limpiar y Ver resultados, que
          es lo que se busca después de tocar tres cosas. */}
      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}
      >
        <View style={styles.panel}>
          <View style={styles.panelCabecera}>
            <Text style={styles.panelTitulo}>Filtros</Text>
            <PressableScale
              onPress={() => setAbierto(false)}
              style={styles.cerrar}
              accessibilityLabel="Cerrar filtros"
            >
              <Ionicons name="close" size={22} color={tema.texto2} />
            </PressableScale>
          </View>

          <ScrollView style={styles.panelCuerpo}>
            {grupos.map((g) => (
              <View key={g.id} style={styles.grupo}>
                <Text style={styles.grupoTitulo}>{g.titulo.toUpperCase()}</Text>
                <View style={styles.opciones}>
                  {g.opciones.map((o) => {
                    const elegida = g.valor === o.clave;
                    return (
                      <PressableScale
                        key={o.clave || "todos"}
                        onPress={() => g.onElegir(o.clave)}
                        style={[styles.opcion, elegida && styles.opcionElegida]}
                      >
                        <Text
                          style={[
                            styles.opcionTexto,
                            elegida && styles.opcionTextoElegida,
                          ]}
                        >
                          {o.etiqueta}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.panelPie, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <PressableScale
              onPress={() => grupos.forEach((g) => g.onElegir(""))}
              disabled={puestos === 0}
              estiloExterno={styles.mitad}
              style={[styles.limpiarBoton, puestos === 0 && styles.apagado]}
            >
              <Text style={styles.limpiarTexto}>Limpiar</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setAbierto(false)}
              estiloExterno={styles.mitad}
              style={styles.ver}
            >
              <Text style={styles.verTexto}>Ver resultados</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cabecera: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: tema.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  tituloFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 36,
  },
  titulo: { fontSize: 26, fontWeight: "800", color: tema.texto },
  acciones: { flexDirection: "row", alignItems: "center", gap: 8 },
  crear: {
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tema.verde,
  },
  crearTexto: { color: "#fff", fontSize: 13, fontWeight: "600" },

  buscarFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  buscador: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  buscadorTexto: { flex: 1, fontSize: 15, color: tema.texto, padding: 0 },
  botonFiltro: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  botonFiltroActivo: { borderColor: tema.verde100, backgroundColor: tema.verde50 },
  contador: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorTexto: { color: "#fff", fontSize: 11, fontWeight: "700" },

  cuerpo: { flex: 1 },

  panel: { flex: 1, backgroundColor: tema.superficie },
  panelCabecera: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  panelTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  panelCuerpo: { flex: 1, padding: 16 },
  grupo: { gap: 8, marginBottom: 22 },
  grupoTitulo: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: tema.texto3,
    fontWeight: "600",
  },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  opcionElegida: { backgroundColor: tema.verde50, borderColor: tema.verde100 },
  opcionTexto: { color: tema.texto2, fontSize: 14 },
  opcionTextoElegida: { color: tema.verde700, fontWeight: "600" },
  panelPie: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  mitad: { flex: 1 },
  limpiarBoton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  apagado: { opacity: 0.4 },
  limpiarTexto: { color: tema.texto2, fontWeight: "600", fontSize: 15 },
  ver: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tema.verde,
  },
  verTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },

});

/**
 * Una fila de la lista: de borde a borde, con una línea arriba.
 *
 * Sin tarjeta y sin separación entre filas, igual que el portal: una tarjeta en
 * una pantalla de 400 px gasta dos bordes y dos márgenes en recuadrar lo único
 * que hay, y un recuadro que contiene todo no separa nada de nada. La línea va
 * **arriba** para que el pie del scroll infinito no quede pareciendo una fila
 * vacía con su propia línea.
 */
export const FILA_LISTA = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  primera: { borderTopWidth: 0 },
}).fila;

/** El pie de una lista que carga de a páginas. */
export function PieDeLista({
  cargando,
  hayMas,
}: {
  cargando: boolean;
  hayMas: boolean;
}) {
  if (!hayMas && !cargando) return null;
  return (
    <View style={pie.caja}>
      <Text style={pie.texto}>
        {cargando ? "Cargando…" : "Desliza para ver más"}
      </Text>
    </View>
  );
}

const pie = StyleSheet.create({
  caja: { paddingVertical: 18, alignItems: "center" },
  texto: { color: tema.texto3, fontSize: 13 },
});
