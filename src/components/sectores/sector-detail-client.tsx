"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, UserPlus, X, Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface ClienteRow {
  id: string;
  nombre: string;
  ciudad: string | null;
}

interface SectorData {
  id: string;
  nombre: string;
  clientes: ClienteRow[];
  admins: { user: AdminUser }[];
}

interface SectorDetailClientProps {
  sector: SectorData;
  unassignedClientes: ClienteRow[];
  jardineroAdmins: AdminUser[];
}

export function SectorDetailClient({
  sector,
  unassignedClientes,
  jardineroAdmins,
}: SectorDetailClientProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(sector.nombre);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredClientes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return unassignedClientes
      .filter((c) => c.nombre.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchQuery, unassignedClientes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const assignedAdminIds = sector.admins.map((a) => a.user.id);
  const availableAdmins = jardineroAdmins.filter(
    (ja) => !assignedAdminIds.includes(ja.id)
  );

  const handleSaveName = async () => {
    if (!nombre.trim() || nombre === sector.nombre) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sectores/${sector.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Nombre actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignCliente = async (clienteId: string) => {
    try {
      const res = await fetch(`/api/sectores/${sector.id}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteIds: [clienteId] }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Cliente asignado al sector");
      setSearchQuery("");
      setShowResults(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleRemoveCliente = async (clienteId: string) => {
    try {
      const res = await fetch(`/api/sectores/${sector.id}/clientes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Cliente removido del sector");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleAssignAdmin = async (userId: string) => {
    try {
      const res = await fetch(`/api/sectores/${sector.id}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Admin asignado");
      setAssigningAdmin(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const res = await fetch(`/api/sectores/${sector.id}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Admin removido");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/sectores">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{sector.nombre}</h1>
          <p className="text-gray-500">
            {sector.clientes.length} cliente{sector.clientes.length !== 1 && "s"} asignado{sector.clientes.length !== 1 && "s"}
          </p>
        </div>
      </div>

      {/* Editar nombre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nombre del sector</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={saving || !nombre.trim() || nombre === sector.nombre}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jardineros Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jardineros Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {sector.admins.map((a) => (
              <Badge
                key={a.user.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {a.user.name ?? a.user.email}
                <button
                  onClick={() => handleRemoveAdmin(a.user.id)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {assigningAdmin ? (
              <Select
                onValueChange={(v) => v && handleAssignAdmin(v as string)}
              >
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Seleccionar admin" />
                </SelectTrigger>
                <SelectContent>
                  {availableAdmins.map((ja) => (
                    <SelectItem key={ja.id} value={ja.id}>
                      {ja.name ?? ja.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              availableAdmins.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigningAdmin(true)}
                >
                  <UserPlus className="mr-2 h-3 w-3" />
                  Asignar
                </Button>
              )
            )}
            {sector.admins.length === 0 && !assigningAdmin && (
              <p className="text-sm text-gray-500">Sin jardineros admin asignados</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clientes asignados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes en este sector</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar */}
          {unassignedClientes.length > 0 && (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar cliente para agregar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  className="pl-9"
                />
              </div>
              {showResults && searchQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-60 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No se encontraron clientes</p>
                  ) : (
                    filteredClientes.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleAssignCliente(c.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <span className="font-medium">{c.nombre}</span>
                        <span className="text-gray-400 text-xs">{c.ciudad ?? ""}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {sector.clientes.length === 0 ? (
            <p className="text-sm text-gray-500">No hay clientes asignados a este sector</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sector.clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/clientes/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>{c.ciudad ?? "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveCliente(c.id)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
