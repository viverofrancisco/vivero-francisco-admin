"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaViewer } from "@/components/ui/media-viewer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronLeft,
  Copy,
  ImageIcon,
  Info,
  MoreVertical,
  Play,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  mezclarConLaCola,
  nuevoIdCliente,
  type EstadoDeMensaje,
  type InfoDeMensaje,
  type MensajeDeChat,
  type MensajeEnCola,
} from "@vivero/shared";
import { hrefDeVuelta } from "@/lib/navegacion";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Conectando } from "@/components/shared/conectando";
import { AvatarDeChat } from "./avatar-de-chat";
import { InfoDelChat } from "./info-del-chat";
import {
  confirmarLlegada,
  descartar,
  encolar,
  onEnviado,
  procesar,
  reintentar,
  useCola,
} from "./cola-de-envio";
import { guardarChat } from "./cache-de-chats";
import { cuandoLeyo, horaDeMensaje, mismoDia, tituloDelDia } from "./formato";

/** Un mensaje como lo dibuja esta pantalla: el mismo que la app. */
export type MensajeEnPantalla = MensajeDeChat;

/** Cómo se nombra un adjunto cuando no hay texto que lo acompañe. */
function etiquetaDeAdjuntos(tipo: string | undefined, cuantos: number): string {
  if (cuantos > 1) return `📎 ${cuantos} archivos`;
  return tipo === "video" ? "🎥 Video" : "📷 Foto";
}

/**
 * La miniatura de una foto o un video, del tamaño que se le pida. Un video no
 * tiene imagen sin reproducirlo, así que va un recuadro oscuro con el
 * triángulo: es lo que todo el mundo lee como "esto se reproduce".
 */
function Miniatura({
  url,
  tipo,
  className,
}: {
  url: string;
  tipo: string;
  className: string;
}) {
  if (tipo === "video") {
    return (
      <span
        className={`flex items-center justify-center bg-foreground/80 text-background ${className}`}
      >
        <Play className="h-1/2 w-1/2 fill-current" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`object-cover ${className}`} />;
}

/**
 * Los vistos de WhatsApp, en la esquina de cada mensaje propio: uno mientras
 * espera, dos cuando el servidor lo tiene, dos azules cuando lo leyeron todos.
 * Y el signo rojo cuando el servidor dijo que no.
 */
function Vistos({ estado }: { estado: EstadoDeMensaje }) {
  if (estado === "pendiente") {
    return <Check className="h-3.5 w-3.5 opacity-70" aria-label="Enviando" />;
  }
  if (estado === "fallido") {
    return (
      <AlertCircle className="h-3.5 w-3.5 text-red-200" aria-label="No se envió" />
    );
  }
  return (
    <CheckCheck
      className={`h-3.5 w-3.5 ${estado === "leido" ? "text-sky-300" : "opacity-70"}`}
      aria-label={estado === "leido" ? "Leído por todos" : "Enviado"}
    />
  );
}

export interface ChatCabecera {
  id: string;
  nombre: string;
  imagenUrl?: string | null;
  puedeEditar: boolean;
  miembros: { id: string; nombre: string; rol: string; soyYo: boolean }[];
  /** Cuántas fotos y videos y cuántos enlaces hay, para la info. */
  medios?: { fotosYVideos: number; enlaces: number };
}

/** Cada cuánto vuelve a preguntar si hay algo nuevo. */
const CADA_MS = 5000;

/**
 * Una conversación.
 *
 * **Pregunta cada cinco segundos en vez de esperar un empujón**: no hay
 * websockets en esta aplicación, y montar la infraestructura para eso es mucho
 * más de lo que hace falta para que quince personas se pongan de acuerdo a qué
 * hora salen. El aviso al teléfono es el que avisa cuando la pantalla está
 * cerrada; esto es para cuando está abierta. Solo pregunta si la pestaña está a
 * la vista, o una computadora olvidada abierta hace un pedido cada cinco
 * segundos toda la noche.
 *
 * **Lo que se escribe aparece en el acto y sale después**, por la cola de
 * `cola-de-envio.ts`: la lista que se dibuja es lo que vino del servidor más
 * lo que espera en la cola, y un mensaje que vuelve del servidor con el
 * `idCliente` de uno de la cola es ese mismo, ya llegado.
 *
 * **Y deja una copia local** (`cache-de-chats.ts`) cada vez que cambia: es lo
 * que `loading.tsx` dibuja la próxima vez, mientras la página llega.
 */
export function Conversacion({
  chat: chatInicial,
  mensajes: primeros,
  cursor: cursorInicial,
  from,
  destacado,
  soloVista = false,
}: {
  chat: ChatCabecera;
  mensajes: MensajeEnPantalla[];
  cursor: string | null;
  from?: string;
  /** El mensaje al que se llegó desde el buscador: se resalta y se centra. */
  destacado?: string;
  /**
   * La copia guardada, mientras llega la de verdad: se lee, no se toca. Sin
   * sondeo, sin marcar leído, sin mandar — la que viene detrás hace todo eso.
   */
  soloVista?: boolean;
}) {
  const router = useRouter();
  const [chat, setChat] = useState(chatInicial);
  // Del más viejo al más nuevo: es como se leen. El servidor los manda al
  // revés porque la primera página es la del final.
  const [mensajes, setMensajes] = useState(() => [...primeros].reverse());
  const [cursor, setCursor] = useState(cursorInicial);
  const [cargandoViejos, setCargandoViejos] = useState(false);
  const [texto, setTexto] = useState("");
  const [respondiendo, setRespondiendo] = useState<MensajeEnPantalla | null>(
    null
  );
  /**
   * Las fotos elegidas que todavía no salieron.
   *
   * Esperan acá —con su miniatura arriba del campo— y salen **con lo que se
   * escriba**, en un solo mensaje, como en WhatsApp. La miniatura es una URL
   * de objeto del navegador, no la foto subida: se ve al instante y no gasta
   * una subida que todavía puede cancelarse. Al enviar, la URL pasa a la cola
   * —que la dibuja mientras sube— y es la cola la que la suelta.
   */
  const [pendientes, setPendientes] = useState<
    { archivo: File; vista: string }[]
  >([]);
  /** La info del chat, que se abre tocando el nombre. */
  const [infoAbierta, setInfoAbierta] = useState(false);
  const [viendo, setViendo] = useState<{ url: string; tipo: string } | null>(
    null
  );
  /** El mensaje que alguien mantuvo apretado, en el teléfono. */
  const [tocado, setTocado] = useState<MensajeEnPantalla | null>(null);
  /** El mensaje propio del que se está mirando quién lo leyó. */
  const [infoDe, setInfoDe] = useState<MensajeEnPantalla | null>(null);
  /**
   * El mensaje resaltado: el que trajo el buscador, o el que se citó y se
   * acaba de tocar. Es un destello y no una marca fija —se apaga solo a los
   * dos segundos—, porque una vez que la vista llegó ahí ya cumplió.
   */
  const [resaltado, setResaltado] = useState<string | null>(destacado ?? null);
  useEffect(() => {
    if (!resaltado) return;
    const id = setTimeout(() => setResaltado(null), 2000);
    return () => clearTimeout(id);
  }, [resaltado]);

  /** Quien escribe, para dibujar lo suyo antes de que el servidor conteste. */
  const yo = useMemo(() => {
    const m = chat.miembros.find((x) => x.soyYo);
    return { id: m?.id ?? "", nombre: m?.nombre ?? "Tú" };
  }, [chat.miembros]);

  /** Lo que espera en la cola, de este chat, dibujado al final de la lista. */
  const cola = useCola();
  const enPantalla = useMemo(
    () =>
      mezclarConLaCola(
        mensajes,
        cola.filter((i) => i.chatId === chat.id),
        yo
      ),
    [mensajes, cola, chat.id, yo]
  );

  /**
   * Ir a un mensaje: al que cita una respuesta. Si está cargado se va hasta él
   * y se lo hace destellar; si quedó más atrás de lo que se trajo, se vuelve a
   * abrir la conversación alrededor de él, que es lo que hace el buscador.
   */
  function irAlMensaje(id: string) {
    const el = document.getElementById(`mensaje-${id}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setResaltado(id);
    } else {
      router.push(`/dashboard/chats/${chat.id}?mensaje=${id}`);
    }
  }

  const scroll = useRef<HTMLDivElement>(null);
  const archivos = useRef<HTMLInputElement>(null);

  const irAlFondo = useCallback((suave = false) => {
    const caja = scroll.current;
    if (!caja) return;
    caja.scrollTo({
      top: caja.scrollHeight,
      behavior: suave ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    // Llegando desde el buscador se va **al mensaje**, no al final: el final
    // puede estar a cien mensajes de lo que la persona vino a leer.
    if (destacado) {
      const el = document.getElementById(`mensaje-${destacado}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
      } else {
        irAlFondo();
      }
    } else {
      irAlFondo();
    }
    if (soloVista) return;
    // Abrir el chat **es** leerlo.
    fetch(`/api/chats/${chat.id}/leido`, { method: "POST" }).catch(() => {});
  }, [chat.id, destacado, irAlFondo, soloVista]);

  // La copia local, para la próxima vez: la tanda más nueva, con lo que el
  // servidor dijo de cada mensaje. Nunca desde el buscador —esa página es
  // el medio del chat, no el final— ni desde la copia misma.
  useEffect(() => {
    if (soloVista || destacado) return;
    guardarChat(chat.id, chat, mensajes, cursor);
  }, [soloVista, destacado, chat, mensajes, cursor]);

  // Un mensaje de la cola que volvió del servidor se pega a la lista acá, sin
  // esperar al próximo sondeo: es lo que hace que el ✓ pase a ✓✓ al instante.
  useEffect(() => {
    if (soloVista) return;
    return onEnviado((chatId, m) => {
      if (chatId !== chat.id) return;
      setMensajes((actuales) =>
        actuales.some((x) => x.id === m.id) ? actuales : [...actuales, m]
      );
    });
  }, [chat.id, soloVista]);

  /** Trae la página más nueva y pega lo que no estaba. */
  const buscarNuevos = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${chat.id}/mensajes`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: MensajeEnPantalla[] };
      const llegaron = [...data.items].reverse();
      // Lo que estaba en la cola y ya vino por acá, dejó de esperar.
      llegaron.forEach((m) => {
        if (m.idCliente) confirmarLlegada(m.idCliente);
      });
      setMensajes((actuales) => {
        const conocidos = new Set(actuales.map((m) => m.id));
        const nuevos = llegaron.filter((m) => !conocidos.has(m.id));
        // Los conocidos se refrescan siempre: cambia el estado —lo leyeron—
        // o uno se borró, sin perder los viejos de arriba.
        const porId = new Map(llegaron.map((m) => [m.id, m]));
        const refrescados = actuales.map((m) => porId.get(m.id) ?? m);
        return nuevos.length === 0 ? refrescados : [...refrescados, ...nuevos];
      });
    } catch {
      // Un pedido que falla no interrumpe nada: el siguiente lo intenta.
    }
  }, [chat.id]);

  useEffect(() => {
    if (soloVista) return;
    const tic = setInterval(() => {
      if (document.visibilityState === "visible") {
        buscarNuevos();
        fetch(`/api/chats/${chat.id}/leido`, { method: "POST" }).catch(() => {});
        // Y lo que esté esperando en la cola, que lo vuelva a intentar.
        void procesar();
      }
    }, CADA_MS);
    return () => clearInterval(tic);
  }, [buscarNuevos, chat.id, soloVista]);

  const cargarViejos = useCallback(async () => {
    if (!cursor || cargandoViejos) return;
    setCargandoViejos(true);
    const caja = scroll.current;
    const altoAntes = caja?.scrollHeight ?? 0;
    try {
      const res = await fetch(
        `/api/chats/${chat.id}/mensajes?cursor=${cursor}`
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        items: MensajeEnPantalla[];
        cursor: string | null;
      };
      setMensajes((actuales) => [...[...data.items].reverse(), ...actuales]);
      setCursor(data.cursor);
      // Que el dedo no pierda el lugar: se agregó contenido **arriba**.
      requestAnimationFrame(() => {
        if (caja) caja.scrollTop = caja.scrollHeight - altoAntes;
      });
    } catch {
      toast.error("No pudimos traer los mensajes anteriores");
    } finally {
      setCargandoViejos(false);
    }
  }, [cursor, cargandoViejos, chat.id]);

  /**
   * Los mensajes anteriores llegan solos al subir, como en la app: un
   * centinela arriba de todo, y cuando asoma en la caja del scroll se pide la
   * página anterior. Era un botón, y un botón es una decisión que WhatsApp no
   * pide. Con pocos mensajes el centinela está a la vista desde el principio,
   * así que trae páginas hasta llenar la pantalla, que es lo que se quiere.
   */
  const centinela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (soloVista || !cursor) return;
    const el = centinela.current;
    const raiz = scroll.current;
    if (!el || !raiz) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void cargarViejos();
      },
      { root: raiz, rootMargin: "120px 0px 0px 0px" }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [soloVista, cursor, cargarViejos]);

  /**
   * Enviar: a la cola, y a la pantalla en el acto. Lo que se escribió se
   * limpia ya, porque el mensaje ya está en la conversación con su ✓; si el
   * servidor lo rechaza, aparece ahí mismo con su motivo y sus dos botones.
   */
  function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo && pendientes.length === 0) return;
    const item: MensajeEnCola = {
      idCliente: nuevoIdCliente(),
      chatId: chat.id,
      texto: cuerpo || null,
      fotos: pendientes.map((p) => ({
        uri: p.vista,
        nombre: p.archivo.name,
        contentType: p.archivo.type,
        tipo: p.archivo.type.startsWith("video/") ? "video" : "imagen",
      })),
      respondeA: respondiendo
        ? {
            id: respondiendo.id,
            autorNombre: respondiendo.autorNombre,
            texto: respondiendo.texto,
            borrado: respondiendo.borrado,
            fotos: respondiendo.fotos.length,
            miniatura: respondiendo.fotos[0]
              ? { url: respondiendo.fotos[0].url, tipo: respondiendo.fotos[0].tipo }
              : null,
          }
        : null,
      creadoEl: new Date().toISOString(),
      estado: "pendiente",
    };
    encolar(
      item,
      pendientes.map((p) => p.archivo)
    );
    setTexto("");
    setRespondiendo(null);
    // Las URLs de objeto pasan a ser de la cola: las suelta ella al terminar.
    setPendientes([]);
    requestAnimationFrame(() => irAlFondo(true));
  }

  /** Elegir **no manda**: la foto espera arriba del campo hasta que se envíe. */
  function elegirFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const nuevas = Array.from(lista)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) }));
    setPendientes((actuales) => [...actuales, ...nuevas].slice(0, 10));
    if (archivos.current) archivos.current.value = "";
  }

  function quitarPendiente(i: number) {
    setPendientes((actuales) => {
      URL.revokeObjectURL(actuales[i].vista);
      return actuales.filter((_, j) => j !== i);
    });
  }

  // Las URLs de objeto viven hasta que alguien las suelte; si la pantalla se
  // va con fotos esperando (sin enviar), quedarían colgadas en memoria.
  useEffect(
    () => () => pendientes.forEach((p) => URL.revokeObjectURL(p.vista)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function borrar(id: string) {
    try {
      const res = await fetch(`/api/chats/mensajes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setMensajes((actuales) =>
        actuales.map((m) =>
          m.id === id ? { ...m, borrado: true, texto: null, fotos: [] } : m
        )
      );
    } catch {
      toast.error("No pudimos borrar el mensaje");
    }
  }

  /**
   * Copiar el mensaje **entero**: el texto y, si tiene, su primera imagen,
   * como hace WhatsApp. Van juntos en un solo `ClipboardItem`, así al pegar en
   * un correo o un documento entran los dos.
   *
   * El navegador solo acepta PNG en el portapapeles, y las fotos son JPEG: se
   * baja la imagen —R2 permite CORS, así que el lienzo no queda "manchado"— y
   * se vuelve a codificar. Un video no se copia: ningún portapapeles lo toma.
   *
   * Si la foto no entra —sin HTTPS no hay `navigator.clipboard`, y una imagen
   * que el navegador ya dibujó en un `<img>` puede negarse a bajar con CORS—
   * va lo que sí se puede: el texto, o el enlace de la foto. "No hay nada
   * para copiar" se decía justo en ese caso, con la foto ahí a la vista.
   */
  async function copiar(mensaje: MensajeEnPantalla) {
    const texto = mensaje.texto ?? "";
    const foto = mensaje.fotos.find((f) => f.tipo !== "video");
    if (!texto && !foto) {
      toast.error("No hay nada para copiar");
      return;
    }
    try {
      if (
        foto &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write
      ) {
        // La imagen va como **promesa**, no ya bajada: Safari solo acepta el
        // `write` dentro del gesto del usuario, y esperar la descarga antes de
        // llamarlo es salirse de él.
        const png = aPng(foto.url).then((b) => {
          if (!b) throw new Error("No se pudo convertir la foto a PNG");
          return b;
        });
        const partes: Record<string, Blob | Promise<Blob>> = { "image/png": png };
        if (texto) partes["text/plain"] = new Blob([texto], { type: "text/plain" });
        try {
          await navigator.clipboard.write([new ClipboardItem(partes)]);
          toast.success(texto ? "Copiados el texto y la foto" : "Foto copiada");
          return;
        } catch (error) {
          // Que quede en la consola: "no pudimos" sin el motivo es lo que hace
          // que el siguiente reporte llegue sin nada para mirar.
          console.warn("No se pudo copiar la foto; va el texto", error);
        }
      }
      await copiarTexto(texto || foto!.url);
      toast.success(texto ? "Copiado" : "Copiado el enlace de la foto");
    } catch (error) {
      console.warn("No se pudo copiar", error);
      toast.error("No pudimos copiar");
    }
  }

  const otros = chat.miembros.filter((m) => !m.soyYo);

  return (
    <div className="-mx-3 -my-3 flex h-[calc(100%+1.5rem)] min-h-0 flex-col md:mx-0 md:my-0 md:h-full">
      {/* El encabezado, con la forma de la app: el chevron, el nombre con
          quiénes están debajo, y el lápiz. Una fila baja y de borde a borde:
          en el teléfono la conversación ocupa la pantalla, no una tarjeta
          adentro de una página con margen. En el escritorio la lista está al
          lado, así que el chevron no hace falta. */}
      <div className="flex flex-none items-center gap-1 border-b border-border px-1 pb-1.5 md:px-4 md:py-2.5">
        <Link href={hrefDeVuelta(from, "/dashboard/chats")} className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </Link>
        {/* El nombre **es** el botón de la info, como en WhatsApp: tocarlo
            abre la foto, la gente y los archivos. El lápiz que había vive
            ahora adentro, como *Editar*. */}
        <button
          type="button"
          onClick={() => setInfoAbierta(true)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 pr-2 text-left hover:bg-muted/60 md:pl-1"
        >
          <AvatarDeChat nombre={chat.nombre} imagenUrl={chat.imagenUrl} size={36} />
          <span className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">
              {chat.nombre}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {otros.length === 0
                ? "Solo tú"
                : `Tú y ${otros.map((m) => m.nombre).join(", ")}`}
            </p>
          </span>
        </button>
      </div>

      <Conectando />

      {/* Los mensajes */}
      {/* Los mensajes se apoyan **abajo**, como en WhatsApp: con pocos, el
          hueco queda arriba y no debajo del último, que es donde uno mira.
          Con `mt-auto` en el contenido y **no** con `justify-end` en la caja:
          en flexbox, lo que desborda de una caja con `justify-content:
          flex-end` se va por arriba del origen del scroll y no hay forma de
          llegar a ello — la conversación se cortaba y no subía. */}
      <div
        ref={scroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2.5 py-2 md:px-6"
      >
        {/* Los mensajes seguidos casi se tocan: lo que separa es el cambio de
            quién habla, no el aire entre burbujas. */}
        <div className="mt-auto space-y-0.5">
        {cursor ? (
          <div
            ref={centinela}
            className="flex h-8 items-center justify-center text-xs text-muted-foreground"
          >
            {cargandoViejos ? "Cargando..." : null}
          </div>
        ) : null}

        {enPantalla.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay mensajes. Escribe el primero.
          </p>
        ) : null}

        {enPantalla.map((m, i) => {
          const anterior = enPantalla[i - 1];
          const cambiaElDia =
            !anterior || !mismoDia(anterior.createdAt, m.createdAt);
          // El nombre se repite solo cuando cambia quién habla: una fila de
          // seis mensajes del mismo con su nombre seis veces es ruido.
          const mismoAutor =
            anterior && anterior.autorId === m.autorId && !cambiaElDia;
          return (
            <div key={m.id} id={`mensaje-${m.id}`}>
              {cambiaElDia ? (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {tituloDelDia(m.createdAt)}
                  </span>
                </div>
              ) : null}
              <Burbuja
                mensaje={m}
                destacado={m.id === resaltado}
                conNombre={!m.mio && !mismoAutor}
                onIrACita={irAlMensaje}
                onResponder={() => setRespondiendo(m)}
                onCopiar={() => copiar(m)}
                onBorrar={() => borrar(m.id)}
                onInfo={() => setInfoDe(m)}
                onReintentar={() => m.idCliente && reintentar(m.idCliente)}
                onDescartar={() => m.idCliente && descartar(m.idCliente)}
                onVerFoto={setViendo}
                onMantener={() => setTocado(m)}
              />
            </div>
          );
        })}
        </div>
      </div>

      {/* Lo que se está por mandar */}
      <div className="flex-none border-t border-border px-2 py-1.5 md:px-4 md:py-2">
        {respondiendo ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-primary bg-muted/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-primary">
                {respondiendo.mio ? "Tú" : respondiendo.autorNombre}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {respondiendo.texto ??
                  etiquetaDeAdjuntos(
                    respondiendo.fotos[0]?.tipo,
                    respondiendo.fotos.length
                  )}
              </p>
            </div>
            {respondiendo.fotos[0] ? (
              <Miniatura
                url={respondiendo.fotos[0].url}
                tipo={respondiendo.fotos[0].tipo}
                className="h-10 w-10 flex-none overflow-hidden rounded-md"
              />
            ) : null}
            <button
              type="button"
              onClick={() => setRespondiendo(null)}
              aria-label="Cancelar la respuesta"
              className="flex-none rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Las fotos que están por salir: se ven, se sacan de la tanda con su
            ✕, y recién salen cuando alguien toca enviar. */}
        {pendientes.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5 px-0.5">
            {pendientes.map((p, i) => (
              <span
                key={p.vista}
                className="relative h-14 w-14 overflow-hidden rounded-lg border border-border"
              >
                <Miniatura
                  url={p.vista}
                  tipo={p.archivo.type.startsWith("video/") ? "video" : "imagen"}
                  className="h-full w-full"
                />
                <button
                  type="button"
                  onClick={() => quitarPendiente(i)}
                  aria-label={`Quitar ${p.archivo.name}`}
                  className="absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-foreground/60 text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <input
            ref={archivos}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => elegirFotos(e.target.files)}
          />
          {/* Ícono pelado, como en la app: al lado de un campo redondeado, un
              botón con borde compite con él. Los tres del mismo alto. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-none text-muted-foreground"
            aria-label="Mandar una foto"
            disabled={soloVista}
            onClick={() => archivos.current?.click()}
          >
            <ImageIcon className="h-[22px] w-[22px]" />
          </Button>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            rows={1}
            // La copia guardada no manda: lo que se escriba mientras llega la
            // página se perdería con ella.
            readOnly={soloVista}
            // 36 de alto, los mismos que los botones: `leading-6` y `py-[5px]`
            // para que mida lo mismo en los dos tamaños de letra.
            className="max-h-32 min-h-9 flex-1 resize-none rounded-full px-3.5 py-[5px] leading-6"
            onKeyDown={(e) => {
              // Enter manda, Shift+Enter hace un renglón: es lo que hacen los
              // dedos que vienen de WhatsApp.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-none rounded-full"
            aria-label="Enviar"
            onClick={() => enviar()}
            // Se puede mandar con texto **o** con fotos esperando: una foto
            // sola es un mensaje, y con pie de foto también.
            disabled={soloVista || (!texto.trim() && pendientes.length === 0)}
          >
            <Send className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>

      <InfoDelChat
        chat={chat}
        abierto={infoAbierta}
        onClose={() => setInfoAbierta(false)}
        onChatActualizado={async () => {
          const res = await fetch(`/api/chats/${chat.id}`);
          if (res.ok) setChat(await res.json());
          router.refresh();
        }}
        onIrAlMensaje={irAlMensaje}
      />

      {/* Lo que se puede hacer con un mensaje, en el teléfono: mantenerlo
          apretado abre un cajón, igual que en la app. El ⋯ es de escritorio,
          donde hay un mouse que pasa por encima. */}
      <Sheet open={tocado !== null} onOpenChange={(v) => !v && setTocado(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
        >
          <SheetTitle className="sr-only">Acciones del mensaje</SheetTitle>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              const m = tocado;
              setTocado(null);
              if (m) setRespondiendo(m);
            }}
          >
            <Reply className="h-5 w-5 flex-none text-muted-foreground" />
            Responder
          </button>
          {tocado && (tocado.texto || tocado.fotos.some((f) => f.tipo !== "video")) ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                const m = tocado;
                setTocado(null);
                copiar(m);
              }}
            >
              <Copy className="h-5 w-5 flex-none text-muted-foreground" />
              Copiar
            </button>
          ) : null}
          {tocado?.mio ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                const m = tocado;
                setTocado(null);
                setInfoDe(m);
              }}
            >
              <Info className="h-5 w-5 flex-none text-muted-foreground" />
              Info
            </button>
          ) : null}
          {tocado?.mio ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm text-destructive hover:bg-muted"
              onClick={() => {
                const id = tocado.id;
                setTocado(null);
                borrar(id);
              }}
            >
              <Trash2 className="h-5 w-5 flex-none" />
              Borrar
            </button>
          ) : null}
        </SheetContent>
      </Sheet>

      <InfoDeMensajeDialogo mensaje={infoDe} onClose={() => setInfoDe(null)} />

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </div>
  );
}

/**
 * Quién leyó un mensaje propio, y cuándo. La pantalla de WhatsApp: el mensaje
 * arriba, tal cual se ve en la conversación, y debajo la lista de quiénes lo
 * leyeron —el más reciente primero— y a quiénes les falta. En el teléfono
 * ocupa la pantalla; en el escritorio es un diálogo.
 */
function InfoDeMensajeDialogo({
  mensaje,
  onClose,
}: {
  mensaje: MensajeEnPantalla | null;
  onClose: () => void;
}) {
  const [cargada, setCargada] = useState<{
    id: string;
    info?: InfoDeMensaje;
    error?: string;
  } | null>(null);
  const id = mensaje?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    fetch(`/api/chats/mensajes/${id}/info`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "No pudimos traer la info");
        return d as InfoDeMensaje;
      })
      .then((info) => vivo && setCargada({ id, info }))
      .catch((e) => vivo && setCargada({ id, error: e.message }));
    return () => {
      vivo = false;
    };
  }, [id]);

  // Lo cargado para otro mensaje no sirve para este.
  const actual = cargada?.id === id ? cargada : null;
  const aDibujar = actual?.info?.mensaje ?? mensaje;

  return (
    <Dialog open={mensaje !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        pantallaCompletaEnMovil
        showCloseButton={false}
        className="gap-0 sm:max-w-md"
      >
        <div className="-mx-4 -mt-4 mb-3 flex flex-none items-center gap-1 border-b border-border px-1 py-1.5">
          <Button variant="ghost" size="icon" aria-label="Volver" onClick={onClose}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <DialogTitle className="flex-1 text-center text-base">
            Info del mensaje
          </DialogTitle>
          <span className="h-9 w-9" aria-hidden />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {aDibujar ? (
            <div className="rounded-xl bg-muted/50 px-2.5 py-3">
              <div className="flex justify-center pb-3">
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {tituloDelDia(aDibujar.createdAt)}
                </span>
              </div>
              <Burbuja mensaje={aDibujar} conNombre={false} soloLectura />
            </div>
          ) : null}

          {actual?.error ? (
            <p className="text-center text-sm text-destructive">{actual.error}</p>
          ) : null}

          {actual?.info ? (
            <>
              <section>
                <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <CheckCheck className="h-4 w-4 text-sky-500" />
                  Leído por
                </p>
                {actual.info.leidoPor.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    Todavía nadie.
                  </p>
                ) : (
                  <ul className="divide-y rounded-xl border border-border">
                    {actual.info.leidoPor.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                        <InitialsAvatar name={p.nombre} size={36} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.nombre}
                        </span>
                        <span className="flex-none text-xs text-muted-foreground">
                          {cuandoLeyo(p.leidoEl)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {actual.info.sinLeer.length > 0 ? (
                <section>
                  <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <CheckCheck className="h-4 w-4" />
                    Sin leer
                  </p>
                  <ul className="divide-y rounded-xl border border-border">
                    {actual.info.sinLeer.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                        <InitialsAvatar name={p.nombre} size={36} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.nombre}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : !actual?.error ? (
            <p className="text-center text-sm text-muted-foreground">Cargando...</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cuánto hay que sostener el dedo para que aparezcan las acciones. */
const MANTENER_MS = 400;
/** Cuánto hay que correr el mensaje con el dedo para que el gesto cuente. */
const UMBRAL_DESLIZAR = 56;
/** Hasta dónde acompaña el mensaje al dedo. */
const TOPE_DESLIZAR = 88;

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco — la convención que todo el mundo ya sabe leer.
 *
 * **Las acciones se abren distinto según con qué se esté mirando**: en
 * escritorio, con el ⋯ que aparece al pasar el mouse por encima; en el
 * teléfono, manteniendo el mensaje apretado, que es lo que hace la app y lo
 * que hacen los dedos que vienen de WhatsApp. Y los dos gestos de WhatsApp:
 * **correr el mensaje a la derecha responde**, y correr uno propio a la
 * izquierda abre su info. El dedo se distingue del scroll por la primera
 * dirección en que se mueve: hacia abajo es scroll y el gesto se rinde;
 * hacia el costado es el gesto y el mensaje acompaña al dedo, con tope.
 */
function Burbuja({
  mensaje,
  destacado = false,
  conNombre,
  soloLectura = false,
  onResponder,
  onCopiar,
  onBorrar,
  onInfo,
  onReintentar,
  onDescartar,
  onVerFoto,
  onMantener,
  onIrACita,
}: {
  mensaje: MensajeEnPantalla;
  /** El que se vino a ver desde el buscador. */
  destacado?: boolean;
  conNombre: boolean;
  /** Dibujado en la info del mensaje: sin gestos ni menú. */
  soloLectura?: boolean;
  onResponder?: () => void;
  onCopiar?: () => void;
  onBorrar?: () => void;
  onInfo?: () => void;
  onReintentar?: () => void;
  onDescartar?: () => void;
  onVerFoto?: (media: { url: string; tipo: string }) => void;
  onMantener?: () => void;
  /** Tocar la cita lleva al mensaje citado, como en WhatsApp. */
  onIrACita?: (id: string) => void;
}) {
  const mio = mensaje.mio;
  const enCola = mensaje.estado === "pendiente" || mensaje.estado === "fallido";
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fila = useRef<HTMLDivElement>(null);
  const iconoResponder = useRef<HTMLSpanElement>(null);
  const iconoInfo = useRef<HTMLSpanElement>(null);
  const gesto = useRef<{
    x: number;
    y: number;
    dx: number;
    modo: "?" | "deslizar" | "no";
  } | null>(null);

  function soltar() {
    if (reloj.current) {
      clearTimeout(reloj.current);
      reloj.current = null;
    }
  }
  // Si el mensaje se va mientras el dedo está apoyado, el temporizador
  // quedaría corriendo contra un componente que ya no está.
  useEffect(() => soltar, []);

  const puedeInfo = mio && !enCola && !mensaje.borrado && Boolean(onInfo);
  const puedeResponder = !enCola && !mensaje.borrado && Boolean(onResponder);

  function acompanar(dx: number) {
    const el = fila.current;
    if (!el) return;
    const hastaDerecha = puedeResponder ? TOPE_DESLIZAR : 0;
    const hastaIzquierda = puedeInfo ? -TOPE_DESLIZAR : 0;
    const t = Math.max(hastaIzquierda, Math.min(hastaDerecha, dx));
    el.style.transition = "none";
    el.style.transform = `translateX(${t}px)`;
    const progreso = Math.min(1, Math.abs(t) / UMBRAL_DESLIZAR);
    if (iconoResponder.current) {
      iconoResponder.current.style.opacity = t > 0 ? String(progreso) : "0";
    }
    if (iconoInfo.current) {
      iconoInfo.current.style.opacity = t < 0 ? String(progreso) : "0";
    }
  }

  function volver() {
    const el = fila.current;
    if (!el) return;
    el.style.transition = "transform 220ms cubic-bezier(0.23, 1, 0.32, 1)";
    el.style.transform = "translateX(0)";
    if (iconoResponder.current) iconoResponder.current.style.opacity = "0";
    if (iconoInfo.current) iconoInfo.current.style.opacity = "0";
  }

  const gestos =
    mensaje.borrado || soloLectura
      ? {}
      : {
          onPointerDown: (e: React.PointerEvent) => {
            // Con mouse no: ahí está el ⋯, y un clic sostenido es cómo se
            // selecciona texto.
            if (e.pointerType === "mouse") return;
            soltar();
            gesto.current = { x: e.clientX, y: e.clientY, dx: 0, modo: "?" };
            if (onMantener && !enCola) {
              reloj.current = setTimeout(onMantener, MANTENER_MS);
            }
          },
          onPointerMove: (e: React.PointerEvent) => {
            const g = gesto.current;
            if (!g) return;
            const dx = e.clientX - g.x;
            const dy = e.clientY - g.y;
            if (g.modo === "?") {
              // La primera dirección decide: hacia abajo es scroll.
              if (Math.abs(dy) > 10) {
                g.modo = "no";
                return;
              }
              if (Math.abs(dx) > 12 && (puedeResponder || puedeInfo)) {
                g.modo = "deslizar";
                soltar();
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }
            if (g.modo === "deslizar") {
              g.dx = dx;
              acompanar(dx);
            }
          },
          onPointerUp: () => {
            soltar();
            const g = gesto.current;
            gesto.current = null;
            if (g?.modo !== "deslizar") return;
            if (g.dx >= UMBRAL_DESLIZAR && puedeResponder) onResponder?.();
            else if (g.dx <= -UMBRAL_DESLIZAR && puedeInfo) onInfo?.();
            volver();
          },
          onPointerCancel: () => {
            soltar();
            if (gesto.current?.modo === "deslizar") volver();
            gesto.current = null;
          },
          // Sin esto iOS abre su propio menú de copiar encima del nuestro.
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };

  return (
    <div
      className={`group relative flex gap-1 ${mio ? "justify-end" : "justify-start"}`}
      // `pan-y`: el scroll vertical sigue siendo del navegador; el horizontal
      // llega acá como movimiento del puntero.
      style={{ touchAction: "pan-y" }}
      {...gestos}
    >
      {mio && !soloLectura ? (
        <Acciones
          mensaje={mensaje}
          onResponder={onResponder}
          onCopiar={onCopiar}
          onBorrar={onBorrar}
          onInfo={onInfo}
        />
      ) : null}
      <div ref={fila} className={`relative flex max-w-[85%] flex-col sm:max-w-[70%] ${mio ? "items-end" : "items-start"}`}>
        {/* Los íconos que asoman detrás del mensaje mientras se lo corre. */}
        {puedeResponder ? (
          <span
            ref={iconoResponder}
            aria-hidden
            className="pointer-events-none absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0"
          >
            <Reply className="h-4 w-4" />
          </span>
        ) : null}
        {puedeInfo ? (
          <span
            ref={iconoInfo}
            aria-hidden
            className="pointer-events-none absolute -right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0"
          >
            <Info className="h-4 w-4" />
          </span>
        ) : null}
      <div
        className={`w-fit max-w-full touch-manipulation select-none rounded-2xl px-2.5 py-1.5 text-sm shadow-sm sm:select-text ${
          mio
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-card"
        } transition-shadow duration-500 ${destacado ? "ring-2 ring-amber-400" : ""} ${
          mensaje.estado === "fallido" ? "opacity-80" : ""
        }`}
      >
        {conNombre ? (
          <p className="pb-0.5 text-xs font-bold text-primary">
            {mensaje.autorNombre}
          </p>
        ) : null}

        {mensaje.respondeA ? (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onIrACita?.(mensaje.respondeA!.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onIrACita?.(mensaje.respondeA!.id);
            }}
            className={`mb-1 flex cursor-pointer items-center gap-2 rounded-lg border-l-[3px] px-2 py-1 text-xs ${
              mio
                ? "border-primary-foreground/60 bg-primary-foreground/15"
                : "border-primary bg-muted"
            }`}
          >
            <span className="min-w-0 flex-1">
              <p className="font-bold">{mensaje.respondeA.autorNombre}</p>
              <p className="line-clamp-2 opacity-80">
                {mensaje.respondeA.borrado
                  ? "Mensaje borrado"
                  : (mensaje.respondeA.texto ??
                    etiquetaDeAdjuntos(
                      mensaje.respondeA.miniatura?.tipo,
                      mensaje.respondeA.fotos
                    ))}
              </p>
            </span>
            {/* La miniatura de lo citado, como en WhatsApp: "📷 Foto" no dice
                cuál de todas. */}
            {mensaje.respondeA.miniatura ? (
              <Miniatura
                url={mensaje.respondeA.miniatura.url}
                tipo={mensaje.respondeA.miniatura.tipo}
                className="h-9 w-9 flex-none overflow-hidden rounded-md"
              />
            ) : null}
          </div>
        ) : null}

        {mensaje.borrado ? (
          <p className="italic opacity-70">Mensaje borrado</p>
        ) : (
          <>
            {mensaje.fotos.length > 0 ? (
              <div
                className={`grid gap-1 ${
                  mensaje.fotos.length > 1 ? "grid-cols-2" : "grid-cols-1"
                } ${mensaje.texto ? "mb-1.5" : ""}`}
              >
                {mensaje.fotos.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onVerFoto?.({ url: f.url, tipo: f.tipo })}
                    className="overflow-hidden rounded-lg"
                  >
                    <Miniatura url={f.url} tipo={f.tipo} className="h-40 w-full" />
                  </button>
                ))}
              </div>
            ) : null}
            {mensaje.texto ? (
              <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
            ) : null}
          </>
        )}

        <p
          className={`flex items-center justify-end gap-1 pt-0.5 text-[10px] ${
            mio ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {horaDeMensaje(mensaje.createdAt)}
          {mio && !mensaje.borrado ? <Vistos estado={mensaje.estado} /> : null}
        </p>
      </div>
      {/* El servidor dijo que no: el motivo y qué hacer, al pie del mensaje. */}
      {mensaje.estado === "fallido" && !soloLectura ? (
        <p className="flex flex-wrap items-center justify-end gap-x-2 pt-0.5 text-[11px] text-destructive">
          <span>{mensaje.error ?? "No se envió"}</span>
          <button type="button" className="font-bold underline" onClick={onReintentar}>
            Reintentar
          </button>
          <button type="button" className="font-bold underline" onClick={onDescartar}>
            Eliminar
          </button>
        </p>
      ) : null}
      </div>
      {mio || soloLectura ? null : (
        <Acciones
          mensaje={mensaje}
          onResponder={onResponder}
          onCopiar={onCopiar}
          onBorrar={onBorrar}
          onInfo={onInfo}
        />
      )}
    </div>
  );
}

function Acciones({
  mensaje,
  onResponder,
  onCopiar,
  onBorrar,
  onInfo,
}: {
  mensaje: MensajeEnPantalla;
  onResponder?: () => void;
  onCopiar?: () => void;
  onBorrar?: () => void;
  onInfo?: () => void;
}) {
  const enCola = mensaje.estado === "pendiente" || mensaje.estado === "fallido";
  if (mensaje.borrado || enCola) {
    return <span className="hidden w-7 flex-none sm:block" aria-hidden />;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Acciones del mensaje"
            // Solo en escritorio: en el teléfono las acciones salen
            // manteniendo el mensaje apretado.
            className="mt-1 hidden h-7 w-7 flex-none self-end rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 sm:block"
          />
        }
      >
        <MoreVertical className="mx-auto h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {/* Sin íconos, como el resto del menú y como los ⋯ de toda la casa. */}
        <DropdownMenuItem onClick={onResponder}>Responder</DropdownMenuItem>
        {mensaje.texto || mensaje.fotos.some((f) => f.tipo !== "video") ? (
          <DropdownMenuItem onClick={onCopiar}>Copiar</DropdownMenuItem>
        ) : null}
        {mensaje.mio ? (
          <DropdownMenuItem onClick={onInfo}>Info</DropdownMenuItem>
        ) : null}
        {mensaje.mio ? (
          <DropdownMenuItem onClick={onBorrar}>Borrar</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Baja una imagen y la devuelve como PNG, que es lo único que el portapapeles acepta. */
async function aPng(url: string): Promise<Blob | null> {
  // `no-store`: si el navegador ya tiene esa imagen en caché por haberla
  // dibujado en un <img> sin `crossorigin`, la copia guardada no trae las
  // cabeceras CORS y este `fetch` falla contra la caché aunque R2 las mande.
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  const lienzo = document.createElement("canvas");
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;
  lienzo.getContext("2d")?.drawImage(bitmap, 0, 0);
  return await new Promise((resolver) =>
    lienzo.toBlob((b) => resolver(b), "image/png")
  );
}

/**
 * Texto al portapapeles, con o sin `navigator.clipboard`: fuera de HTTPS
 * (el portal abierto por IP desde otra máquina) no existe, y `execCommand`
 * sigue funcionando ahí.
 */
async function copiarTexto(texto: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const copiado = document.execCommand("copy");
  area.remove();
  if (!copiado) throw new Error("execCommand('copy') devolvió false");
}
