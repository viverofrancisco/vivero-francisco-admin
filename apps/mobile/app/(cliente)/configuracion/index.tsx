import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl } from "react-native";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteProfileResponse } from "@/lib/types";
import {
  PantallaDeCuenta,
  Row,
  Section,
} from "@/components/cuenta/PantallaDeCuenta";

/**
 * La Cuenta del cliente: la misma pantalla que la del equipo, más lo suyo —su
 * teléfono, sus propiedades y *Eliminar mi cuenta*— (sus solicitudes tienen
 * pestaña propia). El
 * nombre y el correo salen de la sesión, así que se ven al instante; la ficha
 * llega después y suma lo demás.
 */
export default function ClienteConfiguracionScreen() {
  const clear = useAuthStore((s) => s.clear);
  const [data, setData] = useState<ClienteProfileResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<ClienteProfileResponse>("/api/mobile/clientes/me"));
    } catch {
      // Sin la ficha la pantalla igual sirve: nombre, correo y sesión.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Eliminar la cuenta, como pide Apple a toda app donde uno se registra. Se
   * va la forma de entrar; la ficha queda solo si tiene visitas o facturas,
   * que el vivero tiene que conservar. Lo dice antes de confirmar.
   */
  function eliminarCuenta() {
    Alert.alert(
      "¿Eliminar tu cuenta?",
      "Ya no podrás entrar a la app con este correo. Si tienes visitas o facturas con nosotros, las conservamos porque la ley nos lo exige. Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setEliminando(true);
            try {
              await apiRequest("/api/mobile/auth/cuenta", { method: "DELETE" });
              await clear();
            } catch (e) {
              setEliminando(false);
              Alert.alert(
                "No pudimos eliminar tu cuenta",
                mensajeDeError(e, "Intenta de nuevo en un momento.")
              );
            }
          },
        },
      ]
    );
  }

  const cliente = data?.cliente;

  return (
    <PantallaDeCuenta
      filasDeCuenta={cliente?.telefono ? [{ label: "Teléfono", value: cliente.telefono }] : []}
      onEliminarCuenta={eliminarCuenta}
      eliminando={eliminando}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      {/* Dónde se le trabaja. Una fila por propiedad: quien tiene dos las ve
          las dos, en vez de una dirección elegida a dedo. */}
      {cliente && cliente.propiedades.length > 0 ? (
        <Section
          title={cliente.propiedades.length === 1 ? "Mi propiedad" : "Mis propiedades"}
        >
          {cliente.propiedades.map((p) => (
            <Row
              key={p.id}
              label={p.nombre}
              value={
                [p.direccion, p.ciudad ?? p.sector?.nombre].filter(Boolean).join(", ") ||
                "Sin dirección"
              }
            />
          ))}
        </Section>
      ) : null}
    </PantallaDeCuenta>
  );
}
