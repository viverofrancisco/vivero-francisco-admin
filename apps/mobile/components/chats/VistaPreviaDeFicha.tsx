import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  SIN_ACCESO_A,
  type ReferenciaEnMensaje,
  type VistaPreviaDeReferencia,
} from "@vivero/shared";
import { apiRequest, esApiError, mensajeDeError } from "@/lib/api";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { ICONO_REFERENCIA } from "@/components/chats/Burbuja";
import { tema } from "@/lib/tema";

/**
 * La ficha compartida, leída **sin salir del chat**: una hoja desde abajo
 * con lo esencial en filas y un *Ver ficha* para quien sí quiere irse. Tocar
 * la tarjeta abría la ficha entera y volver era perder el hilo.
 *
 * Lo que se muestra lo arma el servidor con el acceso de quien mira: un 403
 * cierra la hoja y muestra el aviso de siempre. El portal tiene la misma
 * hoja en el teléfono, y un diálogo en el escritorio.
 */
type Carga = {
  clave: string;
  datos: VistaPreviaDeReferencia | null;
  error: string | null;
  /** El servidor dijo que no: la hoja se va y después sale el aviso. */
  sinAcceso?: boolean;
};

export function VistaPreviaDeFicha({
  referencia,
  onCerrar,
  onIrAFicha,
}: {
  referencia: ReferenciaEnMensaje | null;
  onCerrar: () => void;
  onIrAFicha: (ref: ReferenciaEnMensaje) => void;
}) {
  const tipo = referencia?.tipo;
  const id = referencia?.id;
  const clave = tipo && id ? `${tipo}:${id}` : null;
  // Con la clave de la ficha a la que pertenece: si no es la de ahora, se
  // está cargando. Sin esto, abrir otra tarjeta mostraba la anterior un rato.
  const [carga, setCarga] = useState<Carga | null>(null);
  const actual = carga && carga.clave === clave ? carga : null;

  useEffect(() => {
    if (!tipo || !id) return;
    const clave = `${tipo}:${id}`;
    let vivo = true;
    apiRequest<VistaPreviaDeReferencia>(
      `/api/mobile/chats/referencia?tipo=${tipo}&id=${encodeURIComponent(id)}`
    )
      .then((datos) => {
        if (vivo) setCarga({ clave, datos, error: null });
      })
      .catch((e) => {
        if (!vivo) return;
        if (esApiError(e) && e.status === 403) {
          setCarga({ clave, datos: null, error: null, sinAcceso: true });
          return;
        }
        setCarga({ clave, datos: null, error: mensajeDeError(e, "No pudimos cargar la ficha") });
      });
    return () => {
      vivo = false;
    };
  }, [tipo, id]);

  // Primero se va la hoja y recién después el aviso: un Alert encima de un
  // Modal que se está cerrando se pierde en iOS.
  useEffect(() => {
    if (!actual?.sinAcceso || !tipo) return;
    onCerrar();
    const { titulo, detalle } = SIN_ACCESO_A[tipo];
    const reloj = setTimeout(() => Alert.alert(titulo, detalle), 350);
    return () => clearTimeout(reloj);
  }, [actual, tipo, onCerrar]);

  const abierta = referencia !== null && !actual?.sinAcceso;

  return (
    <HojaInferior visible={abierta} onCerrar={onCerrar}>
      <ScrollView style={styles.cuerpo} bounces={false}>
        {actual?.error ? (
          <Text style={styles.aviso}>{actual.error}</Text>
        ) : !actual?.datos ? (
          <ActivityIndicator style={styles.cargando} />
        ) : (
          <Detalle datos={actual.datos} />
        )}
      </ScrollView>
      {referencia ? (
        <Button mode="outlined" style={styles.boton} onPress={() => onIrAFicha(referencia)}>
          Ver ficha
        </Button>
      ) : null}
    </HojaInferior>
  );
}

function Detalle({ datos }: { datos: VistaPreviaDeReferencia }) {
  return (
    <View>
      <View style={styles.encabezado}>
        <View style={styles.circulo}>
          <Ionicons name={ICONO_REFERENCIA[datos.tipo]} size={22} color={tema.texto} />
        </View>
        <View style={styles.crece}>
          <Text style={styles.titulo} numberOfLines={1}>
            {datos.titulo}
          </Text>
          <Text style={styles.subtitulo} numberOfLines={1}>
            {datos.subtitulo}
          </Text>
        </View>
        {datos.estado ? (
          <View style={styles.estado}>
            <Text style={styles.estadoTexto}>{datos.estado}</Text>
          </View>
        ) : null}
      </View>
      {datos.filas.map((f) => (
        <View key={f.etiqueta} style={styles.fila}>
          <Text style={styles.etiqueta}>{f.etiqueta}</Text>
          <Text style={styles.valor}>{f.valor}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flexShrink: 1 },
  cargando: { paddingVertical: 32 },
  aviso: { paddingVertical: 32, textAlign: "center", color: tema.texto2, fontSize: 14 },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  crece: { flex: 1, minWidth: 0 },
  titulo: { fontSize: 16, fontWeight: "600", color: tema.texto },
  subtitulo: { fontSize: 13, color: tema.texto2, marginTop: 1 },
  estado: { backgroundColor: tema.lienzo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  estadoTexto: { fontSize: 12, fontWeight: "500", color: tema.texto },
  fila: { flexDirection: "row", gap: 14, paddingVertical: 6 },
  etiqueta: { width: 92, fontSize: 14, color: tema.texto3 },
  valor: { flex: 1, fontSize: 14, color: tema.texto, lineHeight: 20 },
  boton: { marginTop: 12 },
});
