import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, ApiError } from "@/lib/api";
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
 * nadie enseñó. Ahora las fotos se **agrupan por tarea**, con el nombre como
 * título del grupo: la categoría se ve de lejos, sin leer nada, y "Sin tarea"
 * es un grupo más —el que hay que arreglar— en vez de un color.
 *
 * **La foto se toca.** Antes lo único tocable era la etiqueta, y encima de cada
 * miniatura vivía una ✕ permanente: tres fotos, tres botones de borrar
 * mirándote, para algo que se hace de vez en cuando. Tocar la foto abre su
 * hoja —verla grande, cambiarle la tarea, eliminarla—, que es donde esas tres
 * cosas se piden.
 *
 * **Nada se guarda hasta confirmar.** Lo que se elige de la galería entra en
 * una hoja de revisión y se sube recién al apretar *Subir*; eliminar es local
 * hasta que se confirma en su barra. Un solo `PUT` lleva las dos cosas: se
 * sube todo junto o no se sube nada.
 */

/** Una foto elegida que todavía no se subió. */
interface Pendiente {
  asset: ImagePicker.ImagePickerAsset;
  tareaId: string | null;
}

/** Las fotos de una tarea, juntas. `tareaId: null` = las que no tienen. */
interface Grupo {
  clave: string;
  tareaId: string | null;
  nombre: string;
  items: VisitaMedia[];
}

/** Qué está eligiendo tarea. */
type Eligiendo =
  | { tipo: "nueva"; indice: number }
  | { tipo: "todas" }
  | { tipo: "subida"; media: VisitaMedia };

const HUECO = 8;
const COLUMNAS = 3;

export function ArchivosVisita({
  visitaId,
  archivos,
  catalogo,
  onCambio,
  onVer,
}: {
  visitaId: string;
  archivos: VisitaMedia[];
  /** El catálogo entero: cualquier tarea sirve de etiqueta. */
  catalogo: TareaDeCatalogo[];
  onCambio: () => void;
  /** Abrir una foto a pantalla completa. */
  onVer: (media: { url: string; tipo: string }) => void;
}) {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [revisando, setRevisando] = useState(false);
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<VisitaMedia | null>(null);
  const [eligiendo, setEligiendo] = useState<Eligiendo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El ancho de la grilla, para que las miniaturas llenen la fila. */
  const [ancho, setAncho] = useState(0);

  const lado =
    ancho > 0 ? Math.floor((ancho - HUECO * (COLUMNAS - 1)) / COLUMNAS) : 104;

  const nombreDeTarea = (id: string | null) =>
    id ? (catalogo.find((t) => t.id === id)?.nombre ?? "Otra tarea") : null;

  const sinTarea = pendientes.filter((p) => p.tareaId === null).length;

  /**
   * Por tarea, en el orden del catálogo —el que eligió la oficina— y las que no
   * tienen al final, que es donde se las busca para arreglarlas.
   */
  const grupos = useMemo<Grupo[]>(() => {
    const porTarea = new Map<string, VisitaMedia[]>();
    for (const m of archivos) {
      const clave = m.tareaId ?? "";
      const lista = porTarea.get(clave) ?? [];
      lista.push(m);
      porTarea.set(clave, lista);
    }
    const posicion = new Map(catalogo.map((t, i) => [t.id, i]));
    return [...porTarea.entries()]
      .map(([clave, items]) => ({
        clave,
        tareaId: clave || null,
        nombre: clave
          ? (catalogo.find((t) => t.id === clave)?.nombre ?? "Otra tarea")
          : "Sin tarea",
        items,
      }))
      .sort(
        (a, b) =>
          (a.tareaId ? (posicion.get(a.tareaId) ?? 9e3) : 9e6) -
          (b.tareaId ? (posicion.get(b.tareaId) ?? 9e3) : 9e6)
      );
  }, [archivos, catalogo]);

  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    setError(null);
    setPendientes((antes) => [
      ...antes,
      ...assets.map((asset) => ({ asset, tareaId: null })),
    ]);
    setRevisando(true);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError("Permite el acceso a la cámara para tomar fotos.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled) agregar(r.assets);
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Permite el acceso a tus fotos para subirlas.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });
    if (!r.canceled) agregar(r.assets);
  }

  function marcarParaEliminar(media: VisitaMedia) {
    setAbierta(null);
    setQuitadas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(media.id)) ahora.delete(media.id);
      else ahora.add(media.id);
      return ahora;
    });
  }

  /** Lo que entra y lo que sale, en un solo envío. */
  async function guardar() {
    if (pendientes.length === 0 && quitadas.size === 0) return;
    if (sinTarea > 0) {
      setRevisando(true);
      setError("Elige la tarea de cada foto antes de guardar.");
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
            contentType: asset.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
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

      // Un solo guardado: lo que entra y lo que sale.
      await apiRequest(`/api/mobile/visitas/${visitaId}/media`, {
        method: "PUT",
        body: { files: subidas, eliminar: [...quitadas] },
      });
      // Un arrastre que se confirma: golpe liviano, no notificación. Subir
      // cinco fotos y borrar dos es un compromiso, no un aviso del sistema.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendientes([]);
      setQuitadas(new Set());
      setRevisando(false);
      onCambio();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ApiError ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function elegirTarea(tareaId: string) {
    const quien = eligiendo;
    setEligiendo(null);
    if (!quien) return;

    if (quien.tipo === "todas") {
      setPendientes((antes) => antes.map((p) => ({ ...p, tareaId })));
      setRevisando(true);
      return;
    }
    if (quien.tipo === "nueva") {
      setPendientes((antes) =>
        antes.map((p, i) => (i === quien.indice ? { ...p, tareaId } : p))
      );
      setRevisando(true);
      return;
    }
    // Una ya subida se reetiqueta en el momento: no es un cambio que se pueda
    // "cancelar" junto con los otros, porque la foto ya está.
    try {
      await apiRequest(
        `/api/mobile/visitas/${visitaId}/media/${quien.media.id}`,
        { method: "PATCH", body: { tareaId } }
      );
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos etiquetarla");
    }
  }

  const tareaMarcada =
    eligiendo?.tipo === "subida"
      ? eligiendo.media.tareaId
      : eligiendo?.tipo === "nueva"
        ? (pendientes[eligiendo.indice]?.tareaId ?? null)
        : null;

  return (
    <View style={styles.contenedor}>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Cerrar la hoja de revisión no tira lo elegido: un arrastre de más no
          puede costar ocho fotos ya etiquetadas. Queda esta línea para volver. */}
      {pendientes.length > 0 && !revisando ? (
        <Pressable onPress={() => setRevisando(true)} style={styles.aviso}>
          <Ionicons name="cloud-upload-outline" size={16} color={tema.verde} />
          <Text style={styles.avisoTexto}>
            {pendientes.length === 1
              ? "1 foto sin subir"
              : `${pendientes.length} fotos sin subir`}
          </Text>
          <Text style={styles.avisoAccion}>Revisar</Text>
        </Pressable>
      ) : null}

      {archivos.length === 0 ? (
        <Text style={styles.vacio}>
          Todavía no subiste fotos. Sácalas mientras trabajas.
        </Text>
      ) : (
        grupos.map((g) => (
          <View key={g.clave} style={styles.grupo}>
            <View style={styles.grupoCabecera}>
              <Text
                style={[
                  styles.grupoTitulo,
                  !g.tareaId && styles.grupoTituloFalta,
                ]}
                numberOfLines={1}
              >
                {g.nombre}
              </Text>
              <Text style={styles.grupoCuenta}>{g.items.length}</Text>
            </View>
            <View
              style={styles.grilla}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setAncho((antes) => (antes === w ? antes : w));
              }}
            >
              {g.items.map((m) => {
                const fuera = quitadas.has(m.id);
                return (
                  <PressableScale
                    key={m.id}
                    onPress={() => setAbierta(m)}
                    estiloExterno={{ width: lado, height: lado }}
                    style={[styles.celda, fuera && styles.celdaFuera]}
                  >
                    {m.tipo === "video" ? (
                      <View style={[styles.miniatura, styles.video]}>
                        <Ionicons name="play" size={22} color="#fff" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: m.url }}
                        style={styles.miniatura}
                      />
                    )}
                    {fuera ? (
                      <View style={styles.marcaFuera}>
                        <Ionicons name="trash" size={18} color="#fff" />
                      </View>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))
      )}

      {/* Solo aparece eliminando, así que no compite con nada en el camino
          normal: subir vive en su hoja. */}
      {quitadas.size > 0 ? (
        <View style={styles.barra}>
          <Text style={styles.barraTexto}>
            {quitadas.size === 1
              ? "1 foto por eliminar"
              : `${quitadas.size} fotos por eliminar`}
          </Text>
          <View style={styles.barraBotones}>
            <PressableScale
              onPress={() => setQuitadas(new Set())}
              disabled={guardando}
              style={styles.barraBoton}
              estiloPresionado={styles.barraBotonTocado}
            >
              <Text style={styles.barraCancelar}>Deshacer</Text>
            </PressableScale>
            <PressableScale
              onPress={guardar}
              disabled={guardando}
              style={styles.barraBoton}
              estiloPresionado={styles.barraBotonTocado}
            >
              {guardando ? (
                <ActivityIndicator size="small" color={tema.rojo} />
              ) : (
                <Text style={styles.barraEliminar}>Eliminar</Text>
              )}
            </PressableScale>
          </View>
        </View>
      ) : null}

      {/* Revisión de lo recién elegido: cada foto con su tarea antes de subir. */}
      <HojaInferior visible={revisando} onCerrar={() => setRevisando(false)}>
        <View style={styles.hojaCabecera}>
          <Text variant="titleMedium" style={styles.hojaTitulo}>
            {pendientes.length === 1
              ? "¿De qué es esta foto?"
              : `¿De qué son estas ${pendientes.length} fotos?`}
          </Text>
          {pendientes.length > 1 ? (
            <Pressable
              onPress={() => {
                setRevisando(false);
                setEligiendo({ tipo: "todas" });
              }}
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
                onPress={() => {
                  setRevisando(false);
                  setEligiendo({ tipo: "nueva", indice: i });
                }}
                style={styles.revisionTarea}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.revisionTexto,
                    !p.tareaId && styles.revisionFalta,
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
                  setPendientes((a) => {
                    const quedan = a.filter((_, j) => j !== i);
                    if (quedan.length === 0) setRevisando(false);
                    return quedan;
                  });
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
          <PressableScale
            onPress={guardar}
            disabled={guardando || sinTarea > 0 || pendientes.length === 0}
            style={[
              styles.subir,
              (guardando || sinTarea > 0 || pendientes.length === 0) &&
                styles.subirApagado,
            ]}
          >
            {guardando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.subirTexto}>
                {sinTarea > 0
                  ? sinTarea === 1
                    ? "Falta 1 tarea"
                    : `Faltan ${sinTarea} tareas`
                  : pendientes.length === 1
                    ? "Subir foto"
                    : `Subir ${pendientes.length} fotos`}
              </Text>
            )}
          </PressableScale>
        </View>
      </HojaInferior>

      {/* Una foto ya subida: verla, cambiarle la tarea, eliminarla. */}
      <HojaInferior visible={abierta !== null} onCerrar={() => setAbierta(null)}>
        {abierta ? (
          <View style={styles.hojaFoto}>
            <Pressable
              onPress={() => {
                const m = abierta;
                setAbierta(null);
                onVer({ url: m.url, tipo: m.tipo });
              }}
            >
              {abierta.tipo === "video" ? (
                <View style={[styles.vistaPrevia, styles.video]}>
                  <Ionicons name="play" size={34} color="#fff" />
                </View>
              ) : (
                <Image
                  source={{ uri: abierta.url }}
                  style={styles.vistaPrevia}
                  resizeMode="cover"
                />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                const m = abierta;
                setAbierta(null);
                setEligiendo({ tipo: "subida", media: m });
              }}
              style={styles.fila}
            >
              <Ionicons name="pricetag-outline" size={20} color={tema.texto2} />
              <View style={styles.filaTexto}>
                <Text style={styles.filaEtiqueta}>Tarea</Text>
                <Text
                  style={[
                    styles.filaValor,
                    !abierta.tareaId && styles.revisionFalta,
                  ]}
                  numberOfLines={1}
                >
                  {nombreDeTarea(abierta.tareaId) ?? "Sin tarea"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </Pressable>

            <Pressable
              onPress={() => marcarParaEliminar(abierta)}
              style={styles.fila}
            >
              <Ionicons name="trash-outline" size={20} color={tema.rojo} />
              <Text style={styles.filaEliminar}>
                {quitadas.has(abierta.id) ? "No eliminar" : "Eliminar foto"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </HojaInferior>

      {/* La lista de tareas. Sin opción de dejarla vacía: es obligatoria. */}
      <HojaInferior
        visible={eligiendo !== null}
        onCerrar={() => {
          const volver = eligiendo?.tipo !== "subida";
          setEligiendo(null);
          if (volver) setRevisando(true);
        }}
      >
        <View style={styles.hojaCabecera}>
          {/* Se llega acá desde la hoja de revisión, así que hace falta cómo
              volver: arrastrar la hoja también cierra, pero eso hay que
              saberlo. Etiquetar una foto ya subida no viene de ningún lado, y
              ahí la flecha no tendría a dónde ir. */}
          {eligiendo && eligiendo.tipo !== "subida" ? (
            <PressableScale
              onPress={() => {
                setEligiendo(null);
                setRevisando(true);
              }}
              hitSlop={10}
              style={styles.hojaVolver}
            >
              <Ionicons name="chevron-back" size={22} color={tema.texto} />
            </PressableScale>
          ) : null}
          <Text variant="titleMedium" style={styles.hojaTitulo}>
            {eligiendo?.tipo === "todas" ? "¿De qué son todas?" : "¿De qué es?"}
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
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 12 },
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

  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f4faf4",
  },
  avisoTexto: { flex: 1, color: tema.verde, fontWeight: "600", fontSize: 13 },
  avisoAccion: { color: tema.verde, fontWeight: "700", fontSize: 13 },

  grupo: { gap: 8 },
  grupoCabecera: { flexDirection: "row", alignItems: "center", gap: 8 },
  grupoTitulo: {
    flex: 1,
    color: tema.texto,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  /** Las que no tienen tarea: el grupo que hay que arreglar. */
  grupoTituloFalta: { color: tema.ambarTexto },
  grupoCuenta: { color: tema.texto3, fontSize: 13, fontWeight: "600" },

  grilla: { flexDirection: "row", flexWrap: "wrap", gap: HUECO },
  celda: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  /** Marcada para salir: se ve que se va, y se puede deshacer. */
  celdaFuera: { opacity: 0.4 },
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

  barra: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 10,
    backgroundColor: tema.rojo50,
  },
  barraTexto: { flex: 1, color: tema.rojo, fontWeight: "600", fontSize: 13 },
  barraBotones: { flexDirection: "row" },
  barraBoton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  barraBotonTocado: { backgroundColor: "rgba(0,0,0,0.05)" },
  barraCancelar: { color: tema.texto2, fontWeight: "600" },
  barraEliminar: { color: tema.rojo, fontWeight: "700" },

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
  revisionFoto: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#eee" },
  revisionTarea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  revisionTexto: { flex: 1, color: tema.texto, fontSize: 15 },
  revisionFalta: { color: tema.ambarTexto, fontWeight: "600" },
  revisionQuitar: { padding: 4 },

  subir: {
    height: 48,
    borderRadius: 12,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  subirApagado: { backgroundColor: "#bdbdbd" },
  subirTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },

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
