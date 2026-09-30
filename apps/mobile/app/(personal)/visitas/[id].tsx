import React, { useCallback, useEffect, useRef, useState } from "react";
import { estadoLabel, estadoParaMi } from "@/lib/estado-visita";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
} from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  MOTIVO_NOVEDAD_LABEL,
  fechaSola,
  medidasDePropiedad,
  nombreCliente,
  visitaCerrada,
  type MotivoNovedad,
} from "@vivero/shared";
import { HojaNovedad, type DatosDeNovedad } from "@/components/HojaNovedad";
import { apiRequest, mensajeDeError } from "@/lib/api";
import {
  guardarTareas,
  guardarVisita,
  leerTareas,
  leerVisita,
} from "@/lib/cache-de-visitas";
import {
  ArchivosVisita,
  useCambiosDeArchivos,
} from "@/components/ArchivosVisita";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";
import type { VisitaDetail } from "@/lib/types";
import { tareasHechas } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { BotonRedondoDeHoja } from "@/components/ui/CabeceraDeHoja";
import { Conectando } from "@/components/ui/Conectando";
import { AvisoDeCarga } from "@/components/ui/AvisoDeCarga";
import { onHecho, trabajosDe, useColaDeVisitas } from "@/lib/cola-de-visitas";
import { aplicarCola } from "@/lib/visita-con-cola";
import { UbicacionPropiedad } from "@/components/UbicacionPropiedad";
import { tema } from "@/lib/tema";
import { diaEnEcuador, fechaYHora12, hoyEnEcuador } from "@/lib/hora";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { avisarFaltaUbicacion, ubicacionActual } from "@/lib/ubicacion";
import { dispositivoId } from "@/lib/dispositivo";
import * as Haptics from "expo-haptics";

/**
 * Si la visita es de hoy, comparando por día y no por instante.
 *
 * `fechaProgramada` es `@db.Date` y llega como medianoche **UTC**, así que su
 * ISO recortado es el día guardado. Del otro lado va el día en **Ecuador**, que
 * es con el que el servidor decide (`ensureEsElDiaDeLaVisita`): con el día del
 * teléfono habría botones que esta pantalla ofrece y el servidor rechaza.
 */
function mismoDiaQueHoy(fechaProgramada: string): boolean {
  return fechaProgramada.slice(0, 10) === hoyEnEcuador();
}

export default function PersonalVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmandoEntrada, setConfirmandoEntrada] = useState(false);
  const [marcando, setMarcando] = useState(false);
  /** La hoja de "no pude hacer la visita". */
  const [reportando, setReportando] = useState(false);
  const [enviandoNovedad, setEnviandoNovedad] = useState(false);
  const personalId = useAuthStore((s) => s.user?.personalId ?? null);
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [catalogo, setCatalogo] = useState<TareaDeCatalogo[]>([]);
  /** Lo que se hizo en esta visita y todavía no llegó al servidor. */
  const cola = useColaDeVisitas((s) => s.items);
  const hidratarCola = useColaDeVisitas((s) => s.hidratar);
  const encolar = useColaDeVisitas((s) => s.encolar);
  const reintentar = useColaDeVisitas((s) => s.reintentar);
  const descartar = useColaDeVisitas((s) => s.descartar);
  useEffect(() => {
    hidratarCola();
  }, [hidratarCola]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Lo que tiró la carga, tal cual: la pantalla dice si fue acceso, borrado o señal. */
  const [fallaDeCarga, setFallaDeCarga] = useState<unknown>(null);
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({});
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(null);

  useEffect(() => {
    if (!visita) return;
    const videos = visita.media.filter((m) => m.tipo === "video");
    let cancelled = false;
    videos.forEach(async (m) => {
      if (videoThumbs[m.id]) return;
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(m.url, {
          time: 1000,
          quality: 0.6,
        });
        if (!cancelled) {
          setVideoThumbs((prev) => ({ ...prev, [m.id]: uri }));
        }
      } catch {
        // Leave fallback placeholder.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visita, videoThumbs]);

  /**
   * Cargar la ficha: la copia local primero, si la hay, y el servidor detrás.
   * Sin señal se queda la copia —se puede mirar dónde es, qué hay que hacer,
   * a qué hora— con el aviso de que es lo último guardado; sin copia, el
   * error de siempre. Al volver a la pantalla no vuelve el spinner: ya hay
   * algo que mostrar, y lo nuevo lo reemplaza cuando llega.
   */
  const load = useCallback(async () => {
    if (!id) return;
    const [copia, tareasGuardadas] = await Promise.all([leerVisita(id), leerTareas()]);
    if (copia) {
      setVisita((actual) => actual ?? copia);
      setLoading(false);
    }
    if (tareasGuardadas) {
      setCatalogo((actual) => (actual.length > 0 ? actual : tareasGuardadas));
    }
    try {
      // El catálogo entero viene con la visita: la etiqueta de una foto puede
      // ser **cualquier** tarea viva, no solo las que uno marcó. En el campo se
      // fotografía lo que aparece.
      const [v, t] = await Promise.all([
        apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`),
        apiRequest<{ items: TareaDeCatalogo[] }>("/api/mobile/tareas").catch(
          () => ({ items: [] as TareaDeCatalogo[] })
        ),
      ]);
      setVisita(v);
      if (t.items.length > 0) setCatalogo(t.items);
      guardarVisita(v);
      guardarTareas(t.items);
    } catch (e) {
      // Con copia, la ficha se queda y el "Conectando…" de arriba dice lo
      // que pasa; sin copia, el error de siempre.
      if (!copia) setFallaDeCarga(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Un trabajo de la cola que llegó: la visita como quedó, sin esperar a
  // volver a la pantalla. Es lo que hace que el ✓ de "esperando señal" se vaya.
  useEffect(
    () =>
      onHecho((visitaId, v) => {
        if (visitaId !== id) return;
        if (v) {
          setVisita(v);
          guardarVisita(v);
        } else {
          load();
        }
      }),
    [id, load]
  );

  /**
   * Las fotos sin guardar viven acá arriba, no adentro de la lista: sus botones
   * de *Guardar* y *Cancelar* son el encabezado de esta pantalla, que es lo
   * único que no se va scrolleando.
   */
  const cambios = useCambiosDeArchivos(id ?? "", load);

  /*
   * Guardar está en el encabezado, arriba de todo, y los archivos suelen
   * quedar fuera de la pantalla: apretar Guardar sin etiquetar una foto
   * mostraba el error donde nadie lo veía, así que parecía que el botón no
   * hacía nada. La pantalla lleva el ojo hasta ahí.
   */
  const scroll = useRef<ScrollView>(null);
  const yArchivos = useRef(0);

  useEffect(() => {
    if (!cambios.errorEn) return;
    // Un poco antes del rótulo, para que se vea que la sección empieza ahí.
    scroll.current?.scrollTo({ y: Math.max(yArchivos.current - 24, 0), animated: true });
  }, [cambios.errorEn]);


  // Al volver de cargar el parte, se recarga para mostrarlo.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!visita) {
    return (
      <AvisoDeCarga
        error={fallaDeCarga}
        tipo="visita"
        onVolver={() => router.back()}
        onReintentar={load}
      />
    );
  }

  // La visita con lo que espera en la cola puesto encima: la entrada que se
  // marcó sin señal ya se ve marcada, y el botón ya ofrece la salida.
  const {
    visita: vista,
    entradaEnCola,
    salidaEnCola,
    novedadEnCola,
    archivosEnCola,
  } = aplicarCola(visita, personalId, trabajosDe(cola, visita.id), catalogo);

  // Una cancelada o una no realizada es de solo lectura: en ninguna de las dos
  // hubo trabajo que cargar. En cualquier otra se puede cargar el parte propio.
  // **No se cierra desde acá**: decir que el trabajo está terminado es mirar
  // lo que cargaron todos, y eso se hace desde el portal.
  const canAct =
    vista.estado !== "CANCELADA" && vista.estado !== "NO_REALIZADA";
  /**
   * El botón dice el próximo paso, no lo que la pantalla hace.
   *
   * Decía "Cargar lo que hice" desde antes de que la entrada y la salida se
   * marcaran con un botón. Ahora hay tres momentos y cada uno pide algo
   * distinto: llegar, irse, y corregir después.
   */
  const mio = (vista.personal ?? []).find((p) => p.personalId === personalId);

  /**
   * Marcar entrada solo el día de la visita.
   *
   * El servidor no lo exige —una visita del mes pasado se puede cargar, que es
   * cuando hace falta— pero la app no tiene por qué ofrecerlo: marcar la
   * entrada de mañana no significa nada, y la de la semana pasada es fechar
   * hacia atrás algo que dice "estuve acá a esta hora". Si de verdad hay que
   * arreglar una vieja, lo hace la oficina corrigiendo el instante.
   *
   * **La salida no lleva esta regla.** Quien entró sigue pudiendo salir aunque
   * el día haya cambiado: un turno que cruza la medianoche termina en una fecha
   * distinta a la de la visita, y esconderle el botón lo dejaría adentro.
   */
  const esDeHoy = mismoDiaQueHoy(vista.fechaProgramada);
  /**
   * Corregir las tareas dura el día de la visita —o el día en que marcó su
   * salida, que es el mismo turno cuando cruza la medianoche—. Después, lo
   * único que sigue abierto son las fotos: son de lo que se vio en el jardín, y
   * subir una el martes no cambia lo que se hizo el lunes. El servicio lo
   * rechaza igual (`ensureSePuedeCorregir`); acá el botón no se ofrece.
   */
  const puedeCorregir =
    esDeHoy || (mio?.salidaEl ? diaEnEcuador(mio.salidaEl) === hoyEnEcuador() : false);
  /**
   * Lo que reportó quien mira, si reportó. Con eso no hay nada más que hacer
   * acá: la visita queda en manos de un administrador. Si había marcado
   * entrada, la novedad le cerró las horas, y "Editar tareas" ofrecería
   * corregir un trabajo que no hubo.
   */
  const miNovedad = (vista.novedades ?? []).find(
    (n) => n.personalId === personalId
  );
  const accion = !mio || miNovedad
    ? null
    : !mio.entradaEl
      ? esDeHoy
        ? "Marcar entrada"
        : null
      : !mio.salidaEl
        ? "Marcar salida"
        : puedeCorregir
          ? "Editar tareas"
          : null;
  /**
   * "No pude hacer la visita" se ofrece el día de la visita, mientras no se
   * haya marcado la salida —después la visita ya se hizo— y una sola vez. Es
   * secundario a propósito: lo normal es marcar entrada, y el reporte es la
   * excepción de la vereda.
   */
  const puedeReportar =
    Boolean(mio) &&
    esDeHoy &&
    !mio?.salidaEl &&
    !miNovedad &&
    !visitaCerrada(vista.estado);
  /**
   * Marcar entrada, desde la ficha.
   *
   * Era una pantalla completa con un título, un renglón y un botón. Una
   * pantalla es para algo que se llena; esto es una decisión de sí o no.
   *
   * **Va a la cola, no al servidor.** La hora es la de este momento, según el
   * teléfono; con señal sale en el acto y sin señal espera con su ✓. La
   * pantalla la muestra marcada desde ya (`aplicarCola`).
   */
  async function marcarEntrada() {
    setMarcando(true);
    try {
      // Sin permiso no se marca. Es lo único de todo esto que la persona
      // decide, así que es lo único que tiene sentido exigir; sin señal sí se
      // marca — ver `ubicacionActual`.
      const donde = await ubicacionActual();
      if (donde.estado === "sin-permiso") {
        setMarcando(false);
        setConfirmandoEntrada(false);
        avisarFaltaUbicacion("Para marcar tu entrada necesitamos saber dónde estás.", donde);
        return;
      }

      encolar({
        tipo: "ENTRADA",
        visitaId: visita!.id,
        marcadaEl: new Date().toISOString(),
        ubicacion: donde.estado === "ok" ? donde.ubicacion : null,
        dispositivo: await dispositivoId(),
      });
      // En el mismo momento que el dato queda anotado, no cuando termina de
      // dibujarse: una háptica que llega tarde se lee como una falla.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmandoEntrada(false);
      // Sin señal de GPS se marcó igual, pero se avisa: quien marcó es el
      // único que puede salir al patio y volver a intentarlo la próxima.
      if (donde.estado === "sin-senal") {
        Alert.alert(
          "Entrada marcada",
          "No pudimos obtener tu ubicación, así que quedó registrada sin ella."
        );
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(mensajeDeError(e, "No pudimos marcar"));
      setConfirmandoEntrada(false);
    } finally {
      setMarcando(false);
    }
  }

  /**
   * Reportar que no se pudo hacer la visita. **Va a la cola, como una marca**:
   * la hora es la de este momento, la ubicación se pide igual que para la
   * entrada —es lo que respalda el "estuve acá"—, y sin señal espera con su ✓.
   * La pantalla la muestra reportada desde ya (`aplicarCola`).
   */
  async function reportarNovedad(datos: DatosDeNovedad) {
    setEnviandoNovedad(true);
    try {
      const donde = await ubicacionActual();
      if (donde.estado === "sin-permiso") {
        setEnviandoNovedad(false);
        setReportando(false);
        avisarFaltaUbicacion(
          "Para reportar que no pudiste hacer la visita necesitamos saber dónde estás.",
          donde
        );
        return;
      }

      encolar({
        tipo: "NOVEDAD",
        visitaId: visita!.id,
        marcadaEl: new Date().toISOString(),
        ubicacion: donde.estado === "ok" ? donde.ubicacion : null,
        dispositivo: await dispositivoId(),
        motivo: datos.motivo,
        nota: datos.nota,
        fotos: datos.fotos,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReportando(false);
      if (donde.estado === "sin-senal") {
        Alert.alert(
          "Novedad reportada",
          "No pudimos obtener tu ubicación, así que quedó registrada sin ella."
        );
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(mensajeDeError(e, "No pudimos reportar"));
      setReportando(false);
    } finally {
      setEnviandoNovedad(false);
    }
  }

  const cliente = vista.cliente;
  const personalAsignado = vista.personal ?? [];
  const medidas = medidasDePropiedad(vista.propiedad);
  const { obligatorias, extras } = armarFilasDeTareas(visita, personalId);

  return (
    <View style={styles.container}>
      {/* La flecha a la izquierda del nombre, y **fija**: adentro del scroll
          se iba pasando por debajo de la hora y la señal, que están encima de
          todo, y con ella se iba el modo de volver. Debajo va la tarjeta de
          datos, sin nada en el medio: las tareas, que estaban acá en una línea
          recortada, tienen su propia sección más abajo. */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
        {cambios.hayCambios ? (
          /* Con fotos sin guardar, el encabezado **es** la confirmación: es lo
             único que queda fijo mientras se scrollea, y una confirmación que
             hay que ir a buscar es una que se pierde. Se lleva puesta la
             flecha de volver, a propósito: para salir hay que decidir antes. */
          <>
            <PressableScale
              onPress={cambios.cancelar}
              disabled={cambios.guardando}
              hitSlop={8}
              style={styles.encabezadoBoton}
              estiloPresionado={styles.encabezadoBotonTocado}
            >
              <Text style={styles.encabezadoCancelar}>Cancelar</Text>
            </PressableScale>
            <View style={styles.encabezadoTexto} />
            <PressableScale
              onPress={cambios.guardar}
              disabled={cambios.guardando}
              hitSlop={8}
              style={styles.encabezadoBoton}
              estiloPresionado={styles.encabezadoBotonTocado}
            >
              {cambios.guardando ? (
                <ActivityIndicator size="small" color={tema.verde} />
              ) : (
                <Text style={styles.encabezadoGuardar}>Guardar</Text>
              )}
            </PressableScale>
          </>
        ) : (
          <>
            <BotonRedondoDeHoja
              icono="chevron-back"
              etiqueta="Volver"
              onPress={() => router.back()}
            />
            <View style={styles.encabezadoTexto}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {nombreCliente(cliente)}
              </Text>
            </View>
          </>
        )}
      </View>

      <Conectando />
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
        {/* Sin rótulo: "CUÁNDO" arriba de Estado y Programada no agregaba
            nada que las propias filas no dijeran, y gastaba la línea que
            separa el nombre del cliente de sus datos. */}
        <Section>
          {/* El número corto, que es como se nombra la visita en voz alta y
              por teléfono. El cuid de la URL no se dicta. */}
          <Row label="Visita" value={`#${vista.numero}`} />
          {/* El suyo: quien ya marcó su salida ve Completada aunque la visita
              siga En curso esperando el parte de otro. Ver `estadoParaMi`. */}
          {/* Sobre `vista`, con la cola puesta encima: la entrada o la novedad
              que esperan señal ya cuentan como marcadas. */}
          <Row
            label="Estado"
            value={estadoLabel(estadoParaMi(vista, personalId))}
          />
          {/* "Fecha" y no "Programada": arriba dice Estado: Programada, y la
              misma palabra dos veces seguidas parecía un error. */}
          <Row label="Fecha" value={formatDate(vista.fechaProgramada)} />
          {vista.fechaRealizada ? (
            <Row
              label="Realizada"
              value={formatDate(vista.fechaRealizada)}
            />
          ) : null}
          {/* Con fecha, no solo la hora: "5:26 PM" se lee igual si se marcó
              el día de la visita o tres días después, y esa diferencia es
              justo la que hay que poder ver. El instante lo sella el servidor
              al apretar el botón, así que dice la verdad de cuándo se marcó
              —no de cuándo se estuvo—. Sin rótulo "Hora de": la fila dice
              cuándo, que es lo único que una entrada puede decir. */}
          {primeraMarca(visita, "entradaEl") ? (
            <Row
              label="Entrada"
              value={fechaYHora12(primeraMarca(visita, "entradaEl")!)}
            />
          ) : null}
          {ultimaMarca(visita, "salidaEl") ? (
            <Row
              label="Salida"
              value={fechaYHora12(ultimaMarca(visita, "salidaEl")!)}
            />
          ) : null}
        </Section>

        {/* Lo que se reportó desde el jardín: "llegué y no pude". Arriba de
            las tareas, porque mientras esté sin resolver es lo que pasa con
            esta visita; y cerrada, es la historia de por qué no se hizo. */}
        {(vista.novedades ?? []).length > 0 ? (
          <Section title="Novedad">
            {(vista.novedades ?? []).map((n) => {
              // La que todavía espera en la cola: su estado va acá, pegado a
              // lo que se cargó, y no en una línea suelta al pie. Un ✓ mientras
              // espera señal; el motivo y qué hacer si el servidor la rechazó.
              const enCola =
                novedadEnCola && n.id === novedadEnCola.id ? novedadEnCola : null;
              return (
              <View key={n.id} style={styles.novedad}>
                {/* El motivo en una línea y la nota en otra: son dos cosas,
                    lo que se eligió y lo que se escribió. */}
                <Text variant="bodyMedium" style={styles.novedadMotivo}>
                  {MOTIVO_NOVEDAD_LABEL[n.motivo as MotivoNovedad] ?? n.motivo}
                </Text>
                {n.nota ? (
                  <Text variant="bodyMedium" style={styles.novedadNota}>
                    {n.nota}
                  </Text>
                ) : null}
                <Text variant="bodySmall" style={styles.novedadQuien}>
                  {n.personalId === personalId
                    ? "Reportaste"
                    : `${n.personalNombre.split(" ")[0]} reportó`}{" "}
                  {fechaYHora12(n.marcadaEl)}
                </Text>
                {enCola?.estado === "pendiente" ? (
                  <View style={styles.novedadEspera}>
                    <Ionicons name="checkmark" size={14} color={tema.texto3} />
                    <Text style={styles.novedadPendiente}>Se envía cuando haya señal</Text>
                  </View>
                ) : null}
                {enCola?.estado === "fallido" ? (
                  <>
                    <Text style={styles.novedadFallo}>
                      Rechazada: {enCola.error ?? "no se pudo guardar"}
                    </Text>
                    <View style={styles.novedadAcciones}>
                      <PressableScale onPress={() => reintentar(enCola.id)} hitSlop={8}>
                        <Text style={styles.novedadAccion}>Reintentar</Text>
                      </PressableScale>
                      <PressableScale onPress={() => descartar(enCola.id)} hitSlop={8}>
                        <Text style={styles.novedadAccion}>Descartar</Text>
                      </PressableScale>
                    </View>
                  </>
                ) : null}
                {/* Las fotos en fila debajo, como los adjuntos de un mensaje. */}
                {(n.fotos ?? []).length > 0 ? (
                  <View style={styles.novedadFotos}>
                    {(n.fotos ?? []).map((f) => (
                      <PressableScale
                        key={f.id}
                        onPress={() => setActiveMedia({ url: f.url, tipo: "imagen" })}
                        style={styles.novedadFoto}
                      >
                        <Image source={{ uri: f.url }} style={styles.novedadFotoImagen} />
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
              </View>
              );
            })}
          </Section>
        ) : null}

        {/* Lo que la visita exigía. Acá no se tilda nada: se marca al
            registrar la salida, y lo que esta lista responde es qué falta. */}
        {obligatorias.length > 0 ? (
          <Section title="Tareas obligatorias">
            {obligatorias.map((f) => (
              <FilaTarea key={f.id} fila={f} />
            ))}
          </Section>
        ) : null}

        {/* Lo que se hizo sin que nadie lo pidiera. Cuando la visita no exigía
            ninguna no son "otras" de nada, así que ahí son las tareas a secas. */}
        {extras.length > 0 ? (
          <Section
            title={obligatorias.length > 0 ? "Otras tareas" : "Tareas"}
          >
            {extras.map((f) => (
              <FilaTarea key={f.id} fila={f} />
            ))}
          </Section>
        ) : null}

        {obligatorias.length === 0 && extras.length === 0 ? (
          <Section title="Tareas">
            <Text variant="bodySmall" style={styles.tareasVacio}>
              Marca tus tareas al marcar la salida.
            </Text>
          </Section>
        ) : null}

        {/* Dónde es. La dirección es de la **propiedad** de esta visita —un
            cliente puede tener más de una— y arriba de todo lo demás porque es
            lo primero que se necesita: llegar. */}
        <View style={styles.seccionUbicacion}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            UBICACIÓN
          </Text>
          <UbicacionPropiedad propiedad={vista.propiedad} />
        </View>

        {/* Lo que hay que mantener ahí. Solo lo que alguien midió: se va
            completando con el tiempo y una fila con un guión no informa. */}
        {medidas.length > 0 || vista.propiedad.referencia ? (
          <Section title="Propiedad">
            {vista.propiedad.nombre ? (
              <Row label="Nombre" value={vista.propiedad.nombre} />
            ) : null}
            {vista.propiedad.referencia ? (
              <Row label="Referencia" value={vista.propiedad.referencia} />
            ) : null}
            {medidas.map((m) => (
              <Row key={m.etiqueta} label={m.etiqueta} value={m.valor} />
            ))}
          </Section>
        ) : null}

        {/* Cliente */}
        {cliente.telefono ? (
          <Section title="Cliente">
            <Row label="Teléfono" value={cliente.telefono} />
          </Section>
        ) : null}

        {/* Personal */}
        {personalAsignado.length > 0 ? (
          <Section title="Personal asignado">
            {personalAsignado.map((p) => (
              <View key={p.personalId} style={styles.personRow}>
                <Text variant="bodyMedium" style={styles.personName}>
                  {`${p.personal.nombre} ${p.personal.apellido ?? ""}`.trim()}
                </Text>
                {p.personal.tipo ? (
                  <Text variant="bodySmall" style={styles.personTipo}>
                    {tipoLabel(p.personal.tipo)}
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* Notas */}
        {vista.notas || vista.notasIncompleto || vista.motivoNoRealizada ? (
          <Section
            title={
              vista.estado === "INCOMPLETA" ||
              vista.estado === "NO_REALIZADA" ||
              vista.estado === "CANCELADA"
                ? "Motivo"
                : "Notas"
            }
          >
            {vista.estado === "NO_REALIZADA" && vista.motivoNoRealizada ? (
              <View style={styles.motivoBloque}>
                <Text variant="bodyMedium" style={styles.novedadMotivo}>
                  {MOTIVO_NOVEDAD_LABEL[vista.motivoNoRealizada as MotivoNovedad] ??
                    vista.motivoNoRealizada}
                </Text>
                {vista.notasIncompleto ? (
                  <Text variant="bodyMedium" style={styles.novedadNota}>
                    {vista.notasIncompleto}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="bodyMedium" style={styles.notasText}>
                {vista.notasIncompleto || vista.notas}
              </Text>
            )}
          </Section>
        ) : null}

        {/* Los archivos son de la visita, no de un formulario: se suben en
            cualquier momento y en cualquier estado, porque la foto se saca
            mientras se trabaja. Estaban dentro del formulario de salida, donde
            llegaban tarde. */}
        {canAct ? (
          <View
            style={styles.mediaSection}
            onLayout={(e) => {
              yArchivos.current = e.nativeEvent.layout.y;
            }}
          >
            {/* El rótulo lo pone el propio componente: cuando hay fotos
                marcadas para eliminar, esa línea se convierte en la barra de
                Cancelar / Eliminar. */}
            <ArchivosVisita
              archivos={vista.media ?? []}
              enCola={archivosEnCola}
              catalogo={catalogo}
              cambios={cambios}
              onVer={setActiveMedia}
              onReintentar={reintentar}
              onDescartar={descartar}
            />
          </View>
        ) : null}

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

      {/* Sticky actions. Solo cuando hay algo que poner: con una novedad
          reportada, o fuera del día de la visita sin nada que marcar, la
          franja quedaba dibujada vacía, con su línea y su aire. */}
      {(salidaEnCola ?? entradaEnCola) ||
      (canAct && !accion && mio && !miNovedad) ||
      (canAct && accion) ||
      (canAct && puedeReportar) ? (
      <View style={styles.footer}>
        {/* La marca que espera: con su ✓ mientras no hay señal, o con el
            motivo y qué hacer si el servidor la rechazó. */}
        {salidaEnCola ?? entradaEnCola ? (
          <EstadoDeMarcaEnCola
            trabajo={(salidaEnCola ?? entradaEnCola)!}
            onReintentar={reintentar}
            onDescartar={descartar}
          />
        ) : null}
        {/* Sin botón hay que decir por qué, o parece que algo se rompió. Con
            una novedad reportada no: lo que pasa con la visita lo dice la
            sección Novedad de arriba, con lo que la persona cargó. */}
        {canAct && !accion && mio && !miNovedad ? (
          <Text style={styles.soloHoy}>
            {mio.entradaEl
              ? "Las tareas ya no se editan. Las fotos sí."
              : "La entrada se marca el día de la visita."}
          </Text>
        ) : null}
        {canAct && accion ? (
          <Button
            mode="contained"
            onPress={() =>
              accion === "Marcar entrada"
                ? setConfirmandoEntrada(true)
                : router.push(`/(personal)/visitas/completar/${vista.id}`)
            }
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {accion}
          </Button>
        ) : null}
        {/* Debajo del principal y en gris: es la excepción de la vereda, no
            el camino normal. */}
        {canAct && puedeReportar ? (
          <Button
            mode="text"
            onPress={() => setReportando(true)}
            textColor={tema.texto2}
            style={styles.secondaryBtn}
            labelStyle={styles.secondaryBtnLabel}
          >
            No pude hacer la visita
          </Button>
        ) : null}
      </View>
      ) : null}

      <DialogoConfirmar
        visible={confirmandoEntrada}
        titulo="¿Marcar tu entrada?"
        hora
        confirmar="Marcar entrada"
        cargando={marcando}
        onConfirmar={marcarEntrada}
        onCancelar={() => setConfirmandoEntrada(false)}
      />

      <HojaNovedad
        visible={reportando}
        enviando={enviandoNovedad}
        onEnviar={reportarNovedad}
        onCerrar={() => setReportando(false)}
      />

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </View>
  );
}

/**
 * Lo que dice el pie mientras una marca espera en la cola. Pendiente: un ✓ y
 * "se envía cuando haya señal", como un mensaje del chat. Rechazada: el motivo
 * del servidor y los dos botones, porque una marca que el servidor no aceptó
 * no puede quedar en silencio debajo de un botón que dice otra cosa.
 */
function EstadoDeMarcaEnCola({
  trabajo,
  onReintentar,
  onDescartar,
}: {
  trabajo: { id: string; tipo: string; estado: "pendiente" | "fallido"; error?: string };
  onReintentar: (id: string) => void;
  onDescartar: (id: string) => void;
}) {
  const que = trabajo.tipo === "SALIDA" ? "Salida" : "Entrada";
  if (trabajo.estado === "pendiente") {
    return (
      <View style={styles.enCola}>
        <Ionicons name="checkmark" size={16} color={tema.texto3} />
        <Text style={styles.enColaTexto}>
          {que} marcada. Se envía cuando haya señal.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.enColaFallo}>
      <Text style={styles.enColaFalloTexto}>
        {que} rechazada: {trabajo.error ?? "no se pudo guardar"}
      </Text>
      <View style={styles.enColaBotones}>
        <PressableScale onPress={() => onReintentar(trabajo.id)} hitSlop={8}>
          <Text style={styles.enColaAccion}>Reintentar</Text>
        </PressableScale>
        <PressableScale onPress={() => onDescartar(trabajo.id)} hitSlop={8}>
          <Text style={styles.enColaAccion}>Descartar</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  /** Sin título la tarjeta va sola, pegada a lo de arriba. */
  title?: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={title ? styles.section : styles.sectionPegada}>
      {title ? (
        <Text variant="labelMedium" style={styles.sectionLabel}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}


/**
 * Las marcas de la visita entera: la primera entrada y la última salida.
 *
 * `Visita.horaEntrada` dice lo mismo, pero como texto `"HH:MM"` y sin día — se
 * deriva de estos mismos instantes justamente para que las listas no tengan
 * que recorrerlos. Acá hace falta el instante completo.
 *
 * Los ISO se ordenan solos: alfabético y cronológico coinciden.
 */
function primeraMarca(visita: VisitaDetail, campo: "entradaEl" | "salidaEl") {
  return marcas(visita, campo)[0] ?? null;
}

function ultimaMarca(visita: VisitaDetail, campo: "entradaEl" | "salidaEl") {
  return marcas(visita, campo).at(-1) ?? null;
}

function marcas(visita: VisitaDetail, campo: "entradaEl" | "salidaEl") {
  return (visita.personal ?? [])
    .map((p) => p[campo])
    .filter((v): v is string => Boolean(v))
    .sort();
}

/**
 * Qué se hizo y quién lo hizo, más lo que se pidió y nadie marcó.
 *
 * El nombre de pila alcanza para saber a quién preguntarle; el apellido
 * completo empuja la fila a dos líneas en la mitad de los casos.
 *
 * **El propio no se escribe.** Quien mira sabe quién es, y en una visita de uno
 * solo la columna repetía su nombre en cada fila. Los de los demás sí, que es
 * para lo que sirve: en una visita de tres, saber quién hizo el desmalezado.
 */
/**
 * Las tareas de la visita, separadas en dos preguntas distintas.
 *
 * **Lo que la visita exigía** (`obligatorias`) y **lo que además se hizo**
 * (`extras`). Estaban en una sola lista bajo el título "Tareas", y ahí no se
 * distinguía la poda que alguien tildó porque la hizo de la que la oficina
 * pidió y nadie cubrió todavía. Son las dos preguntas que se le hacen a esta
 * pantalla —¿está cubierto lo que se pidió?, ¿qué más se hizo?— y cada una
 * necesita su lista.
 *
 * El nombre de quién la hizo va solo si la hizo **otro**: quien está mirando ya
 * sabe lo que cargó él.
 */
function armarFilasDeTareas(visita: VisitaDetail, yo: string | null) {
  const quienes = new Map<string, string[]>();
  for (const p of visita.personal ?? []) {
    if (p.personalId === yo) continue;
    for (const { tarea } of p.tareas) {
      const lista = quienes.get(tarea.id) ?? [];
      lista.push(p.personal.nombre.split(" ")[0]);
      quienes.set(tarea.id, lista);
    }
  }
  const hechas = new Set(
    (visita.personal ?? []).flatMap((p) => p.tareas.map((t) => t.tarea.id))
  );
  const exigidas = new Set(
    (visita.tareasObligatorias ?? []).map((o) => o.tarea.id)
  );

  const fila = (t: { id: string; nombre: string }, pendiente: boolean) => ({
    id: t.id,
    nombre: t.nombre,
    // Sin nombres al lado es porque la hizo quien está mirando: ahí alcanza con
    // decir que está hecha.
    detalle: pendiente
      ? "Pendiente"
      : (quienes.get(t.id) ?? []).join(", ") || "Hecha",
    pendiente,
  });

  return {
    obligatorias: (visita.tareasObligatorias ?? []).map((o) =>
      fila(o.tarea, !hechas.has(o.tarea.id))
    ),
    extras: tareasHechas(visita)
      .filter((t) => !exigidas.has(t.id))
      .map((t) => fila(t, false)),
  };
}


/**
 * El día de la visita. Sin hora y sin zona: ver `fechaSola`.
 *
 * Acá se leía un día menos —la visita de hoy decía "miércoles 16"— porque el
 * `@db.Date` llega como medianoche UTC y el teléfono lo mostraba en la hora de
 * Guayaquil, que es cinco horas antes.
 */
function formatDate(iso: string): string {
  return fechaSola(iso, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Una fila de tarea: el nombre, y quién la hizo o que falta. */
function FilaTarea({
  fila,
}: {
  fila: { nombre: string; detalle: string; pendiente: boolean };
}) {
  return (
    <View style={styles.tareaRow}>
      <Text
        variant="bodyMedium"
        style={[styles.tareaNombre, fila.pendiente && styles.tareaPendiente]}
      >
        {fila.nombre}
      </Text>
      <Text variant="bodySmall" style={styles.tareaQuien}>
        {fila.detalle}
      </Text>
    </View>
  );
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecánico";
    default:
      return tipo;
  }
}




const styles = StyleSheet.create({
  enCola: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 8,
  },
  enColaTexto: { fontSize: 13, color: tema.texto3 },
  enColaFallo: { gap: 4, paddingBottom: 8 },
  enColaFalloTexto: { fontSize: 13, color: tema.rojo, textAlign: "center" },
  enColaBotones: { flexDirection: "row", justifyContent: "center", gap: 20 },
  enColaAccion: { fontSize: 13, fontWeight: "700", color: tema.rojo, textDecorationLine: "underline" },
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  muted: { color: "#888" },

  /** La flecha y el nombre en una línea, como pide el sistema de diseño. */
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  encabezadoTexto: { flex: 1 },
  encabezadoBoton: { paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  encabezadoBotonTocado: { backgroundColor: "rgba(0,0,0,0.05)" },
  encabezadoCancelar: { color: tema.texto2, fontSize: 16, fontWeight: "600" },
  encabezadoGuardar: { color: tema.verde, fontSize: 16, fontWeight: "700" },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: tema.texto,
  },


  soloHoy: {
    textAlign: "center",
    color: tema.texto3,
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 14,
  },
  section: { marginTop: 20, gap: 6 },
  sectionPegada: { gap: 6 },
  seccionUbicacion: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
    marginHorizontal: 0,
  },

  tareaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  tareaNombre: { color: "#111", flexShrink: 1 },
  tareaPendiente: { color: "#888" },
  tareaQuien: { color: "#888", textAlign: "right", flexShrink: 0 },
  tareasVacio: { color: "#888", paddingVertical: 12, lineHeight: 19 },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  personName: { color: "#111", flexShrink: 1 },
  personTipo: { color: "#888" },

  notasText: {
    color: "#222",
    paddingVertical: 12,
    lineHeight: 22,
  },

  novedad: { gap: 2, paddingVertical: 10 },
  novedadFotos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  novedadFoto: { width: 56, height: 56, borderRadius: 8, overflow: "hidden" },
  novedadFotoImagen: { width: "100%", height: "100%", backgroundColor: "#eee" },
  novedadMotivo: { color: "#111", fontWeight: "600" },
  novedadNota: { color: "#222", lineHeight: 21 },
  novedadQuien: { color: "#888" },
  motivoBloque: { gap: 2, paddingVertical: 12 },
  novedadEspera: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  novedadPendiente: { fontSize: 12, color: tema.texto3 },
  novedadFallo: { fontSize: 12, color: tema.rojo, marginTop: 4 },
  novedadAcciones: { flexDirection: "row", gap: 16, marginTop: 2 },
  novedadAccion: { fontSize: 12, fontWeight: "700", color: tema.rojo, textDecorationLine: "underline" },

  mediaSection: { marginTop: 20, gap: 8 },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
  },
  mediaTile: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  mediaTileImage: {
    width: "100%",
    height: "100%",
  },
  videoTile: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  videoLabel: { color: "#fff", fontWeight: "600" },
  playBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadgeIcon: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 2,
  },

  error: { textAlign: "center", marginTop: 16 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    // Poco: abajo está la barra de pestañas, que ya trae su propio margen.
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    gap: 4,
  },
  primaryBtn: { borderRadius: 14 },
  primaryBtnContent: { height: 46 },
  primaryBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  secondaryBtn: { alignSelf: "center" },
  secondaryBtnLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  chatBtn: {
    borderRadius: 14,
    borderColor: tema.verde,
    marginTop: 4,
  },
  chatBtnLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.verde,
  },
});
