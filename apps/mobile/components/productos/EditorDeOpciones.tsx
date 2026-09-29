import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CabeceraDeHoja, PastillaDeHoja } from "@/components/ui/CabeceraDeHoja";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { PressableScale } from "@/components/ui/PressableScale";
import { EditorDeOpcion, type OpcionBorrador } from "./EditorDeOpcion";
import { apiRequest, ApiError, mensajeDeError } from "@/lib/api";
import type { OpcionDeProducto } from "@/lib/types";
import { tema } from "@/lib/tema";
import { useAltoDelTeclado } from "@/lib/use-teclado";

/** Cuántos ejes admite un producto, como en el servidor. */
const MAX_OPCIONES = 3;

/** Lo que Shopify sugiere al agregar una opción, sin metacampos: lo usual. */
const SUGERENCIAS = ["Color", "Tamaño", "Material", "Presentación", "Medida"];

/**
 * Las opciones del producto, la pantalla de Shopify: cada eje como un renglón
 * —el nombre y, debajo, "(2) Rojo, Azul"— que abre su editor, y al final
 * *Agregar opción*. Se guarda con la pastilla de arriba.
 *
 * **Guardar es un reemplazo, no un parche**: el servidor recibe el conjunto
 * entero y regenera las variantes, conservando las que siguen teniendo
 * sentido. Si el cambio borra variantes con stock, responde 409 diciendo
 * cuáles y con cuánto; acá se pregunta y se vuelve a mandar con
 * `descartarVariantes`. Es el mismo trato que en el portal.
 */
export function EditorDeOpciones({
  productoId,
  opciones,
  variantes,
  onCerrar,
  onGuardado,
}: {
  productoId: string;
  opciones: OpcionDeProducto[];
  /** Cuántas variantes hay hoy: va debajo del título. */
  variantes: number;
  onCerrar: () => void;
  /** Se guardó: la ficha vuelve a cargar y cierra esto. */
  onGuardado: () => void;
}) {
  const inicial = useMemo<OpcionBorrador[]>(
    () =>
      opciones.map((o) => ({
        id: o.id,
        nombre: o.nombre,
        valores: o.valores.map((v) => ({ id: v.id, valor: v.valor })),
      })),
    [opciones]
  );
  const [borrador, setBorrador] = useState<OpcionBorrador[]>(inicial);
  /** Qué se está editando: un índice de la lista, o una nueva con su nombre. */
  const [editando, setEditando] = useState<
    { indice: number } | { indice: null; nombre: string } | null
  >(null);
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El aviso del 409: qué variantes se borran, esperando el sí. */
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(inicial);

  async function guardar(descartarVariantes = false) {
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(`/api/mobile/servicios/${productoId}/opciones`, {
        method: "PUT",
        body: { opciones: borrador, descartarVariantes },
      });
      onGuardado();
    } catch (e) {
      // 409 = el cambio borra variantes con inventario. El servidor dice
      // cuáles y con cuánto; acá solo hace falta el sí.
      if (e instanceof ApiError && e.status === 409 && !descartarVariantes) {
        setConfirmar(e.message);
      } else {
        setError(mensajeDeError(e, "No pudimos guardar las opciones"));
      }
    } finally {
      setGuardando(false);
    }
  }

  /**
   * Una hoja abierta desde otra que se está cerrando la pierde iOS sin decir
   * nada: se espera a que la primera termine de bajar.
   */
  function despuesDeCerrar(abrir: () => void) {
    setAgregando(false);
    setTimeout(abrir, 200);
  }

  const enEdicion =
    editando === null
      ? null
      : editando.indice === null
        ? { opcion: null, nombreInicial: editando.nombre, indice: null }
        : { opcion: borrador[editando.indice], nombreInicial: "", indice: editando.indice };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      <View style={styles.pantalla}>
        <CabeceraDeHoja
          titulo="Opciones"
          subtitulo={`${variantes} ${variantes === 1 ? "variante" : "variantes"}`}
          onCerrar={onCerrar}
          cerrando={hayCambios ? "cancelar" : "cerrar"}
          derecha={
            <PastillaDeHoja
              texto="Guardar"
              primaria
              onPress={() => guardar()}
              disabled={!hayCambios}
              cargando={guardando}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.cuerpo}>
          {borrador.length === 0 ? (
            <Text style={styles.vacio}>
              Sin opciones. Agrega una, como Color o Tamaño, para tener
              variantes.
            </Text>
          ) : null}
          {borrador.map((o, i) => (
            <PressableScale
              key={o.id ?? `nueva-${i}`}
              onPress={() => setEditando({ indice: i })}
              estiloExterno={styles.ancho}
              style={styles.fila}
            >
              <View style={styles.filaTexto}>
                <Text style={styles.filaNombre}>{o.nombre}</Text>
                <Text style={styles.filaValores} numberOfLines={1}>
                  ({o.valores.length}) {o.valores.map((v) => v.valor).join(", ")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          ))}
          {borrador.length < MAX_OPCIONES ? (
            <PressableScale
              onPress={() => setAgregando(true)}
              estiloExterno={styles.ancho}
              style={styles.fila}
            >
              <Ionicons name="add-circle-outline" size={22} color={tema.texto} />
              <Text style={[styles.filaNombre, styles.agregar]}>Agregar opción</Text>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          ) : null}
          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>
      </View>

      {agregando ? (
        <AgregarOpcion
          usadas={borrador.map((o) => o.nombre)}
          onElegir={(nombre) =>
            despuesDeCerrar(() => setEditando({ indice: null, nombre }))
          }
          onCerrar={() => setAgregando(false)}
        />
      ) : null}

      {enEdicion ? (
        <EditorDeOpcion
          opcion={enEdicion.opcion}
          nombreInicial={enEdicion.nombreInicial}
          nombresUsados={borrador
            .filter((_, i) => i !== enEdicion.indice)
            .map((o) => o.nombre)}
          onListo={(opcion) => {
            setBorrador((actual) =>
              enEdicion.indice === null
                ? [...actual, opcion]
                : actual.map((o, i) => (i === enEdicion.indice ? opcion : o))
            );
            setEditando(null);
          }}
          onEliminar={
            enEdicion.indice === null
              ? undefined
              : () => {
                  setBorrador((actual) =>
                    actual.filter((_, i) => i !== enEdicion.indice)
                  );
                  setEditando(null);
                }
          }
          onCerrar={() => setEditando(null)}
        />
      ) : null}

      <DialogoConfirmar
        visible={confirmar !== null}
        titulo="Este cambio borra variantes con stock"
        detalle={confirmar ?? undefined}
        confirmar="Guardar igual"
        peligro
        cargando={guardando}
        onConfirmar={() => {
          setConfirmar(null);
          guardar(true);
        }}
        onCancelar={() => setConfirmar(null)}
      />
    </Modal>
  );
}

/**
 * Agregar una opción, como en Shopify: un buscador, las sugerencias de
 * siempre y, al pie, *Crear opción personalizada* con lo que se escribió.
 */
function AgregarOpcion({
  usadas,
  onElegir,
  onCerrar,
}: {
  usadas: string[];
  onElegir: (nombre: string) => void;
  onCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [busqueda, setBusqueda] = useState("");
  const enUso = new Set(usadas.map((u) => u.toLowerCase()));
  const sugeridas = SUGERENCIAS.filter(
    (s) =>
      !enUso.has(s.toLowerCase()) &&
      s.toLowerCase().includes(busqueda.trim().toLowerCase())
  );
  const personalizada = busqueda.trim();
  const personalizadaEnUso = enUso.has(personalizada.toLowerCase());

  const teclado = useAltoDelTeclado();
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      <View style={[styles.pantalla, { paddingBottom: teclado }]}>
        <CabeceraDeHoja titulo="Agregar opción" onCerrar={onCerrar} />
        <View style={styles.buscador}>
          <Ionicons name="search" size={18} color={tema.texto3} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar"
            placeholderTextColor={tema.texto3}
            style={styles.buscadorTexto}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (personalizada && !personalizadaEnUso) onElegir(personalizada);
            }}
          />
        </View>
        {sugeridas.length > 0 ? (
          <Text style={styles.rotulo}>SUGERENCIAS</Text>
        ) : null}
        <FlatList
          data={sugeridas}
          keyExtractor={(s) => s}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => onElegir(item)}
              estiloExterno={styles.ancho}
              style={styles.sugerida}
            >
              <Text style={styles.filaNombre}>{item}</Text>
            </PressableScale>
          )}
        />
        <Pressable
          onPress={() => onElegir(personalizada)}
          disabled={personalizadaEnUso}
          // Despegado del borde de abajo: el indicador de inicio del teléfono
          // se lo comía, y con el inset queda a la altura de los otros pies.
          style={({ pressed }) => [
            styles.pie,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            pressed && styles.tocado,
            personalizadaEnUso && styles.apagado,
          ]}
        >
          <Ionicons name="add-circle-outline" size={22} color={tema.texto} />
          <Text style={[styles.filaNombre, styles.agregar]} numberOfLines={1}>
            {personalizada
              ? `Crear la opción "${personalizada}"`
              : "Crear opción personalizada"}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  ancho: { alignSelf: "stretch" },
  cuerpo: { paddingBottom: 32 },
  vacio: { color: tema.texto3, paddingHorizontal: 16, paddingVertical: 14, lineHeight: 20 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  filaTexto: { flex: 1, gap: 2 },
  filaNombre: { fontSize: 17, color: tema.texto },
  filaValores: { fontSize: 14, color: tema.texto3 },
  agregar: { flex: 1 },

  buscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
  },
  buscadorTexto: { flex: 1, fontSize: 17, color: tema.texto },
  rotulo: {
    color: tema.texto3,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sugerida: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  tocado: { opacity: 0.6 },
  apagado: { opacity: 0.4 },
});
