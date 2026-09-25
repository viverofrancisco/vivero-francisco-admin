import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Searchbar, Text } from "react-native-paper";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { tema } from "@/lib/tema";

/** Una tarea hecha en las visitas elegidas. Origen de cada sección. */
export interface TareaParaSeccion {
  tareaId: string;
  nombre: string;
  descripcion: string | null;
  visitasCount: number;
  fotosCount: number;
}

/** Una tarea del catálogo, para las secciones que no salen de una visita. */
export interface TareaCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * De qué es la sección nueva: una tarea de estas visitas, otra del catálogo,
 * o una vacía. Un cajón desde abajo, no un menú colgado del botón: son
 * diecisiete tareas más las de las visitas, y eso es una lista, no un menú
 * de dos renglones. El mismo cajón que el portal abre en el teléfono.
 *
 * Lo que ya tiene sección queda en gris: dos secciones de la misma tarea
 * salen iguales en el PDF y no hay forma de distinguirlas después.
 *
 * La personalizada va **primera**: es la que no depende de nada y la que se
 * elige cuando lo que hay que contar no es una tarea. Y hay buscador, porque
 * con las tareas de las visitas más el catálogo la lista pasa la pantalla.
 */
export function SelectorDeSeccion({
  visible,
  onCerrar,
  deVisitas,
  catalogo,
  usadas,
  onElegir,
}: {
  visible: boolean;
  onCerrar: () => void;
  deVisitas: TareaParaSeccion[];
  catalogo: TareaCatalogo[];
  /** Las tareas que ya tienen sección. */
  usadas: string[];
  /** `null` es la personalizada. */
  onElegir: (tarea: TareaParaSeccion | null) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const q = busqueda.trim().toLowerCase();
  const coincide = (nombre: string) => !q || nombre.toLowerCase().includes(q);
  const enVisitas = new Set(deVisitas.map((t) => t.tareaId));
  const deEstas = deVisitas.filter((t) => coincide(t.nombre));
  const otras = catalogo.filter((t) => !enVisitas.has(t.id) && coincide(t.nombre));
  const usada = (id: string) => usadas.includes(id);

  const elegir = (tarea: TareaParaSeccion | null) => {
    setBusqueda("");
    onCerrar();
    onElegir(tarea);
  };

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} maxAlto={0.9}>
      <Text style={styles.titulo}>Agregar sección</Text>
      <View style={styles.buscadorCaja}>
        <Searchbar
          placeholder="Buscar tarea"
          value={busqueda}
          onChangeText={setBusqueda}
          elevation={0}
          style={styles.buscador}
          inputStyle={styles.buscadorTexto}
        />
      </View>
      <ScrollView
        style={styles.lista}
        contentContainerStyle={styles.listaCuerpo}
        keyboardShouldPersistTaps="handled"
      >
        {!q ? (
          <Fila
            nombre="Sección personalizada (vacía)"
            detalle="Se escribe desde cero"
            deshabilitada={false}
            onPress={() => elegir(null)}
          />
        ) : null}
        {deEstas.length > 0 ? (
          <>
            <Rotulo>De estas visitas</Rotulo>
            {deEstas.map((t) => (
              <Fila
                key={t.tareaId}
                nombre={t.nombre}
                detalle={
                  usada(t.tareaId)
                    ? "Ya tiene sección"
                    : t.fotosCount > 0
                      ? `${t.fotosCount} foto${t.fotosCount === 1 ? "" : "s"}`
                      : "Sin fotos"
                }
                deshabilitada={usada(t.tareaId)}
                onPress={() => elegir(t)}
              />
            ))}
          </>
        ) : null}
        {otras.length > 0 ? (
          <>
            <Rotulo>Otras tareas</Rotulo>
            {otras.map((t) => (
              <Fila
                key={t.id}
                nombre={t.nombre}
                detalle={usada(t.id) ? "Ya tiene sección" : null}
                deshabilitada={usada(t.id)}
                onPress={() =>
                  elegir({
                    tareaId: t.id,
                    nombre: t.nombre,
                    descripcion: t.descripcion,
                    visitasCount: 0,
                    fotosCount: 0,
                  })
                }
              />
            ))}
          </>
        ) : null}
        {q && deEstas.length === 0 && otras.length === 0 ? (
          <Text style={styles.vacio}>Sin coincidencias.</Text>
        ) : null}
      </ScrollView>
    </HojaInferior>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text variant="labelMedium" style={styles.rotulo}>
      {children.toUpperCase()}
    </Text>
  );
}

function Fila({
  nombre,
  detalle,
  deshabilitada,
  onPress,
}: {
  nombre: string;
  detalle: string | null;
  deshabilitada: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitada}
      style={({ pressed }) => [
        styles.fila,
        deshabilitada && styles.filaApagada,
        pressed && styles.filaPresionada,
      ]}
    >
      <View style={styles.filaTexto}>
        <Text variant="bodyLarge" style={styles.nombre}>
          {nombre}
        </Text>
        {detalle ? (
          <Text variant="bodySmall" style={styles.detalle}>
            {detalle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  buscadorCaja: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  buscador: { backgroundColor: tema.lienzo, borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },
  vacio: { padding: 16, color: tema.texto3, textAlign: "center" },
  lista: { flexGrow: 0 },
  listaCuerpo: { paddingBottom: 24 },
  rotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  fila: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  filaApagada: { opacity: 0.5 },
  filaPresionada: { backgroundColor: tema.lienzo },
  filaTexto: { gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  detalle: { color: tema.texto3 },
});
