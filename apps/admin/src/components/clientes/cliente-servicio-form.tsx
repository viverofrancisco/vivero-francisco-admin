"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clienteServicioSchema,
  type ClienteServicioFormData,
} from "@/lib/validations/cliente-servicio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, X } from "lucide-react";

interface ServicioCatalogo {
  id: string;
  nombre: string;
  tipo: string;
}

interface AsignacionEditar {
  id: string;
  servicioId: string;
  precio: number;
  iva: number;
  frecuenciaMensual: number | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  notas: string | null;
  servicio: ServicioCatalogo;
}

interface ClienteServicioFormProps {
  clienteId: string;
  servicios: ServicioCatalogo[];
  editData?: AsignacionEditar | null;
  onClose: () => void;
  open: boolean;
}

function formatDateForInput(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export function ClienteServicioForm({
  clienteId,
  servicios,
  editData,
  onClose,
  open,
}: ClienteServicioFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!editData;

  // Search state for servicio
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<ServicioCatalogo | null>(
    editData?.servicio ?? null
  );
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredServicios = useMemo(() => {
    if (!searchQuery.trim()) return servicios.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return servicios.filter((s) => s.nombre.toLowerCase().includes(q)).slice(0, 10);
  }, [searchQuery, servicios]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedServicio(editData?.servicio ?? null);
      setSearchQuery("");
      setShowResults(false);
    }
  }, [open, editData]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClienteServicioFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clienteServicioSchema) as any,
    defaultValues: {
      servicioId: editData?.servicioId ?? "",
      precio: editData?.precio ?? 0,
      iva: editData?.iva ?? 0,
      frecuenciaMensual: editData?.frecuenciaMensual ?? undefined,
      estado: (editData?.estado as "ACTIVO" | "PAUSADO" | "CANCELADO") ?? "ACTIVO",
      fechaInicio: editData?.fechaInicio
        ? formatDateForInput(editData.fechaInicio)
        : new Date().toISOString().split("T")[0],
      fechaFin: editData?.fechaFin
        ? formatDateForInput(editData.fechaFin)
        : "",
      notas: editData?.notas ?? "",
    },
  });

  const isRecurrente = selectedServicio?.tipo === "RECURRENTE";

  const handleSelectServicio = (servicio: ServicioCatalogo) => {
    setSelectedServicio(servicio);
    setValue("servicioId", servicio.id);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleClearServicio = () => {
    setSelectedServicio(null);
    setValue("servicioId", "");
  };

  const onSubmit = async (data: ClienteServicioFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/clientes/${clienteId}/servicios/${editData.id}`
        : `/api/clientes/${clienteId}/servicios`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error al guardar");
      }

      toast.success(
        isEditing ? "Servicio actualizado" : "Servicio asignado"
      );
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Asignación" : "Asignar Servicio"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Servicio search */}
          <div className="space-y-2">
            <Label>Servicio *</Label>
            {selectedServicio ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="flex-1 text-sm">
                  {selectedServicio.nombre}{" "}
                  <span className="text-gray-400">
                    ({selectedServicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"})
                  </span>
                </span>
                {!isEditing && (
                  <button type="button" onClick={handleClearServicio}>
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar servicio..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    className="pl-9"
                  />
                </div>
                {showResults && (
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
            <input type="hidden" {...register("servicioId")} />
            {errors.servicioId && (
              <p className="text-sm text-red-600">{errors.servicioId.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="precio">
                Precio (USD) * {isRecurrente && <span className="text-muted-foreground font-normal">/ mes</span>}
              </Label>
              <Input
                id="precio"
                type="number"
                step="0.01"
                min="0"
                {...register("precio", { valueAsNumber: true })}
              />
              {errors.precio && (
                <p className="text-sm text-red-600">{errors.precio.message}</p>
              )}
            </div>

            {isRecurrente && (
              <div className="space-y-2">
                <Label htmlFor="frecuenciaMensual">Visitas / mes *</Label>
                <Input
                  id="frecuenciaMensual"
                  type="number"
                  min="1"
                  {...register("frecuenciaMensual", { valueAsNumber: true })}
                />
                {errors.frecuenciaMensual && (
                  <p className="text-sm text-red-600">
                    {errors.frecuenciaMensual.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="iva">IVA (USD)</Label>
            <Input
              id="iva"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 22.50"
              {...register("iva", { valueAsNumber: true })}
            />
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Controller
                name="estado"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "ACTIVO", label: "Activo" },
                      { value: "PAUSADO", label: "Pausado" },
                      { value: "CANCELADO", label: "Cancelado" },
                    ]}
                  />
                )}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha inicio *</Label>
              <Controller
                name="fechaInicio"
                control={control}
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.fechaInicio && (
                <p className="text-sm text-red-600">{errors.fechaInicio.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Fecha fin</Label>
              <Controller
                name="fechaFin"
                control={control}
                render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" rows={3} {...register("notas")} />
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

