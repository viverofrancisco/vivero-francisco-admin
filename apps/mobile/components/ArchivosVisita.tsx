import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useColaDeVisitas } from "@/lib/cola-de-visitas";
import { useConexion } from "@/lib/conexion";
import type { ArchivosEnCola } from "@/lib/visita-con-cola";
import type { VisitaMedia } from "@/lib/types";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";
import { tema } from "@/lib/tema";

/**
 * Las fotos de la visita: las **propias**, en cualquier momento.
 *
 * Estaban dentro del formulario de salida, y ahí llegaban tarde: la foto se
 * saca **mientras** se trabaja —antes y después de podar, el riego roto que
 * apareció— y guardarla para el final es pedirle a alguien que se acuerde.
 *
 * Cada uno ve y toca las suyas. En una visita de tres, la grilla mezclaba el
 * trabajo de todos y cualquiera podía borrar la foto que otro acababa de sacar.
 * La oficina las ve todas, porque arma el informe, y el cliente también, porque
 * son de su jardín.
 *
 * **La tarea es obligatoria** y va por foto, no por tanda: una pasada por la
 * galería trae la poda y el riego mezclados, así que una etiqueta para todo
 * sería mentira la mitad de las veces. Una foto sin tarea es la que el informe
 * no puede ubicar. *Aplicar a todas* está igual, porque la otra mitad de las
 * veces sí son todas de lo mismo y etiquetar ocho de a una es un castigo.
 *
 * **La etiqueta no se escribe encima de la foto.** Era una barra de 10 pt
 * quemada sobre el borde inferior: tapaba el tercio que uno mira, recortaba
 * cualquier nombre largo y pintaba de ámbar las que faltaban, un código que
 * nadie enseñó. Después fueron grupos con título, y el título también se
 * recortaba. Ahora es un **listado**: miniatura a la izquierda, nombre de la
 * tarea a la derecha y entero, en las líneas que haga falta. Ordenado por
 * tarea, así las de una misma quedan juntas sin repetir un encabezado.
 *
 * **La fila se toca entera.** Antes lo único tocable era la etiqueta, y encima
 * de cada miniatura vivía una ✕ permanente: tres fotos, tres botones de borrar
 * mirándote, para algo que se hace de vez en cuando. Tocar la fila abre la hoja
 * de esa foto —verla grande, cambiarle la tarea, sacarla—, que es donde esas
 * tres cosas se piden.
 *
 * **Y es una sola hoja con pasos**, no una por pantalla. Elegir la tarea abría
 * otro `HojaInferior`: una se cerraba hacia abajo y la otra subía detrás, medio
 * segundo de ida y vuelta para tocar un ítem de una lista. Ahora cambia el
 * contenido y la tarjeta se queda donde está.
 *
 * **Nada se guarda hasta confirmar, y se confirma todo junto.** Agregar, sacar
 * y cambiar de tarea son cambios locales hasta que alguien aprieta *Guardar*,
 * que viaja en un solo `PUT`: se aplica todo o no se aplica nada. Reetiquetar
 * se guardaba solo, en el momento, y era el único de los tres que no se podía
 * deshacer. Los botones viven en el **encabezado de la pantalla** —ver
 * `useCambiosDeArchivos`—, que es lo único que siempre está a la vista.
 */

/** Una foto elegida que todavía no se subió. */
export interface Pendiente {
  asset: ImagePicker.ImagePickerAsset;
  tareaId: string | null;
}

/** A qué foto se le está eligiendo tarea. */
type Foto =
  | { tipo: "nueva"; indice: number }
  | { tipo: "subida"; media: VisitaMedia };

type Eligiendo = Foto | { tipo: "todas" };

/**
 * Qué muestra la hoja. `null` = cerrada.
 *
 * Es un solo `HojaInferior` con pasos y no tres hojas: elegir la tarea cerraba
 * una y abría otra, un ida y vuelta de medio segundo para tocar un ítem de una
 * lista.
 */
type Vista =
  | { paso: "revision" }
  | { paso: "foto"; de: Foto }
  /**
   * `volverA` es el paso que abrió la lista, y tiene que viajar con ella.
   *
   * La tarea de una foto se elige desde **dos lugares**: la fila de la tanda en
   * revisión y la hoja de esa foto. Se deducía del `para` —si era una foto, se
   * volvía a su hoja— así que tocando la tarea en la lista de revisión, la
   * flecha de atrás dejaba en una pantalla donde nunca se había estado.
   */
  | { paso: "tareas"; para: Eligiendo; volverA: Vista };

/**
 * Todo lo que está sin guardar, más cómo guardarlo.
 *
 * Vive fuera de la lista porque *Guardar* y *Cancelar* están en el encabezado
 * de la pantalla, muy lejos en el árbol: el encabezado es lo único que queda
 * fijo mientras se scrollea, y una confirmación que hay que ir a buscar es una
 * que se pierde. Mientras hay cambios, esos dos botones **reemplazan** el
 * nombre del cliente y la flecha de volver: para salir hay que decidir antes.
 */
export interface CambiosDeArchivos {
  pendientes: Pendiente[];
  quitadas: Set<string>;
  /** `mediaId` → la tarea nueva, todavía sin guardar. */
  etiquetas: Map<string, string>;
  hayCambios: boolean;
  guardando: boolean;
  error: string | null;
  /**
   * Cuándo se falló, para poder reaccionar **cada vez**.
   *
   * Mirar `error` no alcanza: apretando Guardar dos veces con el mismo problema
   * el texto no cambia, así que un efecto colgado de él no se vuelve a
   * disparar y la pantalla no hace nada la segunda vez.
   */
  errorEn: number;
  /** Cuántas de la tanda nueva siguen sin tarea. */
  sinTarea: number;
  agregar: (assets: ImagePicker.ImagePickerAsset[]) => void;
  sacarPendiente: (indice: number) => void;
  etiquetarPendiente: (indice: number, tareaId: string) => void;
  etiquetarTodas: (tareaId: string) => void;
  alternarQuitada: (mediaId: string) => void;
  etiquetar: (mediaId: string, tareaId: string) => void;
  guardar: () => Promise<void>;
  cancelar: () => void;
}

export function useCambiosDeArchivos(
  visitaId: string,
  onCambio: () => void
): CambiosDeArchivos {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [etiquetas, setEtiquetas] = useState<Map<string, string>>(new Map());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorEn, setErrorEn] = useState(0);

  /** Un error, y la marca de que **este** intento falló. */
  const fallar = useCallback((texto: string) => {
    setError(texto);
    setErrorEn(Date.now());
  }, []);

  const sinTarea = pendientes.filter((p) => p.tareaId === null).length;
  const hayCambios =
    pendientes.length > 0 || quitadas.size > 0 || etiquetas.size > 0;

  const cancelar = useCallback(() => {
    setPendientes([]);
    setQuitadas(new Set());
    setEtiquetas(new Map());
    setError(null);
  }, []);

  /**
   * Sin señal, la tanda entera va a la cola —lo que entra, lo que sale y lo
   * que cambió de tarea, junto, como el `PUT`— y sale sola cuando vuelva.
   * También si la señal se cortó a mitad del guardado: eso no es un error de
   * la persona, es esperar.
   */
  const encolar = useCallback(() => {
    useColaDeVisitas.getState().encolar({
      tipo: "ARCHIVOS",
      visitaId,
      nuevas: pendientes.map(({ asset, tareaId }) => ({
        uri: asset.uri,
        fileName:
          asset.fileName ?? asset.uri.split("/").pop() ?? `foto-${Date.now()}.jpg`,
        contentType:
          asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        tareaId: tareaId!,
      })),
      eliminar: [...quitadas],
      etiquetar: [...etiquetas].map(([id, tareaId]) => ({ id, tareaId })),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendientes([]);
    setQuitadas(new Set());
    setEtiquetas(new Map());
    onCambio();
  }, [etiquetas, onCambio, pendientes, quitadas, visitaId]);

  const guardar = useCallback(async () => {
    if (!hayCambios || guardando) return;
    if (sinTarea > 0) {
      fallar("Elige la tarea de cada foto nueva antes de guardar.");
      return;
    }
    if (!useConexion.getState().enLinea) {
      encolar();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      let subidas: { key: string; tipo: string; tareaId: string }[] = [];

      if (pendientes.length > 0) {
        const aEnviar = pendientes.map(({ asset, tareaId }) => {
          const nombre =
            asset.fileName ??
            asset.uri.split("/").pop() ??
            `foto-${Date.now()}.jpg`;
          const esVideo = asset.type === "video";
          return {
            uri: asset.uri,
            fileName: nombre,
            contentType:
              asset.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
            tareaId: tareaId!,
          };
        });

        const presign = await apiRequest<{
          uploads: {
            key: string;
            uploadUrl: string;
            tipo: string;
            contentType: string;
          }[];
        }>(`/api/mobile/visitas/${visitaId}/media`, {
          method: "POST",
          body: {
            files: aEnviar.map((f) => ({
              fileName: f.fileName,
              contentType: f.contentType,
            })),
          },
        });

        await Promise.all(
          presign.uploads.map(async (u, i) => {
            const blob = await (await fetch(aEnviar[i].uri)).blob();
            const res = await fetch(u.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": u.contentType },
              body: blob,
            });
            if (!res.ok)
              throw new Error("No pudimos subir uno de los archivos.");
          })
        );

        subidas = presign.uploads.map((u, i) => ({
          key: u.key,
          tipo: u.tipo,
          tareaId: aEnviar[i].tareaId,
        }));
      }

      // Un solo guardado: lo que entra, lo que sale y lo que cambió de tarea.
      await apiRequest(`/api/mobile/visitas/${visitaId}/media`, {
        method: "PUT",
        body: {
          files: subidas,
          eliminar: [...quitadas],
          etiquetar: [...etiquetas].map(([id, tareaId]) => ({ id, tareaId })),
        },
      });
      // Un arrastre que se confirma: golpe liviano, no notificación. Subir
      // cinco fotos y borrar dos es un compromiso, no un aviso del sistema.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendientes([]);
      setQuitadas(new Set());
      setEtiquetas(new Map());
      onCambio();
    } catch (e) {
      const status = (e as { status?: unknown })?.status;
      if (typeof status === "number" && (status === 0 || status >= 500)) {
        // No llegamos: a la cola, que lo intenta cuando haya señal.
        setGuardando(false);
        encolar();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Con `fallar` y no `setError`: también acá la pantalla tiene que llevar
      // el ojo hasta el mensaje, y el segundo intento fallido suele traer el
      // mismo texto.
      fallar(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }, [
    encolar,
    etiquetas,
    guardando,
    hayCambios,
    onCambio,
    pendientes,
    quitadas,
    fallar,
    sinTarea,
    visitaId,
  ]);

  return {
    pendientes,
    quitadas,
    etiquetas,
    hayCambios,
    guardando,
    error,
    errorEn,
    sinTarea,
    guardar,
    cancelar,
    agregar: useCallback((assets: ImagePicker.ImagePickerAsset[]) => {
      setError(null);
      setPendientes((antes) => [
        ...antes,
        ...assets.map((asset) => ({ asset, tareaId: null })),
      ]);
    }, []),
    sacarPendiente: useCallback((indice: number) => {
      setPendientes((antes) => antes.filter((_, i) => i !== indice));
    }, []),
    etiquetarPendiente: useCallback((indice: number, tareaId: string) => {
      setPendientes((antes) =>
        antes.map((p, i) => (i === indice ? { ...p, tareaId } : p))
      );
    }, []),
    etiquetarTodas: useCallback((tareaId: string) => {
      setPendientes((antes) => antes.map((p) => ({ ...p, tareaId })));
    }, []),
    alternarQuitada: useCallback((mediaId: string) => {
      setQuitadas((antes) => {
        const ahora = new Set(antes);
        if (ahora.has(mediaId)) ahora.delete(mediaId);
        else ahora.add(mediaId);
        return ahora;
      });
    }, []),
    etiquetar: useCallback((mediaId: string, tareaId: string) => {
      setEtiquetas((antes) => new Map(antes).set(mediaId, tareaId));
    }, []),
  };
}

export function ArchivosVisita({
  archivos,
  enCola = [],
  catalogo,
  cambios,
  onVer,
  onReintentar,
  onDescartar,
}: {
  archivos: VisitaMedia[];
  /** Las tandas que esperan señal para subir, con sus fotos del teléfono. */
  enCola?: ArchivosEnCola[];
  /** El catálogo entero: cualquier tarea sirve de etiqueta. */
  catalogo: TareaDeCatalogo[];
  cambios: CambiosDeArchivos;
  /** Abrir una foto a pantalla completa. */
  onVer: (media: { url: string; tipo: string }) => void;
  onReintentar?: (id: string) => void;
  onDescartar?: (id: string) => void;
}) {
  const [vista, setVista] = useState<Vista | null>(null);
  const { pendientes, quitadas, etiquetas, error, sinTarea } = cambios;

  const nombreDeTarea = (id: string | null) =>
    id ? (catalogo.find((t) => t.id === id)?.nombre ?? "Otra tarea") : null;

  /** La tarea que va a quedar: la sin guardar si la hay, si no la de la foto. */
  const tareaDe = (m: VisitaMedia) => etiquetas.get(m.id) ?? m.tareaId;

  /**
   * En el orden del catálogo —el que eligió la oficina—, con las que no tienen
   * tarea al final, que es donde se las busca para arreglarlas.
   *
   * Es un listado plano y no grupos con encabezado: cada fila lleva su nombre
   * completo al lado de la miniatura, así que agrupar sería repetir el mismo
   * texto dos veces. Ordenar por tarea alcanza para que las de una misma queden
   * juntas.
   */
  const enFila = useMemo(() => {
    const posicion = new Map(catalogo.map((t, i) => [t.id, i]));
    const lugar = (m: VisitaMedia) => {
      const id = etiquetas.get(m.id) ?? m.tareaId;
      return id ? (posicion.get(id) ?? 9e3) : 9e6;
    };
    return [...archivos].sort((a, b) => lugar(a) - lugar(b));
  }, [archivos, catalogo, etiquetas]);

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled) {
      cambios.agregar(r.assets);
      setVista({ paso: "revision" });
    }
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });
    if (!r.canceled) {
      cambios.agregar(r.assets);
      setVista({ paso: "revision" });
    }
  }

  function elegirTarea(tareaId: string) {
    if (vista?.paso !== "tareas") return;
    const quien = vista.para;
    // Al paso que abrió la lista, no a uno fijo: elegir desde la fila de la
    // tanda devuelve a la tanda, y elegir desde la hoja de una foto devuelve a
    // esa foto, ya etiquetada.
    if (quien.tipo === "todas") {
      cambios.etiquetarTodas(tareaId);
      setVista(vista.volverA);
      return;
    }
    if (quien.tipo === "nueva") {
      cambios.etiquetarPendiente(quien.indice, tareaId);
      setVista(vista.volverA);
      return;
    }
    // Ya subida: el cambio queda pendiente como los demás y se guarda con todo
    // lo otro desde el encabezado. Se guardaba solo, en el momento, y era el
    // único de los tres que no se podía deshacer.
    cambios.etiquetar(quien.media.id, tareaId);
    setVista(null);
  }

  const tareaMarcada =
    vista?.paso !== "tareas"
      ? null
      : vista.para.tipo === "subida"
        ? tareaDe(vista.para.media)
        : vista.para.tipo === "nueva"
          ? (pendientes[vista.para.indice]?.tareaId ?? null)
          : null;

  return (
    <View style={styles.contenedor}>
      <Text variant="labelMedium" style={styles.rotulo}>
        ARCHIVOS
      </Text>

      <View style={styles.acciones}>
        <PressableScale
          onPress={tomarFoto}
          estiloExterno={styles.mitad}
          style={styles.accion}
          estiloPresionado={styles.accionTocada}
        >
          <Ionicons name="camera-outline" size={20} color={tema.verde} />
          <Text style={styles.accionTexto}>Tomar foto</Text>
        </PressableScale>
        <PressableScale
          onPress={elegirDeGaleria}
          estiloExterno={styles.mitad}
          style={styles.accion}
          estiloPresionado={styles.accionTocada}
        >
          <Ionicons name="images-outline" size={20} color={tema.verde} />
          <Text style={styles.accionTexto}>Galería</Text>
        </PressableScale>
      </View>

      {/* Sin "Guardando…" acá: el spinner que reemplaza a *Guardar* en el
          encabezado ya lo dice, y está justo donde se acaba de tocar. */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {archivos.length === 0 && pendientes.length === 0 && enCola.length === 0 ? (
        <Text style={styles.vacio}>
          Todavía no subiste fotos. Sácalas mientras trabajas.
        </Text>
      ) : (
        <View style={styles.lista}>
          {/* Las que esperan señal: ya están decididas, solo falta que salgan.
              Un ✓ como el del chat; si el servidor las rechazó, el motivo y
              qué hacer. */}
          {enCola.map((tanda) =>
            tanda.nuevas.map((f, i) => (
              <View
                key={`${tanda.id}-${i}`}
                style={[styles.filaFoto, styles.filaConLinea]}
              >
                <View style={styles.miniaturaCaja}>
                  <Image source={{ uri: f.uri }} style={styles.miniatura} />
                </View>
                <View style={styles.filaTexto}>
                  <Text style={styles.filaNombre}>
                    {nombreDeTarea(f.tareaId) ?? "Sin tarea"}
                  </Text>
                  {tanda.estado === "fallido" ? (
                    <>
                      <Text style={styles.filaFallo} numberOfLines={2}>
                        {tanda.error ?? "No se pudo guardar"}
                      </Text>
                      {i === 0 ? (
                        <View style={styles.filaAcciones}>
                          <Pressable onPress={() => onReintentar?.(tanda.id)} hitSlop={8}>
                            <Text style={styles.filaAccion}>Reintentar</Text>
                          </Pressable>
                          <Pressable onPress={() => onDescartar?.(tanda.id)} hitSlop={8}>
                            <Text style={styles.filaAccion}>Descartar</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.filaEspera}>
                      <Ionicons name="checkmark" size={14} color={tema.texto3} />
                      <Text style={styles.filaPendiente}>Se sube cuando haya señal</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
          {/* Las que faltan subir van primero: son lo que acaba de pasar, y lo
              que el Guardar de arriba está esperando. */}
          {pendientes.map((p, i) => (
            <PressableScale
              key={`${p.asset.uri}-${i}`}
              onPress={() =>
                setVista({ paso: "foto", de: { tipo: "nueva", indice: i } })
              }
              style={[styles.filaFoto, i > 0 && styles.filaConLinea]}
              estiloPresionado={styles.filaTocada}
            >
              <View style={styles.miniaturaCaja}>
                <Image source={{ uri: p.asset.uri }} style={styles.miniatura} />
              </View>
              <View style={styles.filaTexto}>
                <Text
                  style={[styles.filaNombre, !p.tareaId && styles.faltaTarea]}
                >
                  {nombreDeTarea(p.tareaId) ?? "Elegir tarea"}
                </Text>
                {/* "Nueva" y no "Sin subir": desde acá lo que importa es que
                    todavía no está en la visita, no el paso técnico que falta.
                    "Sin subir" se leía como una falla. */}
                <Text style={styles.filaNueva}>Nueva</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          ))}

          {enFila.map((m, i) => {
            const fuera = quitadas.has(m.id);
            return (
              <PressableScale
                key={m.id}
                onPress={() =>
                  setVista({ paso: "foto", de: { tipo: "subida", media: m } })
                }
                style={[
                  styles.filaFoto,
                  (i > 0 || pendientes.length > 0) && styles.filaConLinea,
                  fuera && styles.filaFuera,
                ]}
                estiloPresionado={styles.filaTocada}
              >
                <View style={styles.miniaturaCaja}>
                  {m.tipo === "video" ? (
                    <View style={[styles.miniatura, styles.video]}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  ) : (
                    <Image source={{ uri: m.url }} style={styles.miniatura} />
                  )}
                  {fuera ? (
                    <View style={styles.marcaFuera}>
                      <Ionicons name="trash" size={16} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <View style={styles.filaTexto}>
                  {/* Entero: el nombre de la tarea es lo único que dice de qué
                      es la foto, y recortado a una línea "Deshoje de plantas de
                      hojas grandes (alocasias, b…" no distingue nada. */}
                  <Text
                    style={[styles.filaNombre, !tareaDe(m) && styles.faltaTarea]}
                  >
                    {nombreDeTarea(tareaDe(m)) ?? "Sin tarea"}
                  </Text>
                  {fuera ? (
                    <Text style={styles.filaPendiente}>
                      Se elimina al guardar
                    </Text>
                  ) : etiquetas.has(m.id) ? (
                    <Text style={styles.filaPendiente}>Tarea sin guardar</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              </PressableScale>
            );
          })}
        </View>
      )}

      {/*
        Una sola hoja con pasos, no tres hojas.
        Elegir la tarea era otro `HojaInferior`: una se cerraba hacia abajo y la
        otra subía detrás, un ida y vuelta de medio segundo para tocar un ítem
        de una lista. Adentro de la misma hoja el contenido se cambia y el
        contenedor se queda donde está, que es lo que el dedo espera cuando
        acaba de apretar algo que dice "elegir".
      */}
      <HojaInferior visible={vista !== null} onCerrar={() => setVista(null)}>
        {vista?.paso === "revision" ? (
          <>
            <View style={styles.hojaCabecera}>
              <Text variant="titleMedium" style={styles.hojaTitulo}>
                {pendientes.length === 1
                  ? "¿De qué es esta foto?"
                  : `¿De qué son estas ${pendientes.length} fotos?`}
              </Text>
              {pendientes.length > 1 ? (
                <Pressable
                  onPress={() =>
                    setVista({
                      paso: "tareas",
                      para: { tipo: "todas" },
                      volverA: { paso: "revision" },
                    })
                  }
                  hitSlop={8}
                >
                  <Text style={styles.hojaAccion}>Aplicar a todas</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.hojaLista}>
              {pendientes.map((p, i) => (
                <View key={`${p.asset.uri}-${i}`} style={styles.revision}>
                  <Image
                    source={{ uri: p.asset.uri }}
                    style={styles.revisionFoto}
                  />
                  <Pressable
                    onPress={() =>
                      setVista({
                        paso: "tareas",
                        para: { tipo: "nueva", indice: i },
                        // Se vino de la lista de la tanda: ahí se vuelve.
                        volverA: { paso: "revision" },
                      })
                    }
                    style={styles.revisionTarea}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        styles.revisionTexto,
                        !p.tareaId && styles.faltaTarea,
                      ]}
                      numberOfLines={2}
                    >
                      {nombreDeTarea(p.tareaId) ?? "Elegir tarea"}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={p.tareaId ? tema.texto3 : tema.ambarTexto}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      cambios.sacarPendiente(i);
                      if (pendientes.length === 1) setVista(null);
                    }}
                    hitSlop={10}
                    style={styles.revisionQuitar}
                  >
                    <Ionicons name="close" size={18} color={tema.texto3} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <View style={styles.hojaPie}>
              {/* No sube: deja la tanda lista y la sube el *Guardar* de arriba,
                  junto con lo borrado y lo reetiquetado. Dos botones que
                  guardan cosas distintas en la misma pantalla es cómo se
                  termina con la mitad aplicada. */}
              <PressableScale
                onPress={() => setVista(null)}
                disabled={sinTarea > 0}
                style={[styles.listo, sinTarea > 0 && styles.listoApagado]}
              >
                <Text style={styles.listoTexto}>
                  {sinTarea > 0
                    ? sinTarea === 1
                      ? "Falta 1 tarea"
                      : `Faltan ${sinTarea} tareas`
                    : "Listo"}
                </Text>
              </PressableScale>
            </View>
          </>
        ) : null}

        {/* Una foto: verla, cambiarle la tarea, sacarla. */}
        {vista?.paso === "foto" ? (
          <FotoEnHoja
            de={vista.de}
            pendientes={pendientes}
            quitada={
              vista.de.tipo === "subida" && quitadas.has(vista.de.media.id)
            }
            nombreDeTarea={nombreDeTarea}
            tareaDe={tareaDe}
            onVerGrande={(m) => {
              setVista(null);
              onVer(m);
            }}
            onCambiarTarea={() =>
              setVista({ paso: "tareas", para: vista.de, volverA: vista })
            }
            onSacar={() => {
              if (vista.de.tipo === "nueva")
                cambios.sacarPendiente(vista.de.indice);
              else cambios.alternarQuitada(vista.de.media.id);
              setVista(null);
            }}
          />
        ) : null}

        {/* La lista de tareas. Sin opción de dejarla vacía: es obligatoria. */}
        {vista?.paso === "tareas" ? (
          <>
            <View style={styles.hojaCabecera}>
              {/* Volver al paso de donde se vino. Arrastrar la hoja también
                  cierra, pero eso hay que saberlo. */}
              <PressableScale
                onPress={() => setVista(vista.volverA)}
                hitSlop={10}
                style={styles.hojaVolver}
              >
                <Ionicons name="chevron-back" size={22} color={tema.texto} />
              </PressableScale>
              <Text variant="titleMedium" style={styles.hojaTitulo}>
                {vista.para.tipo === "todas"
                  ? "¿De qué son todas?"
                  : "¿De qué es?"}
              </Text>
            </View>
            <ScrollView style={styles.hojaLista}>
              {catalogo.map((t) => (
                <PressableScale
                  key={t.id}
                  onPress={() => elegirTarea(t.id)}
                  style={styles.opcion}
                  estiloPresionado={styles.opcionTocada}
                >
                  <Text style={styles.opcionTexto}>{t.nombre}</Text>
                  {tareaMarcada === t.id ? (
                    <Ionicons name="checkmark" size={18} color={tema.verde} />
                  ) : null}
                </PressableScale>
              ))}
            </ScrollView>
          </>
        ) : null}
      </HojaInferior>
    </View>
  );
}

/** El paso de una foto: la misma hoja sirve para una subida y una pendiente. */
function FotoEnHoja({
  de,
  pendientes,
  quitada,
  nombreDeTarea,
  tareaDe,
  onVerGrande,
  onCambiarTarea,
  onSacar,
}: {
  de: Foto;
  pendientes: Pendiente[];
  quitada: boolean;
  nombreDeTarea: (id: string | null) => string | null;
  tareaDe: (m: VisitaMedia) => string | null;
  onVerGrande: (m: { url: string; tipo: string }) => void;
  onCambiarTarea: () => void;
  onSacar: () => void;
}) {
  const nueva = de.tipo === "nueva" ? pendientes[de.indice] : null;
  if (de.tipo === "nueva" && !nueva) return null;

  const uri = nueva ? nueva.asset.uri : de.tipo === "subida" ? de.media.url : "";
  const esVideo = nueva
    ? nueva.asset.type === "video"
    : de.tipo === "subida" && de.media.tipo === "video";
  const tareaId = nueva
    ? nueva.tareaId
    : de.tipo === "subida"
      ? tareaDe(de.media)
      : null;

  return (
    <View style={styles.hojaFoto}>
      <Pressable
        // Una que todavía no se subió no tiene URL pública que abrir.
        onPress={() =>
          de.tipo === "subida" &&
          onVerGrande({ url: de.media.url, tipo: de.media.tipo })
        }
      >
        {esVideo ? (
          <View style={[styles.vistaPrevia, styles.video]}>
            <Ionicons name="play" size={34} color="#fff" />
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={styles.vistaPrevia}
            resizeMode="cover"
          />
        )}
      </Pressable>

      <Pressable onPress={onCambiarTarea} style={styles.fila}>
        <Ionicons name="pricetag-outline" size={20} color={tema.texto2} />
        <View style={styles.filaTexto}>
          <Text style={styles.filaEtiqueta}>Tarea</Text>
          <Text
            style={[styles.filaValor, !tareaId && styles.faltaTarea]}
            numberOfLines={2}
          >
            {nombreDeTarea(tareaId) ?? (nueva ? "Elegir tarea" : "Sin tarea")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
      </Pressable>

      <Pressable onPress={onSacar} style={styles.fila}>
        <Ionicons name="trash-outline" size={20} color={tema.rojo} />
        <Text style={styles.filaEliminar}>
          {/* Lo mismo diga lo mismo: para quien mira, la foto se va. Que por
              dentro una salga de la tanda y la otra se marque para borrar al
              guardar es asunto nuestro. */}
          {quitada ? "No eliminar" : "Eliminar foto"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filaEspera: { flexDirection: "row", alignItems: "center", gap: 4 },
  filaFallo: { fontSize: 12, color: tema.rojo },
  filaAcciones: { flexDirection: "row", gap: 16, marginTop: 2 },
  filaAccion: { fontSize: 12, fontWeight: "700", color: tema.rojo, textDecorationLine: "underline" },
  contenedor: { gap: 12 },
  rotulo: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  acciones: { flexDirection: "row", gap: 10 },
  /** Reparte el ancho. Va en el `Pressable`, no en la vista que se encoge. */
  mitad: { flex: 1 },
  accion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c3dfc5",
    backgroundColor: "#f4faf4",
  },
  accionTocada: { backgroundColor: "#e3f1e4" },
  accionTexto: { color: tema.verde, fontWeight: "600" },
  error: { color: "#b3261e" },
  vacio: { color: "#888" },

  lista: { backgroundColor: "#fafafa", borderRadius: 12, overflow: "hidden" },
  filaFoto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  filaTocada: { backgroundColor: "#f0f0f0" },
  filaConLinea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eaeaea",
  },
  /** Marcada para salir: se ve que se va, y se puede deshacer. */
  filaFuera: { opacity: 0.45 },
  filaNombre: { color: tema.texto, fontSize: 15, lineHeight: 20 },
  /** Lo que va a pasar al guardar, en chico y debajo del nombre. */
  filaPendiente: { color: tema.texto3, fontSize: 12, marginTop: 1 },
  filaNueva: {
    // Rojo, como "Elegir tarea": las dos líneas hablan de la misma foto y de lo
    // mismo —que todavía no está guardada— así que dicho en dos colores
    // parecían dos avisos distintos.
    color: tema.rojo,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  // Rojo y no ámbar: es lo único que impide guardar, y el ámbar de la casa se
  // usa para "mira esto", no para "esto te frena".
  faltaTarea: { color: tema.rojo, fontWeight: "600" },
  miniaturaCaja: { width: 52, height: 52, borderRadius: 8, overflow: "hidden" },
  miniatura: { width: "100%", height: "100%", backgroundColor: "#eee" },
  video: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#444",
  },
  marcaFuera: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,57,58,0.55)",
  },

  hojaCabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  hojaTitulo: { flex: 1, color: "#111", fontWeight: "700" },
  hojaAccion: { color: tema.verde, fontWeight: "700", fontSize: 13 },
  hojaVolver: { marginLeft: -8, padding: 4 },
  hojaLista: { flexShrink: 1, paddingHorizontal: 12 },
  hojaPie: { paddingHorizontal: 20, paddingTop: 10 },

  revision: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  revisionFoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  revisionTarea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  revisionTexto: { flex: 1, color: tema.texto, fontSize: 15 },
  revisionQuitar: { padding: 4 },

  listo: {
    height: 48,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  listoApagado: { backgroundColor: "#bdbdbd" },
  listoTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },

  hojaFoto: { paddingHorizontal: 20, gap: 4 },
  vistaPrevia: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginBottom: 8,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  filaTexto: { flex: 1 },
  filaEtiqueta: { color: tema.texto3, fontSize: 12, fontWeight: "600" },
  filaValor: { color: tema.texto, fontSize: 15 },
  filaEliminar: { color: tema.rojo, fontSize: 15, fontWeight: "600" },

  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  opcionTocada: { backgroundColor: "#f2f2f2" },
  opcionTexto: { color: "#111", fontSize: 15, flex: 1, paddingRight: 8 },
});
