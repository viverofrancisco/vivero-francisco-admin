"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiDatePicker } from "@/components/ui/multi-date-picker";
import { PersonalSelector } from "@/components/grupos/personal-selector";
import { ArrowLeft, Search, X, Users } from "lucide-react";
import { toast } from "sonner";

interface ServicioAsignado {
  id: string;
  servicio: { id: string; nombre: string; tipo: string };
}

interface Cliente {
  id: string;
  nombre: string;
  servicios: ServicioAsignado[];
}

interface Grupo {
  id: string;
  nombre: string;
  miembrosIds: string[];
}

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

interface Props {
  clientes: Cliente[];
  grupos: Grupo[];
  personalList: PersonalOption[];
}

export function NuevaVisitaPage({ clientes, grupos, personalList }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Client selection
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteQuery, setClienteQuery] = useState("");
  const [showClienteResults, setShowClienteResults] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [selectedServicioId, setSelectedServicioId] = useState("");
  const [fechas, setFechas] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredClientes = useMemo(() => {
    if (!clienteQuery.trim()) return clientes.slice(0, 8);
    const q = clienteQuery.toLowerCase();
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 8);
  }, [clienteQuery, clientes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setShowClienteResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setClienteQuery("");
    setShowClienteResults(false);
    setSelectedServicioId("");
    setErrors({});
  };

  const handleClearCliente = () => {
    setSelectedCliente(null);
    setSelectedServicioId("");
    setFechas([]);
    setGrupoId("");
    setSelectedPersonalIds([]);
    setNotas("");
    setErrors({});
  };

  const handleGrupoChange = (newGrupoId: string) => {
    setGrupoId(newGrupoId);
    const grupo = grupos.find((g) => g.id === newGrupoId);
    if (grupo) {
      setSelectedPersonalIds(grupo.miembrosIds);
    }
  };

  const selectedServicio = selectedCliente?.servicios.find(
    (s) => s.id === selectedServicioId
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedCliente) newErrors.cliente = "Selecciona un cliente";
    if (!selectedServicioId) newErrors.servicio = "Selecciona un servicio";
    if (fechas.length === 0) newErrors.fechas = "Selecciona al menos una fecha";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteServicioId: selectedServicioId,
          fechas,
          grupoId: grupoId || undefined,
          personalIds: selectedPersonalIds,
          notas: notas || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        if (body.error) toast.error(body.error);
        return;
      }

      toast.success(
        fechas.length === 1
          ? "Visita programada"
          : `${fechas.length} visitas programadas`
      );
      router.push("/dashboard/visitas");
      router.refresh();
    } catch {
      toast.error("Error al crear las visitas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/visitas">
            <Button variant="ghost" size="icon" type="button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Nueva Visita</h1>
            {selectedCliente && selectedServicio ? (
              <p className="text-sm text-muted-foreground truncate">
                {selectedCliente.nombre} — {selectedServicio.servicio.nombre}
                {fechas.length > 0 && ` — ${fechas.length} fecha${fechas.length !== 1 ? "s" : ""}`}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Programa una o varias visitas para un cliente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-2xl space-y-6">
          {/* Client selection */}
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {selectedCliente ? (
                <div className="flex items-center justify-between rounded-md border px-4 py-3">
                  <span className="font-medium text-sm">{selectedCliente.nombre}</span>
                  <button type="button" onClick={handleClearCliente}>
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ) : (
                <div ref={clienteRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={clienteQuery}
                      onChange={(e) => {
                        setClienteQuery(e.target.value);
                        setShowClienteResults(true);
                      }}
                      onFocus={() => setShowClienteResults(true)}
                      className="pl-9"
                    />
                  </div>
                  {showClienteResults && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredClientes.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                      ) : (
                        filteredClientes.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCliente(c)}
                            className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                          >
                            <span className="font-medium">{c.nombre}</span>
                            <span className="text-xs text-gray-400">
                              {c.servicios.length} servicio{c.servicios.length !== 1 ? "s" : ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.cliente && (
                <p className="text-sm text-red-600 mt-2">{errors.cliente}</p>
              )}
            </CardContent>
          </Card>

          {/* Service selection */}
          {selectedCliente && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Servicio</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {selectedCliente.servicios.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">
                    Sin servicios activos
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedCliente.servicios.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedServicioId(s.id);
                          setErrors((prev) => ({ ...prev, servicio: "" }));
                        }}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
                          selectedServicioId === s.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="font-medium text-sm">{s.servicio.nombre}</span>
                        <Badge
                          variant={s.servicio.tipo === "RECURRENTE" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {s.servicio.tipo === "RECURRENTE" ? "Recurrente" : "Unico"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
                {errors.servicio && (
                  <p className="text-sm text-red-600 mt-2">{errors.servicio}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          {selectedServicioId && (
            <Card className="overflow-visible">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Fechas</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <MultiDatePicker
                  value={fechas}
                  onChange={(v) => {
                    setFechas(v);
                    setErrors((prev) => ({ ...prev, fechas: "" }));
                  }}
                />
                {errors.fechas && (
                  <p className="text-sm text-red-600 mt-2">{errors.fechas}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Group + Personal */}
          {selectedServicioId && (
            <Card>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Grupo y Personal</CardTitle>
                  {selectedPersonalIds.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {selectedPersonalIds.length} asignado{selectedPersonalIds.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Grupo</Label>
                  <CustomSelect
                    value={grupoId}
                    onChange={handleGrupoChange}
                    options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
                    placeholder="Sin asignar"
                  />
                  <p className="text-xs text-muted-foreground">
                    Al seleccionar un grupo se asigna su personal automaticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Personal</Label>
                  <PersonalSelector
                    personalList={personalList}
                    selectedIds={selectedPersonalIds}
                    onChange={setSelectedPersonalIds}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {selectedServicioId && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas opcionales sobre la visita..."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      {selectedServicioId && (
        <div className="sticky bottom-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-t">
          <div className="max-w-2xl flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {fechas.length > 0 && (
                <span>
                  {fechas.length} fecha{fechas.length !== 1 ? "s" : ""}
                  {selectedPersonalIds.length > 0 &&
                    ` · ${selectedPersonalIds.length} personal`}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard/visitas">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Programando..."
                  : fechas.length <= 1
                    ? "Programar Visita"
                    : `Programar ${fechas.length} Visitas`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
