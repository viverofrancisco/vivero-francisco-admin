"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface UserFormProps {
  initialData: {
    id: string;
    name: string | null;
    apellido: string | null;
    email: string;
  };
  cardsEditing: boolean;
  onEditDone: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export function UserForm({ initialData, cardsEditing, onEditDone }: UserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData.name ?? "");
  const [apellido, setApellido] = useState(initialData.apellido ?? "");
  const [email, setEmail] = useState(initialData.email);
  const [error, setError] = useState("");

  const prevEditing = useRef(cardsEditing);
  useEffect(() => {
    if (prevEditing.current && !cardsEditing) {
      setName(initialData.name ?? "");
      setApellido(initialData.apellido ?? "");
      setEmail(initialData.email);
      setError("");
    }
    prevEditing.current = cardsEditing;
  }, [cardsEditing, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/users/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, apellido, email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      toast.success("Usuario actualizado");
      onEditDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  if (!cardsEditing) {
    return (
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Informacion General</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <InfoRow label="Nombre" value={initialData.name} />
          <InfoRow label="Apellido" value={initialData.apellido} />
          <InfoRow label="Correo" value={initialData.email} />
        </CardContent>
      </Card>
    );
  }

  return (
    <form id="user-cards-form" onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Informacion General</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre *</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-apellido">Apellido</Label>
              <Input
                id="user-apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Correo *</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </form>
  );
}
