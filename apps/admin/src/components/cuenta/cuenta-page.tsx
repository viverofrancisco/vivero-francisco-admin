"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputFlotante } from "@/components/ui/input-flotante";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

const ROL: Record<string, string> = {
  ADMIN: "Administrador",
  STAFF: "Staff",
  PERSONAL: "Personal",
  CLIENTE: "Cliente",
};

/**
 * Mi cuenta: la misma pantalla que la app.
 *
 * Quién soy arriba; el usuario y el correo —lo primero es el usuario, que es
 * lo que la oficina dicta por teléfono y lo primero que se olvida—; cambiar la
 * contraseña; y cerrar sesión en rojo, texto solo: un bloque rojo a todo el
 * ancho gritaba más fuerte que todo lo demás para algo que no es destructivo.
 *
 * Lo único que no está es el bloque de permisos del teléfono: el navegador no
 * tiene Ajustes que abrir.
 */
export function CuentaPage({
  usuario,
}: {
  usuario: {
    nombre: string;
    rol: string;
    usuario: string | null;
    email: string | null;
  };
  branding?: { nombre: string | null };
}) {
  const [cambiando, setCambiando] = useState(false);

  return (
    // En el teléfono, una columna centrada como la app; en escritorio se
    // ensancha y el encabezado se acuesta —avatar a la izquierda, nombre al
    // lado— para no dejar una tira angosta en medio de una pantalla ancha.
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 md:max-w-2xl">
      <div className="flex flex-col items-center gap-2 pt-2 md:flex-row md:items-center md:gap-4 md:pt-0">
        <InitialsAvatar name={usuario.nombre} size={72} />
        <div className="text-center md:text-left">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            {usuario.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ROL[usuario.rol] ?? usuario.rol}
          </p>
        </div>
      </div>

      <section>
        <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cuenta
        </p>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {usuario.usuario ? (
            <Fila etiqueta="Usuario" valor={usuario.usuario} />
          ) : null}
          {usuario.email ? <Fila etiqueta="Email" valor={usuario.email} /> : null}
          <button
            type="button"
            onClick={() => setCambiando(true)}
            className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            Cambiar contraseña
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </section>

      <Button
        variant="ghost"
        className="self-center text-destructive hover:text-destructive md:self-start"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Cerrar sesión
      </Button>

      {cambiando ? (
        <CambiarContrasena onCerrar={() => setCambiando(false)} />
      ) : null}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 truncate font-medium">{valor}</span>
    </div>
  );
}

/**
 * Cambiar la propia contraseña sin salir. Pide la actual porque es lo que
 * prueba quién es: la sesión sola no alcanza —una computadora puede quedar
 * abierta—. Al guardar, el servidor revoca las sesiones de la app, que es el
 * motivo por el que se suele cambiar.
 */
function CambiarContrasena({ onCerrar }: { onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);

  const puede =
    actual.length > 0 && nueva.length >= 6 && nueva === repetir && !guardando;

  async function guardar() {
    if (!puede) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No pudimos cambiarla");
      toast.success("Contraseña cambiada");
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cambiarla");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent
        pantallaCompletaEnMovil
        showCloseButton={false}
        className="gap-0 sm:max-w-sm"
      >
        <div className="-mx-4 -mt-4 mb-4 flex flex-none items-center gap-3 border-b border-border py-2 pl-2 pr-3">
          <Button variant="ghost" size="sm" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <DialogTitle className="flex-1 text-center text-base">
            Cambiar contraseña
          </DialogTitle>
          <Button size="sm" onClick={guardar} disabled={!puede}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <InputFlotante
            label="Contraseña actual"
            value={actual}
            onChange={setActual}
            type="password"
          />
          <InputFlotante
            label="Contraseña nueva"
            value={nueva}
            onChange={setNueva}
            type="password"
          />
          <InputFlotante
            label="Repetir la nueva"
            value={repetir}
            onChange={setRepetir}
            type="password"
          />
          {nueva.length > 0 && nueva.length < 6 ? (
            <p className="text-xs text-muted-foreground">
              Al menos seis caracteres.
            </p>
          ) : null}
          {repetir.length > 0 && nueva !== repetir ? (
            <p className="text-xs text-destructive">No coinciden.</p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
