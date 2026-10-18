import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Text } from "react-native-paper";
import {
  DIAS_DE_LA_SEMANA,
  MINUTOS_DEL_HORARIO,
  horaLegible,
  type HorarioDeDia,
  type HorarioSemanal,
} from "@vivero/shared";
import { HojaInferior } from "@vivero/app-ui/components/ui/HojaInferior";
import { tema } from "@vivero/app-ui/lib/tema";

const legible = horaLegible;

/**
 * El horario de la semana, el mismo del portal: un día por renglón con su
 * interruptor de abierto y, abierto, dos pastillas —abre y cierra— que abren
 * la lista de horas cada media hora. Cómo lo lee el cliente va bajo el
 * título, en el formulario.
 */
export function EditorDeHorario({
  valor,
  onCambio,
}: {
  valor: HorarioSemanal;
  onCambio: (h: HorarioSemanal) => void;
}) {
  /** Qué hora se está eligiendo: el día y si es la de abrir o la de cerrar. */
  const [eligiendo, setEligiendo] = useState<{ dia: number; campo: "desde" | "hasta" } | null>(null);

  const cambiarDia = (i: number, cambio: Partial<HorarioDeDia>) =>
    onCambio(valor.map((d, j) => (j === i ? { ...d, ...cambio } : d)));

  return (
    <View style={styles.caja}>
      {DIAS_DE_LA_SEMANA.map((dia, i) => {
        const d = valor[i];
        const malo = d.abierto && d.desde >= d.hasta;
        return (
          <View key={dia} style={[styles.fila, i > 0 && styles.divisor]}>
            <View style={styles.filaArriba}>
              <Text style={styles.dia}>{dia}</Text>
              {d.abierto ? (
                <View style={styles.horas}>
                  <Pastilla texto={legible(d.desde)} onPress={() => setEligiendo({ dia: i, campo: "desde" })} />
                  <Text style={styles.a}>a</Text>
                  <Pastilla
                    texto={legible(d.hasta)}
                    malo={malo}
                    onPress={() => setEligiendo({ dia: i, campo: "hasta" })}
                  />
                </View>
              ) : (
                <Text style={styles.cerrado}>Cerrado</Text>
              )}
              <Switch
                value={d.abierto}
                onValueChange={(v) => cambiarDia(i, { abierto: v })}
                trackColor={{ true: tema.verde, false: tema.linea }}
                accessibilityLabel={`${dia} abierto`}
              />
            </View>
            {malo ? <Text style={styles.error}>Cierra antes de abrir.</Text> : null}
          </View>
        );
      })}

      <HojaInferior visible={eligiendo !== null} onCerrar={() => setEligiendo(null)}>
        {eligiendo ? (
          <ElegirHora
            titulo={`${DIAS_DE_LA_SEMANA[eligiendo.dia]} · ${eligiendo.campo === "desde" ? "Abre" : "Cierra"}`}
            valor={valor[eligiendo.dia][eligiendo.campo]}
            onListo={(h) => {
              cambiarDia(eligiendo.dia, { [eligiendo.campo]: h });
              setEligiendo(null);
            }}
          />
        ) : null}
      </HojaInferior>
    </View>
  );
}

/**
 * Elegir una hora cualquiera sin teclado: la hora (0 a 23) y los minutos de 5
 * en 5, cada uno en su grilla, con lo elegido en grande arriba y *Listo*. Una
 * lista con las 288 horas del día no se recorre con el pulgar.
 */
function ElegirHora({
  titulo,
  valor,
  onListo,
}: {
  titulo: string;
  valor: string;
  onListo: (hora: string) => void;
}) {
  const [hh, setHh] = useState(valor.slice(0, 2));
  // Un minuto que no cae en el 5 (de un horario viejo) se redondea abajo.
  const [mm, setMm] = useState(
    String(Math.floor(Number(valor.slice(3, 5)) / 5) * 5).padStart(2, "0")
  );
  return (
    <View style={styles.elegir}>
      <Text style={styles.hojaTitulo}>{titulo}</Text>
      <Text style={styles.elegida}>{legible(`${hh}:${mm}`)}</Text>
      <Text style={styles.grillaRotulo}>HORA</Text>
      <View style={styles.grilla}>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
          <Celda key={h} texto={String(Number(h))} activa={h === hh} onPress={() => setHh(h)} />
        ))}
      </View>
      <Text style={styles.grillaRotulo}>MINUTOS</Text>
      <View style={styles.grilla}>
        {MINUTOS_DEL_HORARIO.map((m) => (
          <Celda key={m} texto={`:${m}`} activa={m === mm} onPress={() => setMm(m)} />
        ))}
      </View>
      <Pressable
        onPress={() => onListo(`${hh}:${mm}`)}
        style={({ pressed }) => [styles.listo, pressed && styles.tocado]}
      >
        <Text style={styles.listoTexto}>Listo</Text>
      </Pressable>
    </View>
  );
}

function Celda({ texto, activa, onPress }: { texto: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.celda, activa && styles.celdaActiva, pressed && styles.tocado]}
    >
      <Text style={[styles.celdaTexto, activa && styles.celdaTextoActiva]}>{texto}</Text>
    </Pressable>
  );
}

function Pastilla({ texto, onPress, malo = false }: { texto: string; onPress: () => void; malo?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.pastilla, malo && styles.pastillaMala, pressed && styles.tocado]}
    >
      <Text style={styles.pastillaTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caja: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: tema.linea, paddingHorizontal: 12 },
  fila: { paddingVertical: 10, gap: 4 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  filaArriba: { flexDirection: "row", alignItems: "center", gap: 8 },
  dia: { width: 86, color: tema.texto, fontSize: 15, fontWeight: "500" },
  horas: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  a: { color: tema.texto3, fontSize: 14 },
  cerrado: { flex: 1, color: tema.texto3, fontSize: 14 },
  pastilla: {
    height: 32,
    minWidth: 58,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  pastillaMala: { borderColor: tema.rojo },
  pastillaTexto: { color: tema.texto, fontSize: 15, fontVariant: ["tabular-nums"] },
  error: { color: tema.rojo, fontSize: 12, marginLeft: 94 },
  hojaTitulo: { color: tema.texto, fontSize: 17, fontWeight: "700", textAlign: "center", paddingBottom: 8 },
  tocado: { opacity: 0.6 },
  elegir: { paddingHorizontal: 16, gap: 8 },
  elegida: { color: tema.texto, fontSize: 36, fontWeight: "700", textAlign: "center", fontVariant: ["tabular-nums"] },
  grillaRotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, marginTop: 4 },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  celda: {
    width: "15.2%",
    height: 38,
    borderRadius: 8,
    backgroundColor: tema.fondo,
    alignItems: "center",
    justifyContent: "center",
  },
  celdaActiva: { backgroundColor: tema.verde },
  celdaTexto: { color: tema.texto, fontSize: 15, fontVariant: ["tabular-nums"] },
  celdaTextoActiva: { color: "#fff", fontWeight: "700" },
  listo: {
    marginTop: 8,
    height: 46,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  listoTexto: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
