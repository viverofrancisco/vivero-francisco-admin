"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useAca, useFiltroUrl } from "@/lib/filtros-url";
import { EmptyState } from "@/components/shared/empty-state";
import { FILA_MOVIL } from "@/components/shared/lista-movil";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Play } from "lucide-react";
import { ChatForm } from "./chat-form";
import { fechaRelativaCorta } from "./formato";

export interface ChatEnLista {
  id: string;
  nombre: string;
  miembros: number;
  sinLeer: number;
  ultimo: {
    texto: string | null;
    autorNombre: string;
    createdAt: string;
    fotos: number;
  } | null;
}

/**
 * Los chats del equipo.
 *
 * Una sola lista para los dos tamaños —la misma que la app—: una conversación
 * es un renglón con su nombre, lo último que se dijo y cuántos quedaron sin
 * leer, y eso no mejora repartido en columnas.
 */
interface MensajeEncontrado {
  id: string;
  chatId: string;
  chatNombre: string;
  autorNombre: string;
  mio: boolean;
  texto: string | null;
  createdAt: string;
  foto: { id: string; url: string; nombre: string | null; tipo: string } | null;
  fotos: number;
}

/**
 * Resalta lo buscado dentro del texto encontrado, como WhatsApp.
 *
 * Sin esto, en un mensaje largo hay que releerlo entero para ver por qué
 * apareció en los resultados.
 */
function conMarca(texto: string, q: string) {
  const i = texto.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="bg-transparent font-bold text-foreground">
        {texto.slice(i, i + q.length)}
      </mark>
      {texto.slice(i + q.length)}
    </>
  );
}

/** Cada cuánto se refresca la lista mientras está a la vista. */
const CADA_MS = 5000;

export function ChatsPageClient({
  chats: iniciales,
  puedeCrear,
}: {
  chats: ChatEnLista[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  // El chat abierto al lado, en el escritorio: se marca en la lista.
  const { id: abierto } = useParams<{ id?: string }>();
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  // Con el hook y no con `aca()`: el `href` se arma durante el render, y en
  // el servidor no hay `window` —salía distinto y era un error de hidratación—.
  const desde = useAca();

  /*
   * La lista se refresca sola: en el escritorio queda a la vista todo el día
   * al lado de la conversación, y lo que dice de cada chat —el último
   * mensaje, cuántos sin leer— cambia sin que nadie navegue. Lo que vino con
   * el HTML arranca; después pregunta cada tanto, solo con la pestaña visible.
   */
  const [chats, setChats] = useState(iniciales);
  useEffect(() => {
    const tic = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/chats")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setChats(d.items))
        .catch(() => {});
    }, CADA_MS);
    return () => clearInterval(tic);
  }, []);

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? chats.filter((c) => c.nombre.toLowerCase().includes(q))
    : chats;

  /*
   * Los mensajes los busca el servidor, no el navegador: acá solo están los
   * chats, no lo que se dijo adentro. Se pide con lo que ya se escribió, que
   * es lo que hace WhatsApp — dos letras alcanzan para empezar.
   */
  const [mensajes, setMensajes] = useState<MensajeEncontrado[]>([]);
  useEffect(() => {
    const texto = busqueda.trim();
    let vivo = true;
    // Un respiro antes de preguntar: si no, cada letra es una consulta. Y el
    // vaciado también pasa por acá —dentro del `setTimeout` y no en el cuerpo
    // del efecto— para no encadenar un render por cada tecla.
    const id = setTimeout(() => {
      if (texto.length < 2) {
        setMensajes([]);
        return;
      }
      fetch(`/api/chats/buscar?q=${encodeURIComponent(texto)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => vivo && setMensajes(d.items))
        .catch(() => vivo && setMensajes([]));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [busqueda]);

  return (
    <>
      <PageHeader
        title="Chats"
        actions={
          puedeCrear
            ? [
                {
                  label: "Nuevo chat",
                  icon: "plus",
                  onClick: () => setCreando(true),
                  primary: true,
                },
              ]
            : []
        }
      />

      {/* El buscador, el mismo que en la app: con diez conversaciones no hace
          falta, con cuarenta sí, y es el único filtro que tiene sentido acá. */}
      <div className="relative min-w-0 max-w-sm flex-none">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar chat..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {visibles.length === 0 && mensajes.length === 0 ? (
          <EmptyState
            message={q ? "Sin coincidencias" : "No estás en ningún chat"}
            detalle={
              q
                ? "Prueba con otro nombre."
                : puedeCrear
                  ? "Crea el primero y elige quién está adentro."
                  : "Cuando te agreguen a uno te llega un aviso."
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* Con una búsqueda puesta, los chats van bajo su título y los
                mensajes debajo, como en WhatsApp: son dos preguntas distintas
                —"¿cómo se llamaba el grupo?" y "¿dónde dijimos eso?"— y
                mezclarlas deja sin saber qué se está mirando. */}
            {q && visibles.length > 0 ? (
              <p className="border-b border-border bg-muted/40 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Chats
              </p>
            ) : null}
            {visibles.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/chats/${c.id}?from=${desde}`}
                className={`${FILA_MOVIL} ${c.id === abierto ? "bg-muted" : "bg-card"}`}
                aria-current={c.id === abierto ? "page" : undefined}
              >
                <InitialsAvatar name={c.nombre} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                      {c.nombre}
                    </span>
                    {c.ultimo ? (
                      <span className="flex-none text-[11px] font-medium text-muted-foreground">
                        {fechaRelativaCorta(c.ultimo.createdAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.ultimo
                      ? `${c.ultimo.autorNombre}: ${
                          c.ultimo.texto ??
                          (c.ultimo.fotos === 1
                            ? "📷 Foto"
                            : `📷 ${c.ultimo.fotos} fotos`)
                        }`
                      : `${c.miembros} ${c.miembros === 1 ? "persona" : "personas"} · sin mensajes`}
                  </span>
                </span>
                {c.sinLeer > 0 ? (
                  <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {c.sinLeer}
                  </span>
                ) : null}
              </Link>
            ))}
            {q && mensajes.length > 0 ? (
              <>
                <p className="border-b border-t border-border bg-muted/40 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Mensajes
                </p>
                {mensajes.map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/chats/${m.chatId}?mensaje=${m.id}&from=${desde}`}
                    className={`${FILA_MOVIL} bg-card`}
                  >
                    {m.foto?.tipo === "video" ? (
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-foreground/80 text-background">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                    ) : m.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.foto.url}
                        alt=""
                        className="h-10 w-10 flex-none rounded-lg object-cover"
                      />
                    ) : (
                      <InitialsAvatar name={m.chatNombre} size={40} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                          {m.chatNombre}
                        </span>
                        <span className="flex-none text-[11px] font-medium text-muted-foreground">
                          {fechaRelativaCorta(m.createdAt)}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.mio ? "Tú: " : `${m.autorNombre}: `}
                        {m.texto
                          ? conMarca(m.texto, busqueda.trim())
                          : m.foto?.nombre
                            ? conMarca(m.foto.nombre, busqueda.trim())
                            : m.foto?.tipo === "video"
                              ? "🎥 Video"
                              : "📷 Foto"}
                      </span>
                    </span>
                  </Link>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>

      {creando ? (
        <ChatForm
          chat={null}
          onClose={() => setCreando(false)}
          onGuardado={(id) => {
            setCreando(false);
            router.push(`/dashboard/chats/${id}`);
          }}
        />
      ) : null}
    </>
  );
}
