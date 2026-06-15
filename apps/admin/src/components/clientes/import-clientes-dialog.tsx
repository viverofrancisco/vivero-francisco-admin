"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download, FileText } from "lucide-react";
import { toast } from "sonner";

type CsvRow = Record<string, string>;

interface RowResult {
  fila: number;
  estado: "creado" | "omitido" | "error";
  nombre?: string;
  mensaje?: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  results: RowResult[];
}

const ESTADO_LABEL: Record<RowResult["estado"], string> = {
  creado: "Creado",
  omitido: "Omitido",
  error: "Error",
};

const PREVIEW_COUNT = 5;

export function ImportClientesDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setImporting(false);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    // No permitir cerrar (botón, backdrop o Escape) mientras se importa.
    if (!next && importing) return;
    setOpen(next);
    if (!next) {
      // Si hubo creados, refresca la tabla detrás.
      if (result && result.created > 0) router.refresh();
      reset();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseError(null);
    setResult(null);
    setRows([]);
    setFileName(null);
    if (!file) return;

    setFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = (res.data ?? []).filter((r) =>
          Object.values(r).some((v) => (v ?? "").toString().trim() !== "")
        );
        if (data.length === 0) {
          setParseError("El archivo no tiene filas con datos.");
          return;
        }
        setRows(data);
      },
      error: () => setParseError("No se pudo leer el archivo CSV."),
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/clientes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar");
      setResult(data as ImportResult);
      const r = data as ImportResult;
      if (r.created > 0) {
        toast.success(`${r.created} cliente(s) importado(s)`);
      } else {
        toast.message("No se creó ningún cliente nuevo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const problemas = result?.results.filter((r) => r.estado !== "creado") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="mr-2 h-4 w-4" />
        Importar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar clientes desde CSV</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV. Obligatorio: <strong>nombre</strong> y al menos{" "}
              <strong>teléfono o correo</strong>. Los duplicados (por correo o
              teléfono) se omiten.
            </p>

            <a
              href="/plantilla-clientes.csv"
              download
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Descargar plantilla
            </a>

            <div className="space-y-2">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
              />
              {fileName && !parseError && (
                <p className="flex items-center text-sm text-muted-foreground">
                  <FileText className="mr-1.5 h-4 w-4" />
                  {fileName} — {rows.length} fila(s) detectada(s)
                </p>
              )}
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}
            </div>

            {rows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Vista previa ({Math.min(rows.length, PREVIEW_COUNT)} de {rows.length})
                </p>
                <div className="max-h-48 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr className="text-left">
                        <th className="px-2.5 py-1.5 font-medium">Nombre</th>
                        <th className="px-2.5 py-1.5 font-medium">Correo</th>
                        <th className="px-2.5 py-1.5 font-medium">Teléfono</th>
                        <th className="px-2.5 py-1.5 font-medium">Ciudad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_COUNT).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2.5 py-1.5">{r.nombre || "—"}</td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">
                            {r.email || "—"}
                          </td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">
                            {r.telefono || "—"}
                          </td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">
                            {r.ciudad || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={importing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || rows.length === 0}
              >
                {importing ? "Importando..." : `Importar ${rows.length || ""}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-green-700">
                {result.created} creados
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                {result.skipped} omitidos
              </span>
              <span className="rounded-md bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                {result.failed} con error
              </span>
            </div>

            {problemas.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Fila</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemas.map((r) => (
                      <tr key={r.fila} className="border-t">
                        <td className="px-3 py-2 align-top">{r.fila}</td>
                        <td className="px-3 py-2 align-top">
                          {ESTADO_LABEL[r.estado]}
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {r.nombre ? `${r.nombre}: ` : ""}
                          {r.mensaje}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
