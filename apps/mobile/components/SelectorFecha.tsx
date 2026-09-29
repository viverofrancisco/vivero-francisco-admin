import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Elegir un día, en una hoja que sube desde abajo.
 *
 * El calendario nativo de iOS se dibujaba pegado al pie de la pantalla, en
 * inglés y en el azul del sistema: quedaba como de otra app. Este usa las
 * mismas convenciones que el portal —semana de lunes a domingo, `Lu Ma Mi…`, el
 * verde de la casa— así que la misma persona ve lo mismo en los dos lados.
 *
 * La hoja se arrastra para cerrar (`HojaInferior`). Antes era un `Modal
 * animationType="slide"` con un agarre dibujado arriba, y el agarre mentía: esa
 * animación es un tween fijo que no se puede tomar con el dedo.
 *
 * El mes se mueve con flechas y, tocando el nombre, se abre la lista de meses y
 * años: saltar a marzo del año que viene son dos toques y no catorce flechazos.
 * *Hoy* está siempre a mano, que es adonde se vuelve casi siempre.
 */

/** Cuántos años entran en una página de la grilla, como en el portal. */
const ANIOS_POR_PAGINA = 12;

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

/** El primer año de la página de doce en la que cae ese año. */
function paginaDe(anio: number) {
  return anio - (anio % ANIOS_POR_PAGINA);
}
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const VERDE = tema.verde;

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Los días que se dibujan, con los huecos del principio.
 *
 * `getDay()` cuenta desde el domingo y la semana empieza el lunes, así que el
 * domingo pasa a ser el séptimo: `(dia + 6) % 7`.
 */
function celdasDelMes(anio: number, mes: number): (Date | null)[] {
  const primero = new Date(anio, mes, 1);
  const huecos = (primero.getDay() + 6) % 7;
  const cuantos = new Date(anio, mes + 1, 0).getDate();
  return [
    ...Array<null>(huecos).fill(null),
    ...Array.from({ length: cuantos }, (_, i) => new Date(anio, mes, i + 1)),
  ];
}

export function SelectorFecha({
  visible,
  valor,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  valor: Date;
  onElegir: (d: Date) => void;
  onCerrar: () => void;
}) {
  const [mes, setMes] = useState(valor.getMonth());
  const [anio, setAnio] = useState(valor.getFullYear());
  /** Con el panel abierto se eligen mes y año en vez de un día. */
  const [eligiendoMes, setEligiendoMes] = useState(false);
  /**
   * El panel es el del portal (`MonthYearPicker`), en dos vistas: la grilla
   * de meses del año que se está mirando, y la de años de a doce. Las
   * flechas mueven el año o la página, y el año del medio cambia de vista.
   * Tocar un mes cierra el panel. Estaban los meses y los años juntos en una
   * sola pantalla, y el año perdido al pie.
   */
  const [vista, setVista] = useState<"meses" | "anios">("meses");
  const [anioVisible, setAnioVisible] = useState(valor.getFullYear());
  const [decada, setDecada] = useState(() => paginaDe(valor.getFullYear()));

  const hoy = new Date();
  const celdas = celdasDelMes(anio, mes);

  function correrMes(delta: number) {
    const d = new Date(anio, mes + delta, 1);
    setMes(d.getMonth());
    setAnio(d.getFullYear());
  }

  /** Al abrirla, se posiciona donde está el valor actual. */
  function alMostrar() {
    setMes(valor.getMonth());
    setAnio(valor.getFullYear());
    setEligiendoMes(false);
  }

  /** Abrir el panel parte del mes que se está viendo, no del último toqueteo. */
  function abrirPanel() {
    setVista("meses");
    setAnioVisible(anio);
    setDecada(paginaDe(anio));
    setEligiendoMes(true);
  }

  // La hoja se monta con el valor actual a la vista.
  const visibleAntes = useRef(visible);
  if (visible && !visibleAntes.current) alMostrar();
  visibleAntes.current = visible;

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
          <View style={styles.encabezado}>
            <PressableScale
              onPress={() => (eligiendoMes ? setEligiendoMes(false) : abrirPanel())}
              style={styles.mesBoton}
              hitSlop={6}
            >
              <Text variant="titleMedium" style={styles.mesTexto}>
                {MESES[mes]} {anio}
              </Text>
              <Ionicons
                name={eligiendoMes ? "chevron-up" : "chevron-down"}
                size={16}
                color={VERDE}
              />
            </PressableScale>

            {!eligiendoMes ? (
              <View style={styles.flechas}>
                <PressableScale onPress={() => correrMes(-1)} hitSlop={10} style={styles.flecha}>
                  <Ionicons name="chevron-back" size={20} color={VERDE} />
                </PressableScale>
                <PressableScale onPress={() => correrMes(1)} hitSlop={10} style={styles.flecha}>
                  <Ionicons name="chevron-forward" size={20} color={VERDE} />
                </PressableScale>
              </View>
            ) : null}
          </View>

          {eligiendoMes ? (
            <View style={styles.panel}>
              {/* ‹ año › con el año en el medio, que cambia a la grilla de
                  años; en esa vista las flechas mueven de a doce. */}
              <View style={styles.panelCabecera}>
                <PressableScale
                  onPress={() =>
                    vista === "meses"
                      ? setAnioVisible(anioVisible - 1)
                      : setDecada(decada - ANIOS_POR_PAGINA)
                  }
                  hitSlop={10}
                  style={styles.flecha}
                  accessibilityLabel={vista === "meses" ? "Año anterior" : "Años anteriores"}
                >
                  <Ionicons name="chevron-back" size={20} color={VERDE} />
                </PressableScale>
                <PressableScale
                  onPress={() => setVista(vista === "meses" ? "anios" : "meses")}
                  hitSlop={6}
                  style={styles.panelAnio}
                >
                  <Text style={styles.panelAnioTexto}>
                    {vista === "meses"
                      ? anioVisible
                      : `${decada} – ${decada + ANIOS_POR_PAGINA - 1}`}
                  </Text>
                  <Ionicons
                    name={vista === "meses" ? "chevron-down" : "chevron-up"}
                    size={16}
                    color={VERDE}
                  />
                </PressableScale>
                <PressableScale
                  onPress={() =>
                    vista === "meses"
                      ? setAnioVisible(anioVisible + 1)
                      : setDecada(decada + ANIOS_POR_PAGINA)
                  }
                  hitSlop={10}
                  style={styles.flecha}
                  accessibilityLabel={vista === "meses" ? "Año siguiente" : "Años siguientes"}
                >
                  <Ionicons name="chevron-forward" size={20} color={VERDE} />
                </PressableScale>
              </View>

              <View style={styles.rejilla}>
                {vista === "meses"
                  ? MESES.map((m, i) => {
                      const elegido = anioVisible === anio && i === mes;
                      const esteMes = anioVisible === hoy.getFullYear() && i === hoy.getMonth();
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setMes(i);
                            setAnio(anioVisible);
                            setEligiendoMes(false);
                          }}
                          style={[styles.ficha, styles.fichaTercio, elegido && styles.fichaActiva]}
                        >
                          <Text
                            style={[
                              styles.fichaTexto,
                              elegido && styles.fichaTextoActivo,
                              !elegido && esteMes && styles.fichaTextoHoy,
                            ]}
                          >
                            {m.slice(0, 3)}
                          </Text>
                        </Pressable>
                      );
                    })
                  : Array.from({ length: ANIOS_POR_PAGINA }, (_, i) => decada + i).map((a) => (
                      <Pressable
                        key={a}
                        onPress={() => {
                          setAnioVisible(a);
                          setVista("meses");
                        }}
                        style={[styles.ficha, styles.fichaTercio, a === anio && styles.fichaActiva]}
                      >
                        <Text
                          style={[
                            styles.fichaTexto,
                            a === anio && styles.fichaTextoActivo,
                            a !== anio && a === hoy.getFullYear() && styles.fichaTextoHoy,
                          ]}
                        >
                          {a}
                        </Text>
                      </Pressable>
                    ))}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.semana}>
                {DIAS.map((d) => (
                  <Text key={d} style={styles.diaSemana}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.dias}>
                {celdas.map((d, i) => {
                  if (!d) return <View key={`hueco-${i}`} style={styles.celda} />;
                  const elegido = mismoDia(d, valor);
                  const esHoy = mismoDia(d, hoy);
                  return (
                    <PressableScale
                      key={d.toISOString()}
                      onPress={() => onElegir(d)}
                      estiloExterno={styles.celda}
                    >
                      <View
                        style={[
                          styles.diaBurbuja,
                          esHoy && !elegido && styles.diaHoy,
                          elegido && styles.diaElegido,
                        ]}
                      >
                        <Text
                          style={[
                            styles.diaTexto,
                            esHoy && !elegido && styles.diaTextoHoy,
                            elegido && styles.diaTextoElegido,
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>

              {/* Siempre a mano: es adonde se vuelve casi siempre. */}
              <PressableScale
                onPress={() =>
                  onElegir(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
                }
                style={styles.hoyBoton}
                estiloPresionado={styles.hoyTocado}
              >
                <Ionicons name="today-outline" size={18} color={VERDE} />
                <Text style={styles.hoyTexto}>Hoy</Text>
              </PressableScale>
            </>
          )}
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  panelCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  panelAnio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  panelAnioTexto: { fontSize: 16, fontWeight: "700", color: "#222" },
  fichaTercio: { flexBasis: "30%", flexGrow: 1, alignItems: "center" },
  fichaTextoHoy: { color: VERDE, fontWeight: "800" },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mesBoton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  mesTexto: { color: "#111", fontWeight: "700" },
  flechas: { flexDirection: "row", gap: 4 },
  flecha: { padding: 8 },

  semana: { flexDirection: "row", marginTop: 4 },
  diaSemana: {
    flex: 1,
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
  },
  dias: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  celda: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  diaBurbuja: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  diaHoy: { borderWidth: 1.5, borderColor: VERDE },
  diaElegido: { backgroundColor: VERDE },
  diaTexto: { color: "#111", fontSize: 15 },
  diaTextoHoy: { color: VERDE, fontWeight: "700" },
  diaTextoElegido: { color: "#fff", fontWeight: "700" },

  hoyBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c3dfc5",
    backgroundColor: "#f4faf4",
  },
  hoyTocado: { backgroundColor: "#e3f1e4" },
  hoyTexto: { color: VERDE, fontWeight: "700" },

  panel: { maxHeight: 340 },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ficha: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#f4f4f4",
  },
  fichaActiva: { backgroundColor: VERDE },
  fichaTexto: { color: "#333", fontWeight: "600", fontSize: 14 },
  fichaTextoActivo: { color: "#fff" },
});
