"use client";

import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

interface PersonalSelectorProps {
  personalList: PersonalOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Quiénes ya no se pueden destildar, con el motivo.
   *
   * En una visita son los que ya marcaron su entrada: la marca es un hecho
   * —estuvo ahí a esa hora— y sacarlos la esconde de todo lo que cuenta. El
   * servicio lo rechaza igual (`updateVisitaPersonal`); acá la casilla queda
   * fija para no ofrecer algo que va a fallar al guardar.
   */
  fijos?: Record<string, string>;
}

export function PersonalSelector({
  personalList,
  selectedIds,
  onChange,
  fijos,
}: PersonalSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return personalList;
    const q = search.toLowerCase();
    return personalList.filter((p) => {
      const name = `${p.nombre} ${p.apellido || ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [personalList, search]);

  const togglePersonal = (id: string) => {
    if (fijos?.[id]) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (personalList.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No hay personal disponible. Crea personal primero.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="relative p-2 border-b">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar personal..."
          className="w-full rounded-md bg-background pl-8 pr-3 py-1.5 text-sm outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            Sin resultados
          </p>
        ) : (
          filtered.map((personal) => {
            const fijo = fijos?.[personal.id];
            return (
              <div
                key={personal.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                  fijo ? "opacity-70" : "cursor-pointer hover:bg-gray-50"
                }`}
                onClick={() => togglePersonal(personal.id)}
              >
                <Checkbox
                  id={`personal-${personal.id}`}
                  checked={selectedIds.includes(personal.id)}
                  disabled={Boolean(fijo)}
                  onCheckedChange={() => togglePersonal(personal.id)}
                />
                <Label
                  htmlFor={`personal-${personal.id}`}
                  className={`flex-1 text-sm font-normal ${
                    fijo ? "" : "cursor-pointer"
                  }`}
                >
                  {`${personal.nombre} ${personal.apellido || ""}`.trim()}
                  {fijo && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {fijo}
                    </span>
                  )}
                </Label>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
