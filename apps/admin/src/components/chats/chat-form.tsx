"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputFlotante } from "@/components/ui/input-flotante";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Oficina",
  PERSONAL: "Campo",
};

/**
 * Armar un chat o cambiarle la gente. **Solo el ADMIN llega acá**: el servicio
 * lo rechaza igual, pero la pantalla no ofrece lo que después va a negar.
 *
 * La lista de miembros es de casillas y no de un buscador con etiquetas: son
 * quince personas, caben, y ver a todos con lo que ya está marcado es lo que
 * responde la pregunta de verdad —"¿quién está en este chat?"—.
 */
export function ChatForm({
  chat,
  onClose,
  onGuardado,
}: {
  /** `null` para crear. */
  chat: { id: string; nombre: string; miembrosIds: string[] } | null;
  onClose: () => void;
  onGuardado: (chatId: string) => void;
}) {
  const [nombre, setNombre] = useState(chat?.nombre ?? "");
  const [elegidos, setElegidos] = useState<string[]>(chat?.miembrosIds ?? []);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
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
        body: JSON.stringify({ nombre: nombre.trim(), miembrosIds: elegidos }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No pudimos guardar");
      toast.success(chat ? "Chat actualizado" : "Chat creado");
      onGuardado(chat?.id ?? body.id);
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        pantallaCompletaEnMovil
        showCloseButton={false}
        className="gap-0 sm:max-w-lg"
      >
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
          <InputFlotante
            id="nombre-chat"
            label="Nombre"
            required
            value={nombre}
            onChange={setNombre}
            placeholder="Cuadrilla 1, Oficina, Urgencias..."
            maxLength={80}
          />

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
        </div>

      </DialogContent>
    </Dialog>
  );
}
