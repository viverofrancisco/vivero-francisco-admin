"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { toast } from "sonner";

interface Servicio {
  id: string;
  nombre: string;
  tipo: string;
}

interface Cliente {
  id: string;
  nombre: string;
  ciudad: string | null;
}

interface PendingAssignment {
  cliente: Cliente;
  precio: number;
  iva: number;
  frecuenciaMensual: number | undefined;
  fechaInicio: string;
}

interface AsignarServicioPageProps {
  servicios: Servicio[];
  clientes: Cliente[];
}

export function AsignarServicioPage({
  servicios,
  clientes,
}: AsignarServicioPageProps) {
  const router = useRouter();

  // Servicio search
  const [servicioQuery, setServicioQuery] = useState("");
  const [showServicioResults, setShowServicioResults] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const servicioRef = useRef<HTMLDivElement>(null);

  // Cliente search
  const [clienteQuery, setClienteQuery] = useState("");
  const [showClienteResults, setShowClienteResults] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

  // Pending rows (clients to assign)
  const [pendingRows, setPendingRows] = useState<PendingAssignment[]>([]);
  const [assignedClienteIds, setAssignedClienteIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const isRecurrente = selectedServicio?.tipo === "RECURRENTE";

  const filteredServicios = useMemo(() => {
    if (!servicioQuery.trim()) return servicios.slice(0, 10);
    const q = servicioQuery.toLowerCase();
    return servicios.filter((s) => s.nombre.toLowerCase().includes(q)).slice(0, 10);
  }, [servicioQuery, servicios]);

  const filteredClientes = useMemo(() => {
    if (!clienteQuery.trim()) return [];
    const q = clienteQuery.toLowerCase();
    const pendingIds = new Set(pendingRows.map((r) => r.cliente.id));
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) &&
          !pendingIds.has(c.id) &&
          !assignedClienteIds.has(c.id)
      )
      .slice(0, 10);
  }, [clienteQuery, clientes, pendingRows, assignedClienteIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (servicioRef.current && !servicioRef.current.contains(e.target as Node)) {
        setShowServicioResults(false);
      }
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setShowClienteResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectServicio = (servicio: Servicio) => {
    setSelectedServicio(servicio);
    setServicioQuery("");
    setShowServicioResults(false);
    setPendingRows([]);
    setAssignedClienteIds(new Set());
  };

  const handleClearServicio = () => {
    setSelectedServicio(null);
    setPendingRows([]);
    setAssignedClienteIds(new Set());
  };

  const handleAddCliente = (cliente: Cliente) => {
    setPendingRows((prev) => [
      ...prev,
      {
        cliente,
        precio: 0,
        iva: 0,
        frecuenciaMensual: undefined,
        fechaInicio: today,
      },
    ]);
    setClienteQuery("");
    setShowClienteResults(false);
  };

  const handleRemoveRow = (clienteId: string) => {
    setPendingRows((prev) => prev.filter((r) => r.cliente.id !== clienteId));
  };

  const updateRow = (clienteId: string, field: keyof PendingAssignment, value: unknown) => {
    setPendingRows((prev) =>
      prev.map((r) =>
        r.cliente.id === clienteId ? { ...r, [field]: value } : r
      )
    );
  };

  const handleAssign = async (row: PendingAssignment) => {
    if (!selectedServicio) return;
    if (row.precio <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }
    if (isRecurrente && (!row.frecuenciaMensual || row.frecuenciaMensual < 1)) {
      toast.error("Indica la frecuencia mensual");
      return;
    }

    setSavingId(row.cliente.id);
    try {
      const res = await fetch(`/api/clientes/${row.cliente.id}/servicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicioId: selectedServicio.id,
          precio: row.precio,
          iva: row.iva,
          frecuenciaMensual: isRecurrente ? row.frecuenciaMensual : undefined,
          fechaInicio: row.fechaInicio,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error al asignar");
      }

      toast.success(`Servicio asignado a ${row.cliente.nombre}`);
      setPendingRows((prev) => prev.filter((r) => r.cliente.id !== row.cliente.id));
      setAssignedClienteIds((prev) => new Set([...prev, row.cliente.id]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/servicios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Asignar Servicio</h1>
          <p className="text-gray-500">Asigna un servicio a múltiples clientes</p>
        </div>
      </div>

      {/* Step 1: Select servicio */}
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="text-base">1. Seleccionar servicio</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedServicio ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border px-4 py-2 flex-1">
                <span className="font-medium">{selectedServicio.nombre}</span>
                <Badge variant={selectedServicio.tipo === "RECURRENTE" ? "secondary" : "outline"}>
                  {selectedServicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearServicio}>
                Cambiar
              </Button>
            </div>
          ) : (
            <div ref={servicioRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar servicio..."
                  value={servicioQuery}
                  onChange={(e) => {
                    setServicioQuery(e.target.value);
                    setShowServicioResults(true);
                  }}
                  onFocus={() => setShowServicioResults(true)}
                  className="pl-9"
                />
              </div>
              {showServicioResults && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredServicios.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No se encontraron servicios</p>
                  ) : (
                    filteredServicios.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectServicio(s)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <span className="font-medium">{s.nombre}</span>
                        <span className="text-gray-400 text-xs">
                          {s.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Add clients */}
      {selectedServicio && (
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle className="text-base">2. Agregar clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client search */}
            <div ref={clienteRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar cliente por nombre..."
                  value={clienteQuery}
                  onChange={(e) => {
                    setClienteQuery(e.target.value);
                    setShowClienteResults(true);
                  }}
                  onFocus={() => setShowClienteResults(true)}
                  className="pl-9"
                />
              </div>
              {showClienteResults && clienteQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No se encontraron clientes</p>
                  ) : (
                    filteredClientes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddCliente(c)}
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

            {/* Pending assignment rows */}
            {pendingRows.length > 0 && (
              <div className="space-y-3">
                {pendingRows.map((row) => (
                  <div
                    key={row.cliente.id}
                    className="rounded-md border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{row.cliente.nombre}</span>
                        {row.cliente.ciudad && (
                          <span className="ml-2 text-sm text-gray-400">{row.cliente.ciudad}</span>
                        )}
                      </div>
                      <button onClick={() => handleRemoveRow(row.cliente.id)}>
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Precio (USD) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={row.precio || ""}
                          onChange={(e) =>
                            updateRow(row.cliente.id, "precio", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IVA (USD)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={row.iva || ""}
                          onChange={(e) =>
                            updateRow(row.cliente.id, "iva", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      {isRecurrente && (
                        <div className="space-y-1">
                          <Label className="text-xs">Visitas / mes *</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={row.frecuenciaMensual || ""}
                            onChange={(e) =>
                              updateRow(
                                row.cliente.id,
                                "frecuenciaMensual",
                                parseInt(e.target.value) || undefined
                              )
                            }
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Fecha inicio *</Label>
                        <Input
                          type="date"
                          value={row.fechaInicio}
                          onChange={(e) =>
                            updateRow(row.cliente.id, "fechaInicio", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleAssign(row)}
                        disabled={savingId === row.cliente.id}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {savingId === row.cliente.id ? "Asignando..." : "Asignar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingRows.length === 0 && (
              <p className="text-sm text-gray-500">
                Busca y selecciona clientes para asignarles el servicio
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </>
  );
}
