"use client";

import { PageHeaderActions, type HeaderAction } from "./page-header-actions";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acciones del encabezado: botones en escritorio, dropdown (⋮) en móvil. */
  actions?: HeaderAction[];
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && actions.length > 0 ? (
        <PageHeaderActions actions={actions} />
      ) : null}
    </div>
  );
}

export type { HeaderAction };
