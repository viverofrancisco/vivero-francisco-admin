"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaViewer } from "@/components/ui/media-viewer";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ChevronLeft, ChevronRight, FileText, Images, Play, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  extensionDe,
  tamanoLegible,
  urlParaMiniatura,
  urlParaVerGrande,
  type ArchivoDelChat,
  type EnlaceDelChat,
} from "@vivero/shared";
import { AvatarDeChat } from "./avatar-de-chat";
import { guardarMedios, leerMedios, type TipoDeMedios } from "./cache-de-chats";
import { FormularioDeChat, ROL_LABEL } from "./chat-form";
import { fechaRelativaCorta } from "./formato";

export interface ChatParaInfo {
  id: string;
  nombre: string;
  imagenUrl?: string | null;
  puedeEditar: boolean;
  miembros: { id: string; nombre: string; rol: string; soyYo: boolean }[];
  medios?: { fotosYVideos: number; documentos?: number; enlaces: number };
}

type Vista =
  | { paso: "info" }
  | { paso: "medios"; tipo: TipoDeMedios }
  | { paso: "editar" }
  | { paso: "agregar" };

/**
 * La info del chat, como la de un grupo de WhatsApp: se abre tocando el
 * nombre en el encabezado. La foto y el nombre arriba, los renglones de
 * *Fotos y videos* y *Enlaces* —la forma rápida de volver a encontrar un
 * archivo sin scrollear meses— y la gente, con *Agregar miembros* y el
 * *Quitar* de cada fila para el ADMIN. *Editar* arriba a la derecha es solo
 * el nombre y la foto.
 *
 * **Un solo diálogo con pasos**, no cuatro: los medios, el formulario de
 * editar y el de agregar gente son vistas adentro del mismo, con la flecha
 * de atrás. Apilar diálogos es un cierre que cierra el de abajo también.
 */
export function InfoDelChat({
  chat,
  abierto,
  onClose,
  onChatActualizado,
  onIrAlMensaje,
}: {
  chat: ChatParaInfo;
  abierto: boolean;
  onClose: () => void;
  /** Algo cambió —nombre, foto, gente—: quien la abrió vuelve a pedir el chat. */
  onChatActualizado: () => void;
  /** Un enlace de la lista lleva al mensaje, como en WhatsApp. */
  onIrAlMensaje: (mensajeId: string) => void;
}) {
  const [vista, setVista] = useState<Vista>({ paso: "info" });
  const [viendo, setViendo] = useState<{ url: string; tipo: string } | null>(null);

  // Al cerrarse vuelve a la primera vista: abrirlo otra vez en "editar" a
  // medio camino es una trampa.
  function cerrar() {
    setVista({ paso: "info" });
    onClose();
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent
        pantallaCompletaEnMovil
        showCloseButton={false}
        className="gap-0 sm:max-w-md"
      >
        {vista.paso === "info" ? (
          <VistaInfo
            chat={chat}
            onClose={cerrar}
            onVer={setVista}
            onChatActualizado={onChatActualizado}
          />
        ) : null}
        {vista.paso === "medios" ? (
          <VistaMedios
            chat={chat}
            tipo={vista.tipo}
            onTipo={(tipo) => setVista({ paso: "medios", tipo })}
            onVolver={() => setVista({ paso: "info" })}
            onVerFoto={setViendo}
            onIrAlMensaje={(id) => {
              cerrar();
              onIrAlMensaje(id);
            }}
          />
        ) : null}
        {vista.paso === "editar" ? (
          <FormularioDeChat
            chat={{
              id: chat.id,
              nombre: chat.nombre,
              imagenUrl: chat.imagenUrl,
              miembrosIds: chat.miembros.map((m) => m.id),
            }}
            onClose={() => setVista({ paso: "info" })}
            onGuardado={() => {
              onChatActualizado();
              setVista({ paso: "info" });
            }}
          />
        ) : null}
        {vista.paso === "agregar" ? (
          <VistaAgregar
            chat={chat}
            onVolver={() => setVista({ paso: "info" })}
            onAgregados={() => {
              onChatActualizado();
              setVista({ paso: "info" });
            }}
          />
        ) : null}
        <MediaViewer media={viendo} onClose={() => setViendo(null)} />
      </DialogContent>
    </Dialog>
  );
}

function Encabezado({
  izquierda,
  titulo,
  derecha,
}: {
  izquierda: React.ReactNode;
  titulo: React.ReactNode;
  derecha?: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-4 mb-3 flex flex-none items-center gap-1 border-b border-border px-1 py-1.5">
      {izquierda}
      <DialogTitle className="min-w-0 flex-1 truncate text-center text-base">
        {titulo}
      </DialogTitle>
      {derecha ?? <span className="h-9 w-9 flex-none" aria-hidden />}
    </div>
  );
}

const FILA = "flex w-full items-center gap-3 px-3 py-2.5 text-left";

function VistaInfo({
  chat,
  onClose,
  onVer,
  onChatActualizado,
}: {
  chat: ChatParaInfo;
  onClose: () => void;
  onVer: (v: Vista) => void;
  onChatActualizado: () => void;
}) {
  /** A quién se está por quitar: la confirmación va en la misma fila. */
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cuantos = chat.miembros.length;

  async function quitar(id: string) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/chats/${chat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miembrosIds: chat.miembros.filter((m) => m.id !== id).map((m) => m.id),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No pudimos quitar");
      setQuitando(null);
      onChatActualizado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos quitar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Encabezado
        izquierda={
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        }
        titulo="Info del chat"
        derecha={
          chat.puedeEditar ? (
            <Button variant="ghost" size="sm" onClick={() => onVer({ paso: "editar" })}>
              Editar
            </Button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="flex flex-col items-center gap-1 pt-1">
          <AvatarDeChat nombre={chat.nombre} imagenUrl={chat.imagenUrl} size={96} />
          <p className="pt-1 text-center text-lg font-bold">{chat.nombre}</p>
          <p className="text-sm text-muted-foreground">
            Grupo · {cuantos} {cuantos === 1 ? "miembro" : "miembros"}
          </p>
        </div>

        {/* Una sola fila, como en WhatsApp: adentro están las tres pestañas,
            en ese orden —multimedia, documentos, enlaces—. */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            className={`${FILA} hover:bg-muted`}
            onClick={() => onVer({ paso: "medios", tipo: "archivos" })}
          >
            <Images className="h-5 w-5 flex-none text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Multimedia, documentos y enlaces</span>
            <span className="text-sm text-muted-foreground">
              {(chat.medios?.fotosYVideos ?? 0) + (chat.medios?.documentos ?? 0) + (chat.medios?.enlaces ?? 0)}
            </span>
            <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
          </button>
        </div>

        <section>
          <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {cuantos} {cuantos === 1 ? "miembro" : "miembros"}
          </p>
          <ul className="divide-y rounded-xl border border-border">
            {chat.puedeEditar ? (
              <li>
                <button
                  type="button"
                  className={`${FILA} hover:bg-muted`}
                  onClick={() => onVer({ paso: "agregar" })}
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted text-foreground">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">Agregar miembros</span>
                </button>
              </li>
            ) : null}
            {chat.miembros.map((m) => (
              <li key={m.id} className={FILA}>
                <InitialsAvatar name={m.nombre} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.soyYo ? "Tú" : m.nombre}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {ROL_LABEL[m.rol] ?? m.rol}
                  </span>
                </span>
                {chat.puedeEditar && !m.soyYo ? (
                  quitando === m.id ? (
                    <span className="flex flex-none items-center gap-2 text-xs">
                      <span className="text-muted-foreground">¿Quitar?</span>
                      <button
                        type="button"
                        className="font-bold text-destructive"
                        disabled={ocupado}
                        onClick={() => quitar(m.id)}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className="font-bold text-muted-foreground"
                        disabled={ocupado}
                        onClick={() => setQuitando(null)}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="flex-none text-xs font-semibold text-muted-foreground hover:text-destructive"
                      onClick={() => setQuitando(m.id)}
                    >
                      Quitar
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/**
 * Las fotos y videos en una grilla, o los mensajes con enlaces en una lista.
 * Del más nuevo al más viejo, con *Ver más* al final: es lo que hay en el
 * chat sin tener que leerlo.
 */
function VistaMedios({
  chat,
  tipo,
  onTipo,
  onVolver,
  onVerFoto,
  onIrAlMensaje,
}: {
  chat: ChatParaInfo;
  tipo: TipoDeMedios;
  onTipo: (t: TipoDeMedios) => void;
  onVolver: () => void;
  onVerFoto: (m: { url: string; tipo: string }) => void;
  onIrAlMensaje: (mensajeId: string) => void;
}) {
  /**
   * Lo cargado, con el tipo al que pertenece; mientras no llegó lo de
   * **este** tipo se pinta la copia local, si la hay, y si no, "cargando".
   * Sin un estado aparte que haya que prender en el efecto: se escribe solo
   * cuando la respuesta llega, y la copia se lee en el render.
   */
  const [datos, setDatos] = useState<{
    tipo: TipoDeMedios;
    items: (ArchivoDelChat | EnlaceDelChat)[];
    cursor: string | null;
  } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const vigente = datos?.tipo === tipo ? datos : leerMedios(chat.id, tipo);
  const cargando = vigente === null;
  const archivos = (vigente?.tipo === "archivos" ? vigente.items : []) as ArchivoDelChat[];
  const documentos = (vigente?.tipo === "documentos" ? vigente.items : []) as ArchivoDelChat[];
  const enlaces = (vigente?.tipo === "enlaces" ? vigente.items : []) as EnlaceDelChat[];
  const cursor = vigente?.cursor ?? null;

  useEffect(() => {
    let vivo = true;
    fetch(`/api/chats/${chat.id}/medios?tipo=${tipo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        if (!vivo) return;
        const nuevos = { tipo, items: d.items, cursor: d.cursor };
        setDatos(nuevos);
        guardarMedios(chat.id, nuevos);
      })
      .catch(() => vivo && toast.error("No pudimos traer los archivos"));
    return () => {
      vivo = false;
    };
  }, [chat.id, tipo]);

  async function verMas() {
    if (!cursor || cargando || cargandoMas) return;
    setCargandoMas(true);
    try {
      const r = await fetch(`/api/chats/${chat.id}/medios?tipo=${tipo}&cursor=${cursor}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setDatos((actual) =>
        actual && actual.tipo === tipo
          ? { ...actual, items: [...actual.items, ...d.items], cursor: d.cursor }
          : actual
      );
    } catch {
      toast.error("No pudimos traer más");
    } finally {
      setCargandoMas(false);
    }
  }

  const pestana = (t: TipoDeMedios, etiqueta: string) => (
    <button
      type="button"
      onClick={() => {
        if (t !== tipo) onTipo(t);
      }}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        tipo === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
      }`}
    >
      {etiqueta}
    </button>
  );

  const fotos = archivos.filter((a) => a.tipo !== "video").length;
  const videos = archivos.length - fotos;

  return (
    <>
      <Encabezado
        izquierda={
          <Button variant="ghost" size="icon" aria-label="Volver" onClick={onVolver}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
        }
        titulo={
          <span className="inline-flex rounded-full bg-muted p-0.5">
            {pestana("archivos", "Multimedia")}
            {pestana("documentos", "Documentos")}
            {pestana("enlaces", "Enlaces")}
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tipo === "archivos" ? (
          archivos.length === 0 && !cargando ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Todavía no se mandaron fotos ni videos.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4">
                {archivos.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      onVerFoto({ url: urlParaVerGrande(a, window.innerWidth), tipo: a.tipo })
                    }
                    className="relative aspect-square overflow-hidden bg-muted"
                    aria-label={a.nombre ?? "Ver"}
                  >
                    {a.tipo === "video" ? (
                      <span className="relative flex h-full w-full items-center justify-center bg-foreground/80 text-background">
                        {a.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                        ) : null}
                        <Play className="relative h-6 w-6 fill-current drop-shadow" />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urlParaMiniatura(a)} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
              <p className="py-3 text-center text-xs text-muted-foreground">
                {fotos} {fotos === 1 ? "foto" : "fotos"}, {videos} {videos === 1 ? "video" : "videos"}
                {cursor ? " cargados" : ""}
              </p>
            </>
          )
        ) : tipo === "documentos" ? (
          documentos.length === 0 && !cargando ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Todavía no se mandaron documentos.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border border-border">
              {documentos.map((d) => (
                <li key={d.id}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    download={d.nombre ?? undefined}
                    className={`${FILA} hover:bg-muted`}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.nombre ?? "Documento"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[tamanoLegible(d.tamano), extensionDe(d.nombre), fechaRelativaCorta(d.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )
        ) : enlaces.length === 0 && !cargando ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no se mandaron enlaces.
          </p>
        ) : (
          <ul className="space-y-2">
            {enlaces.map((e) => (
              <li key={e.mensajeId} className="rounded-xl border border-border">
                <div className="space-y-1 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {e.autorNombre} · {fechaRelativaCorta(e.createdAt)}
                  </p>
                  {e.urls.map((u) => (
                    <a
                      key={u}
                      href={u.startsWith("http") ? u : `https://${u}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-primary underline"
                    >
                      {u}
                    </a>
                  ))}
                  <p className="line-clamp-2 text-xs text-muted-foreground">{e.texto}</p>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-t border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  onClick={() => onIrAlMensaje(e.mensajeId)}
                >
                  Ver mensaje
                  <ChevronRight className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {cursor ? (
          <div className="flex justify-center py-3">
            <Button variant="outline" size="sm" onClick={verMas} disabled={cargandoMas}>
              {cargandoMas ? "Cargando..." : "Ver más"}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Meter gente al chat: los que todavía no están, con casillas y buscador. */
function VistaAgregar({
  chat,
  onVolver,
  onAgregados,
}: {
  chat: ChatParaInfo;
  onVolver: () => void;
  onAgregados: () => void;
}) {
  const [personas, setPersonas] = useState<{ id: string; nombre: string; rol: string }[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/chats/miembros")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => vivo && setPersonas(d.items))
      .catch(() => vivo && setPersonas([]));
    return () => {
      vivo = false;
    };
  }, []);

  const adentro = new Set(chat.miembros.map((m) => m.id));
  const q = busqueda.trim().toLowerCase();
  const lista = (personas ?? []).filter(
    (p) => !adentro.has(p.id) && (elegidos.includes(p.id) || !q || p.nombre.toLowerCase().includes(q))
  );

  async function agregar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/chats/${chat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miembrosIds: [...adentro, ...elegidos] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No pudimos agregar");
      toast.success(elegidos.length === 1 ? "Persona agregada" : "Personas agregadas");
      onAgregados();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos agregar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Encabezado
        izquierda={
          <Button variant="ghost" size="icon" aria-label="Volver" onClick={onVolver}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
        }
        titulo="Agregar miembros"
        derecha={
          <Button size="sm" onClick={agregar} disabled={guardando || elegidos.length === 0}>
            {guardando ? "Agregando..." : "Agregar"}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar persona..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        {personas === null ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <ul className="divide-y rounded-xl border border-border">
            {lista.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {q ? "Sin coincidencias" : "Ya están todos adentro."}
              </li>
            ) : null}
            {lista.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={elegidos.includes(p.id)}
                    onCheckedChange={(v) =>
                      setElegidos((a) => (v === true ? [...a, p.id] : a.filter((x) => x !== p.id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                  <span className="flex-none text-xs text-muted-foreground">
                    {ROL_LABEL[p.rol] ?? p.rol}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
