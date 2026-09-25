import { cn } from "@/lib/utils";

/**
 * Una sección de una ficha en el teléfono: el rótulo en mayúsculas chicas y
 * un cuerpo blanco redondeado sobre el fondo de la página. Es la `Seccion` de
 * las fichas de la app (la orden, la suscripción), traída al portal para que
 * la misma ficha se vea igual en los dos.
 *
 * Distinta de la banda blanca de un formulario (*Nueva orden*): ahí las
 * secciones son preguntas y van de borde a borde; acá son datos y van en
 * tarjetas, que es como la app las dibuja.
 */
export function SeccionFichaMovil({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-5", className)}>
      <p className="mb-1.5 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">
        {titulo}
      </p>
      <div className="rounded-xl bg-card px-3.5 py-1.5">{children}</div>
    </section>
  );
}

/** Una fila etiqueta / valor del cuerpo: Subtotal, Número, Estado. */
export function FilaFichaMovil({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  fuerte?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className={cn("text-right", fuerte && "font-bold")}>{valor}</span>
    </div>
  );
}
