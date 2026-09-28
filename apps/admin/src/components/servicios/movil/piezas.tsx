"use client";

import { UNIDAD_PESO_LABEL, type UnidadPeso } from "@vivero/shared";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { money } from "@/components/ordenes/formato";
import { cn } from "@/lib/utils";

/**
 * Las piezas de la ficha del producto en el teléfono: las de la app, traídas
 * al portal para que la misma pantalla se vea igual en los dos. Acá no hay
 * lógica, solo la forma.
 */

/** Una hoja a pantalla completa, la `pageSheet` de la app. */
export function HojaCompleta({
  onCerrar,
  children,
  className,
}: {
  onCerrar: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        pantallaCompletaEnMovil
        className={cn("flex flex-col gap-0 overflow-hidden p-0 md:max-w-lg", className)}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * La cabecera de una hoja, la de Shopify: la ✕ redonda a la izquierda —o
 * *Cancelar* cuando hay algo que se perdería—, el título centrado con un
 * renglón chico debajo, y a la derecha lo que la hoja ofrece.
 */
export function CabeceraDeHoja({
  titulo,
  subtitulo,
  onCerrar,
  cerrando = "cerrar",
  derecha,
}: {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  cerrando?: "cerrar" | "cancelar";
  derecha?: React.ReactNode;
}) {
  return (
    <div className="flex flex-none items-center gap-2 border-b bg-card px-3 py-2">
      {cerrando === "cancelar" ? (
        <PastillaDeHoja texto="Cancelar" onClick={onCerrar} />
      ) : (
        <BotonRedondoDeHoja etiqueta="Cerrar" onClick={onCerrar}>
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </BotonRedondoDeHoja>
      )}
      <div className="min-w-0 flex-1 text-center">
        <DialogTitle className="truncate text-[17px] font-bold">{titulo}</DialogTitle>
        {subtitulo ? (
          <p className="truncate text-[13px] text-muted-foreground">{subtitulo}</p>
        ) : null}
      </div>
      <div className="flex min-w-9 flex-none items-center justify-end gap-2">{derecha}</div>
    </div>
  );
}

/** Un botón redondo de la cabecera: 36 de círculo con el ícono en 18. */
export function BotonRedondoDeHoja({
  etiqueta,
  onClick,
  disabled = false,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted text-foreground active:opacity-60 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** La pastilla de la cabecera, la medida de la casa: 30 de alto, 13 semibold. */
export function PastillaDeHoja({
  texto,
  onClick,
  primaria = false,
  disabled = false,
  cargando = false,
}: {
  texto: string;
  onClick: () => void;
  primaria?: boolean;
  disabled?: boolean;
  cargando?: boolean;
}) {
  const apagada = disabled || cargando;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={apagada}
      className={cn(
        "flex h-[30px] flex-none items-center justify-center rounded-lg px-3 text-[13px] font-semibold active:opacity-60 disabled:opacity-40",
        primaria ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : texto}
    </button>
  );
}

/** Una sección de la ficha: el rótulo en versalitas y el cuerpo redondeado. */
export function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: { etiqueta: string; onClick: () => void } | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-center justify-between pl-1">
        <p className="text-[11px] tracking-[0.8px] text-muted-foreground uppercase">{titulo}</p>
        {accion ? (
          <button
            type="button"
            onClick={accion.onClick}
            className="pr-1 text-sm font-semibold text-primary active:opacity-60"
          >
            {accion.etiqueta}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-border/70 rounded-xl bg-card px-3.5">{children}</div>
    </section>
  );
}

/** Una fila rótulo / valor. Con `onClick` se vuelve un renglón que abre algo. */
export function Fila({
  etiqueta,
  valor,
  onClick,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  onClick?: () => void;
}) {
  const cuerpo = (
    <>
      <span className="flex-none text-muted-foreground">{etiqueta}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        {typeof valor === "string" ? <span className="truncate">{valor}</span> : valor}
        {onClick ? <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" /> : null}
      </span>
    </>
  );
  if (!onClick) return <div className="flex items-center justify-between gap-3 py-2.5 text-sm">{cuerpo}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm active:opacity-60"
    >
      {cuerpo}
    </button>
  );
}

/** El campo de las hojas de Shopify: el rótulo chico adentro de la caja. */
export function CampoEnCaja({
  etiqueta,
  valor,
  onCambio,
  prefijo,
  inputMode,
  placeholder,
  autoFocus,
  limpiable = true,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  prefijo?: string;
  inputMode?: "text" | "decimal" | "numeric";
  placeholder?: string;
  autoFocus?: boolean;
  limpiable?: boolean;
}) {
  return (
    <div className="mb-2.5 rounded-xl border bg-card px-3 pt-1.5 pb-1">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <div className="flex items-center gap-1.5">
        {prefijo ? <span className="text-base">{prefijo}</span> : null}
        <input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground"
        />
        {limpiable && valor !== "" ? (
          <button
            type="button"
            onClick={() => onCambio("")}
            aria-label={`Vaciar ${etiqueta}`}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground active:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** La casilla de Shopify: el cuadrado relleno con el tilde cuando está marcada. */
export function Casilla({
  etiqueta,
  nota,
  marcada,
  onCambio,
}: {
  etiqueta: string;
  nota?: string;
  marcada: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={() => onCambio(!marcada)}
      className="flex w-full items-center gap-3.5 px-1 py-3 text-left active:opacity-60"
    >
      <span
        className={cn(
          "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-[1.5px]",
          marcada ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
        )}
      >
        {marcada ? <Check className="h-[15px] w-[15px]" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{etiqueta}</span>
        {nota ? <span className="block text-xs text-muted-foreground">{nota}</span> : null}
      </span>
    </button>
  );
}

export const dinero = money;

/** Cero es gratis, y decirlo con la palabra es lo que hace que se note. */
export function precioTexto(precio: number): string {
  return precio === 0 ? "Gratis" : money(precio);
}

export function pesoTexto(v: { peso: number | null; pesoUnidad: UnidadPeso }): string {
  if (v.peso === null) return "—";
  return `${v.peso} ${UNIDAD_PESO_LABEL[v.pesoUnidad]}`;
}

/** Lo escrito, como número. Vacío o a medio escribir vale `null`. */
export function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "" || limpio === "." || limpio === "-") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** El nombre de una variante: "Rojo · Grande", o el del producto sin ejes. */
export function nombreDeVariante(
  valores: { valor: string }[],
  productoNombre: string
): string {
  return valores.map((v) => v.valor).join(" · ") || productoNombre;
}

/** Contra la API del portal, con el error del servidor como mensaje. */
export async function pedir<T = unknown>(
  url: string,
  init: { method: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: init.method,
    headers: { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const texto = await res.text();
  const data = texto ? (JSON.parse(texto) as T & { error?: string }) : ({} as T & { error?: string });
  if (!res.ok) throw new Error(data.error ?? `Solicitud falló (${res.status})`);
  return data;
}
