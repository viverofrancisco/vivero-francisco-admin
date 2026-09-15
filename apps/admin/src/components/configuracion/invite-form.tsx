"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { EnlaceAcceso, type EnlaceGenerado } from "./enlace-acceso";

/**
 * Invita a alguien de la oficina.
 *
 * Solo pide nombre y correo: el rol es STAFF —un ADMIN se hace desde la base,
 * y son dos— y no hay sectores que asignar desde que se fue `PERSONAL_ADMIN`.
 * Al personal de campo no se lo invita desde acá: no tiene correo, y su cuenta
 * se crea desde su propia ficha.
 */
export function InviteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  /** El enlace recién emitido. Mientras exista, el diálogo lo muestra. */
  const [generado, setGenerado] = useState<EnlaceGenerado | null>(null);
  const [error, setError] = useState("");

  /**
   * Limpiar al cerrar, no en un efecto.
   *
   * Un efecto que mira `open` corre *después* de pintar, así que el diálogo se
   * cierra con los datos todavía adentro y la próxima vez que se abre se ven
   * un instante antes de vaciarse.
   */
  function cambiarApertura(abierto: boolean) {
    setOpen(abierto);
    if (!abierto) {
      setName("");
      setApellido("");
      setEmail("");
      setGenerado(null);
      setError("");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          apellido: apellido || undefined,
          email,
          role: "STAFF",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al crear usuario");
      }

      // El diálogo no se cierra: adentro está el enlace, y es la única vez que
      // se puede ver.
      setGenerado({
        enlace: data.enlace,
        expiraEl: data.expiraEl,
        correoEnviado: data.correoEnviado,
      });
      toast.success("Usuario invitado");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cambiarApertura}>
      {/* En móvil el ⋯: la etiqueta completa al lado del título obligaba a
          partir el encabezado en dos renglones. */}
      <DialogTrigger
        render={
          <Button
            aria-label="Invitar usuario"
            className="h-9 w-9 p-0 md:w-auto md:px-2.5"
          />
        }
      >
        <Plus className="h-4 w-4" />
        <span className="hidden md:ml-2 md:inline">Invitar Usuario</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {generado ? "Usuario invitado" : "Invitar nuevo usuario"}
          </DialogTitle>
        </DialogHeader>

        {generado ? (
          <div className="space-y-4">
            <EnlaceAcceso datos={generado} correo={email} />
            <div className="flex justify-end">
              <Button onClick={() => cambiarApertura(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nombre</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-apellido">Apellido</Label>
                <Input
                  id="invite-apellido"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => cambiarApertura(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Invitando..." : "Enviar invitación"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
