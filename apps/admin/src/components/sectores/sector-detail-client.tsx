"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { nombreCliente } from "@vivero/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { aca, useFiltroUrl } from "@/lib/filtros-url";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface ClienteRow {
  id: string;
  nombre: string;
  apellido?: string | null;
  empresa?: string | null;
  ciudad: string | null;
}

interface SectorData {
  id: string;
  nombre: string;
  clientes: ClienteRow[];
  admins: { user: AdminUser }[];
}

/** Un cliente que se puede sumar, y de dónde saldría. */
interface Candidato extends ClienteRow {
  /** El sector donde está hoy, o null si no tiene ninguno. */
  sectorActual: string | null;
}

interface SectorDetailClientProps {
  /** La lista de la que se vino, con sus filtros. */
  backHref?: string;
  sector: SectorData;
  /** Todos los clientes que hoy no están en este sector. */
  candidatos: Candidato[];
  personalAdmins: AdminUser[];
}

const nombreAdmin = (a: AdminUser) => a.name ?? a.email;

export function SectorDetailClient({
  sector,
  candidatos,
  personalAdmins,
  backHref = "/dashboard/sectores",
}: SectorDetailClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(sector.nombre);
  const [saving, setSaving] = useState(false);

  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  /** Los tildados, para sacarlos del sector de a varios. */
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [agregando, setAgregando] = useState(false);
  const [agregandoAdmin, setAgregandoAdmin] = useState(false);
  /** Quién se está agregando o quitando, para mostrar el spinner en su fila. */
  const [adminEnCurso, setAdminEnCurso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return sector.clientes;
    return sector.clientes.filter(
      (c) =>
        nombreCliente(c).toLowerCase().includes(q) ||
        (c.ciudad ?? "").toLowerCase().includes(q)
    );
  }, [sector.clientes, busqueda]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / FILAS_POR_PAGINA)
  );
  const pagina = Math.min(page, totalPaginas);
  const enPagina = filtrados.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );
  const idsEnPagina = enPagina.map((c) => c.id);
  const paginaEntera =
    idsEnPagina.length > 0 && idsEnPagina.every((id) => seleccion.has(id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarPagina() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (paginaEntera) idsEnPagina.forEach((id) => next.delete(id));
      else idsEnPagina.forEach((id) => next.add(id));
      return next;
    });
  }

  async function guardarNombre() {
    if (!nombre.trim() || nombre === sector.nombre) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sectores/${sector.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Nombre actualizado");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  /** Suma clientes al sector. Sirve para uno o para veinte. */
  async function agregarClientes(ids: string[]) {
    if (ids.length === 0) return;
    setTrabajando(true);
    try {
      const res = await fetch(`/api/sectores/${sector.id}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteIds: ids }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(
        ids.length === 1 ? "Cliente agregado" : `${ids.length} clientes agregados`
      );
      setAgregando(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTrabajando(false);
    }
  }

  /** Los saca del sector. No los borra: quedan sin sector asignado. */
  async function quitarClientes(ids: string[]) {
    if (ids.length === 0) return;
    setTrabajando(true);
    try {
      const res = await fetch(`/api/sectores/${sector.id}/clientes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteIds: ids }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(
        ids.length === 1
          ? "Cliente quitado del sector"
          : `${ids.length} clientes quitados del sector`
      );
      setSeleccion(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setTrabajando(false);
    }
  }

  async function cambiarAdmin(userId: string, agregar: boolean) {
    setAdminEnCurso(userId);
    try {
      const res = await fetch(`/api/sectores/${sector.id}/admins`, {
        method: agregar ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(agregar ? "Admin asignado" : "Admin removido");
      setAgregandoAdmin(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAdminEnCurso(null);
    }
  }

  const asignados = sector.admins.map((a) => a.user.id);
  const adminsDisponibles = personalAdmins.filter(
    (a) => !asignados.includes(a.id)
  );

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-none items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{sector.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {sector.clientes.length} cliente
            {sector.clientes.length !== 1 && "s"} · {sector.admins.length} admin
            {sector.admins.length !== 1 && "s"}
          </p>
        </div>
      </div>

      {/* La barra de filtros ocupa su propia fila a lo ancho de la grilla —no
          la columna izquierda— para que la tabla y los cards empiecen a la
          misma altura. Antes los cards quedaban un renglón más arriba. */}
      <div className="grid min-h-0 flex-1 gap-x-6 gap-y-4 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente en este sector..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setAgregando(true)}
            disabled={candidatos.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar clientes
          </Button>
        </div>

        {/* Los clientes son lo que se viene a ver acá: se llevan la columna
            grande y toda la altura, con encabezado y paginación fijos y solo
            las filas scrolleando. */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
          {/* La barra de selección va adentro del card y no encima: si
              apareciera afuera empujaría la tabla hacia abajo y la dejaría
              desalineada con los cards cada vez que se tilda algo. */}
          {seleccion.size > 0 && (
            <div className="flex flex-none flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2">
              <span className="text-sm font-semibold">
                {seleccion.size} seleccionado{seleccion.size !== 1 ? "s" : ""}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeleccion(new Set())}
                >
                  Limpiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={trabajando}
                  onClick={() => quitarClientes([...seleccion])}
                >
                  Quitar del sector
                </Button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {filtrados.length === 0 ? (
              <EmptyState
                message={
                  busqueda.trim()
                    ? "Ningún cliente coincide"
                    : "Este sector todavía no tiene clientes"
                }
              />
            ) : (
              <Table containerClassName="h-full overflow-y-auto">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginaEntera}
                        onCheckedChange={alternarPagina}
                        aria-label="Seleccionar página"
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="w-16 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enPagina.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/clientes/${c.id}?from=${aca()}`)
                      }
                    >
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={seleccion.has(c.id)}
                          onCheckedChange={() => alternar(c.id)}
                          aria-label={`Seleccionar ${nombreCliente(c)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <InitialsAvatar name={nombreCliente(c)} size={36} />
                          <span className="truncate font-bold text-foreground">
                            {nombreCliente(c)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.ciudad || "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={trabajando}
                          aria-label={`Quitar a ${nombreCliente(c)} del sector`}
                          title="Quitar del sector"
                          onClick={() => quitarClientes([c.id])}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
          </div>

          <TablePagination
            page={pagina}
            total={filtrados.length}
            onPageChange={setPage}
            sustantivo="cliente"
          />
        </div>

        <div className="space-y-6 overflow-y-auto">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Detalles</CardTitle>
              {/* Editar vive acá y no en el encabezado de la página: lo que se
                  edita es lo que este card muestra. */}
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="flex-none text-muted-foreground">Nombre</span>
                <span className="min-w-0 text-right font-medium">
                  {sector.nombre}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="flex-none text-muted-foreground">Clientes</span>
                <span className="tabular-nums">{sector.clientes.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Admins del sector ({sector.admins.length})
              </CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgregandoAdmin(true)}
                  disabled={adminsDisponibles.length === 0}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Agregar
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {sector.admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nadie administra este sector todavía.
                </p>
              ) : (
                <ul className="divide-y">
                  {sector.admins.map(({ user }) => (
                    <li
                      key={user.id}
                      className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
                    >
                      <InitialsAvatar name={nombreAdmin(user)} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {nombreAdmin(user)}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={adminEnCurso === user.id}
                        aria-label={`Quitar a ${nombreAdmin(user)}`}
                        title="Quitar del sector"
                        onClick={() => cambiarAdmin(user.id, false)}
                      >
                        {adminEnCurso === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={(v) => !v && setEditing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar sector</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNombre(sector.nombre);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={guardarNombre}
              disabled={saving || !nombre.trim() || nombre === sector.nombre}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgregarClientesDialog
        abierto={agregando}
        onCerrar={() => setAgregando(false)}
        candidatos={candidatos}
        trabajando={trabajando}
        onAgregar={agregarClientes}
      />

      <AgregarAdminDialog
        abierto={agregandoAdmin}
        onCerrar={() => setAgregandoAdmin(false)}
        disponibles={adminsDisponibles}
        enCurso={adminEnCurso}
        onAgregar={(id) => cambiarAdmin(id, true)}
      />
    </div>
  );
}

/**
 * Elegir a quiénes sumar al sector.
 *
 * Aparecen todos los que hoy no están acá, incluidos los que pertenecen a otro
 * sector: cada uno muestra de dónde sale, así que sumarlo es un movimiento
 * visible y no una asignación a ciegas. Un cliente tiene un solo sector.
 */
function AgregarClientesDialog({
  abierto,
  onCerrar,
  candidatos,
  trabajando,
  onAgregar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  candidatos: Candidato[];
  trabajando: boolean;
  onAgregar: (ids: string[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter((c) =>
      nombreCliente(c).toLowerCase().includes(q)
    );
  }, [candidatos, busqueda]);

  function cerrar() {
    setBusqueda("");
    setElegidos(new Set());
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar clientes a este sector</DialogTitle>
          <DialogDescription>
            Un cliente pertenece a un solo sector: los que ya están en otro se
            mudan a este.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 min-h-[8rem] overflow-y-auto rounded-md border">
          {visibles.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {candidatos.length === 0
                ? "Todos los clientes ya están en este sector."
                : "Ningún cliente coincide."}
            </p>
          ) : (
            <ul className="divide-y">
              {visibles.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/50">
                    <Checkbox
                      checked={elegidos.has(c.id)}
                      onCheckedChange={() =>
                        setElegidos((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {nombreCliente(c)}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground">
                      {c.sectorActual ? `de ${c.sectorActual}` : "sin sector"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={trabajando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onAgregar([...elegidos])}
            disabled={trabajando || elegidos.size === 0}
          >
            {trabajando
              ? "Agregando…"
              : elegidos.size > 0
                ? `Agregar ${elegidos.size}`
                : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Elegir a quién le toca administrar este sector.
 *
 * Un clic por persona: la fila muestra su propio spinner mientras se guarda,
 * porque el que hace falta ver es *ese* y no un cartel general. Solo aparecen
 * los que tienen rol de admin de sector y todavía no están acá.
 */
function AgregarAdminDialog({
  abierto,
  onCerrar,
  disponibles,
  enCurso,
  onAgregar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  disponibles: AdminUser[];
  /** El id que se está guardando ahora, o null. */
  enCurso: string | null;
  onAgregar: (userId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter(
      (a) =>
        nombreAdmin(a).toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    );
  }, [disponibles, busqueda]);

  function cerrar() {
    setBusqueda("");
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar un admin al sector</DialogTitle>
          <DialogDescription>
            Solo se listan los usuarios con rol de admin de sector.
          </DialogDescription>
        </DialogHeader>

        {disponibles.length > 6 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        <div className="max-h-72 min-h-[6rem] overflow-y-auto rounded-md border">
          {visibles.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {disponibles.length === 0
                ? "Ya están todos asignados a este sector."
                : "Nadie coincide."}
            </p>
          ) : (
            <ul className="divide-y">
              {visibles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={enCurso !== null}
                    onClick={() => onAgregar(a.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                  >
                    <InitialsAvatar name={nombreAdmin(a)} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {nombreAdmin(a)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.email}
                      </div>
                    </div>
                    {enCurso === a.id ? (
                      <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="h-4 w-4 flex-none text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={enCurso !== null}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
