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
import { ArrowLeft, ImagePlus, MoreVertical, Reply, Send, X } from "lucide-react";
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
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [viendo, setViendo] = useState<string | null>(null);

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

  async function subirFotos(lista: FileList): Promise<
    { key: string; url: string }[]
  > {
    const files = Array.from(lista).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return [];
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
    return data.uploads.map((u: { key: string; url: string }) => ({
      key: u.key,
      url: u.url,
    }));
  }

  async function enviar(fotos: { key: string; url: string }[] = []) {
    const cuerpo = texto.trim();
    if (!cuerpo && fotos.length === 0) return;
    setEnviando(true);
    try {
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
      requestAnimationFrame(() => irAlFondo(true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos enviar");
    } finally {
      setEnviando(false);
    }
  }

  async function elegirFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setSubiendo(true);
    try {
      const fotos = await subirFotos(lista);
      if (fotos.length > 0) await enviar(fotos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir la foto");
    } finally {
      setSubiendo(false);
      if (archivos.current) archivos.current.value = "";
    }
  }

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
    <div className="flex h-full min-h-0 flex-col">
      {/* El encabezado, con la forma del detalle de la visita: la flecha, el
          nombre y quiénes están. */}
      {/* Compacto, como WhatsApp: una fila baja con la flecha, el nombre y
          quiénes están. */}
      <div className="flex flex-none items-center gap-2 border-b border-border pb-2">
        <Link href={hrefDeVuelta(from, "/dashboard/chats")}>
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight md:text-lg">
            {chat.nombre}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {otros.length === 0
              ? "Solo tú"
              : `Tú y ${otros.map((m) => m.nombre).join(", ")}`}
          </p>
        </div>
        {chat.puedeEditar ? (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            Editar
          </Button>
        ) : null}
      </div>

      {/* Los mensajes */}
      {/* Los mensajes se apoyan **abajo**, como en WhatsApp: con pocos, el
          hueco queda arriba y no debajo del último, que es donde uno mira. */}
      <div
        ref={scroll}
        className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto overscroll-contain py-2"
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
              />
            </div>
          );
        })}
        </div>
      </div>

      {/* Lo que se está por mandar */}
      <div className="flex-none border-t border-border pt-2">
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
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 flex-none"
            aria-label="Mandar una foto"
            disabled={subiendo || enviando}
            onClick={() => archivos.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
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
            className="max-h-32 min-h-10 flex-1 resize-none py-[7px] leading-6"
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
            className="h-10 w-10 flex-none"
            aria-label="Enviar"
            onClick={() => enviar()}
            disabled={enviando || subiendo || !texto.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {subiendo ? (
          <p className="pt-1 text-xs text-muted-foreground">Subiendo foto...</p>
        ) : null}
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

      <MediaViewer
        media={viendo ? { url: viendo, tipo: "imagen" } : null}
        onClose={() => setViendo(null)}
      />
    </div>
  );
}

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco — la convención que todo el mundo ya sabe leer.
 *
 * Las acciones viven en un ⋯ que aparece al pasar por encima: responder,
 * copiar y, si es mío, borrar. En el teléfono está siempre, porque no hay
 * "pasar por encima".
 */
function Burbuja({
  mensaje,
  conNombre,
  onResponder,
  onCopiar,
  onBorrar,
  onVerFoto,
}: {
  mensaje: MensajeEnPantalla;
  conNombre: boolean;
  onResponder: () => void;
  onCopiar: () => void;
  onBorrar: () => void;
  onVerFoto: (url: string) => void;
}) {
  const mio = mensaje.mio;

  return (
    <div className={`group flex gap-1 ${mio ? "justify-end" : "justify-start"}`}>
      {mio ? <Acciones mensaje={mensaje} onResponder={onResponder} onCopiar={onCopiar} onBorrar={onBorrar} /> : null}
      <div
        className={`max-w-[85%] rounded-2xl px-2.5 py-1.5 text-sm shadow-sm sm:max-w-[70%] ${
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
  if (mensaje.borrado) return <span className="w-7 flex-none" aria-hidden />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Acciones del mensaje"
            className="mt-1 h-7 w-7 flex-none self-end rounded-full text-muted-foreground opacity-100 transition-opacity hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100"
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
