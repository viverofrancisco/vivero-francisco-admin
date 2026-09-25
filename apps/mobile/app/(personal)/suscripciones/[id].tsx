import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ESTADO_SUSCRIPCION_LABEL,
  PERIODICIDAD_LABEL,
  fechaSola,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import {
  CamposDelPlan,
  ResumenDelPlan,
  type ValoresDelPlan,
} from "@/components/suscripciones/CamposDelPlan";
import type { SuscripcionDetalle } from "@/lib/types";
import { estadoVisual, tema } from "@/lib/tema";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const COLOR_ESTADO: Record<string, { texto: string; fondo: string }> = {
  ACTIVO: { texto: tema.verde700, fondo: tema.verde50 },
  PAUSADO: { texto: tema.ambarTexto, fondo: tema.ambar50 },
  CANCELADO: { texto: tema.texto2, fondo: tema.linea2 },
};

function valoresDe(s: SuscripcionDetalle): ValoresDelPlan {
  return {
    propiedadId: s.propiedad.id,
    periodicidad: s.periodicidad,
    estado: s.estado,
    fechaInicio: s.fechaInicio.slice(0, 10),
    precio: String(s.precio),
    ivaTasa: String(s.ivaTasa),
    visitasPorPeriodo: String(s.visitasPorPeriodo),
    notas: s.notas ?? "",
  };
}

/**
 * La ficha de un plan, la misma que el portal en móvil: qué se pactó, dónde,
 * sus visitas y sus órdenes. Se edita acá mismo, y con algo cambiado el
 * encabezado pasa a ser *Cancelar* / *Guardar*, como en la ficha de la visita:
 * es lo único que queda fijo mientras se scrollea, y un botón al pie de un
 * formulario largo es uno que hay que ir a buscar.
 */
export default function SuscripcionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<SuscripcionDetalle | null>(null);
  const [valores, setValores] = useState<ValoresDelPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const s = await apiRequest<SuscripcionDetalle>(`/api/mobile/suscripciones/${id}`);
      setPlan(s);
      // Lo que se está editando no se pisa al volver de una visita: si hay
      // cambios sin guardar, se quedan.
      setValores((v) => v ?? valoresDe(s));
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar la suscripción"));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const cambiar = (patch: Partial<ValoresDelPlan>) =>
    setValores((v) => (v ? { ...v, ...patch } : v));

  const hayCambios =
    plan !== null &&
    valores !== null &&
    JSON.stringify(valores) !== JSON.stringify(valoresDe(plan));

  /** Vuelve a lo guardado. */
  const cancelar = () => {
    if (plan) setValores(valoresDe(plan));
    setError(null);
  };

  async function guardar() {
    if (!valores || !plan) return;
    if (valores.precio.trim() === "" || Number(valores.precio) < 0) {
      setError("Pon el precio del período.");
      return;
    }
    if (!(Number(valores.visitasPorPeriodo) >= 1)) {
      setError("Indica cuántas visitas incluye cada período.");
      return;
    }
    setGuardando(true);
    try {
      await apiRequest(`/api/mobile/suscripciones/${id}`, {
        method: "PUT",
        body: {
          propiedadId: valores.propiedadId,
          periodicidad: valores.periodicidad,
          estado: valores.estado,
          fechaInicio: valores.fechaInicio,
          precio: Number(valores.precio),
          ivaTasa: valores.ivaTasa.trim() ? Number(valores.ivaTasa) : null,
          visitasPorPeriodo: Number(valores.visitasPorPeriodo),
          notas: valores.notas.trim() || null,
        },
      });
      setValores(null);
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  /** Los borradores de los períodos vencidos de este plan, a pedido. */
  async function generarOrdenes() {
    setGenerando(true);
    try {
      const r = await apiRequest<{ creadas: number }>(
        `/api/mobile/suscripciones/${id}/renovar`,
        { method: "POST" }
      );
      setError(
        r.creadas === 0
          ? "No había períodos por generar."
          : `${r.creadas} ${r.creadas === 1 ? "orden creada" : "órdenes creadas"} en borrador.`
      );
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos generar las órdenes"));
    } finally {
      setGenerando(false);
    }
  }

  if (error && !plan) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Suscripción" />
        <View style={styles.centro}>
          <Text style={styles.apagado}>{error}</Text>
        </View>
      </View>
    );
  }
  if (!plan || !valores) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFicha titulo="Suscripción" />
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  const color = COLOR_ESTADO[plan.estado] ?? COLOR_ESTADO.CANCELADO;
  const propiedadActual =
    plan.propiedades.find((p) => p.id === valores.propiedadId) ?? plan.propiedad;

  return (
    <View style={styles.flex}>
      {/* La flecha al lado del nombre, y fija: es el encabezado de toda
          ficha en la app. La pastilla del estado va a su derecha. Con algo
          cambiado, el encabezado **es** la confirmación —Cancelar y Guardar—
          y se lleva puesta la flecha: para salir hay que decidir antes. */}
      {hayCambios ? (
        <EncabezadoDeFormulario
          titulo={plan.cliente.nombre}
          accion="Guardar"
          onAccion={guardar}
          onCancelar={cancelar}
          cargando={guardando}
        />
      ) : (
        <EncabezadoDeFicha
          titulo={plan.cliente.nombre}
          derecha={
            <View style={[styles.pastilla, { backgroundColor: color.fondo }]}>
              <Text style={[styles.pastillaTexto, { color: color.texto }]}>
                {ESTADO_SUSCRIPCION_LABEL[plan.estado] ?? plan.estado}
              </Text>
            </View>
          }
        />
      )}
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.contenedor}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="bodyMedium" style={[styles.apagado, styles.subtitulo]}>
          Suscripción #{plan.numero} · {propiedadActual.nombre} ·{" "}
          {(PERIODICIDAD_LABEL[valores.periodicidad] ?? valores.periodicidad).toLowerCase()}
        </Text>

        {/* Lo primero: cuánto paga el cliente. Es a lo que se abre esta pantalla. */}
        <ResumenDelPlan valores={valores} />

        {error ? <Text style={styles.aviso}>{error}</Text> : null}

        <CamposDelPlan
          valores={valores}
          onChange={cambiar}
          propiedades={plan.propiedades}
          conEstado
        />

        <Seccion
          titulo="Visitas"
          accion="Crear visita"
          onAccion={() =>
            router.push({
              pathname: "/(personal)/visitas/nueva",
              params: { suscripcion: plan.id },
            })
          }
        >
          {plan.visitas.length === 0 ? (
            <Text style={[styles.apagado, styles.vacio]}>
              Todavía no hay visitas de este plan.
            </Text>
          ) : (
            plan.visitas.map((v) => {
              const estado = estadoVisual[v.estado];
              return (
                <PressableScale
                  key={v.id}
                  onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
                  style={styles.filaLink}
                >
                  <View style={styles.filaTexto}>
                    <Text variant="bodyMedium" style={styles.filaNombre}>
                      Visita #{v.numero}
                      <Text style={styles.apagado}>
                        {"  "}
                        {fechaSola(v.fechaProgramada, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                    </Text>
                    <Text variant="bodySmall" style={styles.apagado} numberOfLines={1}>
                      {v.tareas.length > 0 ? v.tareas.join(", ") : "Sin tareas registradas"}
                    </Text>
                  </View>
                  <Text style={[styles.estadoVisita, { color: estado?.color ?? tema.texto3 }]}>
                    {estado?.etiqueta ?? v.estado}
                  </Text>
                </PressableScale>
              );
            })
          )}
        </Seccion>

        <Seccion
          titulo="Órdenes"
          accion={generando ? "Generando…" : "Generar órdenes"}
          onAccion={generando ? undefined : generarOrdenes}
        >
          {plan.ordenes.length === 0 ? (
            <Text style={[styles.apagado, styles.vacio]}>
              Todavía no se generó ninguna orden de este plan.
            </Text>
          ) : (
            plan.ordenes.map((o) => (
              <PressableScale
                key={o.id}
                onPress={() => router.push(`/(personal)/ordenes/${o.id}`)}
                style={styles.filaLink}
              >
                <View style={styles.filaTexto}>
                  <Text variant="bodyMedium" style={styles.filaNombre}>
                    Orden #{o.numero}
                    {o.factura ? (
                      <Text style={styles.apagado}>{"  "}{o.factura.numero}</Text>
                    ) : null}
                  </Text>
                  <Text variant="bodySmall" style={styles.apagado}>
                    {o.periodoInicio && o.periodoFin
                      ? `${fechaSola(o.periodoInicio, { day: "2-digit", month: "short" })} → ${fechaSola(o.periodoFin, { day: "2-digit", month: "short", year: "numeric" })}`
                      : fechaSola(o.fecha)}
                    {o.periodos > 1 ? ` · ${o.periodos} períodos` : ""}
                  </Text>
                </View>
                <View style={styles.derecha}>
                  <Text variant="bodyMedium" style={styles.filaTotal}>
                    {plata(o.delPlan)}
                  </Text>
                  <Text variant="bodySmall" style={styles.apagado}>
                    {o.estado === "BORRADOR"
                      ? "Borrador"
                      : o.estado === "ANULADA"
                        ? "Anulada"
                        : !o.factura || o.factura.saldo === null
                          ? "Facturada"
                          : o.factura.saldo <= 0.001
                            ? "Cobrado"
                            : "Por cobrar"}
                  </Text>
                </View>
              </PressableScale>
            ))
          )}
        </Seccion>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

function Seccion({
  titulo,
  accion,
  onAccion,
  children,
}: {
  titulo: string;
  accion?: string;
  onAccion?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionCabecera}>
        <Text variant="labelMedium" style={styles.seccionRotulo}>
          {titulo.toUpperCase()}
        </Text>
        {accion ? (
          <PressableScale onPress={onAccion ?? (() => {})} disabled={!onAccion}>
            <Text style={styles.seccionAccion}>{accion}</Text>
          </PressableScale>
        ) : null}
      </View>
      <View style={styles.seccionCuerpo}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  scroll: { padding: 16, paddingBottom: 40 },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },

  subtitulo: { marginBottom: 12 },
  apagado: { color: tema.texto3 },
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pastillaTexto: { fontSize: 11, fontWeight: "600" },
  aviso: { color: tema.texto2, textAlign: "center", paddingVertical: 6 },

  seccion: { marginTop: 20, gap: 6 },
  seccionCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 4,
  },
  seccionRotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  seccionAccion: { color: tema.verde700, fontWeight: "600", fontSize: 13 },
  seccionCuerpo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  vacio: { paddingVertical: 10 },

  filaLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  filaTexto: { flex: 1, gap: 2 },
  filaNombre: { color: tema.texto, fontWeight: "500" },
  filaTotal: { color: tema.texto, fontWeight: "600" },
  derecha: { alignItems: "flex-end", gap: 2 },
  estadoVisita: { fontSize: 12, fontWeight: "600" },
});
