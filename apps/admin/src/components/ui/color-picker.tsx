"use client";

import { useState } from "react";

/**
 * Un selector de color completo: cuadro de saturación, barra de tono, hex y
 * muestras.
 *
 * Va acá y no el `input[type=color]` del navegador porque ese abre el diálogo
 * del sistema —una ventana aparte, distinta en cada máquina— y lo que se pidió
 * es elegir el color **adentro** del menú, encima de las muestras, como en
 * Shopify. Sin dependencias: son dos degradados y un poco de aritmética.
 */
export function ColorPicker({
  value,
  onChange,
  muestras,
  neutros,
}: {
  /** Hex `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  muestras: string[];
  neutros: string[];
}) {
  const hsv = hexAHsv(value) ?? { h: 0, s: 0, v: 0 };
  /**
   * El hex mientras se escribe. La fuente sigue siendo `value`: esto solo
   * existe para poder tipear "#1a4" sin que cada tecla intente aplicarse.
   */
  const [escrito, setEscrito] = useState<string | null>(null);

  /**
   * Dónde cayó el puntero adentro del área, de 0 a 1.
   *
   * Se mide sobre `currentTarget` —el elemento al que está colgado el
   * manejador— y no sobre un `ref`: leer un ref durante el render es
   * justamente lo que React desaconseja, y acá no hace falta.
   */
  const posicion = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const arrastrar =
    (alMover: (p: { x: number; y: number }) => void) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      // El puntero queda capturado, así que se puede salir del cuadro sin
      // soltar —que es como se arrastra— y el color sigue.
      e.currentTarget.setPointerCapture(e.pointerId);
      alMover(posicion(e));
    };

  const moviendo =
    (alMover: (p: { x: number; y: number }) => void) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      alMover(posicion(e));
    };

  const enCuadro = ({ x, y }: { x: number; y: number }) =>
    onChange(hsvAHex({ h: hsv.h, s: x, v: 1 - y }));
  const enBarra = ({ y }: { x: number; y: number }) =>
    onChange(hsvAHex({ h: y * 360, s: hsv.s || 1, v: hsv.v || 1 }));

  const fila = (colores: string[]) => (
    <div className="flex items-center gap-1.5">
      {colores.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          title={c}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${
            c.toLowerCase() === value.toLowerCase()
              ? "border-2 border-foreground"
              : "border-border/60"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );

  return (
    <div className="w-56 space-y-2">
      <div className="flex gap-2">
        {/* Saturación (→) y brillo (↓) sobre el tono elegido. */}
        <div
          onPointerDown={arrastrar(enCuadro)}
          onPointerMove={moviendo(enCuadro)}
          className="relative h-32 flex-1 cursor-crosshair rounded touch-none"
          style={{
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            backgroundImage:
              "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
          }}
        >
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              backgroundColor: value,
            }}
          />
        </div>
        {/* El tono, de rojo a rojo. */}
        <div
          onPointerDown={arrastrar(enBarra)}
          onPointerMove={moviendo(enBarra)}
          className="relative h-32 w-4 cursor-pointer rounded touch-none"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
        >
          <span
            className="pointer-events-none absolute left-1/2 h-3 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              top: `${(hsv.h / 360) * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
          />
        </div>
      </div>

      {/* El hex, para pegar uno de una marca. Se aplica cuando ya es un color:
          mientras se escribe "#1a4" no hay nada que aplicar. */}
      <div className="flex items-center gap-2 rounded-md border px-2 py-1">
        <span
          className="h-4 w-4 flex-none rounded border"
          style={{ backgroundColor: value }}
        />
        <input
          value={escrito ?? value.toUpperCase()}
          aria-label="Código hexadecimal"
          spellCheck={false}
          onChange={(e) => {
            const t = e.target.value;
            setEscrito(t);
            const hex = normalizarHex(t);
            if (hex) onChange(hex);
          }}
          onBlur={() => setEscrito(null)}
          className="w-full bg-transparent font-mono text-xs uppercase outline-none"
        />
      </div>

      {fila(muestras)}
      {fila(neutros)}
    </div>
  );
}

/** `#abc`, `abc` o `#aabbcc` → `#aabbcc`. Null si todavía no es un color. */
export function normalizarHex(texto: string): string | null {
  const t = texto.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) {
    return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

function hexAHsv(hex: string): { h: number; s: number; v: number } | null {
  const norm = normalizarHex(hex);
  if (!norm) return null;
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvAHex({ h, s, v }: { h: number; s: number; v: number }): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const dos = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}
