"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Un identificador con botón de copiar.
 *
 * Los códigos e ids de Contífico se pegan en su interfaz para buscar un
 * producto, y son largos y fáciles de transcribir mal.
 */
export function CopyField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      // Vuelve al ícono normal solo; no hace falta limpiarlo al desmontar
      // porque setState sobre un componente desmontado es un no-op en React 19.
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No pudimos copiar");
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="w-16 flex-none text-xs text-muted-foreground">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${label}`}
        className="flex-none rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copiado ? (
          <Check className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
