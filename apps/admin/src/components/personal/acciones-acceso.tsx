"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, KeyRound, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import {
  EnlaceAcceso,
  type EnlaceGenerado,
} from "@/components/configuracion/enlace-acceso";

/** Cómo está el acceso de esta persona. */
export interface EstadoCuenta {
  userId: string;
  usuario: string | null;
  tieneContrasena: boolean;
  revocado: boolean;
  enlacePendiente: boolean;
}

/**
 * Las acciones de la ficha, en un solo menú.
 *
 * Editar, restablecer contraseña y revocar acceso son las tres cosas que se
 * hacen acá, y las tres son poco frecuentes: cada una como botón propio ocupaba
 * un encabezado entero —y la tarjeta de acceso, una columna— para algo que se
 * toca una vez por persona.
 */
export function AccionesAcceso({
  personalId,
  nombre,
  estado,
  puedeAdministrar,
  onEditar,
}: {
  personalId: string;
  nombre: string;
  estado: EstadoCuenta | null;
  /** Solo un ADMIN da o quita acceso. Para el resto queda solo Editar. */
  puedeAdministrar: boolean;
  onEditar: () => void;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [generado, setGenerado] = useState<EnlaceGenerado | null>(null);
  const [confirmandoRevocar, setConfirmandoRevocar] = useState(false);

  /** Un enlace nuevo. Anula el anterior, así que también sirve para cortarlo. */
  async function generarEnlace() {
    if (!estado) return;
    setCargando(true);
    try {
      const res = await fetch(`/api/users/${estado.userId}/enlace-acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Sin contraseña todavía es la invitación de siempre, que dura una
          // semana; con contraseña es un restablecimiento, y eso dura una hora.
          tipo: estado.tieneContrasena ? "restablecer" : "invitacion",
          enviarCorreo: false,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No pudimos generar el enlace");
      setGenerado(datos);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos generarlo");
    } finally {
      setCargando(false);
    }
  }

  async function cambiarAcceso(revocado: boolean) {
    setCargando(true);
    try {
      const res = await fetch(`/api/personal/${personalId}/acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revocado }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No pudimos cambiarlo");
      setConfirmandoRevocar(false);
      toast.success(revocado ? "Acceso revocado" : "Acceso restaurado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cambiarlo");
    } finally {
      setCargando(false);
    }
  }

  const conAcceso = puedeAdministrar && estado !== null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={cargando}>
              Acciones
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onEditar}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>

          {conAcceso && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={generarEnlace}>
                <KeyRound className="mr-2 h-4 w-4" />
                Restablecer contraseña
              </DropdownMenuItem>
              {estado.revocado ? (
                <DropdownMenuItem onClick={() => cambiarAcceso(false)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Restaurar acceso
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirmandoRevocar(true)}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Revocar acceso
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* El enlace, apenas se genera. Es la única vez que se puede ver. */}
      <Dialog
        open={generado !== null}
        onOpenChange={(v) => !v && setGenerado(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enlace para {nombre}</DialogTitle>
          </DialogHeader>
          {generado && <EnlaceAcceso datos={generado} />}
          <DialogFooter>
            <Button onClick={() => setGenerado(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmandoRevocar}
        onOpenChange={(v) => !v && !cargando && setConfirmandoRevocar(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar el acceso de {nombre}</DialogTitle>
            <DialogDescription>
              No va a poder entrar a la app hasta que se lo devuelvas. Su cuenta
              y su historial quedan como están.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={cargando}
              onClick={() => setConfirmandoRevocar(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={cargando}
              onClick={() => cambiarAcceso(true)}
            >
              {cargando ? "Revocando…" : "Revocar acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
