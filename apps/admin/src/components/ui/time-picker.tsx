"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

/** Ancho del desplegable, en px. Tiene que coincidir con `w-56`. */
const ANCHO = 224;

/** Cada cuántos minutos hay una opción en la columna del medio. */
const PASO_MINUTOS = 5;

const HORAS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTOS = Array.from({ length: 60 / PASO_MINUTOS }, (_, i) => i * PASO_MINUTOS);

/** `HH:mm` de 24 horas → `{ hora12, minuto, meridiano }`. */
function partes(valor: string) {
  const [h, m] = valor.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return {
    hora12: h % 12 === 0 ? 12 : h % 12,
    minuto: m,
    meridiano: h < 12 ? "AM" : "PM",
  };
}

/** `{ 1, 5, "PM" }` → `"13:05"`, que es lo que se guarda. */
function aValor(hora12: number, minuto: number, meridiano: string): string {
  const h =
    meridiano === "AM"
      ? hora12 % 12
      : (hora12 % 12) + 12;
  return `${String(h).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

/**
 * Una hora del día, en el estilo del portal.
 *
 * Reemplaza a `<input type="time">`, cuyo desplegable lo dibuja el navegador y
 * no se puede tocar: en Chrome son tres columnas azules que no se parecen a
 * nada más de la app. El valor sigue siendo `HH:mm` de 24 horas —lo que
 * guardan `horaEntrada` y `horaSalida`—; de 24 horas no queda nada a la vista.
 *
 * Se puede escribir o elegir. Escribir gana casi siempre cuando ya se sabe la
 * hora, y la lista sirve cuando se está tanteando; ninguna de las dos alcanza
 * sola. Los minutos de la lista van de a cinco: nadie *elige* 9:37, pero se
 * puede tipear.
 */
export function TimePicker({
  value,
  onChange,
  className,
}: {
  /** `HH:mm`, o vacío. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [arriba, setArriba] = useState(false);
  /** Alineado a la derecha del campo: si no, se corta contra el borde. */
  const [aLaDerecha, setALaDerecha] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const minutoRef = useRef<HTMLInputElement>(null);
  const meridianoRef = useRef<HTMLButtonElement>(null);

  /**
   * Lo tipeado, campo por campo. Se vuelca a `value` recién cuando la hora
   * está completa: "1:" a medio escribir no es ninguna hora.
   */
  const [borrador, setBorrador] = useState<{
    h: string;
    m: string;
    mer: string;
  } | null>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const actual = value ? partes(value) : null;

  const elegir = (hora12: number, minuto: number, meridiano: string) => {
    setBorrador(null);
    onChange(aValor(hora12, minuto, meridiano));
  };

  /** Lo que muestran los tres campos: el borrador si se está tipeando. */
  const campos = borrador ?? {
    h: actual ? String(actual.hora12) : "",
    m: actual ? String(actual.minuto).padStart(2, "0") : "",
    mer: actual?.meridiano ?? "",
  };

  /**
   * Guarda si los tres campos dicen algo; si no, deja el borrador quieto.
   *
   * Sin las tres partes no hay hora que guardar, y tampoco hay que borrar la
   * que estaba: alguien a mitad de tipear no está diciendo "sin hora".
   */
  function volcar(next: { h: string; m: string; mer: string }) {
    setBorrador(next);
    const h = Number(next.h);
    const m = Number(next.m);
    if (!next.h || !next.m || !next.mer) return;
    if (h < 1 || h > 12 || m > 59) return;
    setBorrador(null);
    onChange(aValor(h, m, next.mer));
  }

  /** Vaciar los tres es la forma de decir "no hay hora". */
  function limpiarSiVacio(next: { h: string; m: string; mer: string }) {
    if (!next.h && !next.m && !next.mer && value) onChange("");
  }

  const abrir = () => {
    if (!abierto && campoRef.current) {
      const rect = campoRef.current.getBoundingClientRect();
      setArriba(window.innerHeight - rect.bottom < 280);
      // El desplegable es más ancho que el campo —tres columnas— así que a la
      // derecha de la pantalla se salía de vista.
      setALaDerecha(window.innerWidth - rect.left < ANCHO + 16);
    }
    setAbierto(!abierto);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        className={cn(
          "flex h-9 w-full items-center gap-1.5 rounded-md border bg-background px-2 text-sm transition-colors",
          "focus-within:ring-2 focus-within:ring-ring"
        )}
      >
        <button
          type="button"
          onClick={abrir}
          aria-label="Elegir hora"
          className="flex-none text-muted-foreground hover:text-foreground"
        >
          <Clock className="h-4 w-4" />
        </button>
        {/* Tres campos y no uno: se tipea `9`, `30`, `a` y el foco va solo,
            que es lo que hacía bien el campo nativo. Solo números; el
            am/pm se cambia con la tecla A o P, o haciendo clic. */}
        <div className="flex flex-1 items-center gap-0.5 text-sm tabular-nums">
          <input
            ref={campoRef}
            type="text"
            inputMode="numeric"
            value={campos.h}
            placeholder="--"
            aria-label="Hora"
            className="w-5 bg-transparent text-right outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              const h = e.target.value.replace(/\D/g, "").slice(0, 2);
              const next = { ...campos, h };
              volcar(next);
              limpiarSiVacio(next);
              // Con dos dígitos, o con uno que ya no puede crecer (3 no puede
              // ser 3x), el siguiente número es del minuto.
              if (h.length === 2 || Number(h) > 1) minutoRef.current?.focus();
            }}
          />
          <span className={campos.h || campos.m ? "" : "text-muted-foreground"}>
            :
          </span>
          <input
            ref={minutoRef}
            type="text"
            inputMode="numeric"
            value={campos.m}
            placeholder="--"
            aria-label="Minutos"
            className="w-5 bg-transparent outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              const m = e.target.value.replace(/\D/g, "").slice(0, 2);
              const next = { ...campos, m };
              volcar(next);
              limpiarSiVacio(next);
              if (m.length === 2 || Number(m) > 5) meridianoRef.current?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !campos.m) campoRef.current?.focus();
            }}
          />
          <button
            ref={meridianoRef}
            type="button"
            aria-label="AM o PM"
            className={cn(
              "ml-0.5 whitespace-nowrap rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              campos.mer ? "" : "text-muted-foreground"
            )}
            onClick={() =>
              volcar({ ...campos, mer: campos.mer === "PM" ? "AM" : "PM" })
            }
            onKeyDown={(e) => {
              const k = e.key.toLowerCase();
              if (k === "a" || k === "p") {
                e.preventDefault();
                volcar({ ...campos, mer: k === "a" ? "AM" : "PM" });
              }
              if (e.key === "Backspace") {
                e.preventDefault();
                minutoRef.current?.focus();
              }
            }}
          >
            {campos.mer || "--"}
          </button>
        </div>
      </div>

      {abierto && (
        <div
          className={cn(
            "absolute z-50 w-56 rounded-md border bg-white p-2 shadow-lg",
            arriba ? "bottom-full mb-1" : "top-full mt-1",
            aLaDerecha ? "right-0" : "left-0"
          )}
        >
          <div className="grid grid-cols-3 gap-2">
            <Columna
              titulo="Hora"
              opciones={HORAS_12.map((h) => ({ valor: String(h), label: String(h) }))}
              activo={actual ? String(actual.hora12) : ""}
              onSelect={(h) =>
                elegir(Number(h), actual?.minuto ?? 0, actual?.meridiano ?? "AM")
              }
            />
            <Columna
              titulo="Min"
              opciones={MINUTOS.map((m) => ({
                valor: String(m),
                label: String(m).padStart(2, "0"),
              }))}
              activo={actual ? String(actual.minuto) : ""}
              onSelect={(m) =>
                elegir(actual?.hora12 ?? 12, Number(m), actual?.meridiano ?? "AM")
              }
            />
            <Columna
              titulo=""
              opciones={[
                { valor: "AM", label: "AM" },
                { valor: "PM", label: "PM" },
              ]}
              activo={actual?.meridiano ?? ""}
              onSelect={(mer) =>
                elegir(actual?.hora12 ?? 12, actual?.minuto ?? 0, mer)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Una de las columnas. Se desplaza sola hasta lo elegido al abrirse. */
function Columna({
  titulo,
  opciones,
  activo,
  onSelect,
}: {
  titulo: string;
  opciones: Array<{ valor: string; label: string }>;
  activo: string;
  onSelect: (valor: string) => void;
}) {
  const elegidoRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lista = listaRef.current;
    const elegido = elegidoRef.current;
    if (!lista || !elegido) return;
    // `scrollTop` a mano y no `scrollIntoView`: ese también desplaza a los
    // ancestros, así que abrir el reloj movía la página entera de golpe.
    // Solo al abrir: después, desplazarse mientras alguien mira la lista
    // sería moverle lo que está por tocar.
    lista.scrollTop =
      elegido.offsetTop - lista.clientHeight / 2 + elegido.clientHeight / 2;
  }, []);

  return (
    <div className="space-y-1">
      <p className="h-4 px-1 text-[11px] font-medium text-muted-foreground">
        {titulo}
      </p>
      <div ref={listaRef} className="max-h-44 overflow-y-auto pr-0.5">
        {opciones.map((o) => {
          const elegido = o.valor === activo;
          return (
            <button
              key={o.valor}
              ref={elegido ? elegidoRef : undefined}
              type="button"
              onClick={() => onSelect(o.valor)}
              className={cn(
                "block w-full rounded-md px-2 py-1 text-center text-sm tabular-nums transition-colors",
                elegido
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
