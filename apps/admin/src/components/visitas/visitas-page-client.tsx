"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { Plus } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { VisitasTable } from "@/components/visitas/visitas-table";
import { EmptyState } from "@/components/shared/empty-state";

const ESTADOS = [
  { value: "ALL", label: "Todos" },
  { value: "PROGRAMADA", label: "Programada" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "INCOMPLETA", label: "Incompleta" },
  { value: "CANCELADA", label: "Cancelada" },
];

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  clienteServicio: {
    cliente: { id: string; nombre: string };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: { id: string; nombre: string } | null;
}

interface FilterOption {
  id: string;
  nombre: string;
}

interface VisitasPageClientProps {
  initialVisitas: VisitaRow[];
  initialDesde: string;
  initialHasta: string;
  userRole?: string;
  clientes: FilterOption[];
  servicios: FilterOption[];
}

export function VisitasPageClient({
  initialVisitas,
  initialDesde,
  initialHasta,
  userRole,
  clientes,
  servicios,
}: VisitasPageClientProps) {
  const [visitas, setVisitas] = useState(initialVisitas);
  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);
  const [estado, setEstado] = useState("ALL");
  const [clienteId, setClienteId] = useState("ALL");
  const [servicioId, setServicioId] = useState("ALL");
  const [loadingFilter, setLoadingFilter] = useState(false);

  const fetchVisitas = async (
    d: string,
    h: string,
    e: string,
    cId: string,
    sId: string
  ) => {
    setLoadingFilter(true);
    try {
      const params = new URLSearchParams();
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);
      if (e !== "ALL") params.set("estado", e);
      if (cId !== "ALL") params.set("clienteId", cId);
      if (sId !== "ALL") params.set("servicioId", sId);
      const res = await fetch(`/api/visitas?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVisitas(data);
      }
    } finally {
      setLoadingFilter(false);
    }
  };

  const handleDesdeChange = (v: string) => {
    if (v && hasta && v > hasta) {
      setHasta("");
      setDesde(v);
      fetchVisitas(v, "", estado, clienteId, servicioId);
    } else {
      setDesde(v);
      fetchVisitas(v, hasta, estado, clienteId, servicioId);
    }
  };

  const handleHastaChange = (v: string) => {
    if (v && desde && v < desde) {
      setDesde("");
      setHasta(v);
      fetchVisitas("", v, estado, clienteId, servicioId);
    } else {
      setHasta(v);
      fetchVisitas(desde, v, estado, clienteId, servicioId);
    }
  };

  const handleEstadoChange = (v: string) => {
    setEstado(v);
    fetchVisitas(desde, hasta, v, clienteId, servicioId);
  };

  const handleClienteChange = (v: string) => {
    setClienteId(v);
    fetchVisitas(desde, hasta, estado, v, servicioId);
  };

  const handleServicioChange = (v: string) => {
    setServicioId(v);
    fetchVisitas(desde, hasta, estado, clienteId, v);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visitas</h1>
          <p className="text-gray-500">Gestiona las visitas programadas</p>
        </div>
        {userRole !== "PERSONAL" && (
          <Link href="/dashboard/visitas/nueva">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Visita
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <DatePicker
            value={desde}
            onChange={handleDesdeChange}
            maxDate={hasta || undefined}
            placeholder="Fecha inicio"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <DatePicker
            value={hasta}
            onChange={handleHastaChange}
            minDate={desde || undefined}
            placeholder="Fecha fin"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <CustomSelect
            value={estado}
            onChange={handleEstadoChange}
            options={ESTADOS}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cliente</Label>
          <CustomSelect
            value={clienteId}
            onChange={handleClienteChange}
            options={[
              { value: "ALL", label: "Todos" },
              ...clientes.map((c) => ({ value: c.id, label: c.nombre })),
            ]}
            placeholder="Todos"
            searchable
            searchPlaceholder="Buscar..."
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Servicio</Label>
          <CustomSelect
            value={servicioId}
            onChange={handleServicioChange}
            options={[
              { value: "ALL", label: "Todos" },
              ...servicios.map((s) => ({ value: s.id, label: s.nombre })),
            ]}
            placeholder="Todos"
            className="w-48"
          />
        </div>
      </div>

      {loadingFilter ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : visitas.length === 0 ? (
        <EmptyState message="No hay visitas para este periodo" />
      ) : (
        <VisitasTable visitas={visitas} />
      )}
    </>
  );
}
