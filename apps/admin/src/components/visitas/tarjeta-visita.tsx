import { Card, CardContent } from "@/components/ui/card";

/**
 * La tarjeta de la ficha de visita: título en negrita adentro, sin línea.
 *
 * Es la forma del handoff. Las tarjetas del portal separan su encabezado con un
 * `border-b`, y eso está bien donde el encabezado lleva botones —la línea dice
 * dónde termina la barra de acciones y empieza el contenido—. Acá el encabezado
 * es un título y a veces un enlace, así que la línea partía la tarjeta en dos
 * por nada: con el título en 15.5/800 y aire debajo ya se sabe que es un título.
 *
 * Medidas del diseño: radio 16, padding 22, 14 px entre el título y lo que
 * sigue.
 */
export function TarjetaVisita({
  titulo,
  accion,
  children,
  className,
}: {
  titulo: string;
  /** Lo que va a la derecha del título: un enlace, una píldora, un botón. */
  accion?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`gap-0 rounded-2xl py-0 ${className ?? ""}`}>
      <CardContent className="p-[22px]">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-[15.5px] font-extrabold">{titulo}</span>
          {accion}
        </div>
        <div className="mt-[14px]">{children}</div>
      </CardContent>
    </Card>
  );
}
