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
import { KeyRound, Pencil, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  EnlaceAcceso,
  type EnlaceGenerado,
} from "@/components/configuracion/enlace-acceso";

/** Cómo está el acceso de esta persona. `null` = nunca se le creó cuenta. */
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
 * No tiene correo, así que no se lo puede invitar como al resto: se le elige un
 * **usuario** —un nombre corto que se le dicta— y se le pasa un enlace con el
 * que elige su propia contraseña. Por eso todo esto vive acá y no en Usuarios:
 * su nombre, su teléfono y su grupo están en esta ficha, y tener la cuenta en
 * otra pantalla era tener dos lugares para la misma persona.
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

  /** El diálogo abierto: crear la cuenta, cambiar el usuario, o ninguno. */
  const [dialogo, setDialogo] = useState<null | "crear" | "usuario">(null);
  const [usuario, setUsuario] = useState("");
  const [generado, setGenerado] = useState<EnlaceGenerado | null>(null);
  const [confirmandoRevocar, setConfirmandoRevocar] = useState(false);

  function abrir(cual: "crear" | "usuario") {
    setUsuario(cual === "usuario" ? (estado?.usuario ?? "") : sugerir(nombre));
    setGenerado(null);
    setDialogo(cual);
  }

  async function pedir(url: string, method: "POST" | "PATCH", body: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error ?? "No pudimos completar la acción");
    return datos;
  }

  async function crearCuenta() {
    setCargando(true);
    try {
      const datos = await pedir(`/api/personal/${personalId}/cuenta`, "POST", {
        usuario,
      });
      setEstado(datos.estado);
      // El diálogo no se cierra: adentro está el enlace, y es la única vez que
      // se puede ver.
      setGenerado({
        enlace: datos.enlace,
        expiraEl: datos.expiraEl,
        correoEnviado: false,
        correoIntentado: false,
      });
      toast.success("Cuenta creada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos crear la cuenta");
    } finally {
      setCargando(false);
    }
  }

  async function cambiarUsuario() {
    setCargando(true);
    try {
      const datos = await pedir(`/api/personal/${personalId}/cuenta`, "PATCH", {
        usuario,
      });
      setEstado(datos.estado);
      setDialogo(null);
      toast.success("Usuario actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cambiarlo");
    } finally {
      setCargando(false);
    }
  }

  /** Un enlace nuevo. Anula el anterior, así que también sirve para cortarlo. */
  async function generarEnlace() {
    setCargando(true);
    try {
      const res = await fetch(`/api/users/${estado?.userId}/enlace-acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Sin contraseña todavía es la invitación de siempre, que dura una
          // semana; con contraseña es un restablecimiento, y eso dura una hora.
          tipo: estado?.tieneContrasena ? "restablecer" : "invitacion",
          enviarCorreo: false,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No pudimos generar el enlace");
      setGenerado(datos);
      setDialogo("crear");
      setEstado((e) => (e ? { ...e, enlacePendiente: true } : e));
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
      const datos = await pedir(`/api/personal/${personalId}/acceso`, "POST", {
        revocado,
      });
      setEstado(datos.estado);
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
        <CardContent className="space-y-3">
          {!estado ? (
            <>
              <p className="text-sm text-muted-foreground">
                Todavía no tiene cuenta. Sin una no puede entrar a la app ni
                cargar su parte de las visitas.
              </p>
              {puedeAdministrar && (
                <Button className="w-full" onClick={() => abrir("crear")}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear cuenta
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="truncate font-mono text-sm">{estado.usuario}</p>
                </div>
                {puedeAdministrar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-none"
                    onClick={() => abrir("usuario")}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Cambiar
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {estado.revocado ? (
                  <Badge variant="destructive">Acceso revocado</Badge>
                ) : estado.tieneContrasena ? (
                  <Badge variant="secondary">Activo</Badge>
                ) : (
                  <Badge variant="outline">Falta que elija su contraseña</Badge>
                )}
                {estado.enlacePendiente && !estado.revocado && (
                  <Badge variant="outline">Enlace pendiente</Badge>
                )}
              </div>

              {puedeAdministrar && (
                <div className="space-y-2 pt-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={cargando}
                    onClick={generarEnlace}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {estado.tieneContrasena
                      ? "Restablecer contraseña"
                      : "Generar enlace otra vez"}
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

      <Dialog
        open={dialogo !== null}
        onOpenChange={(abierto) => !abierto && setDialogo(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {generado
                ? "Enlace listo"
                : dialogo === "usuario"
                  ? "Cambiar usuario"
                  : "Crear cuenta"}
            </DialogTitle>
          </DialogHeader>

          {generado ? (
            <div className="space-y-4">
              <EnlaceAcceso datos={generado} />
              <div className="flex justify-end">
                <Button onClick={() => setDialogo(null)}>Listo</Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (dialogo === "usuario") cambiarUsuario();
                else crearCuenta();
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
                  Con esto entra a la app. En minúsculas, sin espacios ni
                  arroba: se lo vas a tener que dictar.
                </p>
              </div>

              {dialogo === "crear" && (
                <p className="text-sm text-muted-foreground">
                  La contraseña no la elegís vos: al crear la cuenta te damos un
                  enlace para pasarle, y la elige {nombre}.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogo(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={cargando || !usuario.trim()}>
                  {cargando
                    ? "Guardando..."
                    : dialogo === "usuario"
                      ? "Guardar"
                      : "Crear cuenta"}
                </Button>
              </div>
            </form>
          )}
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
              No va a poder entrar a la app hasta que se lo devuelvas, y los
              enlaces que le hayas mandado dejan de servir. La cuenta queda: su
              nombre sigue firmando los partes y las visitas que cargó, y su
              contraseña no se toca, así que devolvérselo es un clic.
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
              onClick={async () => {
                await cambiarAcceso(true);
                setConfirmandoRevocar(false);
              }}
            >
              {cargando ? "Revocando…" : "Revocar acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Un usuario para empezar: inicial del nombre + apellido.
 *
 * Es solo una propuesta —se puede escribir otro— pero evita la pausa de
 * inventarlo, que es cuando salen los usuarios con mayúsculas y tildes.
 */
function sugerir(nombre: string): string {
  const partes = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 30);
  return `${partes[0][0]}${partes[partes.length - 1]}`.slice(0, 30);
}
