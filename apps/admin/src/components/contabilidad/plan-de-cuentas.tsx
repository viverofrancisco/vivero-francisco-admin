"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Plus, Search } from "lucide-react";
import {
  codigoDelPadre,
  compararCodigos,
  ETIQUETA_TIPO_CUENTA,
  naturalezaDeCuenta,
  paraBuscar,
  type CuentaDelPlan,
  type TipoCuentaContable,
} from "@vivero/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useFiltroUrl } from "@/lib/filtros-url";
import { cn } from "@/lib/utils";

/** Lo que el diálogo está editando: una cuenta, o una nueva bajo un padre. */
type Edicion =
  | { modo: "editar"; cuenta: CuentaDelPlan }
  | { modo: "nueva"; padre: CuentaDelPlan | null };

/**
 * El plan de cuentas como árbol.
 *
 * Es largo —el del vivero tiene casi 600 cuentas—, así que arranca con los dos
 * primeros niveles abiertos y el buscador abre solo lo necesario para mostrar
 * lo que coincide. Tocar una cuenta la abre en un diálogo: ahí se corrige el
 * nombre, se cambia el tipo, se activa o desactiva, y en un grupo se le
 * agrega una cuenta debajo. Es el mismo gesto en el teléfono y en la
 * computadora: sin botones que aparezcan al pasar el mouse.
 */
export function PlanDeCuentas({ cuentas }: { cuentas: CuentaDelPlan[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  const [verInactivas, setVerInactivas] = useFiltroUrl("inactivas", false);
  const [abiertas, setAbiertas] = useState<Set<string>>(
    () => new Set(cuentas.filter((c) => c.codigo.split(".").length <= 1).map((c) => c.id))
  );
  const [edicion, setEdicion] = useState<Edicion | null>(null);

  const hijas = useMemo(() => {
    const m = new Map<string | null, CuentaDelPlan[]>();
    for (const c of cuentas) {
      const k = c.padreId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    for (const lista of m.values()) lista.sort((a, b) => compararCodigos(a.codigo, b.codigo));
    return m;
  }, [cuentas]);

  /** Con búsqueda: las que coinciden y todos sus padres, abiertos. */
  const visiblesPorBusqueda = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return null;
    const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]));
    const ids = new Set<string>();
    for (const c of cuentas) {
      if (!verInactivas && !c.activa) continue;
      const coincide =
        c.codigo.startsWith(q) ||
        q.split(/\s+/).every((p) => paraBuscar(c.nombre).includes(p));
      if (!coincide) continue;
      ids.add(c.id);
      let p = codigoDelPadre(c.codigo);
      while (p) {
        const padre = porCodigo.get(p);
        if (padre) ids.add(padre.id);
        p = codigoDelPadre(p);
      }
    }
    return ids;
  }, [busqueda, cuentas, verInactivas]);

  const filas: { cuenta: CuentaDelPlan; nivel: number }[] = [];
  const recorrer = (padreId: string | null, nivel: number) => {
    for (const c of hijas.get(padreId) ?? []) {
      if (!verInactivas && !c.activa) continue;
      if (visiblesPorBusqueda && !visiblesPorBusqueda.has(c.id)) continue;
      filas.push({ cuenta: c, nivel });
      const abierta = visiblesPorBusqueda ? true : abiertas.has(c.id);
      if (abierta) recorrer(c.id, nivel + 1);
    }
  };
  recorrer(null, 0);

  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const total = cuentas.filter((c) => c.activa).length;

  return (
    <>
      <PageHeader
        title="Plan de cuentas"
        actions={[
          {
            label: "Nueva cuenta",
            icon: "plus",
            primary: true,
            onClick: () => setEdicion({ modo: "nueva", padre: null }),
          },
          {
            label: "Abrir todo",
            onClick: () => setAbiertas(new Set(cuentas.map((c) => c.id))),
          },
          { label: "Cerrar todo", onClick: () => setAbiertas(new Set()) },
        ]}
      />

      <div className="flex flex-none flex-wrap items-center gap-2 md:gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={verInactivas} onCheckedChange={(v) => setVerInactivas(v)} />
          Ver inactivas
        </label>
        <span className="hidden text-sm text-muted-foreground md:inline">
          {total} cuentas activas
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-card">
        {filas.length === 0 ? (
          <EmptyState
            message={
              cuentas.length === 0
                ? "Todavía no hay plan de cuentas"
                : "Ninguna cuenta coincide con la búsqueda"
            }
          />
        ) : (
          <ul className="divide-y">
            {filas.map(({ cuenta: c, nivel }) => {
              const tieneHijas = (hijas.get(c.id)?.length ?? 0) > 0;
              const abierta = visiblesPorBusqueda ? true : abiertas.has(c.id);
              const grupo = c.tipo === "GRUPO";
              return (
                <li
                  key={c.id}
                  className={cn("flex items-center gap-1 pr-3", !c.activa && "opacity-50")}
                  style={{ paddingLeft: `${4 + nivel * 18}px` }}
                >
                  <button
                    type="button"
                    aria-label={abierta ? "Cerrar" : "Abrir"}
                    disabled={!tieneHijas || !!visiblesPorBusqueda}
                    onClick={() => alternar(c.id)}
                    className="flex h-9 w-7 flex-none items-center justify-center text-muted-foreground disabled:opacity-0"
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", abierta && "rotate-90")}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdicion({ modo: "editar", cuenta: c })}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left hover:text-primary"
                  >
                    <span className="w-24 flex-none font-mono text-xs tabular-nums text-muted-foreground md:w-28">
                      {c.codigo}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-sm", grupo && "font-semibold")}>
                      {c.nombre}
                    </span>
                    {!c.activa ? (
                      <span className="flex-none text-xs text-muted-foreground">Inactiva</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {edicion ? (
        <DialogoCuenta
          key={edicion.modo === "editar" ? edicion.cuenta.id : `nueva-${edicion.padre?.id ?? "raiz"}`}
          edicion={edicion}
          cuentas={cuentas}
          tieneHijas={
            edicion.modo === "editar" && (hijas.get(edicion.cuenta.id)?.length ?? 0) > 0
          }
          onCerrar={() => setEdicion(null)}
          onAgregarDebajo={(padre) => setEdicion({ modo: "nueva", padre })}
          onGuardado={() => {
            setEdicion(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/** El siguiente código libre bajo un padre: `1.1` con hijas hasta `1.1.7` → `1.1.8`. */
function siguienteCodigo(padre: CuentaDelPlan | null, cuentas: CuentaDelPlan[]): string {
  const prefijo = padre ? `${padre.codigo}.` : "";
  let max = 0;
  for (const c of cuentas) {
    if (codigoDelPadre(c.codigo) !== (padre?.codigo ?? null)) continue;
    const n = Number(c.codigo.slice(prefijo.length));
    if (n > max) max = n;
  }
  return `${prefijo}${max + 1}`;
}

function DialogoCuenta({
  edicion,
  cuentas,
  tieneHijas,
  onCerrar,
  onAgregarDebajo,
  onGuardado,
}: {
  edicion: Edicion;
  cuentas: CuentaDelPlan[];
  tieneHijas: boolean;
  onCerrar: () => void;
  onAgregarDebajo: (padre: CuentaDelPlan) => void;
  onGuardado: () => void;
}) {
  const esNueva = edicion.modo === "nueva";
  const original = esNueva ? null : edicion.cuenta;
  const padre = esNueva
    ? edicion.padre
    : cuentas.find((c) => c.id === edicion.cuenta.padreId) ?? null;

  const [codigo, setCodigo] = useState(
    esNueva ? siguienteCodigo(edicion.padre, cuentas) : edicion.cuenta.codigo
  );
  const [nombre, setNombre] = useState(original?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoCuentaContable>(original?.tipo ?? "DETALLE");
  const [activa, setActiva] = useState(original?.activa ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio =
    esNueva ||
    nombre.trim() !== original?.nombre ||
    tipo !== original?.tipo ||
    activa !== original?.activa;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = esNueva
        ? await fetch("/api/contabilidad/cuentas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ padreId: padre?.id ?? null, codigo, nombre, tipo }),
          })
        : await fetch(`/api/contabilidad/cuentas/${original!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, tipo, activa }),
          });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo guardar");
      toast.success(esNueva ? "Cuenta creada" : "Cuenta guardada");
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!original) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/cuentas/${original.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo eliminar");
      toast.success("Cuenta eliminada");
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setGuardando(false);
    }
  }

  const naturaleza = naturalezaDeCuenta(codigo || "1");

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esNueva ? "Nueva cuenta" : `${original!.codigo} ${original!.nombre}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {padre ? (
            <p className="text-sm text-muted-foreground">
              Dentro de <span className="font-mono">{padre.codigo}</span> {padre.nombre}
            </p>
          ) : esNueva ? (
            <p className="text-sm text-muted-foreground">En la raíz del plan.</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              disabled={!esNueva}
              className="font-mono"
            />
            {!esNueva ? (
              <p className="text-xs text-muted-foreground">
                El código no se cambia: ordena el árbol y nombra la cuenta en los asientos.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={esNueva} />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["GRUPO", "DETALLE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  disabled={t === "DETALLE" && tieneHijas}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm disabled:opacity-40",
                    tipo === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <span className="block font-medium">{ETIQUETA_TIPO_CUENTA[t]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t === "GRUPO" ? "Agrupa otras cuentas" : "Recibe movimientos"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Naturaleza {naturaleza === "DEUDORA" ? "deudora" : "acreedora"}: crece por el{" "}
              {naturaleza === "DEUDORA" ? "debe" : "haber"}.
            </p>
          </div>

          {!esNueva ? (
            <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="text-sm">
                <span className="block font-medium">Activa</span>
                <span className="block text-xs text-muted-foreground">
                  {tieneHijas
                    ? "Desactivarla desactiva también las cuentas de debajo."
                    : "Una inactiva no se ofrece para nuevos movimientos."}
                </span>
              </span>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </label>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {!esNueva && original!.tipo === "GRUPO" && original!.activa ? (
              <Button variant="outline" onClick={() => onAgregarDebajo(original!)} disabled={guardando}>
                <Plus className="h-4 w-4" />
                Agregar cuenta dentro
              </Button>
            ) : null}
            {!esNueva && !tieneHijas ? (
              <Button variant="ghost" className="text-destructive" onClick={eliminar} disabled={guardando}>
                Eliminar
              </Button>
            ) : null}
          </div>
          <Button onClick={guardar} disabled={guardando || !cambio || !nombre.trim() || !codigo.trim()}>
            {esNueva ? "Crear" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
