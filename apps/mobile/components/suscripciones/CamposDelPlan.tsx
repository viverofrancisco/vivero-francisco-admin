import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  ESTADOS_DE_SUSCRIPCION,
  ESTADO_SUSCRIPCION_LABEL,
  PERIODICIDADES,
  PERIODICIDAD_LABEL,
  direccionDePropiedad,
  diaISO,
  enlaceParaLlegar,
  fechaSola,
  totalDelPeriodo,
  unidadDePeriodo,
  zonaDePropiedad,
} from "@vivero/shared";
import { SelectorFecha } from "@/components/SelectorFecha";
import { SelectorOpcion } from "@/components/ui/SelectorOpcion";
import { Campo, Titulo } from "@/components/ui/Formulario";
import { PressableScale } from "@/components/ui/PressableScale";
import type { PropiedadDelPlan } from "@/lib/types";
import { tema } from "@/lib/tema";

/** Lo que se edita de un plan, como texto: los importes no pelean con el input. */
export interface ValoresDelPlan {
  propiedadId: string | null;
  periodicidad: string;
  estado: string;
  /** `YYYY-MM-DD`. */
  fechaInicio: string;
  precio: string;
  ivaTasa: string;
  visitasPorPeriodo: string;
  notas: string;
}

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Los campos de un plan, los mismos en el alta y en la ficha.
 *
 * Son la ficha del portal en móvil: la propiedad con su ubicación debajo, el
 * precio, el IVA y las visitas; y los términos —cada cuánto se cobra, desde
 * cuándo, notas—. Dos copias de este formulario se habrían separado a la
 * primera corrección.
 */
export function CamposDelPlan({
  valores,
  onChange,
  propiedades,
  conEstado = false,
  avisoPropiedad,
}: {
  valores: ValoresDelPlan;
  onChange: (patch: Partial<ValoresDelPlan>) => void;
  /** Entre cuáles se elige: las propiedades vivas del cliente. */
  propiedades: PropiedadDelPlan[];
  /** En la ficha se puede pausar o cancelar; al crear nace activo. */
  conEstado?: boolean;
  /** Qué decir debajo de cada propiedad: "Ya tiene la suscripción #12 activa". */
  avisoPropiedad?: (propiedadId: string) => string | null;
}) {
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const sufijo = `/${unidadDePeriodo(valores.periodicidad)}`;
  const propiedad = propiedades.find((p) => p.id === valores.propiedadId) ?? null;
  const aviso = propiedad ? avisoPropiedad?.(propiedad.id) : null;

  return (
    <View>
      <Titulo>Plan</Titulo>
      <SelectorOpcion
        label="Propiedad"
        valor={valores.propiedadId}
        onElegir={(id) => onChange({ propiedadId: id })}
        placeholder="Elegir propiedad"
        opciones={propiedades.map((p) => ({
          clave: p.id,
          etiqueta: p.nombre,
          detalle: avisoPropiedad?.(p.id) ?? direccionDePropiedad(p) ?? null,
        }))}
      />
      {/* Dónde queda, debajo del selector: el nombre solo ("Principal") no
          dice a qué jardín se va. Solo la ubicación; las medidas son de la
          ficha de la propiedad. */}
      {propiedad ? <UbicacionDelPlan propiedad={propiedad} /> : null}
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      <View style={styles.tres}>
        <View style={styles.tercio}>
          <Campo
            label={`Precio${sufijo}`}
            required
            value={valores.precio}
            onChangeText={(v) => onChange({ precio: v })}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
        <View style={styles.tercio}>
          <Campo
            label="IVA %"
            value={valores.ivaTasa}
            onChangeText={(v) => onChange({ ivaTasa: v })}
            keyboardType="decimal-pad"
            placeholder="15"
          />
        </View>
        <View style={styles.tercio}>
          <Campo
            label={`Visitas${sufijo}`}
            required
            value={valores.visitasPorPeriodo}
            onChangeText={(v) => onChange({ visitasPorPeriodo: v })}
            keyboardType="number-pad"
            placeholder="4"
          />
        </View>
      </View>
      <Text style={styles.ayuda}>
        El precio va sin IVA. Las visitas son informativas: no limitan agendar.
      </Text>

      <Titulo>Términos</Titulo>
      <SelectorOpcion
        label="Se cobra"
        valor={valores.periodicidad}
        onElegir={(p) => onChange({ periodicidad: p })}
        opciones={PERIODICIDADES.map((p) => ({
          clave: p,
          etiqueta: PERIODICIDAD_LABEL[p],
        }))}
      />
      {conEstado ? (
        <SelectorOpcion
          label="Estado"
          valor={valores.estado}
          onElegir={(e) => onChange({ estado: e })}
          opciones={ESTADOS_DE_SUSCRIPCION.map((e) => ({
            clave: e,
            etiqueta: ESTADO_SUSCRIPCION_LABEL[e],
          }))}
        />
      ) : null}
      <Pressable
        onPress={() => setEligiendoFecha(true)}
        style={({ pressed }) => [styles.fecha, pressed && styles.fechaPresionada]}
        accessibilityRole="button"
        accessibilityLabel="Desde"
      >
        <View style={styles.fechaTexto}>
          <Text style={styles.label}>Desde</Text>
          <Text variant="bodyLarge" style={styles.valor}>
            {fechaSola(valores.fechaInicio)}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={18} color={tema.texto3} />
      </Pressable>
      <Text style={styles.ayuda}>
        Los períodos de cobro se cuentan desde este mes.
      </Text>
      <SelectorFecha
        visible={eligiendoFecha}
        valor={new Date(`${valores.fechaInicio}T12:00:00`)}
        onElegir={(d) => {
          // A mediodía local, así el `YYYY-MM-DD` que se guarda es el día
          // que se tocó y no el anterior corrido por la zona horaria.
          const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
          onChange({ fechaInicio: diaISO(local) });
          setEligiendoFecha(false);
        }}
        onCerrar={() => setEligiendoFecha(false)}
      />
      <Campo
        label="Notas"
        value={valores.notas}
        onChangeText={(v) => onChange({ notas: v })}
        multiline
        placeholder="Opcional: qué incluye, qué se acordó"
      />
    </View>
  );
}

/**
 * Dónde queda el jardín del plan: dirección, zona, referencia y cómo llegar.
 * Es el renglón que encabeza la ficha de la visita, sin el mapa.
 */
export function UbicacionDelPlan({ propiedad }: { propiedad: PropiedadDelPlan }) {
  const direccion = direccionDePropiedad(propiedad);
  const zona = zonaDePropiedad(propiedad);
  const tienePunto = propiedad.lat !== null && propiedad.lng !== null;
  return (
    <View style={styles.ubicacion}>
      <View style={styles.ubicacionTexto}>
        <Text variant="bodyMedium" style={styles.ubicacionDireccion} numberOfLines={1}>
          {direccion || propiedad.nombre}
        </Text>
        <Text variant="bodySmall" style={styles.ubicacionZona} numberOfLines={1}>
          {zona || (tienePunto ? propiedad.nombre : "Sin ubicación en el mapa")}
        </Text>
        {propiedad.referencia ? (
          <Text variant="bodySmall" style={styles.ubicacionZona}>
            {propiedad.referencia}
          </Text>
        ) : null}
      </View>
      {tienePunto ? (
        <PressableScale
          onPress={() =>
            Linking.openURL(enlaceParaLlegar(propiedad.lat!, propiedad.lng!))
          }
          style={styles.llegar}
          accessibilityLabel="Llegar"
        >
          <Ionicons name="navigate-outline" size={15} color={tema.verde700} />
          <Text style={styles.llegarTexto}>Llegar</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * Lo que el cliente paga por período, y cuánto sale cada visita. El
 * formulario pide el precio sin IVA, así que de los campos no se lee.
 */
export function ResumenDelPlan({ valores }: { valores: ValoresDelPlan }) {
  const base = Number(valores.precio) || 0;
  const tasa = Number(valores.ivaTasa) || 0;
  const total = totalDelPeriodo(base, tasa);
  const visitas = Number(valores.visitasPorPeriodo) || 0;
  const unidad = unidadDePeriodo(valores.periodicidad);
  if (valores.precio.trim() === "") return null;
  return (
    <View style={styles.resumen}>
      <Text style={styles.resumenTotal}>
        {plata(total)}
        <Text style={styles.resumenSufijo}>/{unidad}</Text>
      </Text>
      <Text style={styles.resumenDetalle}>
        {plata(base)}
        {tasa > 0 ? ` + ${tasa}% IVA` : " sin IVA"}
        {visitas > 0
          ? ` · ${visitas} visita${visitas === 1 ? "" : "s"}/${unidad} · ${plata(
              Math.round((total / visitas) * 100) / 100
            )} por visita`
          : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tres: { flexDirection: "row", gap: 8 },
  tercio: { flex: 1 },
  ayuda: { color: tema.texto3, fontSize: 12, paddingHorizontal: 4, marginBottom: 8 },
  aviso: {
    color: tema.ambarTexto,
    fontSize: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  label: { fontSize: 12, color: tema.texto3 },
  valor: { color: tema.texto },

  fecha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    marginBottom: 6,
  },
  fechaPresionada: { backgroundColor: tema.lienzo },
  fechaTexto: { flex: 1, gap: 1 },

  ubicacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
    marginBottom: 10,
  },
  ubicacionTexto: { flex: 1, gap: 2 },
  ubicacionDireccion: { color: tema.texto, fontWeight: "600" },
  ubicacionZona: { color: tema.texto3 },
  llegar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.verde100,
    backgroundColor: tema.verde50,
  },
  llegarTexto: { color: tema.verde700, fontWeight: "600", fontSize: 13 },

  resumen: {
    backgroundColor: tema.verdeProfundo,
    borderRadius: 16,
    padding: 18,
    gap: 4,
    marginBottom: 8,
  },
  resumenTotal: { color: "#fff", fontSize: 28, fontWeight: "700" },
  resumenSufijo: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "500" },
  resumenDetalle: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});
