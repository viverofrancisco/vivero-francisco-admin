"use client";

import { useEffect, useRef, useState } from "react";

const LADO_SALIDA = 512;

function acotar(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/** El cuadro entra en el ancho del teléfono y no pasa de 420. */
function medidaDelCuadro() {
  if (typeof window === "undefined") return 300;
  return Math.floor(Math.min(window.innerWidth - 32, window.innerHeight * 0.6, 420));
}

/**
 * Recortar la foto de un grupo viendo el círculo, como WhatsApp y como la
 * app: la foto se arrastra dentro de un cuadro y se acerca con el control de
 * abajo, y encima va el círculo que se va a ver —lo que queda en las
 * esquinas no se muestra—. Antes se recortaba sola al centro, sin que nadie
 * eligiera qué parte de la foto quedaba adentro.
 *
 * Todo pasa en el navegador: es un archivo local, así que el lienzo no queda
 * "manchado" y el resultado sale como JPEG cuadrado de 512, listo para subir.
 */
export function RecortarAvatar({
  archivo,
  onCancelar,
  onRecortada,
}: {
  archivo: File;
  onCancelar: () => void;
  onRecortada: (blob: Blob) => void;
}) {
  const [url] = useState(() => URL.createObjectURL(archivo));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [lado, setLado] = useState(() => medidaDelCuadro());
  /** 1 = la foto cubre justo el cuadro; más es acercar. */
  const [zoom, setZoom] = useState(1);
  /** Cuánto se corrió la foto respecto del centro del cuadro, en píxeles de pantalla. */
  const [desp, setDesp] = useState({ x: 0, y: 0 });
  const [guardando, setGuardando] = useState(false);
  const arrastre = useRef<{ x0: number; y0: number; dx: number; dy: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const medir = () => setLado(medidaDelCuadro());
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  const base = natural ? lado / Math.min(natural.w, natural.h) : 1;
  const escala = base * zoom;
  const ancho = natural ? natural.w * escala : 0;
  const alto = natural ? natural.h * escala : 0;

  /** La foto nunca deja un hueco dentro del cuadro. */
  const limitar = (p: { x: number; y: number }) => ({
    x: acotar(p.x, -(ancho - lado) / 2, (ancho - lado) / 2),
    y: acotar(p.y, -(alto - lado) / 2, (alto - lado) / 2),
  });

  const cambiarZoom = (z: number) => {
    setZoom(z);
    // Con menos acercamiento el corrimiento de antes puede quedar afuera.
    const e = base * z;
    const a = natural ? natural.w * e : 0;
    const h = natural ? natural.h * e : 0;
    setDesp((d) => ({
      x: acotar(d.x, -(a - lado) / 2, (a - lado) / 2),
      y: acotar(d.y, -(h - lado) / 2, (h - lado) / 2),
    }));
  };

  const alPuntero = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastre.current = { x0: e.clientX, y0: e.clientY, dx: desp.x, dy: desp.y };
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    setDesp(limitar({ x: a.dx + e.clientX - a.x0, y: a.dy + e.clientY - a.y0 }));
  };
  const alSoltar = () => {
    arrastre.current = null;
  };

  async function guardar() {
    if (!natural) return;
    setGuardando(true);
    try {
      const bitmap = await createImageBitmap(archivo);
      // El cuadro, llevado a píxeles de la foto original.
      const sx = ((ancho - lado) / 2 - desp.x) / escala;
      const sy = ((alto - lado) / 2 - desp.y) / escala;
      const s = lado / escala;
      const destino = Math.min(LADO_SALIDA, Math.round(s));
      const lienzo = document.createElement("canvas");
      lienzo.width = destino;
      lienzo.height = destino;
      lienzo.getContext("2d")!.drawImage(bitmap, sx, sy, s, s, 0, 0, destino, destino);
      const blob = await new Promise<Blob>((resolver, rechazar) =>
        lienzo.toBlob(
          (b) => (b ? resolver(b) : rechazar(new Error("No pudimos preparar la foto"))),
          "image/jpeg",
          0.85
        )
      );
      onRecortada(blob);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex h-14 flex-none items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onCancelar} className="rounded-lg px-2 py-1.5 text-[16px] font-semibold active:bg-white/10">
          Cancelar
        </button>
        <span className="text-[16px] font-bold">Recortar</span>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={!natural || guardando}
          className="rounded-lg px-2 py-1.5 text-[16px] font-bold text-primary active:bg-white/10 disabled:opacity-50"
        >
          Listo
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          onPointerDown={alPuntero}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          style={{ width: lado, height: lado, touchAction: "none" }}
          className="relative cursor-grab select-none overflow-hidden active:cursor-grabbing"
        >
          {natural ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: ancho,
                height: alto,
                maxWidth: "none",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${desp.x}px), calc(-50% + ${desp.y}px))`,
              }}
              className="pointer-events-none absolute"
            />
          ) : null}
          {/* El círculo que se va a ver: lo de afuera se oscurece con una
              sombra enorme, que es lo que hace el recorte de WhatsApp. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-white/90"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          />
        </div>
      </div>

      <div className="flex flex-none items-center gap-3 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
        <span className="text-xs opacity-70">Acercar</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => cambiarZoom(Number(e.target.value))}
          aria-label="Acercar"
          className="flex-1 accent-primary"
        />
      </div>
    </div>
  );
}
