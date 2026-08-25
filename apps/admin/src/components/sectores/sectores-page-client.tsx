"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SectoresTable } from "@/components/sectores/sectores-table";
import { SectorForm } from "@/components/sectores/sector-form";

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
      <PageHeader
        title="Sectores"
        description="Gestiona los sectores geográficos"
        actions={[
          {
            label: "Nuevo Sector",
            icon: "plus",
            onClick: () => setFormOpen(true),
            primary: true,
          },
        ]}
      />

      <SectoresTable sectores={sectores} />

      <SectorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editData={null}
      />
    </>
  );
}
