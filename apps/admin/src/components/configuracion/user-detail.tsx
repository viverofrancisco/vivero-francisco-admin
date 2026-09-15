"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserForm } from "./user-form";
import { EnlaceAcceso, type EnlaceGenerado } from "./enlace-acceso";

interface UserData {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

interface Props {
  user: UserData;
}

const roleBadge = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", variant: "default" as const };
    case "STAFF":
      return { label: "Staff", variant: "secondary" as const };
    case "PERSONAL":
      return { label: "Personal", variant: "outline" as const };
    default:
      return { label: role, variant: "outline" as const };
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function UserDetail({ user }: Props) {
  const router = useRouter();
  const [cardsEditing, setCardsEditing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  /** El enlace recién emitido. Mientras exista, el diálogo lo muestra. */
  const [generado, setGenerado] = useState<EnlaceGenerado | null>(null);

  /**
   * Nadie le pone la contraseña a nadie.
   *
   * Acá había un campo para tipearle una contraseña al otro: había que
   * inventarla, dictarla y confiar en que la cambiara después —cosa que no
   * pasa—, y hasta entonces era una clave que sabían dos personas. Lo que se
   * emite es un enlace de un solo uso; la contraseña la elige su dueño.
   */
  const pedirEnlace = async () => {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/enlace-acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "restablecer",
          enviarCorreo: user.email !== null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pudimos generar el enlace");
      setGenerado(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos generar el enlace"
      );
    } finally {
      setResetLoading(false);
    }
  };

  const nombreCompleto = [user.name, user.apellido].filter(Boolean).join(" ") || "Sin nombre";
  const badge = roleBadge(user.role);

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/configuracion")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold truncate">{nombreCompleto}</h1>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Usuario desde {formatDate(user.createdAt)}
            </p>
          </div>
          {cardsEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCardsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="user-cards-form"
              >
                Guardar cambios
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Form + Sectors */}
          <div className="lg:col-span-2 space-y-6">
            <UserForm
              initialData={{
                id: user.id,
                name: user.name,
                apellido: user.apellido,
                // La oficina siempre tiene correo —es con lo que se la invitó—;
                // el `?? ""` es por el tipo, que admite nulo desde que existen
                // las cuentas de personal, que no se editan acá.
                email: user.email ?? "",
              }}
              cardsEditing={cardsEditing}
              onEditDone={() => setCardsEditing(false)}
            />

          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Reset password card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Seguridad</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setGenerado(null);
                    setResetOpen(true);
                  }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Restablecer contraseña
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Le enviamos un enlace para que elija la suya.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Restablecer = emitir un enlace, no elegirle la contraseña. */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          {generado ? (
            <div className="space-y-4">
              <EnlaceAcceso datos={generado} correo={user.email ?? undefined} />
              <div className="flex justify-end">
                <Button onClick={() => setResetOpen(false)}>Listo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{nombreCompleto}</strong> elige su contraseña con un
                enlace de un solo uso.
                {user.email && " Se lo enviamos por correo."}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={pedirEnlace} disabled={resetLoading}>
                  {resetLoading ? "Generando..." : "Generar enlace"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
