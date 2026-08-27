"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Ban,
  Copy,
  KeyRound,
  Loader2,
  MoreVertical,
  Send,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { EnlaceAcceso, type EnlaceGenerado } from "./enlace-acceso";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

interface UserData {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string;
  role: string;
  createdAt: string;
  /** Si ya eligió una contraseña. Si no, su invitación sigue pendiente. */
  tieneContrasena: boolean;
  /** Si se le cortó el acceso. La cuenta existe; no puede entrar. */
  revocado: boolean;
}

/** Role pill style: ADMIN green, sector-admin sky, others neutral. */
const roleMeta = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", className: "bg-secondary text-green-700" };
    case "STAFF":
      return { label: "Staff", className: "bg-muted text-muted-foreground" };
    case "PERSONAL_ADMIN":
      return { label: "Admin de sector", className: "bg-info/12 text-info" };
    case "PERSONAL":
      return { label: "Personal", className: "bg-muted text-muted-foreground" };
    default:
      return { label: role, className: "bg-muted text-muted-foreground" };
  }
};

export function UsersTable({
  users,
  usuarioActualId,
}: {
  users: UserData[];
  /** Quién está mirando, para no ofrecerle revocarse a sí mismo. */
  usuarioActualId: string;
}) {
  const router = useRouter();
  /** A quién se le está generando el enlace, para no repetir el clic. */
  const [generando, setGenerando] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<
    | (EnlaceGenerado & { correo: string; tipo: "invitacion" | "restablecer" })
    | null
  >(null);

  /**
   * Emite un enlace nuevo. `enviarCorreo` distingue "mandáselo" de "dámelo
   * para copiarlo": el segundo es para cuando la persona está al lado o se le
   * manda por WhatsApp, y un correo de más solo confunde.
   *
   * En los dos casos se muestra el enlace, porque es la única vez que se puede
   * ver, y en los dos casos el enlace anterior queda anulado.
   */
  /** Corta o devuelve el acceso, sin tocar la cuenta ni lo que la persona hizo. */
  async function cambiarAcceso(user: UserData, revocado: boolean) {
    setGenerando(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revocado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos cambiar el acceso");
      toast.success(revocado ? "Acceso revocado" : "Acceso restaurado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos cambiar el acceso"
      );
    } finally {
      setGenerando(null);
    }
  }

  async function generarEnlace(
    user: UserData,
    tipo: "invitacion" | "restablecer",
    enviarCorreo: boolean
  ) {
    setGenerando(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/enlace-acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, enviarCorreo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos generar el enlace");
      setEnlace({ ...data, correo: user.email, tipo });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos generar el enlace"
      );
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Fecha de registro</TableHead>
            <TableHead className="w-16 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const meta = roleMeta(user.role);
            const esUnoMismo = user.id === usuarioActualId;
            const name =
              [user.name, user.apellido].filter(Boolean).join(" ") || "—";
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/configuracion/usuarios/${user.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={name} size={36} />
                    <span className="font-bold text-foreground">{name}</span>
                    {/* Sin esto no hay forma de saber quién nunca entró, y el
                        menú de la fila parecería ofrecer cosas al azar. */}
                    {user.revocado ? (
                      <span className="flex-none rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                        Acceso revocado
                      </span>
                    ) : !user.tieneContrasena ? (
                      <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        Invitación pendiente
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {new Date(user.createdAt).toLocaleDateString("es-EC")}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={generando === user.id}
                          aria-label={`Acciones de ${name}`}
                        />
                      }
                    >
                      {generando === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </DropdownMenuTrigger>
                    {/* Ancho fijo: el menú se mide contra el botón, que es un
                        ícono, y sin esto cada opción salía en tres renglones. */}
                    <DropdownMenuContent align="end" className="w-64">
                      {/* Lo que se ofrece depende de en qué estado está la
                          persona. Reenviarle una invitación a alguien que ya
                          trabaja acá, o mandarle un "restablecé tu contraseña"
                          a quien nunca tuvo una, es hablarle de algo que no le
                          pasó. */}
                      {user.revocado ? (
                        <>
                          {/* Volver con la contraseña que ya tenía, o con una
                              nueva si no la recuerda. */}
                          <DropdownMenuItem
                            onClick={() => cambiarAcceso(user, false)}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Quitar el bloqueo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "invitacion", true)
                            }
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Volver a invitar
                          </DropdownMenuItem>
                        </>
                      ) : user.tieneContrasena ? (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "restablecer", true)
                            }
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Restablecer contraseña
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "restablecer", false)
                            }
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar enlace sin enviar
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "invitacion", true)
                            }
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Reenviar invitación
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "invitacion", false)
                            }
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar enlace de invitación
                          </DropdownMenuItem>
                        </>
                      )}

                      {/* Revocar no borra la cuenta: cierra la puerta y anula
                          los enlaces y sesiones que quedaran vivos. Uno mismo
                          no aparece, porque dejarse afuera no tiene arreglo
                          desde adentro. */}
                      {!user.revocado && !esUnoMismo ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => cambiarAcceso(user, true)}
                            className="text-destructive"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Revocar acceso
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={enlace !== null} onOpenChange={(v) => !v && setEnlace(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {enlace?.tipo === "invitacion"
                ? "Enlace de invitación"
                : "Enlace para cambiar la contraseña"}
            </DialogTitle>
          </DialogHeader>
          {enlace ? (
            <div className="space-y-4">
              <EnlaceAcceso datos={enlace} correo={enlace.correo} />
              <div className="flex justify-end">
                <Button onClick={() => setEnlace(null)}>Listo</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
