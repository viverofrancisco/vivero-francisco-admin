"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowLeft, Search, X, ChevronDown } from "lucide-react";

interface Asignacion {
  id: string;
  precio: number;
  iva: number;
  frecuenciaMensual: number | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  cliente: { id: string; nombre: string; apellido?: string | null; ciudad: string | null };
  servicio: { id: string; nombre: string; tipo: string };
}

interface ServicioOption {
  id: string;
  nombre: string;
}

interface AsignacionesPageClientProps {
  asignaciones: Asignacion[];
  servicios: ServicioOption[];
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return "default" as const;
    case "PAUSADO":
      return "secondary" as const;
    case "CANCELADO":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return "Activo";
    case "PAUSADO":
      return "Pausado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return estado;
  }
};

export function AsignacionesPageClient({
  asignaciones,
  servicios,
}: AsignacionesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServicioId, setSelectedServicioId] = useState<string | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<string | null>(null);

  // Servicio dropdown search
  const [servicioDropdownOpen, setServicioDropdownOpen] = useState(false);
  const [servicioSearchQuery, setServicioSearchQuery] = useState("");
  const servicioDropdownRef = useRef<HTMLDivElement>(null);

  const selectedServicio = servicios.find((s) => s.id === selectedServicioId);

  const filteredServicioOptions = useMemo(() => {
    if (!servicioSearchQuery.trim()) return servicios;
    const q = servicioSearchQuery.toLowerCase();
    return servicios.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [servicioSearchQuery, servicios]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (servicioDropdownRef.current && !servicioDropdownRef.current.contains(e.target as Node)) {
        setServicioDropdownOpen(false);
        setServicioSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let result = asignaciones;

    if (selectedServicioId) {
      result = result.filter((a) => a.servicio.id === selectedServicioId);
    }

    if (estadoFilter) {
      result = result.filter((a) => a.estado === estadoFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => `${a.cliente.nombre} ${a.cliente.apellido || ""}`.toLowerCase().includes(q));
    }

    return result;
  }, [asignaciones, selectedServicioId, estadoFilter, searchQuery]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/servicios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Asignaciones de Servicios</h1>
            <p className="text-gray-500">
              {filtered.length} de {asignaciones.length} asignaciones
            </p>
          </div>
        </div>
        <Link href="/dashboard/servicios/asignar">
          <Button>Asignar Servicio</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Servicio searchable dropdown */}
        <div ref={servicioDropdownRef} className="relative">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setServicioDropdownOpen(!servicioDropdownOpen)}
              className="min-w-[160px] justify-between"
            >
              <span className="truncate">
                {selectedServicio ? selectedServicio.nombre : "Todos los servicios"}
              </span>
              <ChevronDown className="ml-2 h-3 w-3 shrink-0" />
            </Button>
            {selectedServicio && (
              <button
                type="button"
                onClick={() => setSelectedServicioId(null)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
          {servicioDropdownOpen && (
            <div className="absolute z-10 mt-1 w-64 rounded-md border bg-white shadow-lg">
              <div className="p-2">
                <Input
                  placeholder="Buscar servicio..."
                  value={servicioSearchQuery}
                  onChange={(e) => setServicioSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServicioId(null);
                    setServicioDropdownOpen(false);
                    setServicioSearchQuery("");
                  }}
                  className="flex w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-gray-500"
                >
                  Todos los servicios
                </button>
                {filteredServicioOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedServicioId(s.id);
                      setServicioDropdownOpen(false);
                      setServicioSearchQuery("");
                    }}
                    className={`flex w-full px-3 py-2 text-sm hover:bg-gray-50 text-left ${
                      selectedServicioId === s.id ? "bg-gray-100 font-medium" : ""
                    }`}
                  >
                    {s.nombre}
                  </button>
                ))}
                {filteredServicioOptions.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Estado filter */}
        <div className="flex gap-1">
          {[
            { value: null, label: "Todos" },
            { value: "ACTIVO", label: "Activos" },
            { value: "PAUSADO", label: "Pausados" },
            { value: "CANCELADO", label: "Cancelados" },
          ].map((opt) => (
            <Button
              key={opt.label}
              variant={estadoFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setEstadoFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron asignaciones" />
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clientes/${a.cliente.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {`${a.cliente.nombre} ${a.cliente.apellido || ""}`.trim()}
                    </Link>
                    {a.cliente.ciudad && (
                      <span className="ml-2 text-xs text-gray-400">
                        {a.cliente.ciudad}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.servicio.nombre}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        a.servicio.tipo === "RECURRENTE" ? "secondary" : "outline"
                      }
                    >
                      {a.servicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatPrice(a.precio)}
                    {a.iva > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        + {formatPrice(a.iva)} IVA
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.frecuenciaMensual
                      ? `${a.frecuenciaMensual}x/mes`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {a.fechaInicio}
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoBadgeVariant(a.estado)}>
                      {estadoLabel(a.estado)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
