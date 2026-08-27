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
  /** Si tiene un enlace vivo sin usar: se le mandó y falta que lo abra. */
  enlacePendiente: boolean;
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

  /**
   * Emite un enlace nuevo y lo entrega según lo que se haya pedido.
   *
   * *Enviar* abre el diálogo, porque conviene ver a dónde fue y poder mandarlo
   * también por otro lado. *Copiar* copia y ya está: pedirlo ya dice qué se
   * quiere hacer con él, y un diálogo en el medio es un clic de más.
   *
   * El enlace no se puede volver a ver, así que si el portapapeles falla se
   * muestra igual: quedarse sin nada después de haber anulado el anterior
   * sería lo peor que puede pasar acá.
   */
  async function generarEnlace(
    user: UserData,
    tipo: "invitacion" | "restablecer",
    modo: "enviar" | "copiar"
  ) {
    setGenerando(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/enlace-acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, enviarCorreo: modo === "enviar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos generar el enlace");

      if (modo === "copiar") {
        try {
          await navigator.clipboard.writeText(data.enlace);
          toast.success("Enlace copiado");
          return;
        } catch {
          // Sin portapapeles queda mostrarlo para copiarlo a mano.
        }
      }
      setEnlace({ ...data, correo: user.email, tipo });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos generar el enlace"
      );
      return;
    } finally {
      setGenerando(null);
    }
    // La fila se relee después de cualquier acción sobre el usuario. Hoy
    // emitir un enlace no le cambia el estado —el bloqueo se levanta recién
    // cuando la persona lo usa— pero la lista sale del servidor y quedarse con
    // una versión vieja en pantalla es el tipo de cosa que aparece cuando algo
    // de esto cambia y nadie se acuerda de este renglón.
    router.refresh();
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
                {/* El estado va **debajo** del nombre, no al lado: son
                    hasta dos etiquetas y en la misma línea le comían el
                    espacio al nombre, que es lo primero que uno busca en la
                    fila. `w-full max-w-0` deja que esta celda se quede con el
                    sobrante y trunque en vez de empujar a las demás fuera de
                    la pantalla. */}
                <TableCell className="w-full max-w-0">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={name} size={36} />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-foreground">
                        {name}
                      </div>
                      {user.revocado || !user.tieneContrasena || user.enlacePendiente ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {user.revocado ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                              Acceso revocado
                            </span>
                          ) : !user.tieneContrasena ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              Invitación pendiente
                            </span>
                          ) : null}
                          {/* Que el enlace esté enviado y sin abrir es un
                              estado en sí mismo: explica por qué la fila no
                              cambió después de invitar, y evita reenviarlo
                              tres veces creyendo que no salió. */}
                          {user.enlacePendiente ? (
                            <span
                              className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              title="Ya se le envió el enlace; falta que lo abra y elija su contraseña."
                            >
                              Enlace enviado
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
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
                          {/* Volver a invitar le manda una contraseña nueva;
                              remover el bloqueo lo deja entrar con la que ya
                              tenía. Lo segundo va al final y marcado, en el
                              mismo lugar donde está *Revocar acceso* cuando la
                              persona tiene acceso: son las dos caras de la
                              misma decisión y conviene que se busquen en el
                              mismo renglón. */}
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "invitacion", "enviar")
                            }
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Volver a invitar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => cambiarAcceso(user, false)}
                            className="text-destructive"
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Remover bloqueo
                          </DropdownMenuItem>
                        </>
                      ) : user.tieneContrasena ? (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "restablecer", "enviar")
                            }
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Restablecer contraseña
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "restablecer", "copiar")
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
                              generarEnlace(user, "invitacion", "enviar")
                            }
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Reenviar invitación
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              generarEnlace(user, "invitacion", "copiar")
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
