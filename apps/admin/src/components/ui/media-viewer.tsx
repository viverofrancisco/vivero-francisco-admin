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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative flex max-h-screen max-w-[100vw] items-center justify-center p-4 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[95vw]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt=""
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        )}
      </div>
    </div>
  );
}
