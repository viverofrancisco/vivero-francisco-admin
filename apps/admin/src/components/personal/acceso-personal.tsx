"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { KeyRound, Pencil, ShieldOff } from "lucide-react";
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
 * El acceso de quien trabaja en el campo.
 *
 * No tiene correo, así que entra con un **usuario** que se genera solo al crear
 * su ficha. Lo único que hay que hacer acá es pasarle el enlace con el que
 * elige su contraseña —nadie elige la de otro— y, si hace falta, cortarle el
 * acceso.
 *
 * Vive en esta ficha y no en Usuarios porque acá están su nombre, su teléfono y
 * su grupo: una segunda pantalla para la misma persona es como dos pantallas
 * empiezan a decir cosas distintas.
 */
export function AccesoPersonal({
  personalId,
  nombre,
  estado: estadoInicial,
  puedeAdministrar,
}: {
  personalId: string;
  nombre: string;
  estado: EstadoCuenta | null;
  /** Solo un ADMIN da o quita acceso. Para el resto esto es informativo. */
  puedeAdministrar: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [cargando, setCargando] = useState(false);
  const [generado, setGenerado] = useState<EnlaceGenerado | null>(null);
  const [editandoUsuario, setEditandoUsuario] = useState(false);
  const [usuario, setUsuario] = useState("");
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
      setEstado({ ...estado, enlacePendiente: true });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos generarlo");
    } finally {
      setCargando(false);
    }
  }

  async function guardarUsuario() {
    setCargando(true);
    try {
      const res = await fetch(`/api/personal/${personalId}/usuario`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No pudimos cambiarlo");
      setEstado(datos.estado);
      setEditandoUsuario(false);
      toast.success("Usuario actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cambiarlo");
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
      setEstado(datos.estado);
      setConfirmandoRevocar(false);
      toast.success(revocado ? "Acceso revocado" : "Acceso restaurado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cambiarlo");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Acceso a la app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!estado ? (
            <p className="text-sm text-muted-foreground">No tiene cuenta.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="truncate font-mono text-sm font-semibold">
                    {estado.usuario}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {estado.revocado ? (
                    <Badge variant="destructive">Revocado</Badge>
                  ) : estado.tieneContrasena ? (
                    <Badge variant="secondary">Activo</Badge>
                  ) : (
                    <Badge variant="outline">Sin contraseña</Badge>
                  )}
                  {puedeAdministrar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Cambiar usuario"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setUsuario(estado.usuario ?? "");
                        setEditandoUsuario(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {puedeAdministrar && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={cargando}
                    onClick={generarEnlace}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Generar enlace de contraseña
                  </Button>

                  {estado.revocado ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={cargando}
                      onClick={() => cambiarAcceso(false)}
                    >
                      Restaurar acceso
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={cargando}
                      onClick={() => setConfirmandoRevocar(true)}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Revocar acceso
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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

      <Dialog open={editandoUsuario} onOpenChange={setEditandoUsuario}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar usuario</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardarUsuario();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="usuario-personal">Usuario</Label>
              <Input
                id="usuario-personal"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Minúsculas, sin espacios ni arroba.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditandoUsuario(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={cargando || !usuario.trim()}>
                {cargando ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
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
