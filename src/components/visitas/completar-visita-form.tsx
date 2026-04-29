"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  completarVisitaSchema,
  type CompletarVisitaFormData,
} from "@/lib/validations/visita";
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
import { ImagePlus, X, Loader2 } from "lucide-react";

interface CompletarVisitaFormProps {
  visitaId: string;
  open: boolean;
  onClose: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
  tipo: "imagen" | "video";
}

export function CompletarVisitaForm({
  visitaId,
  open,
  onClose,
}: CompletarVisitaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CompletarVisitaFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(completarVisitaSchema) as any,
    defaultValues: {
      estado: "COMPLETADA",
      fechaRealizada: new Date().toISOString().split("T")[0],
      horaEntrada: "",
      horaSalida: "",
      notas: "",
      notasIncompleto: "",
    },
  });

  const estado = watch("estado");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: PendingFile[] = Array.from(selected).map((file) => ({
      file,
      preview: file.type.startsWith("video/")
        ? ""
        : URL.createObjectURL(file),
      tipo: file.type.startsWith("video/") ? "video" : "imagen",
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async (): Promise<boolean> => {
    if (files.length === 0) return true;

    // 1. Get presigned URLs
    const presignRes = await fetch(`/api/visitas/${visitaId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: files.map((f) => ({
          fileName: f.file.name,
          contentType: f.file.type,
        })),
      }),
    });

    if (!presignRes.ok) return false;

    const { uploads } = await presignRes.json();

    // 2. Upload to S3
    const uploadPromises = uploads.map(
      (u: { uploadUrl: string; contentType: string }, i: number) =>
        fetch(u.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": u.contentType },
          body: files[i].file,
        })
    );

    const results = await Promise.all(uploadPromises);
    if (results.some((r: Response) => !r.ok)) return false;

    // 3. Confirm uploads in DB
    const confirmRes = await fetch(`/api/visitas/${visitaId}/media`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: uploads.map((u: { key: string; tipo: string }) => ({
          key: u.key,
          tipo: u.tipo,
        })),
      }),
    });

    return confirmRes.ok;
  };

  const onSubmit = async (data: CompletarVisitaFormData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/completar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error");
      }

      if (files.length > 0) {
        const uploaded = await uploadFiles();
        if (!uploaded) {
          toast.error("Visita completada pero hubo un error subiendo archivos");
        }
      }

      const labels: Record<string, string> = {
        COMPLETADA: "Visita completada",
        INCOMPLETA: "Visita marcada como incompleta",
        CANCELADA: "Visita cancelada",
      };
      toast.success(labels[data.estado]);
      reset();
      setFiles([]);
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Completar Visita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Resultado *</Label>
            <Controller
              name="estado"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "COMPLETADA", label: "Completada" },
                    { value: "INCOMPLETA", label: "Incompleta" },
                    { value: "CANCELADA", label: "Cancelada" },
                  ]}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha realizada *</Label>
            <Controller
              name="fechaRealizada"
              control={control}
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.fechaRealizada && (
              <p className="text-sm text-red-600">{errors.fechaRealizada.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horaEntrada">Hora entrada</Label>
              <Input
                id="horaEntrada"
                type="time"
                {...register("horaEntrada")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horaSalida">Hora salida</Label>
              <Input
                id="horaSalida"
                type="time"
                {...register("horaSalida")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas del trabajo</Label>
            <Textarea id="notas" rows={3} {...register("notas")} />
          </div>

          {estado === "INCOMPLETA" && (
            <div className="space-y-2">
              <Label htmlFor="notasIncompleto">Razón de incompleto *</Label>
              <Textarea
                id="notasIncompleto"
                rows={3}
                placeholder="Explica por qué no se completó..."
                {...register("notasIncompleto")}
              />
            </div>
          )}

          {estado === "CANCELADA" && (
            <div className="space-y-2">
              <Label htmlFor="notasIncompleto">Razón de cancelación</Label>
              <Textarea
                id="notasIncompleto"
                rows={3}
                placeholder="Explica por qué se canceló..."
                {...register("notasIncompleto")}
              />
            </div>
          )}

          {/* Media upload */}
          <div className="space-y-2">
            <Label>Imágenes / Videos</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border aspect-square bg-gray-50">
                    {f.tipo === "imagen" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.preview}
                        alt={f.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-2 text-center">
                        {f.file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Agregar archivos
            </Button>
            <p className="text-xs text-muted-foreground">Máximo 10 archivos</p>
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
