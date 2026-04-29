"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { grupoSchema, type GrupoFormData } from "@/lib/validations/grupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PersonalSelector } from "./personal-selector";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

interface GrupoData {
  id: string;
  nombre: string;
  descripcion: string | null;
  createdAt: string;
}

interface Props {
  grupo: GrupoData;
  miembrosIds: string[];
  personalList: PersonalOption[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export function GrupoDetail({ grupo, miembrosIds, personalList }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GrupoFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(grupoSchema) as any,
    defaultValues: {
      nombre: grupo.nombre,
      descripcion: grupo.descripcion ?? "",
      miembrosIds,
    },
  });

  const selectedIds = watch("miembrosIds");

  const onSubmit = async (data: GrupoFormData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/grupos/${grupo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Grupo actualizado");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Error al guardar el grupo");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset({
      nombre: grupo.nombre,
      descripcion: grupo.descripcion ?? "",
      miembrosIds,
    });
    setEditing(false);
  };

  // Resolve member names for read-only display
  const memberNames = personalList
    .filter((p) => selectedIds.includes(p.id))
    .map((p) => `${p.nombre} ${p.apellido || ""}`.trim());

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/grupos")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{grupo.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              Creado el {formatDate(grupo.createdAt)}
            </p>
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="grupo-cards-form"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pt-6 pb-6">
        <form
          id="grupo-cards-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Left column - Grupo info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Informacion del Grupo</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {editing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre *</Label>
                      <Input id="nombre" {...register("nombre")} />
                      {errors.nombre && (
                        <p className="text-sm text-red-600">
                          {errors.nombre.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripcion</Label>
                      <Textarea
                        id="descripcion"
                        rows={4}
                        {...register("descripcion")}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <InfoRow label="Nombre" value={grupo.nombre} />
                    <InfoRow label="Descripcion" value={grupo.descripcion} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Miembros */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Miembros</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {editing ? (
                  <div className="space-y-2">
                    <PersonalSelector
                      personalList={personalList}
                      selectedIds={selectedIds}
                      onChange={(ids) => setValue("miembrosIds", ids)}
                    />
                    <p className="text-xs text-gray-500">
                      {selectedIds.length} personal seleccionado(s)
                    </p>
                  </div>
                ) : memberNames.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No hay miembros en este grupo
                  </p>
                ) : (
                  <div className="space-y-1">
                    {memberNames.map((name, i) => (
                      <div
                        key={i}
                        className="py-2 border-b border-gray-100 last:border-0 text-sm font-medium"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
