"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BOTON_REDONDO_MOVIL,
  ICONO_BOTON_REDONDO,
} from "@/components/shared/boton-redondo-movil";
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
  /** Estilo primario: el botón verde. */
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
 * Acciones del encabezado de página.
 *
 * En escritorio van como botones en línea; **en el teléfono, todas adentro del
 * ⋯**, la primaria incluida. Hubo un botón verde al lado del título —y en la
 * app lo mismo—: compite con el título por el renglón y gasta ancho permanente
 * en algo que se toca de vez en cuando. Un menú para todo deja el encabezado
 * con el nombre de la pantalla y un solo control.
 *
 * **El ⋯ también está en escritorio**, con lo que allá no es un botón —
 * "Seleccionar personal", por ejemplo, que ahí se hace con las casillas de la
 * tabla—: quien lo aprendió en el teléfono lo buscaba en el mismo lugar y no lo
 * encontraba. Repetir en un menú lo que ya está al lado como botón no agrega
 * nada, así que cada tamaño lista lo suyo.
 */
export function PageHeaderActions({ actions }: { actions: HeaderAction[] }) {
  if (actions.length === 0) return null;

  const enEscritorio = actions.filter((a) => !a.soloMovil);
  const soloEnElMenu = actions.filter((a) => a.soloMovil);
  return (
    <>
      {/* Teléfono: todo en el ⋯, aunque sea una sola, y redondo como el de
          las fichas y el de la app. */}
      <div className="sm:hidden">
        <Menu acciones={actions} redondo />
      </div>

      {/* Escritorio: botones en línea, y el ⋯ solo con lo que no es botón. */}
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
        {soloEnElMenu.length > 0 ? <Menu acciones={soloEnElMenu} /> : null}
      </div>
    </>
  );
}

function Menu({
  acciones,
  redondo = false,
}: {
  acciones: HeaderAction[];
  /** El círculo gris del teléfono; en escritorio, el botón con borde. */
  redondo?: boolean;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          redondo ? (
            <button type="button" aria-label="Acciones" className={BOTON_REDONDO_MOVIL} />
          ) : (
            <Button
              variant="outline"
              size="icon"
              aria-label="Acciones"
              className="h-9 w-9"
            />
          )
        }
      >
        <MoreHorizontal className={redondo ? ICONO_BOTON_REDONDO : "h-4 w-4"} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {acciones.map((action, i) => (
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
  );
}
