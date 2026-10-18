"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { nombreCliente, paraBuscar } from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VistaPreviaFusion } from "@/lib/services/cliente-fusion.service";
import { cn } from "@/lib/utils";

interface Candidato {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
}

const CUENTA: Record<VistaPreviaFusion["cuenta"], string | null> = {
  ninguna: null,
  "se-conserva": "La cuenta de la app de esta ficha se mantiene.",
  "se-mueve": "La cuenta de la app del duplicado pasa a esta ficha: entra con la misma contraseña.",
  "se-elimina-la-del-duplicado":
    "Las dos tienen cuenta en la app: queda la de esta ficha y la del duplicado se elimina.",
};

function resumen(m: VistaPreviaFusion["mueve"]): string[] {
  const t: [number, string, string][] = [
    [m.propiedades, "propiedad", "propiedades"],
    [m.visitas, "visita", "visitas"],
    [m.suscripciones, "suscripción", "suscripciones"],
    [m.ordenes, "pedido", "pedidos"],
    [m.informes, "informe", "informes"],
    [m.datosFacturacion, "dato de facturación", "datos de facturación"],
    [m.solicitudes, "solicitud", "solicitudes"],
    [m.obras, "obra", "obras"],
  ];
  return t.filter(([n]) => n > 0).map(([n, s, p]) => `${n} ${n === 1 ? s : p}`);
}

/**
 * Fusionar un duplicado en esta ficha. Dos pasos: elegir el duplicado, y ver
 * exactamente qué pasa antes de confirmar, porque no se deshace.
 */
export function FusionarClienteDialog({
  clienteId,
  nombre,
  abierto,
  onCerrar,
}: {
  clienteId: string;
  nombre: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<Candidato[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [vista, setVista] = useState<VistaPreviaFusion | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || clientes) return;
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((lista: Candidato[]) => setClientes(lista.filter((c) => c.id !== clienteId)))
      .catch(() => toast.error("No se pudo cargar la lista de clientes"));
  }, [abierto, clientes, clienteId]);

  const filtrados = useMemo(() => {
    const palabras = paraBuscar(busqueda.trim()).split(/\s+/).filter(Boolean);
    if (!clientes) return [];
    if (palabras.length === 0) return clientes.slice(0, 30);
    return clientes
      .filter((c) => {
        const t = paraBuscar(`${nombreCliente(c)} ${c.telefono ?? ""} ${c.email ?? ""}`);
        return palabras.every((p) => t.includes(p));
      })
      .slice(0, 30);
  }, [clientes, busqueda]);

  async function pedir(confirmar: boolean, otro: Candidato) {
    setCargando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/fusion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otroId: otro.id, confirmar }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo");
      if (confirmar) {
        toast.success(`${nombreCliente(otro)} quedó fusionado en esta ficha`);
        cerrar();
        router.refresh();
      } else {
        setVista(body);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo");
    } finally {
      setCargando(false);
    }
  }

  function cerrar() {
    setElegido(null);
    setVista(null);
    setBusqueda("");
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-lg" pantallaCompletaEnMovil>
        <DialogHeader>
          <DialogTitle>Fusionar con otro cliente</DialogTitle>
          <DialogDescription>
            Elige la ficha duplicada. Todo lo suyo pasa a <strong>{nombre}</strong>, y el duplicado
            se archiva.
          </DialogDescription>
        </DialogHeader>

        {!elegido ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar por nombre, teléfono o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border md:max-h-80">
              {!clientes ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtrados.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Ningún cliente coincide.</p>
              ) : (
                <ul className="divide-y">
                  {filtrados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setElegido(c);
                          pedir(false, c);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-muted/50"
                      >
                        <span className="block text-sm font-medium">{nombreCliente(c)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {!vista ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p>
                  <strong>{vista.absorber.nombre}</strong> se fusiona en{" "}
                  <strong>{vista.conservar.nombre}</strong>.
                </p>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-1 font-medium">Pasa a esta ficha:</p>
                  {resumen(vista.mueve).length ? (
                    <ul className="list-disc space-y-0.5 pl-5">
                      {resumen(vista.mueve).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">El duplicado no tiene nada cargado.</p>
                  )}
                  {vista.completa.length ? (
                    <p className="mt-2 text-muted-foreground">
                      Esta ficha toma del duplicado: {vista.completa.join(", ")}.
                    </p>
                  ) : null}
                  {CUENTA[vista.cuenta] ? (
                    <p className="mt-2 text-muted-foreground">{CUENTA[vista.cuenta]}</p>
                  ) : null}
                </div>
                <p className={cn("font-medium text-destructive")}>Esto no se puede deshacer.</p>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {elegido ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setElegido(null);
                  setVista(null);
                }}
                disabled={cargando}
              >
                Elegir otro
              </Button>
              <Button
                variant="destructive"
                onClick={() => pedir(true, elegido)}
                disabled={cargando || !vista}
              >
                Fusionar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
