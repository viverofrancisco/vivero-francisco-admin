"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LogEntry {
  id: string;
  tipo: string;
  destinatarioTipo: string;
  destinatarioNombre: string | null;
  telefono: string;
  mensaje: string;
  estado: string;
  errorDetalle: string | null;
  whatsappMessageId: string | null;
  enviadoAt: string | null;
  createdAt: string;
  visita: {
    id: string;
    fechaProgramada: string;
    clienteServicio: {
      cliente: { nombre: string; apellido: string | null };
      servicio: { nombre: string };
    };
  } | null;
}

const TIPO_LABELS: Record<string, string> = {
  CONFIRMACION_VISITA_CLIENTE: "Confirmación",
  RECORDATORIO_VISITA_CLIENTE: "Recordatorio",
  RESUMEN_DIARIO_ADMIN: "Resumen diario",
  ALERTA_VISITA_COMPLETADA: "Completada",
  ALERTA_VISITA_INCOMPLETA: "Incompleta",
  MENSAJE_ENTRANTE_CLIENTE: "Mensaje entrante",
};

const ESTADO_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  ENVIADA: "default",
  PENDIENTE: "secondary",
  FALLIDA: "destructive",
};

export function NotificacionHistorial() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Filters
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);

      const res = await fetch(`/api/notificaciones/historial?${params}`);
      const data = await res.json();

      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filtroTipo, filtroEstado, filtroDesde, filtroHasta]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <CustomSelect
            value={filtroTipo}
            onChange={(val) => {
              setFiltroTipo(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos los tipos" },
              { value: "CONFIRMACION_VISITA_CLIENTE", label: "Confirmación" },
              { value: "RECORDATORIO_VISITA_CLIENTE", label: "Recordatorio" },
              { value: "RESUMEN_DIARIO_ADMIN", label: "Resumen diario" },
              { value: "ALERTA_VISITA_COMPLETADA", label: "Completada" },
              { value: "ALERTA_VISITA_INCOMPLETA", label: "Incompleta" },
              { value: "MENSAJE_ENTRANTE_CLIENTE", label: "Mensaje entrante" },
            ]}
          />
        </div>
        <div className="w-36">
          <CustomSelect
            value={filtroEstado}
            onChange={(val) => {
              setFiltroEstado(val);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              { value: "ENVIADA", label: "Enviada" },
              { value: "PENDIENTE", label: "Pendiente" },
              { value: "FALLIDA", label: "Fallida" },
            ]}
          />
        </div>
        <Input
          type="date"
          value={filtroDesde}
          onChange={(e) => {
            setFiltroDesde(e.target.value);
            setPage(1);
          }}
          className="w-36"
          placeholder="Desde"
        />
        <Input
          type="date"
          value={filtroHasta}
          onChange={(e) => {
            setFiltroHasta(e.target.value);
            setPage(1);
          }}
          className="w-36"
          placeholder="Hasta"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay notificaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="text-sm">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TIPO_LABELS[log.tipo] || log.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.destinatarioNombre || "-"}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {log.telefono}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANTS[log.estado] || "secondary"}>
                      {log.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} notificacion{total !== 1 ? "es" : ""} en total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de notificación</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">
                    {TIPO_LABELS[selectedLog.tipo] || selectedLog.tipo}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <p>
                    <Badge
                      variant={
                        ESTADO_VARIANTS[selectedLog.estado] || "secondary"
                      }
                    >
                      {selectedLog.estado}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Destinatario:</span>
                  <p className="font-medium">
                    {selectedLog.destinatarioNombre || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Teléfono:</span>
                  <p className="font-mono">{selectedLog.telefono}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Enviado:</span>
                  <p>{formatDate(selectedLog.createdAt)}</p>
                </div>
                {selectedLog.whatsappMessageId && (
                  <div>
                    <span className="text-muted-foreground">Message ID:</span>
                    <p className="font-mono text-xs truncate">
                      {selectedLog.whatsappMessageId}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Mensaje:</span>
                <p className="text-sm mt-1 whitespace-pre-line bg-muted/50 p-3 rounded-md">
                  {selectedLog.mensaje}
                </p>
              </div>

              {selectedLog.errorDetalle && (
                <div>
                  <span className="text-sm text-destructive">Error:</span>
                  <p className="text-sm mt-1 text-destructive bg-destructive/5 p-3 rounded-md">
                    {selectedLog.errorDetalle}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
