"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface InitialData {
  nombre: string | null;
  logoUrl: string | null;
  logoKey: string | null;
}

const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function EmpresaConfigForm({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(initial.nombre ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [logoKey, setLogoKey] = useState<string | null>(initial.logoKey);
  const [uploading, setUploading] = useState(false);
  /** Hay algo encima de la zona, para marcarla mientras se arrastra. */
  const [arrastrando, setArrastrando] = useState(false);
  const [saving, startSaving] = useTransition();

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato no permitido. Usa PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagen demasiado grande (máx 2MB)");
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch(
        "/api/admin/empresa-config/logo-upload-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          }),
        }
      );
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || "No pudimos generar la URL de subida");
      }
      const {
        uploadUrl,
        key,
        publicUrl,
      }: { uploadUrl: string; key: string; publicUrl: string } =
        await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("No pudimos subir la imagen");

      setLogoUrl(publicUrl);
      setLogoKey(key);
      toast.success("Logo cargado. Recuerda guardar para aplicarlo.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  function clearLogo() {
    setLogoUrl(null);
    setLogoKey(null);
  }

  function save() {
    startSaving(async () => {
      const res = await fetch("/api/admin/empresa-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim() || null,
          logoKey,
          logoUrl,
        }),
      });
      if (!res.ok) {
        toast.error("No pudimos guardar la configuración");
        return;
      }
      toast.success("Configuración guardada");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Nombre de la empresa
          </label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Vivero Francisco"
            maxLength={100}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se muestra como texto cuando no hay logo cargado.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Logo de la empresa
          </label>
          {/* Todo el recuadro es la zona: soltar el archivo encima alcanza,
              que es como llega un logo —arrastrado del escritorio— cuando uno
              ya lo tiene abierto al lado. El botón sigue estando para quien
              prefiere el explorador. */}
          <div
            className={`rounded-lg border p-4 transition-colors ${
              arrastrando
                ? "border-primary border-dashed bg-primary/5"
                : "bg-muted/20"
            }`}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setArrastrando(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label={logoUrl ? "Reemplazar el logo" : "Subir un logo"}
                className="flex h-28 w-44 flex-none items-center justify-center overflow-hidden rounded-md border bg-white transition-colors hover:border-primary"
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">Sin logo</span>
                  </div>
                )}
              </button>
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Arrastrá la imagen acá o elegila del computador. PNG, JPG o
                  WEBP, máximo 2MB. Recomendado: PNG transparente ~400×200 px.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {uploading
                      ? "Subiendo…"
                      : logoUrl
                        ? "Reemplazar"
                        : "Subir logo"}
                  </Button>
                  {logoUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearLogo}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
