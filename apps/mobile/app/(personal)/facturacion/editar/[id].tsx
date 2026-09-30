import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { Campo, Titulo } from "@/components/ui/Formulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { EmisorConfig } from "@/lib/types";
import { tema } from "@/lib/tema";

type Datos = Omit<EmisorConfig, "id" | "certificadoSujeto" | "certificadoVence" | "facturas">;

const VACIO: Datos = {
  ruc: "",
  razonSocial: "",
  nombreComercial: "",
  dirMatriz: "",
  direccionEstablecimiento: "",
  establecimiento: "001",
  puntoEmision: "001",
  obligadoContabilidad: true,
  contribuyenteEspecial: "",
  agenteRetencion: "",
  ambiente: "PRUEBAS",
  activo: true,
  predeterminado: false,
};

const limpio = (d: Datos) => ({
  ruc: d.ruc.trim(),
  razonSocial: d.razonSocial.trim(),
  nombreComercial: d.nombreComercial?.trim() || null,
  dirMatriz: d.dirMatriz.trim(),
  direccionEstablecimiento: d.direccionEstablecimiento?.trim() || null,
  establecimiento: d.establecimiento.trim(),
  puntoEmision: d.puntoEmision.trim(),
  obligadoContabilidad: d.obligadoContabilidad,
  contribuyenteEspecial: d.contribuyenteEspecial?.trim() || null,
  agenteRetencion: d.agenteRetencion?.trim() || null,
  ambiente: d.ambiente,
  activo: d.activo,
  predeterminado: d.predeterminado,
});

/**
 * Crear o editar un emisor (`id` = "nuevo" para crear): los mismos campos que
 * el diálogo del portal, con *Cancelar* · título · *Crear* / *Guardar* arriba.
 * El RUC no se cambia después: para el SRI otro RUC es otro contribuyente.
 */
export default function EmisorEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const esNuevo = id === "nuevo";
  const [inicial, setInicial] = useState<Datos | null>(esNuevo ? VACIO : null);
  const [form, setForm] = useState<Datos>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (esNuevo) return;
    apiRequest<{ items: EmisorConfig[] }>("/api/mobile/configuracion/emisores")
      .then((r) => {
        const e = r.items.find((x) => x.id === id);
        if (!e) throw new Error("Este emisor ya no existe");
        const datos: Datos = {
          ...e,
          nombreComercial: e.nombreComercial ?? "",
          direccionEstablecimiento: e.direccionEstablecimiento ?? "",
          contribuyenteEspecial: e.contribuyenteEspecial ?? "",
          agenteRetencion: e.agenteRetencion ?? "",
        };
        setInicial(datos);
        setForm(datos);
      })
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar el emisor")));
  }, [esNuevo, id]);

  const set = (patch: Partial<Datos>) => setForm((f) => ({ ...f, ...patch }));
  const hayCambios =
    inicial !== null && JSON.stringify(limpio(form)) !== JSON.stringify(limpio(inicial));
  const completo =
    /^\d{13}$/.test(form.ruc.trim()) &&
    form.razonSocial.trim().length > 0 &&
    form.dirMatriz.trim().length > 0;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiRequest(
        esNuevo ? "/api/mobile/configuracion/emisores" : `/api/mobile/configuracion/emisores/${id}`,
        { method: esNuevo ? "POST" : "PUT", body: limpio(form) }
      );
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={esNuevo ? "Nuevo emisor" : "Editar emisor"}
        accion={esNuevo ? "Crear" : "Guardar"}
        onAccion={guardar}
        onCancelar={() => router.back()}
        cargando={guardando}
        deshabilitado={!completo || !hayCambios}
      />
      {!inicial ? (
        <View style={styles.centro}>
          {error ? <Text style={styles.apagado}>{error}</Text> : <ActivityIndicator size="large" />}
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Titulo>Contribuyente</Titulo>
            {esNuevo ? (
              <Campo
                label="RUC"
                required
                value={form.ruc}
                onChangeText={(v) => set({ ruc: v })}
                keyboardType="number-pad"
              />
            ) : (
              <View style={styles.soloLectura}>
                <Text style={styles.soloLecturaLabel}>RUC</Text>
                <Text style={styles.soloLecturaTexto}>{form.ruc}</Text>
              </View>
            )}
            <Campo
              label="Razón social"
              required
              value={form.razonSocial}
              onChangeText={(v) => set({ razonSocial: v })}
            />
            <Campo
              label="Nombre comercial"
              value={form.nombreComercial ?? ""}
              onChangeText={(v) => set({ nombreComercial: v })}
            />

            <Titulo>Ambiente</Titulo>
            <View style={styles.chips}>
              {(["PRUEBAS", "PRODUCCION"] as const).map((a) => {
                const elegido = form.ambiente === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => set({ ambiente: a })}
                    style={[styles.chip, elegido && styles.chipElegido]}
                  >
                    <Text style={[styles.chipTexto, elegido && styles.chipTextoElegido]}>
                      {a === "PRUEBAS" ? "Pruebas" : "Producción"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {form.ambiente === "PRODUCCION" ? (
              <Text style={styles.nota}>Lo que se emita aquí son facturas de verdad.</Text>
            ) : null}

            <Titulo>Direcciones</Titulo>
            <Campo
              label="Dirección de la matriz"
              required
              value={form.dirMatriz}
              onChangeText={(v) => set({ dirMatriz: v })}
            />
            <Campo
              label="Dirección del establecimiento"
              value={form.direccionEstablecimiento ?? ""}
              onChangeText={(v) => set({ direccionEstablecimiento: v })}
              placeholder="La misma que la matriz"
            />

            <Titulo>Serie</Titulo>
            <View style={styles.dos}>
              <View style={styles.mitad}>
                <Campo
                  label="Establecimiento"
                  required
                  value={form.establecimiento}
                  onChangeText={(v) => set({ establecimiento: v })}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.mitad}>
                <Campo
                  label="Punto de emisión"
                  required
                  value={form.puntoEmision}
                  onChangeText={(v) => set({ puntoEmision: v })}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Titulo>Régimen</Titulo>
            <Campo
              label="Contribuyente especial"
              value={form.contribuyenteEspecial ?? ""}
              onChangeText={(v) => set({ contribuyenteEspecial: v })}
              placeholder="N° de resolución"
            />
            <Campo
              label="Agente de retención"
              value={form.agenteRetencion ?? ""}
              onChangeText={(v) => set({ agenteRetencion: v })}
              placeholder="N° de resolución"
            />
            <Interruptor
              titulo="Obligado a llevar contabilidad"
              valor={form.obligadoContabilidad}
              onCambiar={(v) => set({ obligadoContabilidad: v })}
            />
            <Interruptor
              titulo="Predeterminado"
              ayuda="Es el que viene elegido al emitir. Solo puede haber uno."
              valor={form.predeterminado}
              onCambiar={(v) => set({ predeterminado: v })}
            />
            <Interruptor
              titulo="Activo"
              ayuda="Un emisor inactivo no se ofrece al emitir, pero conserva lo que ya facturó."
              valor={form.activo}
              onCambiar={(v) => set({ activo: v })}
            />

            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Interruptor({
  titulo,
  ayuda,
  valor,
  onCambiar,
}: {
  titulo: string;
  ayuda?: string;
  valor: boolean;
  onCambiar: (v: boolean) => void;
}) {
  return (
    <View style={styles.interruptor}>
      <View style={styles.interruptorTexto}>
        <Text variant="bodyLarge" style={styles.interruptorTitulo}>
          {titulo}
        </Text>
        {ayuda ? <Text style={styles.nota}>{ayuda}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambiar}
        trackColor={{ true: tema.verde100, false: undefined }}
        thumbColor={valor ? tema.verde : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  apagado: { color: tema.texto3, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  nota: { color: tema.texto3, fontSize: 13 },
  soloLectura: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 2,
  },
  soloLecturaLabel: { color: tema.texto3, fontSize: 12 },
  soloLecturaTexto: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: "#f4f4f4" },
  chipElegido: { backgroundColor: tema.verde50 },
  chipTexto: { color: tema.texto2, fontSize: 14 },
  chipTextoElegido: { color: tema.verde700, fontWeight: "600" },
  dos: { flexDirection: "row", gap: 10 },
  mitad: { flex: 1 },
  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  interruptorTexto: { flex: 1, gap: 2 },
  interruptorTitulo: { color: tema.texto },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
