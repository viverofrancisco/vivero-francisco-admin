/**
 * En qué estado está un producto, en una palabra.
 *
 * Son dos cosas distintas en un mismo lugar: `estado` dice si ya se ofrece o
 * todavía se está armando, y archivado —el borrado suave— pisa a las dos,
 * porque un archivado no se ofrece esté como esté.
 *
 * Vive acá y no en la ficha porque el listado muestra exactamente lo mismo, y
 * dos versiones del mismo semáforo terminan diciendo cosas distintas.
 */
export function EstadoBadge({
  archivado,
  estado,
}: {
  archivado: boolean;
  estado: "ACTIVO" | "BORRADOR";
}) {
  const [texto, clases] = archivado
    ? ["Archivado", "border-amber-200 bg-amber-50 text-amber-900"]
    : estado === "BORRADOR"
      ? ["Borrador", "border-border bg-muted text-muted-foreground"]
      : ["Activo", "border-primary/20 bg-primary/10 text-primary"];

  return (
    <span
      className={`inline-block flex-none rounded-full border px-2 py-0.5 text-xs font-medium ${clases}`}
    >
      {texto}
    </span>
  );
}
