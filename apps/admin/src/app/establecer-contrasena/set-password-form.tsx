"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Estado = "cargando" | "valido" | "invalido" | "listo";

/**
 * A dónde entra quien abre el enlace. El mecanismo es el mismo para todos; lo
 * que cambia es qué se le dice después, y mandar a alguien del personal a
 * "abrir la app" cuando su lugar de trabajo es el portal es mandarlo al lugar
 * equivocado.
 */
type Destino = "portal" | "app";

export function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [estado, setEstado] = useState<Estado>(() =>
    token ? "cargando" : "invalido"
  );
  const [nombre, setNombre] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino>("app");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/set-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; nombre?: string; destino?: Destino }) => {
        if (data.valid) {
          setNombre(data.nombre ?? null);
          setDestino(data.destino ?? "app");
          setEstado("valido");
        } else {
          setEstado("invalido");
        }
      })
      .catch(() => setEstado("invalido"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No pudimos guardar la contraseña.");
        setLoading(false);
        return;
      }
      setEstado("listo");
    } catch {
      setError("No pudimos guardar la contraseña.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Vivero Francisco</CardTitle>
          <CardDescription>
            {estado === "listo"
              ? "Contraseña creada"
              : destino === "portal"
                ? "Crea tu contraseña para entrar al portal"
                : "Crea tu contraseña para acceder a la app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estado === "cargando" && (
            <p className="text-center text-sm text-muted-foreground">
              Validando enlace…
            </p>
          )}

          {estado === "invalido" && (
            <p className="text-center text-sm text-red-600">
              El enlace no es válido, ya fue usado o caducó. Pide uno nuevo a
              quien te lo envió.
            </p>
          )}

          {estado === "listo" &&
            (destino === "portal" ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-green-700">
                  ¡Listo! Ya puedes entrar al portal con tu correo y tu nueva
                  contraseña.
                </p>
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<a href="/login" />}
                >
                  Ir a iniciar sesión
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-green-700">
                ¡Listo! Ya puedes abrir la app de Vivero Francisco e iniciar
                sesión con tu teléfono o correo y tu nueva contraseña.
              </p>
            ))}

          {estado === "valido" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {nombre && (
                <p className="text-sm text-muted-foreground">
                  Hola <span className="font-semibold">{nombre}</span>, elige tu
                  contraseña.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <Input
                  id="confirmar"
                  type="password"
                  placeholder="••••••••"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando…" : "Crear contraseña"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
