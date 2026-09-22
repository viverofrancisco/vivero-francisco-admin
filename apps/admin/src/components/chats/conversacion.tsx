"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { MediaViewer } from "@/components/ui/media-viewer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  Copy,
  ImageIcon,
  MoreVertical,
  Reply,
  Send,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { hrefDeVuelta } from "@/lib/navegacion";
import { ChatForm } from "./chat-form";
import { horaDeMensaje, mismoDia, tituloDelDia } from "./formato";

export interface MensajeEnPantalla {
  id: string;
  texto: string | null;
  fotos: { id: string; url: string; tipo: string }[];
  createdAt: string;
  borrado: boolean;
  autorId: string | null;
  autorNombre: string;
  mio: boolean;
  respondeA: {
    id: string;
    autorNombre: string;
    texto: string | null;
    borrado: boolean;
    fotos: number;
  } | null;
}

export interface ChatCabecera {
  id: string;
  nombre: string;
  puedeEditar: boolean;
  miembros: { id: string; nombre: string; rol: string; soyYo: boolean }[];
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
 */
export function Conversacion({
  chat: chatInicial,
  mensajes: primeros,
  cursor: cursorInicial,
  from,
}: {
  chat: ChatCabecera;
  mensajes: MensajeEnPantalla[];
  cursor: string | null;
  from?: string;
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
   * Antes se subían y se mandaban en el acto, así que una foto nunca podía
   * llevar texto ni juntarse con otra: cada una era su propio mensaje. Ahora
   * esperan acá —con su miniatura arriba del campo— y salen **con lo que se
   * escriba**, en un solo mensaje, como en WhatsApp.
   *
   * La miniatura es una URL de objeto del navegador, no la foto subida: se ve
   * al instante y no gasta una subida que todavía puede cancelarse.
   */
  const [pendientes, setPendientes] = useState<
    { archivo: File; vista: string }[]
  >([]);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [viendo, setViendo] = useState<string | null>(null);
  /** El mensaje que alguien mantuvo apretado, en el teléfono. */
  const [tocado, setTocado] = useState<MensajeEnPantalla | null>(null);

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
    irAlFondo();
    // Abrir el chat **es** leerlo.
    fetch(`/api/chats/${chat.id}/leido`, { method: "POST" }).catch(() => {});
  }, [chat.id, irAlFondo]);

  /** Trae la página más nueva y pega lo que no estaba. */
  const buscarNuevos = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${chat.id}/mensajes`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: MensajeEnPantalla[] };
      const llegaron = [...data.items].reverse();
      setMensajes((actuales) => {
        const conocidos = new Set(actuales.map((m) => m.id));
        const nuevos = llegaron.filter((m) => !conocidos.has(m.id));
        if (nuevos.length === 0) {
          // Puede haber cambiado algo de los que ya están —uno borrado—, así
          // que se refrescan los conocidos sin perder los viejos de arriba.
          const porId = new Map(llegaron.map((m) => [m.id, m]));
          return actuales.map((m) => porId.get(m.id) ?? m);
        }
        return [...actuales, ...nuevos];
      });
    } catch {
      // Un pedido que falla no interrumpe nada: el siguiente lo intenta.
    }
  }, [chat.id]);

  useEffect(() => {
    const tic = setInterval(() => {
      if (document.visibilityState === "visible") {
        buscarNuevos();
        fetch(`/api/chats/${chat.id}/leido`, { method: "POST" }).catch(() => {});
      }
    }, CADA_MS);
    return () => clearInterval(tic);
  }, [buscarNuevos, chat.id]);

  async function cargarViejos() {
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
  }

  /** Sube lo que esté esperando y devuelve con qué crear el mensaje. */
  async function subirPendientes(): Promise<
    { key: string; url: string; nombre: string }[]
  > {
    if (pendientes.length === 0) return [];
    const files = pendientes.map((p) => p.archivo);
    const res = await fetch(`/api/chats/${chat.id}/fotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: files.map((f) => ({ fileName: f.name, contentType: f.type })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No pudimos preparar la subida");

    await Promise.all(
      data.uploads.map((u: { uploadUrl: string }, i: number) =>
        fetch(u.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": files[i].type },
          body: files[i],
        })
      )
    );
    return data.uploads.map((u: { key: string; url: string }, i: number) => ({
      key: u.key,
      url: u.url,
      // El nombre del archivo viaja porque es lo único por lo que después se
      // puede buscar una foto.
      nombre: files[i].name,
    }));
  }

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo && pendientes.length === 0) return;
    setEnviando(true);
    try {
      const fotos = await subirPendientes();
      const res = await fetch(`/api/chats/${chat.id}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: cuerpo || null,
          fotos,
          respondeAId: respondiendo?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos enviar");
      setMensajes((actuales) => [...actuales, data as MensajeEnPantalla]);
      setTexto("");
      setRespondiendo(null);
      pendientes.forEach((p) => URL.revokeObjectURL(p.vista));
      setPendientes([]);
      requestAnimationFrame(() => irAlFondo(true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos enviar");
    } finally {
      setEnviando(false);
    }
  }

  /** Elegir **no manda**: la foto espera arriba del campo hasta que se envíe. */
  function elegirFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const nuevas = Array.from(lista)
      .filter((f) => f.type.startsWith("image/"))
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
  // va con fotos esperando, quedarían colgadas en memoria.
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

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado");
    } catch {
      toast.error("No pudimos copiar");
    }
  }

  const otros = chat.miembros.filter((m) => !m.soyYo);

  return (
    <div className="-mx-3 -my-3 flex h-[calc(100%+1.5rem)] min-h-0 flex-col md:mx-0 md:my-0 md:h-full">
      {/* El encabezado, con la forma de la app: el chevron, el nombre con
          quiénes están debajo, y el lápiz. Una fila baja y de borde a borde:
          en el teléfono la conversación ocupa la pantalla, no una tarjeta
          adentro de una página con margen. */}
      <div className="flex flex-none items-center gap-1 border-b border-border px-1 pb-1.5 md:px-0">
        <Link href={hrefDeVuelta(from, "/dashboard/chats")}>
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight">
            {chat.nombre}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {otros.length === 0
              ? "Solo tú"
              : `Tú y ${otros.map((m) => m.nombre).join(", ")}`}
          </p>
        </div>
        {chat.puedeEditar ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Editar el chat"
            onClick={() => setEditando(true)}
          >
            <SquarePen className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {/* Los mensajes */}
      {/* Los mensajes se apoyan **abajo**, como en WhatsApp: con pocos, el
          hueco queda arriba y no debajo del último, que es donde uno mira. */}
      <div
        ref={scroll}
        className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto overscroll-contain px-2.5 py-2 md:px-0"
      >
        {/* Los mensajes seguidos casi se tocan: lo que separa es el cambio de
            quién habla, no el aire entre burbujas. */}
        <div className="space-y-0.5">
        {cursor ? (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cargarViejos}
              disabled={cargandoViejos}
            >
              {cargandoViejos ? "Cargando..." : "Ver mensajes anteriores"}
            </Button>
          </div>
        ) : null}

        {mensajes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay mensajes. Escribe el primero.
          </p>
        ) : null}

        {mensajes.map((m, i) => {
          const anterior = mensajes[i - 1];
          const cambiaElDia =
            !anterior || !mismoDia(anterior.createdAt, m.createdAt);
          // El nombre se repite solo cuando cambia quién habla: una fila de
          // seis mensajes del mismo con su nombre seis veces es ruido.
          const mismoAutor =
            anterior && anterior.autorId === m.autorId && !cambiaElDia;
          return (
            <div key={m.id}>
              {cambiaElDia ? (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {tituloDelDia(m.createdAt)}
                  </span>
                </div>
              ) : null}
              <Burbuja
                mensaje={m}
                conNombre={!m.mio && !mismoAutor}
                onResponder={() => setRespondiendo(m)}
                onCopiar={() => m.texto && copiar(m.texto)}
                onBorrar={() => borrar(m.id)}
                onVerFoto={setViendo}
                onMantener={() => setTocado(m)}
              />
            </div>
          );
        })}
        </div>
      </div>

      {/* Lo que se está por mandar */}
      <div className="flex-none border-t border-border px-2 py-1.5 md:px-0">
        {respondiendo ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-primary bg-muted/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-primary">
                {respondiendo.mio ? "Tú" : respondiendo.autorNombre}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {respondiendo.texto ?? "📷 Foto"}
              </p>
            </div>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.vista}
                  alt={p.archivo.name}
                  className="h-full w-full object-cover"
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
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => elegirFotos(e.target.files)}
          />
          {/* Los tres del mismo alto: con el `size="icon"` de la casa los
              botones median 32 contra los 42 del campo, y la fila se veía
              desalineada apenas el campo estaba vacío. */}
          {/* Ícono pelado, como en la app: al lado de un campo redondeado, un
              botón con borde compite con él. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-none text-muted-foreground"
            aria-label="Mandar una foto"
            disabled={enviando}
            onClick={() => archivos.current?.click()}
          >
            <ImageIcon className="h-[22px] w-[22px]" />
          </Button>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            rows={1}
            // `leading-6` y `py-[7px]` para que mida exactamente 40 en los dos
            // tamaños: la clase base cambia de `text-base` a `text-sm` en `md`,
            // y con el interlineado de cada una el alto cambiaba con el ancho
            // de la ventana.
            // 36 de alto, los mismos que los botones: los tres eran 40 y en el
            // teléfono la fila de escribir se comía más de lo que hace falta,
            // con un círculo pesado al lado de un ícono chiquito.
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
            disabled={enviando || (!texto.trim() && pendientes.length === 0)}
          >
            <Send className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>

      {editando ? (
        <ChatForm
          chat={{
            id: chat.id,
            nombre: chat.nombre,
            miembrosIds: chat.miembros.map((m) => m.id),
          }}
          onClose={() => setEditando(false)}
          onGuardado={async () => {
            setEditando(false);
            const res = await fetch(`/api/chats/${chat.id}`);
            if (res.ok) setChat(await res.json());
            router.refresh();
          }}
        />
      ) : null}

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
          {tocado?.texto ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                const texto = tocado.texto ?? "";
                setTocado(null);
                copiar(texto);
              }}
            >
              <Copy className="h-5 w-5 flex-none text-muted-foreground" />
              Copiar texto
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

      <MediaViewer
        media={viendo ? { url: viendo, tipo: "imagen" } : null}
        onClose={() => setViendo(null)}
      />
    </div>
  );
}

/** Cuánto hay que sostener el dedo para que aparezcan las acciones. */
const MANTENER_MS = 400;

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco — la convención que todo el mundo ya sabe leer.
 *
 * **Las acciones se abren distinto según con qué se esté mirando**: en
 * escritorio, con el ⋯ que aparece al pasar el mouse por encima; en el
 * teléfono, manteniendo el mensaje apretado, que es lo que hace la app y lo
 * que hacen los dedos que vienen de WhatsApp. El ⋯ no tiene sentido ahí —no
 * hay "pasar por encima", así que había que dejarlo visible siempre, un punto
 * gris al costado de cada mensaje propio—.
 */
function Burbuja({
  mensaje,
  conNombre,
  onResponder,
  onCopiar,
  onBorrar,
  onVerFoto,
  onMantener,
}: {
  mensaje: MensajeEnPantalla;
  conNombre: boolean;
  onResponder: () => void;
  onCopiar: () => void;
  onBorrar: () => void;
  onVerFoto: (url: string) => void;
  onMantener: () => void;
}) {
  const mio = mensaje.mio;
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  function soltar() {
    if (reloj.current) {
      clearTimeout(reloj.current);
      reloj.current = null;
    }
  }
  // Si el mensaje se va mientras el dedo está apoyado, el temporizador
  // quedaría corriendo contra un componente que ya no está.
  useEffect(() => soltar, []);

  const gestos = mensaje.borrado
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          // Con mouse no: ahí está el ⋯, y un clic sostenido es cómo se
          // selecciona texto.
          if (e.pointerType === "mouse") return;
          soltar();
          reloj.current = setTimeout(onMantener, MANTENER_MS);
        },
        onPointerUp: soltar,
        onPointerCancel: soltar,
        onPointerLeave: soltar,
        // Sin esto iOS abre su propio menú de copiar encima del nuestro.
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      };

  return (
    <div
      className={`group flex gap-1 ${mio ? "justify-end" : "justify-start"}`}
      {...gestos}
    >
      {mio ? <Acciones mensaje={mensaje} onResponder={onResponder} onCopiar={onCopiar} onBorrar={onBorrar} /> : null}
      <div
        className={`max-w-[85%] touch-manipulation select-none rounded-2xl px-2.5 py-1.5 text-sm shadow-sm sm:max-w-[70%] sm:select-text ${
          mio
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-card"
        }`}
      >
        {conNombre ? (
          <p className="pb-0.5 text-xs font-bold text-primary">
            {mensaje.autorNombre}
          </p>
        ) : null}

        {mensaje.respondeA ? (
          <div
            className={`mb-1 rounded-lg border-l-[3px] px-2 py-1 text-xs ${
              mio
                ? "border-primary-foreground/60 bg-primary-foreground/15"
                : "border-primary bg-muted"
            }`}
          >
            <p className="font-bold">{mensaje.respondeA.autorNombre}</p>
            <p className="line-clamp-2 opacity-80">
              {mensaje.respondeA.borrado
                ? "Mensaje borrado"
                : (mensaje.respondeA.texto ??
                  (mensaje.respondeA.fotos === 1
                    ? "📷 Foto"
                    : `📷 ${mensaje.respondeA.fotos} fotos`))}
            </p>
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
                    onClick={() => onVerFoto(f.url)}
                    className="overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt=""
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
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
          className={`pt-0.5 text-right text-[10px] ${
            mio ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {horaDeMensaje(mensaje.createdAt)}
        </p>
      </div>
      {mio ? null : <Acciones mensaje={mensaje} onResponder={onResponder} onCopiar={onCopiar} onBorrar={onBorrar} />}
    </div>
  );
}

function Acciones({
  mensaje,
  onResponder,
  onCopiar,
  onBorrar,
}: {
  mensaje: MensajeEnPantalla;
  onResponder: () => void;
  onCopiar: () => void;
  onBorrar: () => void;
}) {
  if (mensaje.borrado) return <span className="hidden w-7 flex-none sm:block" aria-hidden />;
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
        <DropdownMenuItem onClick={onResponder}>
          <Reply className="mr-2 h-4 w-4" />
          Responder
        </DropdownMenuItem>
        {mensaje.texto ? (
          <DropdownMenuItem onClick={onCopiar}>Copiar texto</DropdownMenuItem>
        ) : null}
        {mensaje.mio ? (
          <DropdownMenuItem onClick={onBorrar}>Borrar</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
