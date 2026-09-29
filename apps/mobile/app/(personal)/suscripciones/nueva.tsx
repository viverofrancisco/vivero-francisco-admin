import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { diaISO } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { SelectorCliente } from "@/components/clientes/SelectorCliente";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Titulo } from "@/components/ui/Formulario";
import {
  CamposDelPlan,
  ResumenDelPlan,
  type ValoresDelPlan,
} from "@/components/suscripciones/CamposDelPlan";
import type { ClienteListItem, ClientesListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Alta de un plan, la misma pantalla que el portal en móvil: cliente,
 * propiedad, precio, IVA, visitas y términos. Con `?cliente=` llega con el
 * cliente puesto, que es como se entra desde su ficha.
 */
export default function NuevaSuscripcionScreen() {
  const router = useRouter();
  const { cliente: clienteInicial } = useLocalSearchParams<{ cliente?: string }>();
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(clienteInicial ?? null);
  const [valores, setValores] = useState<ValoresDelPlan>({
    propiedadId: null,
    periodicidad: "MENSUAL",
    estado: "ACTIVO",
    fechaInicio: diaISO(new Date()),
    precio: "",
    // 15 es lo que paga un servicio de jardinería en Ecuador; el 0 se escribe.
    ivaTasa: "15",
    visitasPorPeriodo: "",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ClientesListResponse>("/api/mobile/clientes", {
      query: { limit: 500 },
    })
      .then((r) => {
        setClientes(r.items);
        // Con cliente en la URL, su propiedad sale sola si tiene una.
        const c = r.items.find((x) => x.id === clienteInicial);
        if (c?.propiedades.length === 1) {
          setValores((v) => ({ ...v, propiedadId: c.propiedades[0].id }));
        }
      })
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar los clientes")))
      .finally(() => setCargando(false));
  }, [clienteInicial]);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  function elegirCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setValores((v) => ({
      ...v,
      propiedadId: c?.propiedades.length === 1 ? c.propiedades[0].id : null,
    }));
  }

  /** Un segundo plan sobre el mismo jardín suele ser un duplicado: se avisa. */
  const avisoPropiedad = (propiedadId: string) => {
    const activos = (cliente?.suscripciones ?? [])
      .filter((s) => s.propiedad.id === propiedadId)
      .map((s) => `#${s.numero}`);
    return activos.length > 0
      ? `Ya tiene la suscripción ${activos.join(", ")} activa`
      : null;
  };

  async function crear() {
    if (!clienteId) return setError("Selecciona un cliente.");
    if (!valores.propiedadId) return setError("Elige de qué propiedad es el plan.");
    if (valores.precio.trim() === "" || Number(valores.precio) < 0) {
      return setError("Pon el precio del período.");
    }
    if (!(Number(valores.visitasPorPeriodo) >= 1)) {
      return setError("Indica cuántas visitas incluye cada período.");
    }
    setError(null);
    setGuardando(true);
    try {
      const creada = await apiRequest<{ id: string }>("/api/mobile/suscripciones", {
        method: "POST",
        body: {
          clienteId,
          propiedadId: valores.propiedadId,
          periodicidad: valores.periodicidad,
          fechaInicio: valores.fechaInicio,
          precio: Number(valores.precio),
          ivaTasa: valores.ivaTasa.trim() ? Number(valores.ivaTasa) : null,
          visitasPorPeriodo: Number(valores.visitasPorPeriodo),
          notas: valores.notas.trim() || null,
        },
      });
      router.replace(`/(personal)/suscripciones/${creada.id}`);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos crear la suscripción"));
      setGuardando(false);
    }
  }

  const encabezado = (
    <EncabezadoDeFormulario
      titulo="Nueva suscripción"
      accion="Crear"
      onAccion={crear}
      onCancelar={() => router.back()}
      cargando={guardando}
      deshabilitado={!cliente || !valores.propiedadId}
    />
  );

  if (cargando) {
    return (
      <View style={styles.flex}>
        {encabezado}
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
    {encabezado}
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <ScrollView
        style={styles.contenedor}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Titulo>Cliente</Titulo>
        <SelectorCliente
          clientes={clientes}
          valor={clienteId}
          onElegir={elegirCliente}
        />

        {cliente ? (
          cliente.propiedades.length === 0 ? (
            <Text style={styles.aviso}>
              Este cliente no tiene ninguna propiedad cargada. Agrégale una desde
              su ficha para poder armarle un plan.
            </Text>
          ) : (
            <>
              <CamposDelPlan
                valores={valores}
                onChange={(patch) => setValores((v) => ({ ...v, ...patch }))}
                propiedades={cliente.propiedades}
                avisoPropiedad={avisoPropiedad}
              />
              <Titulo>Resumen</Titulo>
              <ResumenDelPlan valores={valores} />
            </>
          )
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tema.fondo },
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  scroll: { padding: 16, paddingBottom: 40 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  aviso: { color: tema.ambarTexto, paddingHorizontal: 4, paddingVertical: 8 },
  error: { color: tema.rojo, textAlign: "center", paddingVertical: 10 },

});
