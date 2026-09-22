"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      toast.error("Ponele un nombre");
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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent pantallaCompletaEnMovil className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{chat ? "Editar chat" : "Nuevo chat"}</DialogTitle>
          <DialogDescription>
            Quién está adentro lo decide el administrador. Al agregar a alguien
            le llega un aviso al teléfono.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-chat">Nombre</Label>
            <Input
              id="nombre-chat"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cuadrilla 1, Oficina, Urgencias..."
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quiénes están</Label>
            {personas === null ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : personas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cuentas que puedan entrar a un chat.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border border-border">
                {personas.map((p) => (
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
            )}
            {/* Quien lo arma queda adentro sin marcarse: es el que después va a
                tener que agregar o sacar gente. */}
            <p className="text-xs text-muted-foreground">
              Vos quedás adentro siempre.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : chat ? "Guardar" : "Crear chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
