"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, CalendarClock } from "lucide-react";
import { CompletarVisitaForm } from "@/components/visitas/completar-visita-form";
import { ReagendarForm } from "@/components/visitas/reagendar-form";

interface VisitaDetailData {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  clienteServicio: {
    cliente: { id: string; nombre: string; ciudad: string | null; sector: { nombre: string } | null };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: {
    id: string;
    nombre: string;
    miembros: { jardinero: { id: string; nombre: string } }[];
  } | null;
  visitaOrigen: { id: string; fechaProgramada: string; estado: string } | null;
  visitasReagendadas: { id: string; fechaProgramada: string; estado: string }[];
}

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "secondary" as const;
    case "COMPLETADA": return "default" as const;
    case "INCOMPLETA": return "destructive" as const;
    case "REAGENDADA": return "outline" as const;
    default: return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "Programada";
    case "COMPLETADA": return "Completada";
    case "INCOMPLETA": return "Incompleta";
    case "REAGENDADA": return "Reagendada";
    default: return estado;
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface VisitaDetailProps {
  visita: VisitaDetailData;
  userRole?: string;
}

export function VisitaDetail({ visita, userRole }: VisitaDetailProps) {
  const [completarOpen, setCompletarOpen] = useState(false);
  const [reagendarOpen, setReagendarOpen] = useState(false);

  const isProgramada = visita.estado === "PROGRAMADA";
  const canModify = userRole !== "JARDINERO";

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/visitas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Detalle de Visita</h1>
            <p className="text-gray-500">
              {visita.clienteServicio.cliente.nombre} — {visita.clienteServicio.servicio.nombre}
            </p>
          </div>
        </div>
        {isProgramada && canModify && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReagendarOpen(true)}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Reagendar
            </Button>
            <Button onClick={() => setCompletarOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completar
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Estado</span>
              <Badge variant={estadoBadgeVariant(visita.estado)}>
                {estadoLabel(visita.estado)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha programada</span>
              <span className="capitalize">{formatDate(visita.fechaProgramada)}</span>
            </div>
            {visita.fechaRealizada && (
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha realizada</span>
                <span className="capitalize">{formatDate(visita.fechaRealizada)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Servicio</span>
              <span>{visita.clienteServicio.servicio.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo</span>
              <Badge variant="outline">
                {visita.clienteServicio.servicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Nombre</span>
              <Link
                href={`/dashboard/clientes/${visita.clienteServicio.cliente.id}`}
                className="text-green-700 hover:underline"
              >
                {visita.clienteServicio.cliente.nombre}
              </Link>
            </div>
            {visita.clienteServicio.cliente.ciudad && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ciudad</span>
                <span>{visita.clienteServicio.cliente.ciudad}</span>
              </div>
            )}
            {visita.clienteServicio.cliente.sector && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sector</span>
                <span>{visita.clienteServicio.cliente.sector.nombre}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grupo asignado</CardTitle>
          </CardHeader>
          <CardContent>
            {visita.grupo ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Grupo</span>
                  <span className="font-medium">{visita.grupo.nombre}</span>
                </div>
                {visita.grupo.miembros.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Miembros:</span>
                    <ul className="mt-1 space-y-1">
                      {visita.grupo.miembros.map((m) => (
                        <li key={m.jardinero.id} className="text-sm">
                          {m.jardinero.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Sin grupo asignado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visita.notas ? (
              <p className="text-sm whitespace-pre-wrap">{visita.notas}</p>
            ) : (
              <p className="text-gray-400 text-sm">Sin notas</p>
            )}
            {visita.notasIncompleto && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-red-600 mb-1">Razón de incompleto:</p>
                <p className="text-sm whitespace-pre-wrap">{visita.notasIncompleto}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(visita.visitaOrigen || visita.visitasReagendadas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de reagendamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visita.visitaOrigen && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Origen:</span>
                <Link
                  href={`/dashboard/visitas/${visita.visitaOrigen.id}`}
                  className="text-green-700 hover:underline capitalize"
                >
                  {formatDate(visita.visitaOrigen.fechaProgramada)}
                </Link>
                <Badge variant={estadoBadgeVariant(visita.visitaOrigen.estado)} className="text-xs">
                  {estadoLabel(visita.visitaOrigen.estado)}
                </Badge>
              </div>
            )}
            {visita.visitasReagendadas.map((vr) => (
              <div key={vr.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Reagendada a:</span>
                <Link
                  href={`/dashboard/visitas/${vr.id}`}
                  className="text-green-700 hover:underline capitalize"
                >
                  {formatDate(vr.fechaProgramada)}
                </Link>
                <Badge variant={estadoBadgeVariant(vr.estado)} className="text-xs">
                  {estadoLabel(vr.estado)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CompletarVisitaForm
        visitaId={visita.id}
        open={completarOpen}
        onClose={() => setCompletarOpen(false)}
      />

      <ReagendarForm
        visitaId={visita.id}
        open={reagendarOpen}
        onClose={() => setReagendarOpen(false)}
      />
    </>
  );
}
