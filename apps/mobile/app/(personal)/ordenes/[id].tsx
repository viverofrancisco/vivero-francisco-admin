import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  cobroLabel,
  estadoCobro,
  fechaSola,
  resumenDePropiedades,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import type { OrdenDetalle } from "@/lib/types";
import { tema } from "@/lib/tema";

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const ESTADO_FACTURA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  FIRMADO: "Firmada",
  ENVIADO_SRI: "Enviada al SRI",
  AUTORIZADO: "Autorizada",
  RECHAZADO: "Rechazada",
};

/**
 * Una orden: por qué existe, qué se cobra y cómo viene el cobro.
 *
 * Solo lectura. Cobrar y emitir siguen en el portal: emitir una factura es
 * irreversible —el SRI ya vio ese número— y no es algo que uno quiera poder
 * hacer sin querer, con el teléfono en la mano y una mano en el volante.
 */
export default function OrdenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiRequest<OrdenDetalle>(`/api/mobile/ordenes/${id}`)
        .then(setOrden)
        .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la orden")));
    }, [id])
  );

  if (error && !orden) {
    return (
      <View style={styles.centro}>
        <Text style={styles.apagado}>{error}</Text>
      </View>
    );
  }
  if (!orden) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const anulada = orden.estado === "ANULADA";
  const cobro = estadoCobro(orden.total, orden.factura?.saldo ?? null);
  const donde = resumenDePropiedades(orden.propiedades);

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={styles.scroll}>
      <View style={styles.encabezado}>
        <Text variant="headlineSmall" style={styles.titulo}>
          Orden #{orden.numero}
        </Text>
        <Text variant="bodyMedium" style={styles.apagado}>
          {orden.cliente.nombre} ·{" "}
          {fechaSola(orden.fecha, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        {donde ? (
          <Text variant="bodySmall" style={styles.apagado}>
            {donde}
          </Text>
        ) : null}
      </View>

      {/* Lo primero: cuánto es y si entró. Es a lo que se abre esta pantalla. */}
      <View style={[styles.tarjetaPlata, anulada && styles.tarjetaAnulada]}>
        <Text style={styles.plataGrande}>{plata(orden.total)}</Text>
        <Text style={styles.plataEstado}>
          {anulada ? "Orden anulada" : cobroLabel[cobro]}
        </Text>
        {!anulada && orden.factura?.saldo ? (
          <Text style={styles.plataSaldo}>
            Falta cobrar {plata(orden.factura.saldo)}
          </Text>
        ) : null}
      </View>

      <Seccion titulo="Detalle">
        {orden.lineas.map((l) => (
          <View key={l.id} style={styles.linea}>
            <View style={styles.lineaTexto}>
              <Text variant="bodyMedium" style={styles.lineaNombre}>
                {l.descripcion}
              </Text>
              <Text variant="bodySmall" style={styles.apagado}>
                {l.cantidad} × {plata(l.precioUnitario)}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.lineaTotal}>
              {plata(l.total)}
            </Text>
          </View>
        ))}
        <View style={styles.totales}>
          <Fila etiqueta="Subtotal" valor={plata(orden.subtotal)} />
          <Fila etiqueta="IVA" valor={plata(orden.iva)} />
          <Fila etiqueta="Total" valor={plata(orden.total)} fuerte />
        </View>
      </Seccion>

      {orden.factura ? (
        <Seccion titulo="Factura">
          <Fila etiqueta="Número" valor={orden.factura.numero} />
          <Fila
            etiqueta="Estado"
            valor={ESTADO_FACTURA[orden.factura.estado] ?? orden.factura.estado}
          />
          <Fila
            etiqueta="Emitida"
            valor={fechaSola(orden.factura.fechaEmision, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </Seccion>
      ) : null}

      {/* De qué es la orden: el plan o las visitas que cubre. */}
      {orden.visitas.length > 0 ? (
        <Seccion
          titulo={orden.visitas.length === 1 ? "Visita" : "Visitas"}
        >
          {orden.visitas.map((v) => (
            <PressableScale
              key={v.id}
              onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
              style={styles.visita}
            >
              <Text variant="bodyMedium" style={styles.lineaNombre}>
                Visita #{v.numero}
              </Text>
              <Text style={styles.apagado}>›</Text>
            </PressableScale>
          ))}
        </Seccion>
      ) : null}

      {orden.notas ? (
        <Seccion titulo="Notas">
          <Text variant="bodyMedium" style={styles.notas}>
            {orden.notas}
          </Text>
        </Seccion>
      ) : null}

      <Text variant="bodySmall" style={styles.pie}>
        Cobrar y emitir se hacen en el portal.
      </Text>
    </ScrollView>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.seccion}>
      <Text variant="labelMedium" style={styles.seccionRotulo}>
        {titulo.toUpperCase()}
      </Text>
      <View style={styles.seccionCuerpo}>{children}</View>
    </View>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text variant="bodyMedium" style={styles.apagado}>
        {etiqueta}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.filaValor, fuerte && styles.filaFuerte]}
      >
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  scroll: { padding: 16, paddingBottom: 40 },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },

  encabezado: { gap: 3, marginBottom: 16 },
  titulo: { color: tema.texto, fontWeight: "700" },
  apagado: { color: tema.texto3 },

  tarjetaPlata: {
    backgroundColor: tema.verdeProfundo,
    borderRadius: 16,
    padding: 18,
    gap: 2,
    marginBottom: 8,
  },
  tarjetaAnulada: { backgroundColor: tema.texto2 },
  plataGrande: { color: "#fff", fontSize: 30, fontWeight: "700" },
  plataEstado: { color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  plataSaldo: { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  seccion: { marginTop: 20, gap: 6 },
  seccionRotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  seccionCuerpo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  linea: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
  },
  lineaTexto: { flex: 1, gap: 2 },
  lineaNombre: { color: tema.texto },
  lineaTotal: { color: tema.texto, fontWeight: "600" },
  totales: { paddingTop: 6 },

  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  filaValor: { color: tema.texto },
  filaFuerte: { fontWeight: "700" },

  visita: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },

  notas: { color: tema.texto2, paddingVertical: 8, lineHeight: 21 },
  pie: { color: tema.texto3, textAlign: "center", marginTop: 24 },
});
