"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PersonalForm } from "@/components/personal/personal-form";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ArrowLeft, Pencil } from "lucide-react";

interface PersonalData {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  sueldo: number | null;
  estado: string;
  createdAt: string;
}

interface GrupoInfo {
  id: string;
  nombre: string;
}

interface Props {
  personal: PersonalData;
  grupos: GrupoInfo[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PersonalDetail({ personal, grupos }: Props) {
  const router = useRouter();
  const [cardsEditing, setCardsEditing] = useState(false);

  const nombreCompleto = `${personal.nombre} ${personal.apellido || ""}`.trim();

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/personal")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <InitialsAvatar name={nombreCompleto} size={44} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                {nombreCompleto}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  personal.estado === "ACTIVO"
                    ? "bg-secondary text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {personal.estado === "ACTIVO" ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Personal desde {formatDate(personal.createdAt)}
            </p>
          </div>
          {cardsEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCardsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="personal-cards-form"
              >
                Guardar cambios
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Form */}
          <div className="lg:col-span-2">
            <PersonalForm
              initialData={{
                id: personal.id,
                nombre: personal.nombre,
                apellido: personal.apellido,
                telefono: personal.telefono,
                especialidad: personal.especialidad,
                tipo: personal.tipo,
                sueldo: personal.sueldo,
                estado: personal.estado,
              }}
              cards
              cardsEditing={cardsEditing}
              onEditDone={() => setCardsEditing(false)}
            />
          </div>

          {/* Right column - Grupos */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Grupos</CardTitle>
              </CardHeader>
              <CardContent>
                {grupos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No pertenece a ningun grupo
                  </p>
                ) : (
                  <div className="space-y-2">
                    {grupos.map((g) => (
                      <Link
                        key={g.id}
                        href={`/dashboard/grupos/${g.id}`}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm hover:text-primary transition-colors"
                      >
                        <span className="font-bold">{g.nombre}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
