import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  createHref?: string;
  createLabel?: string;
}

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = "Nuevo",
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-gray-500">{description}</p>}
      </div>
      {createHref && (
        <Link href={createHref}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
