"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { ArrowLeft } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { NuevaSuscripcionForm } from "./nueva-suscripcion-form";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
}

export function NuevaSuscripcionPage({
  clientes,
  clienteInicial,
  backHref,
}: {
  clientes: Cliente[];
  /** Preseleccionado al venir desde la ficha del cliente. */
  clienteInicial?: string;
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref: string;
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nueva suscripción</h1>
          <p className="text-sm text-muted-foreground">
            Una suscripción agrupa uno o más productos recurrentes, que se
            cobran juntos en cada período.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl overflow-visible">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <CustomSelect
              value={clienteId}
              onChange={setClienteId}
              options={clientes.map((c) => ({
                value: c.id,
                label: nombreCliente(c),
              }))}
              placeholder="Seleccionar cliente"
              searchable
              searchPlaceholder="Buscar cliente..."
            />
          </div>

          {clienteId && (
            <NuevaSuscripcionForm
              key={clienteId}
              clienteId={clienteId}
              onCreada={() => router.push(backHref)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
