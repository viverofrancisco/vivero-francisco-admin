"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export interface MediaViewerSource {
  url: string;
  tipo: string; // "imagen" | "video"
}

export function MediaViewer({
  media,
  onClose,
}: {
  media: MediaViewerSource | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!media) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Prevent the page below from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [media, onClose]);

  if (!media) return null;

  const isVideo = media.tipo === "video";

  return (
    /* El mismo velo que el resto de los diálogos —`bg-black/10` con blur—
       para que el portal se siga viendo detrás. Lo único distinto es el
       tamaño: una foto pide más lugar que un formulario, así que este panel
       crece con la imagen en vez de tener un ancho fijo. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-3 supports-backdrop-filter:backdrop-blur-xs md:p-5"
      onClick={onClose}
    >
      <div
        className="relative max-h-full overflow-hidden rounded-xl bg-background p-2 ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>
        {isVideo ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
}
