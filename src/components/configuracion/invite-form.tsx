"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface SectorOption {
  id: string;
  nombre: string;
}

interface InviteFormProps {
  sectores: SectorOption[];
}

export function InviteForm({ sectores }: InviteFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [sectorSearch, setSectorSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setApellido("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setSelectedSectors([]);
      setSectorSearch("");
      setError("");
    }
  }, [open]);

  const MAX_VISIBLE_SECTORS = 8;

  const filteredSectores = useMemo(() => {
    const query = sectorSearch.toLowerCase().trim();
    const filtered = query
      ? sectores.filter((s) => s.nombre.toLowerCase().includes(query))
      : sectores;
    return filtered.slice(0, MAX_VISIBLE_SECTORS);
  }, [sectores, sectorSearch]);

  const hiddenCount = useMemo(() => {
    const query = sectorSearch.toLowerCase().trim();
    const total = query
      ? sectores.filter((s) => s.nombre.toLowerCase().includes(query)).length
      : sectores.length;
    return Math.max(0, total - MAX_VISIBLE_SECTORS);
  }, [sectores, sectorSearch]);

  const toggleSector = (sectorId: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sectorId)
        ? prev.filter((id) => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          apellido: apellido || undefined,
          email,
          password,
          role,
          sectorIds: role === "PERSONAL_ADMIN" ? selectedSectors : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear usuario");
      }

      toast.success("Usuario creado correctamente");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Invitar Usuario
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nombre</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-apellido">Apellido</Label>
              <Input
                id="invite-apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">Contraseña temporal</Label>
            <Input
              id="invite-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <CustomSelect
              value={role}
              onChange={setRole}
              options={[
                { value: "STAFF", label: "Staff" },
                { value: "PERSONAL_ADMIN", label: "Personal Admin" },
              ]}
            />
          </div>

          {role === "PERSONAL_ADMIN" && sectores.length > 0 && (
            <div className="space-y-2">
              <Label>Sectores asignados</Label>
              <div className="border rounded-md">
                <div className="relative p-2 border-b">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar sector..."
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    className="pl-8 h-8 border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="space-y-1 p-2 max-h-48 overflow-y-auto">
                  {filteredSectores.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No se encontraron sectores
                    </p>
                  ) : (
                    <>
                      {filteredSectores.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={selectedSectors.includes(s.id)}
                            onCheckedChange={() => toggleSector(s.id)}
                          />
                          <span className="text-sm">{s.nombre}</span>
                        </label>
                      ))}
                      {hiddenCount > 0 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{hiddenCount} más — escribe para filtrar
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              {selectedSectors.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedSectors.length} sector{selectedSectors.length !== 1 ? "es" : ""} seleccionado{selectedSectors.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Usuario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
