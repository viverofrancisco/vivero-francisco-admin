"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
import { Upload, Download, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CsvRow = Record<string, string>;

interface RowResult {
  fila: number;
  estado: "creado" | "omitido" | "error";
  nombre?: string;
  clienteId?: string;
  mensaje?: string;
}

interface ImportOutcome {
  status: "completado" | "cancelado";
  created: number;
  skipped: number;
  failed: number;
  results: RowResult[];
}

const PREVIEW_COUNT = 5;
const BATCH_SIZE = 25;

const ESTADO_LABEL: Record<RowResult["estado"], string> = {
  creado: "Creado",
  omitido: "Omitido",
  error: "Error",
};

const ESTADO_CLASS: Record<RowResult["estado"], string> = {
  creado: "text-green-700",
  omitido: "text-muted-foreground",
  error: "text-destructive",
};

export function ImportClientesDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [dragging, setDragging] = useState(false);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setImporting(false);
    setCancelling(false);
    setProcessed(0);
    setResult(null);
    cancelRef.current = false;
  };

  const handleOpenChange = (next: boolean) => {
    // Mientras importa, intentar cerrar (botón/backdrop/Escape) solo solicita
    // cancelar; el diálogo permanece abierto para mostrar el resultado.
    if (!next && importing) {
      cancelRef.current = true;
      setCancelling(true);
      return;
    }
    setOpen(next);
    if (!next) {
      if (result && result.created > 0) router.refresh();
      reset();
    }
  };

  const parseFile = (file: File | undefined | null) => {
    setParseError(null);
    setResult(null);
    setRows([]);
    setFileName(null);
    if (!file) return;

    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setParseError("Selecciona un archivo .csv");
      return;
    }

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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    parseFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    parseFile(e.dataTransfer.files?.[0]);
  };

  const handleImport = async () => {
    cancelRef.current = false;
    setCancelling(false);
    setImporting(true);
    setProcessed(0);

    let importId: string | undefined;
    const acc: RowResult[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let cancelled = false;

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        if (cancelRef.current) {
          cancelled = true;
          break;
        }
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/clientes/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, importId, offset: i, total: rows.length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al importar");
        importId = data.importId;
        acc.push(...(data.results as RowResult[]));
        created += data.created;
        skipped += data.skipped;
        failed += data.failed;
        setProcessed(Math.min(i + BATCH_SIZE, rows.length));
      }

      const finalStatus: ImportOutcome["status"] = cancelled
        ? "cancelado"
        : "completado";
      if (importId) {
        await fetch("/api/clientes/import/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importId, status: finalStatus }),
        }).catch(() => {});
      }
      setResult({ status: finalStatus, created, skipped, failed, results: acc });
      if (created > 0) toast.success(`${created} cliente(s) importado(s)`);
      else if (cancelled) toast.message("Importación cancelada");
      else toast.message("No se creó ningún cliente nuevo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
      if (acc.length > 0) {
        setResult({ status: "cancelado", created, skipped, failed, results: acc });
      }
    } finally {
      setImporting(false);
      setCancelling(false);
    }
  };

  const pct = rows.length > 0 ? Math.round((processed / rows.length) * 100) : 0;

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

        {result ? (
          // ─── Resultado ───
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`rounded-md px-2.5 py-1 font-medium ${
                  result.status === "completado"
                    ? "bg-secondary text-green-700"
                    : "bg-warning/15 text-warning-foreground"
                }`}
              >
                {result.status === "completado" ? "Completado" : "Cancelado"}
              </span>
              <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-green-700">
                {result.created} creados
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                {result.skipped} omitidos
              </span>
              <span className="rounded-md bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                {result.failed} error
              </span>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.fila} className="border-t">
                      <td className="px-3 py-2 align-top">{r.fila}</td>
                      <td
                        className={`px-3 py-2 align-top font-medium ${ESTADO_CLASS[r.estado]}`}
                      >
                        {ESTADO_LABEL[r.estado]}
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {r.nombre ? <span className="text-foreground">{r.nombre}</span> : null}
                        {r.nombre && r.mensaje ? " — " : ""}
                        {r.mensaje}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/dashboard/clientes/importaciones"
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <History className="mr-1.5 h-4 w-4" />
                Ver historial
              </Link>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          // ─── Selección / progreso ───
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV. Obligatorio: <strong>nombre</strong> y al menos{" "}
              <strong>teléfono o correo</strong>. Los duplicados (por correo o
              teléfono) se omiten.
            </p>

            <div className="flex items-center justify-between">
              <a
                href="/plantilla-clientes.csv"
                download
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <Download className="mr-1.5 h-4 w-4" />
                Descargar plantilla
              </a>
              <Link
                href="/dashboard/clientes/importaciones"
                className="inline-flex items-center text-sm text-muted-foreground hover:underline"
              >
                <History className="mr-1.5 h-4 w-4" />
                Historial
              </Link>
            </div>

            {!importing && (
              <div className="space-y-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors outline-none",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Arrastra tu CSV aquí o haz click para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground">Solo archivos .csv</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
                {fileName && !parseError && (
                  <p className="flex items-center text-sm text-muted-foreground">
                    <FileText className="mr-1.5 h-4 w-4" />
                    {fileName} — {rows.length} fila(s) detectada(s)
                  </p>
                )}
                {parseError && <p className="text-sm text-red-600">{parseError}</p>}
              </div>
            )}

            {!importing && rows.length > 0 && (
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

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {cancelling ? "Cancelando…" : "Importando…"} {processed} de{" "}
                    {rows.length}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {importing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    cancelRef.current = true;
                    setCancelling(true);
                  }}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelando…" : "Cancelar"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={rows.length === 0}
                  >
                    Importar {rows.length || ""}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
