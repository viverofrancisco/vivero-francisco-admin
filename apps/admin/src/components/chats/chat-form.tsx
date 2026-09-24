"use client";

import { useEffect, useRef, useState } from "react";
import { ETIQUETA_DE_ROL } from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputFlotante } from "@/components/ui/input-flotante";
import { Camera, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AvatarDeChat } from "./avatar-de-chat";

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

export const ROL_LABEL: Record<string, string> = ETIQUETA_DE_ROL;

/**
 * La foto del grupo, achicada y cuadrada **antes** de subirla: 512 px de
 * lado, recortada al centro y en JPEG. Una foto de la galería son varios MB
 * para un círculo de 40 px, y el recorte cuadrado es el que WhatsApp pide
 * al elegirla. En el canvas y no en el servidor: es un archivo local, así
 * que el lienzo no queda "manchado".
 */
async function reducirParaAvatar(archivo: File, lado = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const corto = Math.min(bitmap.width, bitmap.height);
  const destino = Math.min(lado, corto);
  const lienzo = document.createElement("canvas");
  lienzo.width = destino;
  lienzo.height = destino;
  lienzo
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - corto) / 2,
      (bitmap.height - corto) / 2,
      corto,
      corto,
      0,
      0,
      destino,
      destino
    );
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error("No pudimos preparar la foto"))),
      "image/jpeg",
      0.85
    )
  );
}

/** Sube la foto bajo el prefijo del chat y la deja como su imagen. */
async function subirFotoDelChat(chatId: string, blob: Blob) {
  const firma = await fetch(`/api/chats/${chatId}/fotos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ fileName: "grupo.jpg", contentType: "image/jpeg" }] }),
  });
  const datos = await firma.json().catch(() => ({}));
  if (!firma.ok) throw new Error(datos.error ?? "No pudimos preparar la foto");
  const [u] = datos.uploads as { key: string; url: string; uploadUrl: string }[];
  const subida = await fetch(u.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!subida.ok) throw new Error("No pudimos subir la foto");
  const guardado = await fetch(`/api/chats/${chatId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagen: { key: u.key, url: u.url } }),
  });
  if (!guardado.ok) throw new Error("No pudimos guardar la foto");
}

export interface ChatParaEditar {
  id: string;
  nombre: string;
  miembrosIds: string[];
  imagenUrl?: string | null;
}

/**
 * El formulario del chat: la foto, el nombre y —al crear— quién está adentro.
 * **Solo el ADMIN llega acá**: el servicio lo rechaza igual, pero la pantalla
 * no ofrece lo que después va a negar.
 *
 * Al **editar** lleva solo el nombre y la foto, como el "Editar grupo" de
 * WhatsApp: la gente se agrega y se quita desde la info del chat, de a uno,
 * que es como se piensa ("saquemos a Kevin") y no como una lista que se
 * reescribe entera. Al crear sí va la lista, porque un chat nace con su
 * gente.
 *
 * Es el contenido sin el diálogo, para poder vivir adentro de la info del
 * chat; `ChatForm` lo envuelve en uno para crear.
 */
export function FormularioDeChat({
  chat,
  onClose,
  onGuardado,
}: {
  /** `null` para crear. */
  chat: ChatParaEditar | null;
  onClose: () => void;
  onGuardado: (chatId: string) => void;
}) {
  const [nombre, setNombre] = useState(chat?.nombre ?? "");
  const [elegidos, setElegidos] = useState<string[]>(chat?.miembrosIds ?? []);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  /** La foto elegida y todavía no subida; `quitar` saca la que había. */
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  const [quitar, setQuitar] = useState(false);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const vistaDeFoto = foto?.vista ?? (quitar ? null : chat?.imagenUrl ?? null);
  const creando = chat === null;

  function elegirFoto(lista: FileList | null) {
    const archivo = lista?.[0];
    if (!archivo || !archivo.type.startsWith("image/")) return;
    if (foto) URL.revokeObjectURL(foto.vista);
    setFoto({ archivo, vista: URL.createObjectURL(archivo) });
    setQuitar(false);
    if (entradaFoto.current) entradaFoto.current.value = "";
  }

  useEffect(() => {
    if (!creando) return;
    let vivo = true;
    fetch("/api/chats/miembros")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => vivo && setPersonas(d.items))
      .catch(() => vivo && setPersonas([]));
    return () => {
      vivo = false;
    };
  }, [creando]);

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Ponle un nombre");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(chat ? `/api/chats/${chat.id}` : "/api/chats", {
        method: chat ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          chat
            ? { nombre: nombre.trim() }
            : { nombre: nombre.trim(), miembrosIds: elegidos }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No pudimos guardar");
      const chatId: string = chat?.id ?? body.id;
      // La foto va después, con el chat ya creado: la firma de subida es por
      // chat, así que antes no hay dónde ponerla.
      if (foto) {
        await subirFotoDelChat(chatId, await reducirParaAvatar(foto.archivo));
      } else if (quitar && chat?.imagenUrl) {
        await fetch(`/api/chats/${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen: null }),
        });
      }
      toast.success(chat ? "Chat actualizado" : "Chat creado");
      onGuardado(chatId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  /*
   * Los marcados quedan **arriba y siempre a la vista**, incluso mientras se
   * busca: si no, elegir a la cuarta persona esconde a las tres anteriores y
   * hay que borrar la búsqueda para saber a quiénes ya elegiste.
   */
  const q = busqueda.trim().toLowerCase();
  const lista = (personas ?? []).filter(
    (p) => elegidos.includes(p.id) || !q || p.nombre.toLowerCase().includes(q)
  );

  return (
    <>
      {/* Cancelar a la izquierda y la acción a la derecha, arriba y no al
          pie: es donde están en la app, y en un formulario largo el botón no
          puede quedar a seis gestos de lo último que se escribió. */}
      <div className="-mx-4 -mt-4 mb-4 flex flex-none items-center gap-3 border-b border-border px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <DialogTitle className="flex-1 text-center text-base">
          {chat ? "Editar chat" : "Nuevo chat"}
        </DialogTitle>
        <Button
          size="sm"
          onClick={guardar}
          disabled={guardando || !nombre.trim()}
        >
          {guardando ? "Guardando..." : chat ? "Guardar" : "Crear"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5">
        {/* La foto del grupo, como en WhatsApp: el círculo se toca para
            elegirla, y debajo se puede quitar. */}
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => elegirFoto(e.target.files)}
          />
          <button
            type="button"
            onClick={() => entradaFoto.current?.click()}
            aria-label={vistaDeFoto ? "Cambiar la foto del grupo" : "Poner una foto al grupo"}
            className="relative rounded-full"
          >
            <AvatarDeChat nombre={nombre || "?"} imagenUrl={vistaDeFoto} size={96} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          {vistaDeFoto ? (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (foto) URL.revokeObjectURL(foto.vista);
                setFoto(null);
                setQuitar(true);
              }}
            >
              Quitar foto
            </button>
          ) : null}
        </div>

        <InputFlotante
          id="nombre-chat"
          label="Nombre"
          required
          value={nombre}
          onChange={setNombre}
          placeholder="Cuadrilla 1, Administración, Urgencias..."
          maxLength={80}
        />

        {creando ? (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Miembros
            </p>
            {personas === null ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : personas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cuentas que puedan entrar a un chat.
              </p>
            ) : (
              <>
                {/* `mb-2`: pegados, el buscador y la lista se leen como un solo
                    bloque y la primera fila parece parte del campo. */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar persona..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ul className="divide-y rounded-xl border border-border">
                  {lista.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted-foreground">
                      Sin coincidencias
                    </li>
                  ) : null}
                  {lista.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          checked={elegidos.includes(p.id)}
                          onCheckedChange={(v) =>
                            setElegidos((actuales) =>
                              v === true
                                ? [...actuales, p.id]
                                : actuales.filter((x) => x !== p.id)
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.nombre}
                        </span>
                        <span className="flex-none text-xs text-muted-foreground">
                          {ROL_LABEL[p.rol] ?? p.rol}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Crear un chat, en su propio diálogo. Editar se hace desde la info del chat. */
export function ChatForm({
  chat,
  onClose,
  onGuardado,
}: {
  chat: ChatParaEditar | null;
  onClose: () => void;
  onGuardado: (chatId: string) => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        pantallaCompletaEnMovil
        showCloseButton={false}
        className="gap-0 sm:max-w-lg"
      >
        <FormularioDeChat chat={chat} onClose={onClose} onGuardado={onGuardado} />
      </DialogContent>
    </Dialog>
  );
}
