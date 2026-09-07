"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { MediaItem } from "./media-library";

/** El rectángulo del recorte, en **fracciones** de la imagen (0 a 1). */
interface Recorte {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

const FORMAS: { clave: string; label: string; nota: string; ratio: number | null }[] =
  [
    { clave: "libre", label: "Libre", nota: "Como quieras", ratio: null },
    { clave: "1:1", label: "1:1", nota: "Cuadrada", ratio: 1 },
    { clave: "4:3", label: "4:3", nota: "Horizontal", ratio: 4 / 3 },
    { clave: "3:4", label: "3:4", nota: "Vertical", ratio: 3 / 4 },
    { clave: "16:9", label: "16:9", nota: "Panorámica", ratio: 16 / 9 },
    { clave: "2:3", label: "2:3", nota: "Vertical", ratio: 2 / 3 },
  ];

type Asa = "mover" | "nw" | "ne" | "sw" | "se";

/**
 * Recorta y redimensiona una imagen.
 *
 * Trabaja en **fracciones** de la imagen y no en píxeles: el recuadro se
 * arrastra sobre una vista que puede tener cualquier tamaño, y guardar
 * píxeles de pantalla haría que el recorte dependiera del ancho del monitor.
 * Los píxeles reales se calculan al guardar, con las medidas del original.
 *
 * El resultado es **una imagen nueva**. La original queda en la biblioteca:
 * puede estar en otro producto, y recortarla para este cambiaría la del otro.
 */
export function EditorImagen({
  media,
  origen = "biblioteca",
  onGuardado,
  onCerrar,
}: {
  /** Solo lo que hace falta para dibujarla: el nombre del recorte lo pone el servidor. */
  media: Pick<MediaItem, "id" | "url" | "alt">;
  /**
   * De dónde sale el archivo que se está editando. Con `"visita"`, `media.id`
   * es una `VisitaMedia`: se lee de ahí y el recorte igual nace en la
   * biblioteca, sin tocar la foto de la visita.
   */
  origen?: "biblioteca" | "visita";
  /** Siempre una imagen **nueva** de la biblioteca: el original nunca se pisa. */
  onGuardado: (nueva: MediaItem) => void;
  onCerrar: () => void;
}) {
  const [recorte, setRecorte] = useState<Recorte>({
    x: 0,
    y: 0,
    ancho: 1,
    alto: 1,
  });
  const [forma, setForma] = useState("libre");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [salida, setSalida] = useState<{ ancho: string; alto: string }>({
    ancho: "",
    alto: "",
  });
  const [guardando, setGuardando] = useState(false);
  const marco = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{
    asa: Asa;
    x0: number;
    y0: number;
    inicial: Recorte;
  } | null>(null);

  /** Cuántos píxeles del original abarca el recorte actual. */
  const enPixeles = natural
    ? {
        x: Math.round(recorte.x * natural.w),
        y: Math.round(recorte.y * natural.h),
        ancho: Math.max(1, Math.round(recorte.ancho * natural.w)),
        alto: Math.max(1, Math.round(recorte.alto * natural.h)),
      }
    : null;

  /** Ajusta el recuadro a una proporción, sin salirse de la imagen. */
  const aplicarForma = (clave: string) => {
    setForma(clave);
    const ratio = FORMAS.find((f) => f.clave === clave)?.ratio;
    if (!ratio || !natural) return;
    // La proporción es de la imagen final, así que hay que llevarla al espacio
    // de fracciones, donde ancho y alto no miden lo mismo.
    const rf = (ratio * natural.h) / natural.w;
    let ancho = 1;
    let alto = ancho / rf;
    if (alto > 1) {
      alto = 1;
      ancho = alto * rf;
    }
    setRecorte({ x: (1 - ancho) / 2, y: (1 - alto) / 2, ancho, alto });
  };

  const alPuntero = (e: React.PointerEvent, asa: Asa) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastre.current = {
      asa,
      x0: e.clientX,
      y0: e.clientY,
      inicial: recorte,
    };
  };

  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    const caja = marco.current?.getBoundingClientRect();
    if (!a || !caja) return;
    const dx = (e.clientX - a.x0) / caja.width;
    const dy = (e.clientY - a.y0) / caja.height;
    const r = { ...a.inicial };
    const min = 0.05;

    if (a.asa === "mover") {
      r.x = Math.min(Math.max(0, a.inicial.x + dx), 1 - a.inicial.ancho);
      r.y = Math.min(Math.max(0, a.inicial.y + dy), 1 - a.inicial.alto);
    } else {
      // Cada asa mueve dos bordes: el suyo y el que comparte esquina. El otro
      // par queda fijo, que es lo que hace que la esquina opuesta no se mueva.
      if (a.asa === "nw" || a.asa === "sw") {
        const x = Math.min(Math.max(0, a.inicial.x + dx), a.inicial.x + a.inicial.ancho - min);
        r.ancho = a.inicial.x + a.inicial.ancho - x;
        r.x = x;
      } else {
        r.ancho = Math.min(
          Math.max(min, a.inicial.ancho + dx),
          1 - a.inicial.x
        );
      }
      if (a.asa === "nw" || a.asa === "ne") {
        const y = Math.min(Math.max(0, a.inicial.y + dy), a.inicial.y + a.inicial.alto - min);
        r.alto = a.inicial.y + a.inicial.alto - y;
        r.y = y;
      } else {
        r.alto = Math.min(Math.max(min, a.inicial.alto + dy), 1 - a.inicial.y);
      }
      // Con una proporción fija, el alto lo manda el ancho: si no, arrastrar
      // una esquina la rompería y el preset dejaría de significar algo.
      const ratio = FORMAS.find((f) => f.clave === forma)?.ratio;
      if (ratio && natural) {
        const rf = (ratio * natural.h) / natural.w;
        r.alto = Math.min(r.ancho / rf, 1 - r.y);
        r.ancho = r.alto * rf;
      }
    }
    setRecorte(r);
  };

  const soltar = () => {
    arrastre.current = null;
  };

  const guardar = async () => {
    if (!enPixeles) return;
    setGuardando(true);
    try {
      const cuerpo: Record<string, unknown> = {};
      // Un recorte que abarca todo no se manda: sería copiar el archivo por
      // nada, y la biblioteca terminaría llena de gemelos.
      const recortaAlgo =
        recorte.x > 0.001 ||
        recorte.y > 0.001 ||
        recorte.ancho < 0.999 ||
        recorte.alto < 0.999;
      if (recortaAlgo) cuerpo.recorte = enPixeles;

      const ancho = Number(salida.ancho);
      const alto = Number(salida.alto);
      if (ancho > 0 && alto > 0 && (ancho !== enPixeles.ancho || alto !== enPixeles.alto)) {
        cuerpo.redimensionar = { ancho, alto };
      }
      if (Object.keys(cuerpo).length === 0) {
        toast.info("No hay cambios que aplicar");
        setGuardando(false);
        return;
      }

      const res = await fetch(`/api/media/${media.id}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, origen }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success("Imagen recortada");
      onGuardado(body.media);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos recortarla");
    } finally {
      setGuardando(false);
    }
  };

  const pct = (n: number) => `${n * 100}%`;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Recortar imagen</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div
            ref={marco}
            onPointerMove={alMover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-md bg-muted"
          >
            {/* Sin `next/image`: acá hace falta el tamaño natural del archivo
                para traducir el recuadro a píxeles, y el optimizador sirve otra
                cosa. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.url}
              alt={media.alt ?? ""}
              // `w-auto` y no `object-contain`: con `contain` la imagen se
              // dibuja centrada dentro de un elemento más grande, y el marco
              // —que es contra el que se mide el recuadro— dejaría de coincidir
              // con lo que se ve. Así el marco mide exactamente la imagen.
              className="block max-h-[65vh] w-auto max-w-full select-none"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                setSalida({
                  ancho: String(el.naturalWidth),
                  alto: String(el.naturalHeight),
                });
              }}
            />
            {/* Lo de afuera, apagado con cuatro rectángulos alrededor del
                recuadro — y no repintando la imagen adentro de él.

                Repintarla era lo primero que hice y quedaba corrido: el
                `background` se posiciona contra la caja de padding, así que el
                borde de 2px del recuadro desplazaba y escalaba la copia, y lo
                seleccionado no coincidía con lo que se veía. Con sombras
                alrededor, lo que se ve dentro del recuadro **es** la imagen de
                abajo: no hay dos copias que puedan desalinearse. */}
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-x-0 top-0 bg-black/60"
                style={{ height: pct(recorte.y) }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-black/60"
                style={{ height: pct(1 - recorte.y - recorte.alto) }}
              />
              <div
                className="absolute left-0 bg-black/60"
                style={{
                  top: pct(recorte.y),
                  height: pct(recorte.alto),
                  width: pct(recorte.x),
                }}
              />
              <div
                className="absolute right-0 bg-black/60"
                style={{
                  top: pct(recorte.y),
                  height: pct(recorte.alto),
                  width: pct(1 - recorte.x - recorte.ancho),
                }}
              />
            </div>
            <div
              onPointerDown={(e) => alPuntero(e, "mover")}
              style={{
                left: pct(recorte.x),
                top: pct(recorte.y),
                width: pct(recorte.ancho),
                height: pct(recorte.alto),
              }}
              className="absolute cursor-move outline outline-2 -outline-offset-1 outline-white"
            >
              {(["nw", "ne", "sw", "se"] as const).map((asa) => (
                <span
                  key={asa}
                  onPointerDown={(e) => alPuntero(e, asa)}
                  className={`absolute h-3 w-3 rounded-sm border border-muted-foreground bg-white ${
                    asa === "nw"
                      ? "-left-1.5 -top-1.5 cursor-nwse-resize"
                      : asa === "ne"
                        ? "-right-1.5 -top-1.5 cursor-nesw-resize"
                        : asa === "sw"
                          ? "-bottom-1.5 -left-1.5 cursor-nesw-resize"
                          : "-bottom-1.5 -right-1.5 cursor-nwse-resize"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Forma</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {FORMAS.map((f) => (
                  <button
                    key={f.clave}
                    type="button"
                    onClick={() => aplicarForma(f.clave)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      forma === f.clave
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {f.nota}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* El tamaño de salida, ya recortado. Arranca en el del recorte,
                que es lo que se guarda si nadie lo toca. */}
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Ancho (px)</Label>
                <Input
                  type="number"
                  min="1"
                  value={salida.ancho}
                  onChange={(e) => setSalida({ ...salida, ancho: e.target.value })}
                  className="h-8 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alto (px)</Label>
                <Input
                  type="number"
                  min="1"
                  value={salida.alto}
                  onChange={(e) => setSalida({ ...salida, alto: e.target.value })}
                  className="h-8 text-sm tabular-nums"
                />
              </div>
            </div>

            {enPixeles && (
              <p className="text-xs text-muted-foreground">
                Recorte: {enPixeles.ancho} × {enPixeles.alto} px
                {natural && ` · original ${natural.w} × ${natural.h}`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Se guarda como una imagen nueva. La original queda en la
              biblioteca.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !natural}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar recorte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
