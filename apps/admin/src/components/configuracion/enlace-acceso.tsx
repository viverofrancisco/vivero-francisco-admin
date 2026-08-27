"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Mail, MailX } from "lucide-react";

export interface EnlaceGenerado {
  enlace: string;
  /** ISO. Cuándo deja de servir. */
  expiraEl: string;
  correoEnviado: boolean;
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
  datos,
  correo,
}: {
  datos: EnlaceGenerado;
  /** A qué dirección se intentó enviar, para nombrarla en el mensaje. */
  correo: string;
}) {
  const [copiado, setCopiado] = useState(false);

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
    <div className="space-y-3">
      <div
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
          datos.correoEnviado
            ? "border-primary/30 bg-primary/5"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {datos.correoEnviado ? (
          <Mail className="mt-0.5 h-4 w-4 flex-none text-primary" />
        ) : (
          <MailX className="mt-0.5 h-4 w-4 flex-none" />
        )}
        <p>
          {datos.correoEnviado ? (
            <>
              Le enviamos el enlace a <strong>{correo}</strong>. Podés mandárselo
              también por otro medio.
            </>
          ) : (
            <>
              No pudimos enviar el correo. Copiá el enlace y mandáselo por donde
              prefieras.
            </>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={datos.enlace}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={copiar} className="flex-none">
          {copiado ? (
            <>
              <Check className="mr-1.5 h-4 w-4" /> Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Caduca {vencimiento(datos.expiraEl)}. Al abrirlo elige su contraseña y ya
        puede entrar. Este enlace no se vuelve a mostrar: si lo perdés, generá
        uno nuevo.
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
