"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Pencil, Search, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserForm } from "./user-form";

interface UserData {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface SectorInfo {
  id: string;
  nombre: string;
}

interface Props {
  user: UserData;
  assignedSectors: SectorInfo[];
  allSectors: SectorInfo[];
}

const roleBadge = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", variant: "default" as const };
    case "STAFF":
      return { label: "Staff", variant: "secondary" as const };
    case "PERSONAL_ADMIN":
      return { label: "Personal Admin", variant: "outline" as const };
    case "PERSONAL":
      return { label: "Personal", variant: "outline" as const };
    default:
      return { label: role, variant: "outline" as const };
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function UserDetail({ user, assignedSectors, allSectors }: Props) {
  const router = useRouter();
  const [cardsEditing, setCardsEditing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Sector editing
  const [editingSectors, setEditingSectors] = useState(false);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>(
    assignedSectors.map((s) => s.id)
  );
  const [sectorSearch, setSectorSearch] = useState("");
  const [savingSectors, setSavingSectors] = useState(false);

  const MAX_VISIBLE_SECTORS = 8;

  const filteredSectors = useMemo(() => {
    const query = sectorSearch.toLowerCase().trim();
    const filtered = query
      ? allSectors.filter((s) => s.nombre.toLowerCase().includes(query))
      : allSectors;
    return filtered.slice(0, MAX_VISIBLE_SECTORS);
  }, [allSectors, sectorSearch]);

  const hiddenCount = useMemo(() => {
    const query = sectorSearch.toLowerCase().trim();
    const total = query
      ? allSectors.filter((s) => s.nombre.toLowerCase().includes(query)).length
      : allSectors.length;
    return Math.max(0, total - MAX_VISIBLE_SECTORS);
  }, [allSectors, sectorSearch]);

  const toggleSector = (sectorId: string) => {
    setSelectedSectorIds((prev) =>
      prev.includes(sectorId)
        ? prev.filter((id) => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const handleSaveSectors = async () => {
    setSavingSectors(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectorIds: selectedSectorIds }),
      });
      if (!res.ok) throw new Error();
      toast.success("Sectores actualizados");
      setEditingSectors(false);
      router.refresh();
    } catch {
      toast.error("Error al actualizar sectores");
    } finally {
      setSavingSectors(false);
    }
  };

  const handleCancelSectors = () => {
    setSelectedSectorIds(assignedSectors.map((s) => s.id));
    setSectorSearch("");
    setEditingSectors(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error");
      }
      toast.success("Contraseña restablecida");
      setResetOpen(false);
      setResetPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al restablecer contraseña");
    } finally {
      setResetLoading(false);
    }
  };

  const nombreCompleto = [user.name, user.apellido].filter(Boolean).join(" ") || "Sin nombre";
  const badge = roleBadge(user.role);
  const isPersonalAdmin = user.role === "PERSONAL_ADMIN";

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-white/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/configuracion")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold truncate">{nombreCompleto}</h1>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Usuario desde {formatDate(user.createdAt)}
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
                form="user-cards-form"
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
          {/* Left column - Form + Sectors */}
          <div className="lg:col-span-2 space-y-6">
            <UserForm
              initialData={{
                id: user.id,
                name: user.name,
                apellido: user.apellido,
                email: user.email,
              }}
              cardsEditing={cardsEditing}
              onEditDone={() => setCardsEditing(false)}
            />

            {/* Sectors card - only for PERSONAL_ADMIN */}
            {isPersonalAdmin && (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle>Sectores asignados</CardTitle>
                    {!editingSectors && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSectors(true)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  {editingSectors ? (
                    <div className="space-y-3">
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
                          {filteredSectors.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2 text-center">
                              No se encontraron sectores
                            </p>
                          ) : (
                            <>
                              {filteredSectors.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-gray-50"
                                >
                                  <Checkbox
                                    checked={selectedSectorIds.includes(s.id)}
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
                      {selectedSectorIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedSectorIds.length} sector{selectedSectorIds.length !== 1 ? "es" : ""} seleccionado{selectedSectorIds.length !== 1 ? "s" : ""}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelSectors}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveSectors}
                          disabled={savingSectors}
                        >
                          {savingSectors ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {assignedSectors.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No tiene sectores asignados
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {assignedSectors.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center py-2 border-b border-gray-100 last:border-0 text-sm"
                            >
                              <span className="font-medium">{s.nombre}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Reset password card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Seguridad</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setResetOpen(true)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Restablecer contraseña
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <Input
                id="reset-password"
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResetOpen(false);
                  setResetPassword("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? "Guardando..." : "Restablecer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
