"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VolverRedondo } from "@/components/shared/boton-redondo-movil";
import {
  FilaFichaMovil,
  SeccionFichaMovil,
} from "@/components/shared/seccion-ficha-movil";
import { AccionesAcceso, type EstadoCuenta } from "./acciones-acceso";
import { EditarGrupos } from "./editar-grupos";

const TIPO_LABEL: Record<string, string> = {
  JARDINERO: "Jardinero",
  CHOFER: "Chofer",
  SUPERVISOR: "Supervisor",
  MECANICO: "Mecánico",
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * La ficha de alguien del vivero en el teléfono: **la de la app**. La flecha
 * y el nombre arriba con el ⋯ —Editar, invitación o restablecer, revocar o
 * restaurar acceso, archivar—; primero con qué entra a la app y cómo está su
 * acceso, después los datos, y abajo sus grupos, que se editan desde acá. En
 * escritorio la ficha sigue siendo la de tarjetas con edición en el lugar.
 */
export function FichaPersonalMovil({
  personal,
  nombre,
  grupos,
  todosLosGrupos,
  cuenta,
  puedeAdministrarAcceso,
  backHref,
}: {
  personal: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    especialidad: string | null;
    tipo: string | null;
    estado: string;
    createdAt: string;
  };
  nombre: string;
  grupos: { id: string; nombre: string }[];
  todosLosGrupos: { id: string; nombre: string }[];
  cuenta: EstadoCuenta | null;
  puedeAdministrarAcceso: boolean;
  backHref: string;
}) {
  const router = useRouter();

  const acceso = !cuenta
    ? { texto: "Sin cuenta", clase: "bg-muted text-muted-foreground" }
    : cuenta.revocado
      ? { texto: "Revocado", clase: "bg-red-50 text-red-700" }
      : !cuenta.tieneContrasena
        ? { texto: "Falta que elija su contraseña", clase: "bg-amber-50 text-amber-800" }
        : { texto: "Activo", clase: "bg-secondary text-green-700" };

  async function archivar() {
    const res = await fetch(`/api/personal/${personal.id}`, { method: "DELETE" });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(datos.error ?? "No pudimos archivarla");
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="-mx-3 -mt-3 min-h-full bg-page pb-6">
      <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b bg-card px-3 pt-1.5 pb-2">
        <VolverRedondo href={backHref} />
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-0.4px]">{nombre}</h1>
        <AccionesAcceso
          personalId={personal.id}
          nombre={nombre}
          estado={cuenta}
          puedeAdministrar={puedeAdministrarAcceso}
          onEditar={() => router.push(`/dashboard/personal/${personal.id}/editar`)}
          onArchivar={archivar}
        />
      </div>

      <div className="px-3">
        {/* Primero con qué entra: es lo que se dicta por teléfono y lo que
            alguien abre la ficha a buscar. */}
        <SeccionFichaMovil titulo="Entra a la app con">
          <FilaFichaMovil etiqueta="Usuario" valor={cuenta?.usuario ?? "—"} />
          <FilaFichaMovil
            etiqueta="Acceso"
            valor={
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", acceso.clase)}>
                {acceso.texto}
              </span>
            }
          />
        </SeccionFichaMovil>

        <SeccionFichaMovil titulo="Información general">
          <FilaFichaMovil etiqueta="Nombre" valor={personal.nombre} />
          <FilaFichaMovil etiqueta="Apellido" valor={personal.apellido || "—"} />
          <FilaFichaMovil etiqueta="Teléfono" valor={personal.telefono || "—"} />
          <FilaFichaMovil
            etiqueta="Trabajo"
            valor={personal.tipo ? (TIPO_LABEL[personal.tipo] ?? personal.tipo) : "—"}
          />
          <FilaFichaMovil etiqueta="Especialidad" valor={personal.especialidad || "—"} />
          <FilaFichaMovil
            etiqueta="Estado"
            valor={personal.estado === "ACTIVO" ? "Activo" : "Inactivo"}
          />
          <FilaFichaMovil etiqueta="Personal desde" valor={fechaCorta(personal.createdAt)} />
        </SeccionFichaMovil>

        {/* Sus cuadrillas, editables desde acá como las categorías de un
            producto: cada una es una fila que abre el grupo. */}
        <section className="mt-5">
          <div className="mb-1.5 flex items-center justify-between pl-1">
            <p className="text-[11px] tracking-[0.8px] text-muted-foreground uppercase">Grupos</p>
            <EditarGrupos
              personalId={personal.id}
              actuales={grupos.map((g) => g.id)}
              todos={todosLosGrupos}
            />
          </div>
          <div className="rounded-xl bg-card px-3.5 py-1.5">
            {grupos.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No está en ningún grupo.</p>
            ) : (
              grupos.map((g, i) => (
                <Link
                  key={g.id}
                  href={`/dashboard/grupos/${g.id}`}
                  className={cn(
                    "flex items-center justify-between gap-3 py-2.5 text-sm",
                    i > 0 && "border-t border-border"
                  )}
                >
                  <span className="font-medium">{g.nombre}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
