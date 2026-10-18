import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { Calendar, type DateData } from "react-native-calendars";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { EncabezadoDePasos } from "@/components/ui/EncabezadoDePasos";
import { describirPlan, nombreCliente, type SolicitudItem } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type {
  ClienteListItem,
  ClientesListResponse,
  GrupoOption,
  GruposListResponse,
  PersonalListResponse,
  PersonalOption,
  PlanDelCliente,
  PropiedadResumen,
} from "@/lib/types";
import { tema } from "@/lib/tema";
import { Conmutador } from "@/components/ui/Conmutador";
import { SelectorDeCiudad } from "@/components/SelectorDeCiudad";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

/** Una tarea del catálogo, tal como la devuelve `/api/mobile/tareas`. */
interface TareaDelCatalogo {
  id: string;
  nombre: string;
  orden: number;
}
// La propiedad es un paso propio: iba al pie de la lista de clientes, y con
// cuarenta clientes quedaba fuera de la pantalla, donde nadie la veía.
const STEP_LABELS = ["Cliente", "Propiedad", "Tareas", "Fechas", "Personal", "Revisar"];

/** Lo que se escribe de un cliente nuevo, tal cual está en los campos. */
interface DatosClienteNuevo {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}
const CLIENTE_VACIO: DatosClienteNuevo = { nombre: "", apellido: "", telefono: "", email: "" };

/** Lo que se escribe de una propiedad nueva; `direccion` es la calle. */
interface DatosPropiedadNueva {
  nombre: string;
  direccion: string;
  numeroCasa: string;
  ciudad: string;
  referencia: string;
}
const PROPIEDAD_VACIA: DatosPropiedadNueva = {
  nombre: "",
  direccion: "",
  numeroCasa: "",
  ciudad: "",
  referencia: "",
};

/** Un campo escrito, recortado; vacío no viaja. */
const limpio = (t: string) => t.trim() || undefined;

export default function CrearVisitaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  // Llegar desde una suscripción deja el plan puesto —y con él el cliente y
  // la propiedad—: "nueva visita de este plan" es una sola acción.
  // Llegar desde una solicitud deja puestos su cliente y, si eligió una, su
  // propiedad; la visita queda enlazada a ella y la solicitud, atendida.
  const {
    suscripcion: suscripcionInicial,
    solicitud: solicitudId,
    cliente: clienteDeLaSolicitud,
    propiedad: propiedadDeLaSolicitud,
  } = useLocalSearchParams<{
    suscripcion?: string;
    solicitud?: string;
    cliente?: string;
    propiedad?: string;
  }>();

  // Hide the default Stack header — we render our own progress header.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [step, setStep] = useState<Step>(0);

  // Reference data
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null
  );
  /**
   * En cuál de sus propiedades.
   *
   * `Visita.propiedadId` es NOT NULL —una visita pasa en un lugar, y el lugar
   * es el que dice cuánto césped hay—, y esta pantalla no lo mandaba: agendar
   * desde el teléfono venía fallando con el error de validación del esquema,
   * que además no dice qué falta. Con una sola propiedad la elige sola, pero
   * eso no la exime de viajar.
   */
  const [selectedPropiedadId, setSelectedPropiedadId] = useState<string | null>(
    null
  );
  /**
   * De qué plan es la visita. `null` = trabajo aparte, se cobra en una orden.
   * El plan es de un jardín: elegirlo pone su propiedad, y cambiar de
   * propiedad suelta un plan que no sea de esa.
   */
  const [selectedSuscripcionId, setSelectedSuscripcionId] = useState<
    string | null
  >(null);
  /** Las tareas que esta visita va a exigir. Opcional: la mayoría no exige. */
  const [selectedProductoIds, setSelectedProductoIds] = useState<string[]>([]);
  // Precio de cada trabajo suelto elegido, por productoId.
  const [catalogo, setCatalogo] = useState<TareaDelCatalogo[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  /**
   * **Un cliente que ya está, o uno nuevo escrito acá mismo**, como en
   * Shopify: tener que ir a otra pantalla a darlo de alta y volver es lo que
   * hacía que una visita para alguien nuevo no se agendara en el momento. El
   * nuevo nace con la visita, en el servidor y en la misma transacción.
   */
  const [modoCliente, setModoCliente] = useState<"existente" | "nuevo">("existente");
  const [clienteNuevo, setClienteNuevo] = useState<DatosClienteNuevo>(CLIENTE_VACIO);
  /**
   * Lo mismo con el lugar: una propiedad nueva, escrita acá. Con un cliente
   * nuevo es la única opción —todavía no tiene ninguna—; con uno que ya está,
   * una más al pie de su lista.
   */
  const [propiedadNuevaActiva, setPropiedadNuevaActiva] = useState(false);
  const [propiedadNueva, setPropiedadNueva] = useState<DatosPropiedadNueva>(PROPIEDAD_VACIA);
  /** El pin que dejó en la solicitud, si la propiedad nueva sale de ahí. */
  const [puntoNuevo, setPuntoNuevo] = useState<{ lat: number; lng: number } | null>(null);
  const clienteEsNuevo = modoCliente === "nuevo";
  const propiedadEsNueva = clienteEsNuevo || propiedadNuevaActiva;

  // La solicitud de origen, para precargar lo que dejó: la de un invitado
  // arranca en *Cliente nuevo* con su nombre, teléfono y correo, y una con
  // otra dirección, en *Propiedad nueva* con esa dirección. Lo que ya se
  // escribió no se pisa. Se aplica en el `then`, cuando llega.
  useEffect(() => {
    if (!solicitudId) return;
    apiRequest<SolicitudItem>(`/api/mobile/solicitudes/${solicitudId}`)
      .then((sol) => {
        if (!sol.cliente) {
          setModoCliente("nuevo");
          setClienteNuevo((c) =>
            c.nombre || c.telefono || c.email
              ? c
              : {
                  nombre: sol.contacto.nombre === "Sin nombre" ? "" : sol.contacto.nombre,
                  apellido: "",
                  telefono: sol.contacto.telefono ?? "",
                  email: sol.contacto.email ?? "",
                }
          );
        }
        if (!sol.propiedad && sol.direccion) {
          const partes = sol.direccionPorPartes;
          setPropiedadNueva((p) =>
            p.direccion || p.numeroCasa || p.ciudad || p.referencia || p.nombre
              ? p
              : {
                  nombre: "",
                  direccion: partes?.calle ?? sol.direccion ?? "",
                  numeroCasa: partes?.numeroCasa ?? "",
                  ciudad: partes?.ciudad ?? "",
                  referencia: partes?.referencia ?? "",
                }
          );
          if (sol.lat !== null && sol.lng !== null) setPuntoNuevo({ lat: sol.lat, lng: sol.lng });
          // Con un cliente que ya está, la de la solicitud queda elegida: es
          // donde pidió el trabajo.
          setPropiedadNuevaActiva(true);
        }
      })
      .catch(() => {});
  }, [solicitudId]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<ClientesListResponse>("/api/mobile/clientes", {
        query: { limit: 500 },
      }).then((r) => {
        setClientes(r.items);
        // Con un plan preseleccionado, el cliente y la propiedad salen de él.
        const dueno = r.items.find((c) =>
          c.suscripciones.some((s) => s.id === suscripcionInicial)
        );
        const plan = dueno?.suscripciones.find((s) => s.id === suscripcionInicial);
        if (dueno && plan) {
          setSelectedClienteId(dueno.id);
          setSelectedPropiedadId(plan.propiedad.id);
          setSelectedSuscripcionId(plan.id);
        }
        const deLaSolicitud = r.items.find((c) => c.id === clienteDeLaSolicitud);
        if (deLaSolicitud) {
          setSelectedClienteId(deLaSolicitud.id);
          const suya = deLaSolicitud.propiedades.find(
            (p) => p.id === propiedadDeLaSolicitud
          );
          setSelectedPropiedadId(
            suya?.id ??
              (deLaSolicitud.propiedades.length === 1
                ? deLaSolicitud.propiedades[0].id
                : null)
          );
        }
      }),
      apiRequest<GruposListResponse>("/api/mobile/grupos").then((r) =>
        setGrupos(r.items)
      ),
      apiRequest<PersonalListResponse>("/api/mobile/personal").then((r) =>
        setPersonal(r.items)
      ),
      // El catálogo de tareas, para poder exigir alguna. Va completo: exigir
      // una tarea no depende de qué tenga contratado el cliente.
      apiRequest<{ items: TareaDelCatalogo[] }>("/api/mobile/tareas").then((r) =>
        setCatalogo(r.items)
      ),
    ])
      .catch(() => {})
      .finally(() => setLoadingRefs(false));
  }, [suscripcionInicial, clienteDeLaSolicitud, propiedadDeLaSolicitud]);

  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);

  const catalogoDisponible = catalogo;
  const selectedServicios = catalogoDisponible.filter((sv) =>
    selectedProductoIds.includes(sv.id)
  );

  const resumenTareasElegidos = selectedServicios.map((sv) => sv.nombre);

  function toggleServicio(sv: TareaDelCatalogo) {
    setSelectedProductoIds((prev) =>
      prev.includes(sv.id) ? prev.filter((x) => x !== sv.id) : [...prev, sv.id]
    );
  }
  const selectedPersonal = personal.filter((p) =>
    selectedPersonalIds.includes(p.id)
  );

  function canContinue(): boolean {
    if (step === 0) {
      return clienteEsNuevo ? clienteNuevo.nombre.trim().length > 0 : !!selectedClienteId;
    }
    // Una propiedad nueva puede ir vacía: nace como *Principal* (cliente
    // nuevo) o con la calle por nombre, y se completa después en su ficha.
    if (step === 1) return propiedadEsNueva || !!selectedPropiedadId;
    // Las tareas obligatorias son opcionales, como en el portal: una visita
    // sin ninguna exigida es la de todos los días, y lo que se hizo lo anota
    // cada uno en su parte.
    if (step === 2) return true;
    if (step === 3) return fechas.length > 0;
    if (step === 4) return true; // personal optional
    return true;
  }

  function next() {
    if (!canContinue()) return;
    setError(null);
    if (step < 5) setStep((step + 1) as Step);
  }

  function prev() {
    setError(null);
    if (step === 0) router.back();
    else setStep((step - 1) as Step);
  }

  async function submit() {
    setError(null);
    // Exigir tareas es opcional; lo que no puede faltar es una fecha.
    if (fechas.length === 0) return;
    setSubmitting(true);
    try {
      await apiRequest("/api/mobile/visitas", {
        method: "POST",
        body: {
          // Uno de los dos de cada par: el que ya está, o el escrito acá.
          ...(clienteEsNuevo
            ? {
                clienteNuevo: {
                  nombre: clienteNuevo.nombre.trim(),
                  apellido: limpio(clienteNuevo.apellido),
                  telefono: limpio(clienteNuevo.telefono),
                  email: limpio(clienteNuevo.email),
                },
              }
            : { clienteId: selectedClienteId }),
          ...(propiedadEsNueva
            ? {
                propiedadNueva: {
                  nombre: limpio(propiedadNueva.nombre),
                  direccion: limpio(propiedadNueva.direccion),
                  numeroCasa: limpio(propiedadNueva.numeroCasa),
                  ciudad: limpio(propiedadNueva.ciudad),
                  referencia: limpio(propiedadNueva.referencia),
                  lat: puntoNuevo?.lat,
                  lng: puntoNuevo?.lng,
                },
              }
            : { propiedadId: selectedPropiedadId }),
          // Un plan es de una propiedad que ya está.
          suscripcionId: propiedadEsNueva ? null : selectedSuscripcionId,
          tareasObligatoriasIds: selectedProductoIds,
          fechas,
          grupoId: grupoId || null,
          personalIds: selectedPersonalIds,
          notas: notas.trim() || null,
          solicitudId: solicitudId ?? null,
        },
      });
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos crear"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <View style={styles.flex}>
        {/* La acción del paso arriba, a la derecha del contador, y no en un
            botón al pie: es donde están *Crear* y *Guardar* en las demás
            pantallas, y donde queda fijo mientras el calendario scrollea. */}
        <EncabezadoDePasos
          paso={step}
          total={STEP_LABELS.length}
          onAtras={prev}
          accion={
            step < 5
              ? "Continuar"
              : fechas.length > 1
                ? `Crear ${fechas.length}`
                : "Crear"
          }
          onAccion={step < 5 ? next : submit}
          deshabilitado={step < 5 && !canContinue()}
          cargando={submitting}
        />

        {/* Content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <ClienteStep
              clientes={clientes}
              modo={modoCliente}
              onModo={(m) => {
                setModoCliente(m);
                setSelectedSuscripcionId(null);
              }}
              clienteNuevo={clienteNuevo}
              onCambiarClienteNuevo={(c) => setClienteNuevo((x) => ({ ...x, ...c }))}
              selectedId={selectedClienteId}
              onSelect={(id) => {
                setSelectedClienteId(id);
                setSelectedSuscripcionId(null);
                const c = clientes.find((x) => x.id === id);
                setSelectedPropiedadId(
                  c?.propiedades.length === 1 ? c.propiedades[0].id : null
                );
              }}
            />
          )}
          {step === 1 && (
            <PropiedadStep
              clienteNuevo={clienteEsNuevo ? clienteNuevo.nombre.trim() : null}
              nuevaActiva={propiedadEsNueva}
              onActivarNueva={() => {
                setPropiedadNuevaActiva(true);
                setSelectedSuscripcionId(null);
              }}
              propiedadNueva={propiedadNueva}
              onCambiarPropiedadNueva={(p) => setPropiedadNueva((x) => ({ ...x, ...p }))}
              cliente={clienteEsNuevo ? null : (selectedCliente ?? null)}
              propiedades={selectedCliente?.propiedades ?? []}
              selectedPropiedadId={selectedPropiedadId}
              onSelectPropiedad={(id) => {
                setSelectedPropiedadId(id);
                setPropiedadNuevaActiva(false);
                const plan = selectedCliente?.suscripciones.find(
                  (s) => s.id === selectedSuscripcionId
                );
                if (plan && plan.propiedad.id !== id) setSelectedSuscripcionId(null);
              }}
              planes={selectedCliente?.suscripciones ?? []}
              selectedSuscripcionId={selectedSuscripcionId}
              onSelectSuscripcion={(id) => {
                setSelectedSuscripcionId(id);
                const plan = selectedCliente?.suscripciones.find((s) => s.id === id);
                if (plan) {
                  setSelectedPropiedadId(plan.propiedad.id);
                  setPropiedadNuevaActiva(false);
                }
              }}
            />
          )}
          {step === 2 && (
            <ServicioStep
              loading={loadingRefs}
              catalogoDisponible={catalogoDisponible}
              selectedIds={selectedProductoIds}
              onToggle={toggleServicio}
            />
          )}
          {step === 3 && (
            <FechasStep
              fechas={fechas}
              onToggle={(iso) => {
                setFechas((prev) =>
                  prev.includes(iso)
                    ? prev.filter((d) => d !== iso)
                    : [...prev, iso].sort()
                );
              }}
              onClear={() => setFechas([])}
            />
          )}
          {step === 4 && (
            <PersonalStep
              grupos={grupos}
              personal={personal}
              selectedPersonalIds={selectedPersonalIds}
              onApplyGrupo={(id) => {
                setGrupoId(id);
                const g = grupos.find((x) => x.id === id);
                if (g) setSelectedPersonalIds(g.miembrosIds);
              }}
              onClearGrupo={() => {
                setGrupoId(null);
                setSelectedPersonalIds([]);
              }}
              onTogglePersonal={(id) =>
                setSelectedPersonalIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id]
                )
              }
            />
          )}
          {step === 5 && (
            <RevisarStep
              cliente={
                clienteEsNuevo
                  ? `Cliente nuevo: ${clienteNuevo.nombre.trim()}`
                  : selectedCliente
                    ? nombreCliente(selectedCliente)
                    : null
              }
              propiedad={
                propiedadEsNueva
                  ? `Propiedad nueva: ${
                      propiedadNueva.nombre.trim() ||
                      propiedadNueva.direccion.trim() ||
                      "Principal"
                    }`
                  : (selectedCliente?.propiedades.find(
                      (p) => p.id === selectedPropiedadId
                    )?.nombre ?? null)
              }
              servicio={resumenTareasElegidos}
              fechas={fechas}
              personal={selectedPersonal}
              notas={notas}
              onChangeNotas={setNotas}
            />
          )}



          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>

      </View>
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────
// Step 0 — Cliente
// ──────────────────────────────────────────────

function ClienteStep({
  clientes,
  modo,
  onModo,
  clienteNuevo,
  onCambiarClienteNuevo,
  selectedId,
  onSelect,
}: {
  clientes: ClienteListItem[];
  /** Elegir uno de la lista, o escribir uno nuevo acá mismo. */
  modo: "existente" | "nuevo";
  onModo: (m: "existente" | "nuevo") => void;
  clienteNuevo: DatosClienteNuevo;
  onCambiarClienteNuevo: (c: Partial<DatosClienteNuevo>) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes.slice(0, 12);
    return clientes
      .filter((c) =>
        `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, clientes]);

  if (modo === "nuevo") {
    return (
      <View>
        <Text variant="headlineSmall" style={styles.title}>
          Cliente nuevo
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Se crea su ficha junto con la visita
        </Text>
        <View style={styles.campos}>
          <TextInput
            mode="outlined"
            label="Nombre *"
            value={clienteNuevo.nombre}
            onChangeText={(t) => onCambiarClienteNuevo({ nombre: t })}
            autoCapitalize="words"
          />
          <TextInput
            mode="outlined"
            label="Apellido"
            value={clienteNuevo.apellido}
            onChangeText={(t) => onCambiarClienteNuevo({ apellido: t })}
            autoCapitalize="words"
          />
          <TextInput
            mode="outlined"
            label="Teléfono"
            value={clienteNuevo.telefono}
            onChangeText={(t) => onCambiarClienteNuevo({ telefono: t })}
            keyboardType="phone-pad"
          />
          <TextInput
            mode="outlined"
            label="Correo"
            value={clienteNuevo.email}
            onChangeText={(t) => onCambiarClienteNuevo({ email: t })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button mode="text" onPress={() => onModo("existente")} style={styles.volverALista}>
          Elegir un cliente
        </Button>
      </View>
    );
  }

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Para qué cliente?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Busca por nombre o teléfono
      </Text>

      <Searchbar
        placeholder="Buscar"
        value={query}
        onChangeText={setQuery}
        elevation={0}
        style={styles.searchbar}
        inputStyle={styles.searchbarInput}
      />

      <View style={styles.list}>
        {/* Arriba de la lista: si no está, se escribe acá sin salir. */}
        <Pressable onPress={() => onModo("nuevo")} style={[styles.row, styles.rowNueva]}>
          <View style={styles.rowText}>
            <Text variant="bodyLarge" style={styles.rowNuevaTexto}>
              + Cliente nuevo
            </Text>
          </View>
        </Pressable>
        {filtered.map((c) => {
          const selected = c.id === selectedId;
          // El inactivo se ve, atenuado y sin poder elegirse: saberlo ahí
          // mismo es mejor que no encontrarlo.
          const inactivo = c.inactivoDesde !== null;
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id)}
              disabled={inactivo}
              style={[styles.row, selected && styles.rowSelected, inactivo && styles.rowInactiva]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowTitle}>
                  {nombreCliente(c)}
                </Text>
                {inactivo || c.telefono || c.propiedades[0]?.sector?.nombre ? (
                  <Text variant="bodySmall" style={styles.muted}>
                    {[inactivo ? "Inactivo" : null, c.telefono, c.propiedades[0]?.sector?.nombre]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.empty}>Sin coincidencias.</Text>
        )}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 1 — Propiedad (y suscripción)
// ──────────────────────────────────────────────

/**
 * Dónde, en un paso propio. La mayoría tiene una sola propiedad y ya viene
 * marcada, así que este paso es un vistazo y *Continuar*; el que tiene dos
 * casas necesita decir en cuál, porque la dirección, el sector y los metros
 * son del lugar y no de la persona. Iba al pie de la lista de clientes, y con
 * cuarenta clientes quedaba fuera de la pantalla: se agendaba sin verla.
 */
function PropiedadStep({
  cliente,
  propiedades,
  selectedPropiedadId,
  onSelectPropiedad,
  planes,
  selectedSuscripcionId,
  onSelectSuscripcion,
  clienteNuevo,
  nuevaActiva,
  onActivarNueva,
  propiedadNueva,
  onCambiarPropiedadNueva,
}: {
  /** El nombre del cliente nuevo, si es uno nuevo: ahí solo hay propiedad nueva. */
  clienteNuevo: string | null;
  /** Si la visita va en una propiedad escrita acá. */
  nuevaActiva: boolean;
  onActivarNueva: () => void;
  propiedadNueva: DatosPropiedadNueva;
  onCambiarPropiedadNueva: (p: Partial<DatosPropiedadNueva>) => void;
  cliente: ClienteListItem | null;
  propiedades: PropiedadResumen[];
  selectedPropiedadId: string | null;
  onSelectPropiedad: (id: string) => void;
  /** Sus planes activos, para decir de cuál es la visita. */
  planes: PlanDelCliente[];
  selectedSuscripcionId: string | null;
  onSelectSuscripcion: (id: string | null) => void;
}) {
  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿En qué propiedad?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {cliente
          ? `Dónde va a ser la visita de ${nombreCliente(cliente)}`
          : "Dónde va a ser la visita"}
      </Text>

      {/* Un cliente nuevo todavía no tiene ninguna: la única es la nueva. */}
      {clienteNuevo !== null ? (
        <View style={styles.propiedades}>
          <CamposPropiedadNueva
            valor={propiedadNueva}
            onCambio={onCambiarPropiedadNueva}
            nombreSugerido="Principal"
          />
          <Text variant="bodySmall" style={styles.nota}>
            Si la dejas vacía, nace como «Principal» y la completas después en su ficha.
          </Text>
        </View>
      ) : null}

      {cliente ? (
        <View style={styles.propiedades}>
          {propiedades.length === 0 ? (
            <Text style={styles.empty}>
              Este cliente no tiene propiedades. Agrégale una nueva aquí abajo.
            </Text>
          ) : null}
          {propiedades.length > 0 ? (
            <View style={styles.list}>
              {propiedades.map((p) => {
                const elegida = !nuevaActiva && p.id === selectedPropiedadId;
                const donde = [p.direccion, p.numeroCasa, p.sector?.nombre]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => onSelectPropiedad(p.id)}
                    style={[styles.row, elegida && styles.rowSelected]}
                  >
                    <View style={styles.rowText}>
                      <Text variant="bodyLarge" style={styles.rowTitle}>
                        {p.nombre}
                      </Text>
                      {donde ? (
                        <Text variant="bodySmall" style={styles.muted}>
                          {donde}
                        </Text>
                      ) : null}
                    </View>
                    {elegida ? (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkIcon}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {/* Una más al pie: el trabajo es en un lugar que todavía no
              está en su ficha. */}
          <View style={[styles.list, styles.listaNueva]}>
            <Pressable
              onPress={onActivarNueva}
              style={[styles.row, nuevaActiva ? styles.rowSelected : styles.rowNueva]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowNuevaTexto}>
                  + Propiedad nueva
                </Text>
              </View>
              {nuevaActiva ? (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          {nuevaActiva ? (
            <View style={styles.camposNueva}>
              <CamposPropiedadNueva
                valor={propiedadNueva}
                onCambio={onCambiarPropiedadNueva}
                nombreSugerido="La calle, si lo dejas vacío"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* De qué plan es la visita: una decisión, de la visita entera. El plan
          es de un jardín, así que elegirlo pone la propiedad. "Sin
          suscripción" es trabajo aparte, que se cobra en una orden. */}
      {/* Un plan es de una propiedad que ya está: con una nueva no aplica. */}
      {cliente && !nuevaActiva && planes.length > 0 ? (
        <View style={styles.propiedades}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            ¿DE QUÉ SUSCRIPCIÓN?
          </Text>
          <View style={styles.list}>
            {[
              { id: null, titulo: "Sin suscripción", detalle: "Trabajo aparte, se cobra en un pedido" },
              ...planes.map((p) => ({
                id: p.id,
                titulo: `Suscripción #${p.numero}`,
                detalle: describirPlan(p),
              })),
            ].map((o) => {
              const elegida = o.id === selectedSuscripcionId;
              return (
                <Pressable
                  key={o.id ?? "ninguna"}
                  onPress={() => onSelectSuscripcion(o.id)}
                  style={[styles.row, elegida && styles.rowSelected]}
                >
                  <View style={styles.rowText}>
                    <Text variant="bodyLarge" style={styles.rowTitle}>
                      {o.titulo}
                    </Text>
                    <Text variant="bodySmall" style={styles.muted}>
                      {o.detalle}
                    </Text>
                  </View>
                  {elegida ? (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkIcon}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Los campos de una propiedad nueva, todos opcionales, como en su ficha. */
function CamposPropiedadNueva({
  valor,
  onCambio,
  nombreSugerido,
}: {
  valor: DatosPropiedadNueva;
  onCambio: (p: Partial<DatosPropiedadNueva>) => void;
  nombreSugerido: string;
}) {
  return (
    <View style={styles.campos}>
      <TextInput
        mode="outlined"
        label="Nombre"
        placeholder={nombreSugerido}
        value={valor.nombre}
        onChangeText={(t) => onCambio({ nombre: t })}
      />
      <TextInput
        mode="outlined"
        label="Calle"
        value={valor.direccion}
        onChangeText={(t) => onCambio({ direccion: t })}
      />
      <TextInput
        mode="outlined"
        label="Número de casa"
        value={valor.numeroCasa}
        onChangeText={(t) => onCambio({ numeroCasa: t })}
      />
      <SelectorDeCiudad valor={valor.ciudad} onCambio={(ciudad) => onCambio({ ciudad })} />
      <TextInput
        mode="outlined"
        label="Referencia"
        value={valor.referencia}
        onChangeText={(t) => onCambio({ referencia: t })}
      />
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 1 — Servicios
// ──────────────────────────────────────────────

function ServicioStep({
  loading,
  catalogoDisponible,
  selectedIds,
  onToggle,
}: {
  loading: boolean;
  catalogoDisponible: TareaDelCatalogo[];
  selectedIds: string[];
  onToggle: (sv: TareaDelCatalogo) => void;
}) {
  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        Tareas obligatorias
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Lo que esta visita tiene que dejar hecho. Es opcional: no frena nada,
        pero después se ve cuáles quedaron sin cubrir.
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : catalogoDisponible.length === 0 ? (
        <Text style={styles.empty}>No hay tareas en el catálogo.</Text>
      ) : (
        <View style={styles.list}>
          {catalogoDisponible.map((sv) => {
            const selected = selectedIds.includes(sv.id);
            return (
              <Pressable
                key={sv.id}
                onPress={() => onToggle(sv)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" style={styles.rowTitle}>
                    {sv.nombre}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 2 — Fechas
// ──────────────────────────────────────────────

function FechasStep({
  fechas,
  onToggle,
  onClear,
}: {
  fechas: string[];
  onToggle: (iso: string) => void;
  onClear: () => void;
}) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayMonthKey = today.slice(0, 7); // "YYYY-MM"
  const [visibleMonthKey, setVisibleMonthKey] = useState(todayMonthKey);

  const markedDates = useMemo(() => {
    const marks: Record<string, { selected: boolean; selectedColor: string }> =
      {};
    for (const d of fechas) {
      marks[d] = { selected: true, selectedColor: tema.verde };
    }
    return marks;
  }, [fechas]);

  const sortedFechas = useMemo(() => [...fechas].sort(), [fechas]);

  // Disable the back arrow when the user is on (or somehow before) today's
  // month so they can't navigate into the past.
  const cantGoBack = visibleMonthKey <= todayMonthKey;

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Qué fechas?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Toca los días que quieres programar
      </Text>

      <Calendar
        current={today}
        minDate={today}
        markedDates={markedDates}
        onDayPress={(d: DateData) => onToggle(d.dateString)}
        onMonthChange={(m) => setVisibleMonthKey(m.dateString.slice(0, 7))}
        firstDay={1}
        enableSwipeMonths={!cantGoBack ? true : true}
        disableArrowLeft={cantGoBack}
        theme={{
          backgroundColor: "#fff",
          calendarBackground: "#fff",
          textSectionTitleColor: "#888",
          selectedDayBackgroundColor: tema.verde,
          selectedDayTextColor: "#fff",
          todayTextColor: tema.verde,
          dayTextColor: "#111",
          textDisabledColor: "#ccc",
          monthTextColor: "#111",
          arrowColor: tema.verde,
          textMonthFontWeight: "600",
          textDayFontSize: 15,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      {sortedFechas.length > 0 ? (
        <View style={styles.fechasFooter}>
          <Text variant="bodySmall" style={styles.fechasCounter}>
            {sortedFechas.length} fecha
            {sortedFechas.length === 1 ? "" : "s"} seleccionada
            {sortedFechas.length === 1 ? "" : "s"}
          </Text>
          <Button
            mode="text"
            compact
            onPress={onClear}
            textColor="#b00020"
            labelStyle={styles.clearLabel}
          >
            Limpiar
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 3 — Personal
// ──────────────────────────────────────────────

function PersonalStep({
  grupos,
  personal,
  selectedPersonalIds,
  onApplyGrupo,
  onClearGrupo,
  onTogglePersonal,
}: {
  grupos: GrupoOption[];
  personal: PersonalOption[];
  selectedPersonalIds: string[];
  onApplyGrupo: (id: string) => void;
  onClearGrupo: () => void;
  onTogglePersonal: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  // Build a quick lookup so grupo rows can show member names
  const personalById = useMemo(() => {
    const map: Record<string, PersonalOption> = {};
    for (const p of personal) map[p.id] = p;
    return map;
  }, [personal]);

  function grupoSubtitle(g: GrupoOption): string {
    if (g.miembrosIds.length === 0) return "Sin miembros";
    const names = g.miembrosIds
      .map((id) => personalById[id]?.nombre)
      .filter((n): n is string => !!n);
    const preview = names.slice(0, 3).join(", ");
    const extra = names.length - 3;
    return extra > 0 ? `${preview} y ${extra} más` : preview;
  }

  const filteredPersonal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personal;
    return personal.filter((p) =>
      `${p.nombre} ${p.apellido ?? ""} ${p.tipo}`.toLowerCase().includes(q)
    );
  }, [query, personal]);

  const selectedSet = useMemo(
    () => new Set(selectedPersonalIds),
    [selectedPersonalIds]
  );
  const selectedFiltered = filteredPersonal.filter((p) => selectedSet.has(p.id));
  const availableFiltered = filteredPersonal.filter(
    (p) => !selectedSet.has(p.id)
  );

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Quién va?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Selecciona personal o un grupo (opcional)
      </Text>

      {grupos.length > 0 ? (
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            Asignación rápida
          </Text>
          <View style={styles.list}>
            <Pressable
              onPress={onClearGrupo}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowTitle}>
                  Sin miembros
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  Quitar todos los seleccionados
                </Text>
              </View>
            </Pressable>
            {grupos.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => onApplyGrupo(g.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" style={styles.rowTitle}>
                    {g.nombre}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={styles.muted}
                    numberOfLines={2}
                  >
                    {grupoSubtitle(g)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.sectionLabel}>
          Miembros ({selectedPersonalIds.length})
        </Text>
        {personal.length === 0 ? (
          <Text style={styles.empty}>No hay personal activo.</Text>
        ) : (
          <>
            <Searchbar
              placeholder="Buscar miembro"
              value={query}
              onChangeText={setQuery}
              elevation={0}
              style={styles.searchbar}
              inputStyle={styles.searchbarInput}
            />

            {selectedFiltered.length > 0 ? (
              <>
                <Text variant="labelSmall" style={styles.miniLabel}>
                  Seleccionados
                </Text>
                {selectedFiltered.map((p) => (
                  <PersonalRow
                    key={p.id}
                    personal={p}
                    checked
                    onToggle={() => onTogglePersonal(p.id)}
                  />
                ))}
              </>
            ) : null}

            {availableFiltered.length > 0 ? (
              <>
                {selectedFiltered.length > 0 ? (
                  <Text variant="labelSmall" style={styles.miniLabel}>
                    Disponibles
                  </Text>
                ) : null}
                {availableFiltered.map((p) => (
                  <PersonalRow
                    key={p.id}
                    personal={p}
                    checked={false}
                    onToggle={() => onTogglePersonal(p.id)}
                  />
                ))}
              </>
            ) : null}

            {filteredPersonal.length === 0 ? (
              <Text style={styles.empty}>Sin coincidencias.</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function PersonalRow({
  personal: p,
  checked,
  onToggle,
}: {
  personal: PersonalOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        checked && styles.rowSelected,
        pressed && !checked && styles.rowPressed,
      ]}
      onPress={onToggle}
    >
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle}>
          {`${p.nombre} ${p.apellido ?? ""}`.trim()}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {p.tipo}
        </Text>
      </View>
      <Conmutador value={checked} onValueChange={onToggle} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Step 4 — Revisar (notas + summary)
// ──────────────────────────────────────────────

function RevisarStep({
  cliente,
  propiedad,
  servicio,
  fechas,
  personal,
  notas,
  onChangeNotas,
}: {
  /** Ya resuelto: el del que se eligió, o "Cliente nuevo: …". */
  cliente: string | null;
  propiedad: string | null;
  /** Líneas ya formateadas: "Nombre · $ 00.00". */
  servicio: string[];
  fechas: string[];
  personal: PersonalOption[];
  notas: string;
  onChangeNotas: (s: string) => void;
}) {
  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        Revisar y crear
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Confirma los detalles antes de crear
      </Text>

      <View style={styles.summaryBox}>
        <SummaryRow
          label="Cliente"
          value={cliente ?? "—"}
        />
        <SummaryRow label="Propiedad" value={propiedad ?? "—"} />
        <SummaryRow
          label="Tareas obligatorias"
          value={servicio.length > 0 ? servicio.join("\n") : "Ninguna"}
        />
        <SummaryRow
          label="Fechas"
          value={
            fechas.length === 0
              ? "—"
              : fechas
                  .map((iso) =>
                    new Date(iso + "T00:00:00").toLocaleDateString("es-EC", {
                      day: "numeric",
                      month: "short",
                    })
                  )
                  .join(", ")
          }
        />
        <SummaryRow label="Personal" isLast>
          {personal.length === 0 ? (
            <Text variant="bodyMedium" style={styles.summaryValue}>
              Sin asignar
            </Text>
          ) : (
            <View style={styles.personalList}>
              {personal.map((p) => (
                <View key={p.id} style={styles.personalRow}>
                  <Text variant="bodyMedium" style={styles.personalName}>
                    {`${p.nombre} ${p.apellido ?? ""}`.trim()}
                  </Text>
                  <Text variant="bodySmall" style={styles.personalTipo}>
                    {p.tipo}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </SummaryRow>
      </View>

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.sectionLabel}>
          NOTAS
        </Text>
        <TextInput
          mode="outlined"
          label="Notas (opcional)"
          value={notas}
          onChangeText={onChangeNotas}
          multiline
          numberOfLines={4}
          outlineColor="#e0e0e0"
          activeOutlineColor={tema.verde}
          outlineStyle={styles.notasOutline}
          style={styles.notasField}
          contentStyle={styles.notasContent}
        />
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  children,
  isLast,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text variant="labelMedium" style={styles.summaryLabel}>
        {label}
      </Text>
      {children ?? (
        <Text variant="bodyMedium" style={styles.summaryValue}>
          {value}
        </Text>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },


  content: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    color: "#777",
    marginBottom: 16,
  },

  propiedades: { marginTop: 24, gap: 6 },
  /** *+ Cliente nuevo* / *+ Propiedad nueva*: punteadas, para que se lean
   *  como "agregar" y no como una más de la lista. */
  rowNueva: { borderWidth: 1, borderStyle: "dashed", borderColor: tema.verde },
  rowNuevaTexto: { color: tema.verde700, fontWeight: "600" },
  listaNueva: { marginTop: 6 },
  camposNueva: { marginTop: 12 },
  campos: { gap: 10, marginTop: 8 },
  nota: { color: tema.texto3, marginTop: 10 },
  volverALista: { alignSelf: "flex-start", marginTop: 12 },

  searchbar: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    marginBottom: 16,
  },
  searchbarInput: { fontSize: 15 },

  list: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  rowSelected: {
    backgroundColor: "#e8f5e9",
  },
  rowInactiva: { opacity: 0.45 },
  groupLabel: {
    color: "#888",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  groupHint: {
    color: "#888",
    marginBottom: 8,
  },
  precioSuelto: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#e8f5e9",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  nuevoInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  rowPressed: {
    backgroundColor: "#eaeaea",
  },
  rowText: { flex: 1 },
  rowTitle: { color: "#111" },

  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  checkmarkIcon: { color: "#fff", fontWeight: "700", fontSize: 14 },

  empty: {
    color: "#999",
    paddingVertical: 16,
    textAlign: "center",
  },
  muted: { color: "#888", marginTop: 2 },

  calendar: {
    borderRadius: 12,
    overflow: "hidden",
  },
  fechasFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  fechasCounter: {
    color: "#888",
  },
  clearLabel: {
    fontSize: 13,
    fontWeight: "500",
  },

  section: { marginTop: 12, gap: 8 },
  sectionLabel: {
    color: "#888",
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  miniLabel: {
    color: "#999",
    marginTop: 8,
    marginBottom: 2,
    paddingLeft: 4,
  },


  summaryBox: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaeaea",
    gap: 4,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { color: "#888" },
  summaryValue: { color: "#111" },

  personalList: {
    gap: 6,
    marginTop: 4,
  },
  personalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  personalName: { color: "#111" },
  personalTipo: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  notasField: {
    minHeight: 110,
    backgroundColor: "#fff",
  },
  notasOutline: { borderRadius: 12 },
  notasContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },

  error: { textAlign: "center", marginTop: 16 },

});
