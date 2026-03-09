"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SectoresTable } from "@/components/sectores/sectores-table";
import { SectorForm } from "@/components/sectores/sector-form";
import { EmptyState } from "@/components/shared/empty-state";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface SectorRow {
  id: string;
  nombre: string;
  _count: { clientes: number };
  admins: { user: AdminUser }[];
}

interface SectoresPageClientProps {
  sectores: SectorRow[];
}

export function SectoresPageClient({ sectores }: SectoresPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sectores</h1>
          <p className="text-gray-500">Gestiona los sectores geográficos</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Sector
        </Button>
      </div>

      {sectores.length === 0 ? (
        <EmptyState message="No hay sectores registrados" />
      ) : (
        <SectoresTable sectores={sectores} />
      )}

      <SectorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editData={null}
      />
    </>
  );
}
