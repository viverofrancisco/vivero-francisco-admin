"use client";

import { PageHeaderActions, type HeaderAction } from "./page-header-actions";

/**
 * El encabezado de una pantalla: su título y sus acciones.
 *
 * **Sin subtítulo.** Los que había repetían el título con otras palabras
 * —"Personal" / "Gestiona el personal del vivero"— así que ocupaban un renglón
 * para no decir nada. Si alguna pantalla necesita explicarse, se explica donde
 * hace falta la explicación y no arriba de todo.
 */
interface PageHeaderProps {
  title: string;
  /** Acciones del encabezado: botones en escritorio, dropdown (⋯) en móvil. */
  actions?: HeaderAction[];
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Más chico en el teléfono: un título de 24 al lado de una lista
          apretada se lleva media pantalla para decir dónde estás. */}
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
      {actions && actions.length > 0 ? (
        <PageHeaderActions actions={actions} />
      ) : null}
    </div>
  );
}

export type { HeaderAction };
