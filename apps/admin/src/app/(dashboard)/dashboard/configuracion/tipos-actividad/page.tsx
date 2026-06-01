import { requireRole } from "@/lib/auth-helpers";
import { listTiposActividad } from "@/lib/services/tipo-actividad.service";
import { TiposActividadClient } from "@/components/configuracion/tipos-actividad-client";

export default async function TiposActividadPage() {
  await requireRole("ADMIN");
  const items = await listTiposActividad({ incluirInactivos: true });
  // Convert Date fields to plain strings before passing to client component.
  const serialized = items.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    descripcionTemplate: t.descripcionTemplate,
    orden: t.orden,
    activo: t.activo,
  }));
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tipos de actividad</h1>
        <p className="text-sm text-muted-foreground">
          Plantillas para las secciones de los informes mensuales.
        </p>
      </div>
      <TiposActividadClient initialItems={serialized} />
    </div>
  );
}
