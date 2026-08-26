import Link from "next/link";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import {
  globalSearch,
  type SearchGroup,
  type SearchResultItem,
} from "@/lib/services/search.service";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import {
  CalendarDays,
  ChevronRight,
  DollarSign,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";

const groupMeta = {
  clientes: { label: "Clientes", icon: Users },
  visitas: { label: "Visitas", icon: CalendarDays },
  ordenes: { label: "Órdenes", icon: DollarSign },
  suscripciones: { label: "Suscripciones", icon: RefreshCw },
  informes: { label: "Informes", icon: FileText },
} as const;

function ResultRow({ item }: { item: SearchResultItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-foreground">
          {item.title}
        </div>
        <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
          {item.subtitle}
        </div>
        {item.detalle && (
          <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
            {item.detalle}
          </div>
        )}
      </div>
      {item.estado && (
        <StatusBadge estado={item.estado as EstadoVisitaUI} size="sm" />
      )}
      <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
    </Link>
  );
}

function Section({
  groupKey,
  group,
}: {
  groupKey: keyof typeof groupMeta;
  group: SearchGroup;
}) {
  if (group.items.length === 0) return null;
  const { label, icon: Icon } = groupMeta[groupKey];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-green-700">
          <Icon className="h-[17px] w-[17px]" />
        </span>
        <span className="text-[15px] font-extrabold text-foreground">
          {label}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-green-700">
          {group.total}
        </span>
      </div>
      <div className="divide-y divide-border">
        {group.items.map((item) => (
          <ResultRow key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const { q = "" } = await searchParams;
  const term = q.trim();
  const result = term.length >= 2 ? await globalSearch(viewer, term, 50) : null;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resultados de búsqueda</h1>
        <p className="text-muted-foreground">
          {term.length < 2
            ? "Escribe al menos dos caracteres para buscar."
            : result && result.total > 0
              ? `${result.total} resultado${result.total === 1 ? "" : "s"} para “${term}”`
              : `Sin resultados para “${term}”.`}
        </p>
      </div>

      {result && result.total > 0 && (
        <div className="space-y-4">
          <Section groupKey="clientes" group={result.clientes} />
          <Section groupKey="visitas" group={result.visitas} />
          <Section groupKey="ordenes" group={result.ordenes} />
          <Section groupKey="suscripciones" group={result.suscripciones} />
          <Section groupKey="informes" group={result.informes} />
        </div>
      )}
    </div>
  );
}
