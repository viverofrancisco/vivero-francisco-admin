"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Íconos disponibles por nombre (serializable: las páginas servidor pasan un
// string, no un componente, a este componente cliente).
const ACTION_ICONS = { plus: Plus, upload: Upload } as const;
export type HeaderActionIcon = keyof typeof ACTION_ICONS;

export interface HeaderAction {
  label: string;
  /** Navegación: se renderiza como Link. */
  href?: string;
  /** Acción: se renderiza con onClick. */
  onClick?: () => void;
  /**
   * Ícono opcional (por nombre). **Solo en escritorio**: en el menú de móvil
   * las acciones van con su nombre a secas, que ya dice todo lo que el ícono
   * repetía.
   */
  icon?: HeaderActionIcon;
  /** Estilo primario en escritorio. */
  primary?: boolean;
  /**
   * Solo en el menú de móvil.
   *
   * Para lo que en escritorio ya está resuelto de otra manera —seleccionar
   * filas, por ejemplo, que ahí se hace con las casillas de la tabla— y en el
   * teléfono necesita una puerta de entrada.
   */
  soloMovil?: boolean;
}

function ActionIcon({ name }: { name?: HeaderActionIcon }) {
  if (!name) return null;
  const Icon = ACTION_ICONS[name];
  return <Icon className="h-4 w-4" />;
}

/**
 * Acciones del encabezado de página. En escritorio se muestran como botones en
 * línea; en móvil se colapsan siempre en un menú desplegable (⋯), incluso si es
 * una sola acción.
 */
export function PageHeaderActions({ actions }: { actions: HeaderAction[] }) {
  const router = useRouter();
  if (actions.length === 0) return null;

  const enEscritorio = actions.filter((a) => !a.soloMovil);

  return (
    <>
      {/* Escritorio: botones en línea */}
      <div className="hidden items-center gap-2 sm:flex">
        {enEscritorio.map((action, i) =>
          action.href ? (
            <Link key={i} href={action.href}>
              <Button
                variant={action.primary ? "default" : "outline"}
                className="gap-2"
              >
                <ActionIcon name={action.icon} />
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              key={i}
              variant={action.primary ? "default" : "outline"}
              className="gap-2"
              onClick={action.onClick}
            >
              <ActionIcon name={action.icon} />
              {action.label}
            </Button>
          )
        )}
      </div>

      {/* Móvil: menú desplegable */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Acciones"
                className="h-9 w-9"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {actions.map((action, i) => (
              <DropdownMenuItem
                key={i}
                onClick={
                  action.href
                    ? () => router.push(action.href as string)
                    : action.onClick
                }
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
