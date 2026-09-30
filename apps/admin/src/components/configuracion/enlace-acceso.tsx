"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Clock, Copy, Loader2, Mail, MailX, Share2 } from "lucide-react";
import { toast } from "sonner";

export interface EnlaceGenerado {
  enlace: string;
  /** ISO. Cuándo deja de servir. */
  expiraEl: string;
  correoEnviado: boolean;
  /**
   * Si se intentó mandar el correo. Distingue "no salió" de "no se pidió", que
   * son cosas muy distintas para quien está mirando: una es un problema.
   */
  correoIntentado?: boolean;
}

/**
 * El enlace recién generado, listo para copiar.
 *
 * Se muestra **siempre**, aunque el correo haya salido bien: el correo puede
 * demorar, caer en spam o ir a una casilla que la persona no mira, y en ese
 * caso lo que resuelve es mandárselo por WhatsApp. El enlace no se puede
 * volver a ver después —en la base solo queda su hash— así que si se cierra
 * esto sin copiarlo, el camino es generar otro.
 */
export function EnlaceAcceso({
  datos: inicial,
  correo,
  enviarA,
}: {
  datos: EnlaceGenerado;
  /**
   * A qué dirección se intentó enviar, para nombrarla en el mensaje. No la hay
   * cuando la cuenta no tiene correo —el personal de campo— y ahí el enlace se
   * copia y se manda por donde sea.
   */
  correo?: string;
  /**
   * Con esto, y con `correo`, aparece *Enviar por correo*: manda **este**
   * enlace —no emite otro, que anularía el que ya se copió— a la casilla de
   * la cuenta.
   */
  enviarA?: { userId: string; tipo: "invitacion" | "restablecer" };
}) {
  const [copiado, setCopiado] = useState(false);
  const [datos, setDatos] = useState(inicial);
  const [enviando, setEnviando] = useState(false);

  async function enviarPorCorreo() {
    if (!enviarA) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/users/${enviarA.userId}/enlace-acceso/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enlace: datos.enlace, tipo: enviarA.tipo }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error ?? "No pudimos enviar el correo");
      setDatos((d) => ({ ...d, correoEnviado: r.correoEnviado, correoIntentado: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos enviar el correo");
    } finally {
      setEnviando(false);
    }
  }

  // El teléfono ofrece compartir —por WhatsApp, que es como le llega al
  // personal de campo—; el escritorio casi nunca, y ahí queda copiar.
  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const seIntento = datos.correoIntentado ?? false;
  const fallo = seIntento && !datos.correoEnviado;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(datos.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles queda seleccionar a mano; el campo es
      // de solo lectura pero se puede seleccionar.
    }
  }

  return (
    // El enlace es una sola palabra de cien caracteres, y el diálogo es una
    // grilla que se mide por su contenido: con `truncate` su ancho mínimo
    // seguía siendo el enlace entero y lo estiraba más allá del borde.
    // `break-all` lo deja partirse en cualquier letra, así que no empuja nada.
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        Pásale este enlace para que elija su contraseña.
      </p>

      {/* El enlace en una tarjeta y no en un campo: no se edita, y un input
          con el texto cortado pedía que alguien lo tocara. Clic lo copia. */}
      <button
        type="button"
        onClick={copiar}
        className="block w-full min-w-0 overflow-hidden rounded-xl border bg-muted/50 px-3.5 py-3 text-left transition-colors hover:bg-muted"
      >
        <span className="line-clamp-2 font-mono text-xs break-all text-foreground">
          {datos.enlace}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Caduca {vencimiento(datos.expiraEl)}
        </span>
      </button>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={copiar} className="h-10 sm:flex-1">
          {copiado ? (
            <>
              <Check className="mr-1.5 h-4 w-4" /> Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar enlace
            </>
          )}
        </Button>
        {puedeCompartir ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigator.share({ text: datos.enlace }).catch(() => {})}
            className="h-10 sm:flex-1"
          >
            <Share2 className="mr-1.5 h-4 w-4" /> Compartir
          </Button>
        ) : null}
        {enviarA && correo && !datos.correoEnviado ? (
          <Button
            type="button"
            variant="outline"
            onClick={enviarPorCorreo}
            disabled={enviando}
            className="h-10 sm:flex-1"
          >
            {enviando ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-1.5 h-4 w-4" />
            )}
            Enviar por correo
          </Button>
        ) : null}
      </div>

      {/* Qué pasó con el correo, cuando hubo uno de por medio. */}
      {seIntento ? (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            fallo ? "bg-amber-50 text-amber-900" : "bg-primary/5 text-foreground"
          }`}
        >
          {fallo ? (
            <MailX className="mt-0.5 h-4 w-4 flex-none" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
          )}
          <p>
            {datos.correoEnviado ? (
              <>
                Enviado a <strong>{correo}</strong>.
              </>
            ) : (
              <>No pudimos enviar el correo. Copia el enlace y envíaselo por otro lado.</>
            )}
          </p>
        </div>
      ) : null}

      {/* Lo único que no se puede averiguar después. */}
      <p className="text-xs text-muted-foreground">
        El enlace no se vuelve a mostrar, y anula los que se hayan generado antes.
      </p>
    </div>
  );
}

/**
 * Cuándo vence, dicho como lo diría una persona.
 *
 * Un enlace de una hora necesita la hora —"el 27 de agosto" no sirve para
 * algo que se muere a las 11:45— y uno de una semana necesita la fecha.
 */
function vencimiento(iso: string): string {
  const fecha = new Date(iso);
  const faltan = fecha.getTime() - Date.now();
  const hora = fecha.toLocaleTimeString("es-EC", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (faltan < 24 * 60 * 60 * 1000) return `hoy a las ${hora}`;
  return `el ${fecha.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
  })} a las ${hora}`;
}
