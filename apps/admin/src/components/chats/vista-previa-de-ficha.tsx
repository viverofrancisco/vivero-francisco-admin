"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  SIN_ACCESO_A,
  type ReferenciaEnMensaje,
  type VistaPreviaDeReferencia,
} from "@vivero/shared";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAca } from "@/lib/filtros-url";
import { ETIQUETA_REFERENCIA, hrefDeReferencia, IconoDeReferencia } from "./referencias";

/**
 * La ficha compartida, leída **sin salir del chat**: un diálogo en el
 * escritorio y una hoja desde abajo en el teléfono, con lo esencial en filas
 * y un *Ver ficha* para quien sí quiere irse. Tocar la tarjeta abría la ficha
 * entera y volver era perder el hilo de la conversación.
 *
 * Lo que se muestra lo arma el servidor (`vistaPreviaDeReferencia`) con el
 * acceso de quien mira: un 403 se convierte en el aviso de siempre y la
 * hoja se cierra sola. La app tiene la misma hoja (`VistaPreviaDeFicha`).
 */
const MOVIL = "(max-width: 767px)";

/** Debajo de `md`, el mismo corte que decide tabla o lista. */
function useEsMovil() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(MOVIL);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(MOVIL).matches,
    () => false
  );
}

type Carga = {
  clave: string;
  datos: VistaPreviaDeReferencia | null;
  error: string | null;
  /** El servidor dijo que no: el aviso ya salió y la hoja tiene que irse. */
  cerrar?: boolean;
};

export function VistaPreviaDeFicha({
  referencia,
  onClose,
}: {
  referencia: ReferenciaEnMensaje | null;
  onClose: () => void;
}) {
  const esMovil = useEsMovil();
  const aca = useAca();
  const tipo = referencia?.tipo;
  const id = referencia?.id;
  const clave = tipo && id ? `${tipo}:${id}` : null;
  // Con la clave de la ficha a la que pertenece: si no es la de ahora, se
  // está cargando. Sin esto, abrir otra tarjeta mostraba la anterior un rato.
  const [carga, setCarga] = useState<Carga | null>(null);
  const actual = carga && carga.clave === clave ? carga : null;

  useEffect(() => {
    if (!tipo || !id) return;
    const clave = `${tipo}:${id}`;
    let vivo = true;
    fetch(`/api/chats/referencia?tipo=${tipo}&id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!vivo) return;
        if (r.status === 403) {
          const { titulo, detalle } = SIN_ACCESO_A[tipo];
          toast.error(titulo, { description: detalle });
          setCarga({ clave, datos: null, error: null, cerrar: true });
          return;
        }
        if (!r.ok) {
          const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
          setCarga({ clave, datos: null, error: cuerpo?.error ?? "No pudimos cargar la ficha" });
          return;
        }
        setCarga({ clave, datos: (await r.json()) as VistaPreviaDeReferencia, error: null });
      })
      .catch(() => {
        if (vivo) setCarga({ clave, datos: null, error: "No pudimos cargar la ficha. Revisa la conexión." });
      });
    return () => {
      vivo = false;
    };
  }, [tipo, id]);

  useEffect(() => {
    if (actual?.cerrar) onClose();
  }, [actual, onClose]);

  const abierta = referencia !== null && !actual?.cerrar;
  const titulo = referencia ? ETIQUETA_REFERENCIA[referencia.tipo] : "";

  const cuerpo = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {actual?.error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{actual.error}</p>
      ) : !actual?.datos ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <Detalle datos={actual.datos} />
      )}
    </div>
  );
  const pie = referencia ? (
    <Link
      href={hrefDeReferencia(referencia, aca)}
      onClick={onClose}
      className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full flex-none")}
    >
      Ver ficha
    </Link>
  ) : null;

  if (esMovil) {
    return (
      <Sheet open={abierta} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[85dvh] flex-col rounded-t-2xl px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">{titulo}</SheetTitle>
          {cuerpo}
          {pie}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={abierta} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-md">
        <DialogTitle className="sr-only">{titulo}</DialogTitle>
        {cuerpo}
        {pie}
      </DialogContent>
    </Dialog>
  );
}

function Detalle({ datos }: { datos: VistaPreviaDeReferencia }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-muted">
          <IconoDeReferencia tipo={datos.tipo} className="h-5 w-5 text-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{datos.titulo}</p>
          <p className="truncate text-sm text-muted-foreground">{datos.subtitulo}</p>
        </div>
        {datos.estado ? (
          <span className="flex-none rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {datos.estado}
          </span>
        ) : null}
      </div>
      {datos.filas.length > 0 ? (
        <dl className="mt-4 grid grid-cols-[minmax(88px,auto)_1fr] gap-x-4 gap-y-2.5 text-sm">
          {datos.filas.map((f) => (
            <div key={f.etiqueta} className="contents">
              <dt className="text-muted-foreground">{f.etiqueta}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words">{f.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
