import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  createHref?: string;
  createLabel?: string;
  /** Acciones extra (p. ej. un botón de importar) junto al botón "Nuevo". */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = "Nuevo",
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {(actions || createHref) && (
        <div className="flex items-center gap-2">
          {actions}
          {createHref && (
            <Link href={createHref}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {createLabel}
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
