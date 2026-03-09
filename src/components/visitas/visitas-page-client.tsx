"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, CalendarPlus } from "lucide-react";
import { VisitasTable } from "@/components/visitas/visitas-table";
import { VisitaForm } from "@/components/visitas/visita-form";
import { GenerarVisitasForm } from "@/components/visitas/generar-visitas-form";
import { EmptyState } from "@/components/shared/empty-state";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTADOS = [
  { value: "ALL", label: "Todos" },
  { value: "PROGRAMADA", label: "Programada" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "INCOMPLETA", label: "Incompleta" },
  { value: "REAGENDADA", label: "Reagendada" },
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

interface ClienteServicioOption {
  id: string;
  cliente: { nombre: string };
  servicio: { nombre: string; tipo: string };
}

interface GrupoOption {
  id: string;
  nombre: string;
}

interface VisitasPageClientProps {
  initialVisitas: VisitaRow[];
  clienteServicios: ClienteServicioOption[];
  grupos: GrupoOption[];
  mesInicial: number;
  anioInicial: number;
  userRole?: string;
}

export function VisitasPageClient({
  initialVisitas,
  clienteServicios,
  grupos,
  mesInicial,
  anioInicial,
  userRole,
}: VisitasPageClientProps) {
  const [visitas, setVisitas] = useState(initialVisitas);
  const [mes, setMes] = useState(String(mesInicial));
  const [anio, setAnio] = useState(String(anioInicial));
  const [estado, setEstado] = useState("ALL");
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const [generarOpen, setGenerarOpen] = useState(false);

  const anioActual = new Date().getFullYear();
  const anios = [anioActual - 1, anioActual, anioActual + 1];

  const fetchVisitas = async (m: string, a: string, e: string) => {
    setLoadingFilter(true);
    try {
      const params = new URLSearchParams({ mes: m, anio: a });
      if (e !== "ALL") params.set("estado", e);
      const res = await fetch(`/api/visitas?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVisitas(data);
      }
    } finally {
      setLoadingFilter(false);
    }
  };

  const handleMesChange = (v: string) => {
    setMes(v);
    fetchVisitas(v, anio, estado);
  };

  const handleAnioChange = (v: string) => {
    setAnio(v);
    fetchVisitas(mes, v, estado);
  };

  const handleEstadoChange = (v: string) => {
    setEstado(v);
    fetchVisitas(mes, anio, v);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visitas</h1>
          <p className="text-gray-500">Gestiona las visitas programadas</p>
        </div>
        {userRole !== "JARDINERO" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setGenerarOpen(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Generar Mes
            </Button>
            <Button onClick={() => setCrearOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Visita
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Mes</Label>
          <Select value={mes} onValueChange={(v) => v && handleMesChange(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nombre, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Año</Label>
          <Select value={anio} onValueChange={(v) => v && handleAnioChange(v)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={estado} onValueChange={(v) => v && handleEstadoChange(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingFilter ? (
        <p className="text-center text-gray-500 py-8">Cargando...</p>
      ) : visitas.length === 0 ? (
        <EmptyState message="No hay visitas para este periodo" />
      ) : (
        <VisitasTable visitas={visitas} />
      )}

      <VisitaForm
        open={crearOpen}
        onClose={() => setCrearOpen(false)}
        clienteServicios={clienteServicios}
        grupos={grupos}
      />

      <GenerarVisitasForm
        open={generarOpen}
        onClose={() => setGenerarOpen(false)}
      />
    </>
  );
}
