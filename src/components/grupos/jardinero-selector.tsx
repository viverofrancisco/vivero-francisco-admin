"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface JardineroOption {
  id: string;
  nombre: string;
}

interface JardineroSelectorProps {
  jardineros: JardineroOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function JardineroSelector({
  jardineros,
  selectedIds,
  onChange,
}: JardineroSelectorProps) {
  const toggleJardinero = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (jardineros.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No hay jardineros disponibles. Crea jardineros primero.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
      {jardineros.map((jardinero) => (
        <div key={jardinero.id} className="flex items-center gap-2">
          <Checkbox
            id={`jardinero-${jardinero.id}`}
            checked={selectedIds.includes(jardinero.id)}
            onCheckedChange={() => toggleJardinero(jardinero.id)}
          />
          <Label
            htmlFor={`jardinero-${jardinero.id}`}
            className="text-sm font-normal cursor-pointer"
          >
            {jardinero.nombre}
          </Label>
        </div>
      ))}
    </div>
  );
}
