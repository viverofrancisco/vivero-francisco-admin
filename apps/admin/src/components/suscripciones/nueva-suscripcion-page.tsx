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
import {
  NuevaSuscripcionForm,
  type ItemDraft,
} from "./nueva-suscripcion-form";
import { PERIODICIDAD_SUFIJO } from "./formato";
import { ResumenSuscripcion } from "./resumen-suscripcion";

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
  /**
   * Los productos del plan viven acá y no en el formulario porque el resumen
   * de la derecha necesita los mismos números: una sola fuente, dos columnas.
   */
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [periodicidad, setPeriodicidad] = useState("MENSUAL");

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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-visible">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <CustomSelect
                value={clienteId}
                onChange={(id) => {
                  // Los productos disponibles son por cliente, así que lo
                  // cargado hasta acá deja de tener sentido al cambiarlo.
                  setClienteId(id);
                  setItems([]);
                }}
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
                items={items}
                onItemsChange={setItems}
                periodicidad={periodicidad}
                onPeriodicidadChange={setPeriodicidad}
                onCreada={() => router.push(backHref)}
              />
            )}
          </CardContent>
        </Card>

        {/* Cuánto termina pagando el cliente por cada cosa: el formulario pide
            el precio sin IVA, así que de los campos solos no se puede leer. */}
        <div className="lg:sticky lg:top-6">
          <ResumenSuscripcion
            items={items}
            sufijo={PERIODICIDAD_SUFIJO[periodicidad] ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
