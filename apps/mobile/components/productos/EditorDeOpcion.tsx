import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  NestedReorderableList,
  ScrollViewContainer,
  reorderItems,
  useReorderableDrag,
} from "react-native-reorderable-list";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BotonRedondoDeHoja, CabeceraDeHoja } from "@/components/ui/CabeceraDeHoja";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { CampoEnCaja } from "@/components/ui/Formulario";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/** Un eje en edición: con id cuando ya existía, y sus valores igual. */
export interface OpcionBorrador {
  id: string | null;
  nombre: string;
  valores: { id: string | null; valor: string }[];
}

interface FilaValor {
  /** Solo para React: un valor nuevo no tiene id. */
  clave: number;
  id: string | null;
  valor: string;
}

/**
 * Una opción del producto, la pantalla de Shopify: el nombre en su caja, una
 * franja gris, y los valores en una tarjeta como filas con su agarre para
 * reordenar y su tacho, con la última fila vacía diciendo *Agregar valor*.
 *
 * **No tiene *Listo*: la ✕ aplica**, como en Shopify. Lo que se editó vuelve
 * al editor de opciones al cerrar; si la opción quedó sin nombre o sin
 * valores se descarta lo escrito, y el aviso de qué falta está a la vista
 * antes de cerrar. El editor de opciones es el que manda el conjunto entero
 * al servidor con *Guardar*.
 *
 * **Los valores se cargan tipeando**: la última fila está vacía, escribir en
 * ella la convierte en un valor y abre otra debajo. La conversión es solo en
 * esa fila —borrar el texto de un valor del medio lo deja en blanco para
 * reescribirlo— y las vacías se descartan al cerrar. Es lo que hace el
 * editor del portal.
 *
 * **Los valores viajan con su id** cuando ya existían: sin eso, renombrar
 * "Rojo" a "Rojo intenso" sería borrar un valor y crear otro, y las variantes
 * rojas se irían con su stock por un cambio de texto.
 */
export function EditorDeOpcion({
  opcion,
  nombreInicial = "",
  nombresUsados,
  onListo,
  onEliminar,
  onCerrar,
}: {
  /** `null` es una opción nueva. */
  opcion: OpcionBorrador | null;
  /** Para una nueva: el nombre sugerido, si vino de la lista. */
  nombreInicial?: string;
  /** Los nombres de las otras opciones, para no repetir. */
  nombresUsados: string[];
  onListo: (opcion: OpcionBorrador) => void;
  /** Solo para una opción que ya está en la lista. */
  onEliminar?: () => void;
  /** Cerrar sin aplicar: lo que había quedó sin nombre o sin valores. */
  onCerrar: () => void;
}) {
  const siguienteClave = useRef(1);
  const [nombre, setNombre] = useState(opcion?.nombre ?? nombreInicial);
  const [valores, setValores] = useState<FilaValor[]>(() => [
    ...(opcion?.valores ?? []).map((v) => ({
      clave: siguienteClave.current++,
      id: v.id,
      valor: v.valor,
    })),
    { clave: siguienteClave.current++, id: null, valor: "" },
  ]);
  const [menu, setMenu] = useState(false);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);

  const llenos = useMemo(
    () => valores.filter((v) => v.valor.trim() !== ""),
    [valores]
  );

  /** Qué falta para que la opción valga, si falta algo. */
  const falta = useMemo(() => {
    if (!nombre.trim()) return "La opción necesita un nombre.";
    if (
      nombresUsados.some((n) => n.toLowerCase() === nombre.trim().toLowerCase())
    ) {
      return `Ya hay una opción llamada "${nombre.trim()}".`;
    }
    if (llenos.length === 0) return "Agrega al menos un valor.";
    const vistos = new Set<string>();
    for (const v of llenos) {
      const clave = v.valor.trim().toLowerCase();
      if (vistos.has(clave)) return `"${v.valor.trim()}" está repetido.`;
      vistos.add(clave);
    }
    return null;
  }, [nombre, nombresUsados, llenos]);

  function escribir(clave: number, texto: string) {
    setValores((actual) => {
      const siguiente = actual.map((v) =>
        v.clave === clave ? { ...v, valor: texto } : v
      );
      // La última fila es la de agregar: en cuanto tiene algo, nace otra.
      const ultima = siguiente[siguiente.length - 1];
      if (ultima.valor.trim() !== "") {
        siguiente.push({ clave: siguienteClave.current++, id: null, valor: "" });
      }
      return siguiente;
    });
  }

  function borrar(clave: number) {
    setValores((actual) => actual.filter((v) => v.clave !== clave));
  }

  /** La ✕: aplica si la opción vale, y si no, cierra sin aplicar. */
  function cerrar() {
    if (falta) {
      onCerrar();
      return;
    }
    onListo({
      id: opcion?.id ?? null,
      nombre: nombre.trim(),
      valores: llenos.map((v) => ({ id: v.id, valor: v.valor.trim() })),
    });
  }

  const titulo = nombre.trim() || (opcion ? opcion.nombre : "Nueva opción");

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cerrar}
    >
      {/* Adentro de un `Modal` los gestos necesitan su propia raíz, o la fila
          no se despega del dedo. */}
      <GestureHandlerRootView style={styles.pantalla}>
        <CabeceraDeHoja
          titulo={titulo}
          subtitulo={`${llenos.length} ${llenos.length === 1 ? "valor" : "valores"}`}
          onCerrar={cerrar}
          derecha={
            onEliminar ? (
              <BotonRedondoDeHoja
                icono="ellipsis-horizontal"
                etiqueta="Más acciones"
                onPress={() => setMenu(true)}
              />
            ) : undefined
          }
        />
        <KeyboardAvoidingView
          style={styles.pantalla}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* El contenedor de la librería: adentro va una lista arrastrable
              que no scrollea por su cuenta, y el scroll es de esta pantalla. */}
          <ScrollViewContainer
            style={styles.pantalla}
            contentContainerStyle={styles.cuerpo}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.bloque}>
              <CampoEnCaja
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Color, Tamaño"
                autoFocus={!opcion && !nombreInicial}
                autoCapitalize="sentences"
                limpiable={false}
              />
            </View>

            <View style={styles.banda} />

            <View style={styles.bloque}>
              <Text style={styles.rotulo}>
                Valores ({llenos.length})
              </Text>
              <View style={styles.tarjeta}>
                <NestedReorderableList<FilaValor>
                  data={valores}
                  keyExtractor={(v) => String(v.clave)}
                  scrollEnabled={false}
                  keyboardShouldPersistTaps="handled"
                  onReorder={({ from, to }) =>
                    setValores((actual) => reorderItems(actual, from, to))
                  }
                  ItemSeparatorComponent={Divisor}
                  renderItem={({ item, index }) => (
                    <FilaDeValor
                      fila={item}
                      ultima={index === valores.length - 1}
                      onEscribir={(t) => escribir(item.clave, t)}
                      onBorrar={() => borrar(item.clave)}
                    />
                  )}
                />
              </View>
              {falta && (nombre.trim() || llenos.length > 0) ? (
                <HelperText type="error" visible style={styles.error}>
                  {falta}
                </HelperText>
              ) : null}
            </View>
          </ScrollViewContainer>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>

      {/* El ⋯: lo que se hace una vez por opción, en una hoja desde abajo
          como la de Shopify. */}
      <HojaInferior visible={menu} onCerrar={() => setMenu(false)}>
        <View style={styles.menu}>
          <Text style={styles.menuTitulo}>Acciones</Text>
          <PressableScale
            onPress={() => {
              setMenu(false);
              // Una hoja que se abre mientras otra baja se pierde: un respiro.
              setTimeout(() => setConfirmandoBorrar(true), 250);
            }}
            estiloExterno={styles.ancho}
            style={styles.menuFila}
          >
            <Ionicons name="trash-outline" size={20} color={tema.rojo} />
            <Text style={styles.menuFilaTexto}>Eliminar opción</Text>
          </PressableScale>
        </View>
      </HojaInferior>

      <DialogoConfirmar
        visible={confirmandoBorrar}
        titulo="¿Eliminar esta opción?"
        detalle="Las variantes que dependen de ella se borran al guardar. Si alguna tiene stock, se te va a preguntar antes."
        confirmar="Eliminar"
        peligro
        onConfirmar={() => {
          setConfirmandoBorrar(false);
          onEliminar?.();
        }}
        onCancelar={() => setConfirmandoBorrar(false)}
      />
    </Modal>
  );
}

function Divisor() {
  return <View style={styles.divisor} />;
}

/**
 * Una fila de valor: el agarre de seis puntos, el texto (que se edita ahí
 * mismo) y el tacho. La última —la vacía— no tiene agarre ni tacho: es la
 * que agrega, y arranca donde arranca el texto de las otras.
 */
function FilaDeValor({
  fila,
  ultima,
  onEscribir,
  onBorrar,
}: {
  fila: FilaValor;
  ultima: boolean;
  onEscribir: (texto: string) => void;
  onBorrar: () => void;
}) {
  const arrastrar = useReorderableDrag();
  return (
    <View style={styles.fila}>
      {ultima ? null : (
        <Pressable
          onPressIn={arrastrar}
          style={styles.agarre}
          accessibilityLabel="Arrastrar para reordenar"
        >
          <MaterialCommunityIcons name="drag-vertical" size={20} color={tema.texto3} />
        </Pressable>
      )}
      <TextInput
        value={fila.valor}
        onChangeText={onEscribir}
        placeholder={ultima ? "Agregar valor" : ""}
        placeholderTextColor={tema.texto3}
        style={[styles.valor, ultima && styles.valorAgregar]}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      {ultima ? null : (
        <Pressable
          onPress={onBorrar}
          hitSlop={8}
          style={({ pressed }) => [styles.tacho, pressed && styles.tocado]}
          accessibilityLabel={`Quitar ${fila.valor}`}
        >
          <Ionicons name="trash-outline" size={18} color={tema.texto2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  ancho: { alignSelf: "stretch" },
  cuerpo: { paddingBottom: 32 },
  bloque: { paddingHorizontal: 16, paddingVertical: 12 },
  banda: { height: 8, backgroundColor: tema.lienzo },

  rotulo: { fontSize: 15, fontWeight: "500", color: tema.texto2, marginBottom: 10 },
  tarjeta: {
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: tema.superficie,
  },
  divisor: { height: StyleSheet.hairlineWidth, backgroundColor: tema.linea },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingRight: 6,
  },
  agarre: { width: 44, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  valor: { flex: 1, fontSize: 17, color: tema.texto, paddingVertical: 12 },
  valorAgregar: { paddingLeft: 14 },
  tacho: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  tocado: { opacity: 0.6 },
  error: { marginTop: 6 },

  menu: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  menuTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto, marginBottom: 6 },
  menuFila: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  menuFilaTexto: { fontSize: 17, color: tema.rojo },
});
