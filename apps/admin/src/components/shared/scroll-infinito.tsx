"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** Cuántos se agregan por tanda al llegar al pie. */
export const POR_TANDA = 20;

/**
 * Un listado que crece al llegar al final, en lugar de paginar.
 *
 * Es para móvil: pasar de página con el pulgar, en una barra de 40 px al pie,
 * es peor que seguir bajando. En escritorio la paginación sigue, que es donde
 * "ir a la página 3" tiene sentido y hay dónde clickear.
 *
 * `clave` es la firma de los filtros: cuando cambia, la lista vuelve a la
 * primera tanda. Va por parámetro y no por efecto para no reiniciar el conteo
 * *después* de pintar, que es lo que hace que se vea la lista larga un cuadro
 * antes de recortarse.
 */
/** Cuánto silencio hace falta para dar el scroll por terminado. */
const QUIETO_MS = 180;

/** El ancestro que scrollea, para saber cuándo se quedó quieto. */
function scrollerDe(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

/**
 * Avisa una vez cuando el pie se cruza **y** el scroll se quedó quieto.
 *
 * Lo comparten los dos modos —el que corta una lista que ya está y el que va
 * a buscar la tanda siguiente— porque el problema es el mismo: si la tanda
 * entra en el momento de llegar al fondo, la inercia del gesto se come el
 * espacio nuevo y la lista sigue corriendo sola cuando uno ya soltó.
 */
function alLlegarYQuedarQuieto(
  el: HTMLElement,
  alDisparar: () => void,
  alPedir?: () => void
) {
  const scroller = scrollerDe(el);
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let pedido = false;

  const reiniciar = () => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (pedido) alDisparar();
    }, QUIETO_MS);
  };

  const obs = new IntersectionObserver((entradas) => {
    if (!entradas[0].isIntersecting || pedido) return;
    pedido = true;
    alPedir?.();
    reiniciar();
  });
  obs.observe(el);

  // `scroll` no alcanza: contra el fondo la posición ya no cambia y deja de
  // dispararse, aunque el trackpad siga empujando. `wheel` y `touchmove` sí
  // avisan de que el gesto sigue vivo.
  const destino: (HTMLElement | Window)[] = scroller ? [scroller] : [window];
  for (const t of destino) {
    t.addEventListener("scroll", reiniciar, { passive: true });
    t.addEventListener("wheel", reiniciar, { passive: true });
    t.addEventListener("touchmove", reiniciar, { passive: true });
  }

  return () => {
    obs.disconnect();
    if (temporizador) clearTimeout(temporizador);
    for (const t of destino) {
      t.removeEventListener("scroll", reiniciar);
      t.removeEventListener("wheel", reiniciar);
      t.removeEventListener("touchmove", reiniciar);
    }
  };
}

/**
 * Lo mismo, pero para una lista que **pagina en el servidor**: en vez de
 * cortar algo que ya está, va a buscar la tanda siguiente.
 *
 * Acá el spinner no es decorativo — hay una consulta de verdad esperando.
 */
export function useCargaInfinita({
  hayMas,
  cargarMas,
}: {
  hayMas: boolean;
  cargarMas: () => Promise<void>;
}) {
  const [cargando, setCargando] = useState(false);
  /**
   * Cuántas tandas se trajeron. Es lo que rearma el observador después de cada
   * una — y tiene que ser esto y no `cargando`: con `cargando` en las
   * dependencias, prenderlo volvía a correr el efecto, cuya limpieza mataba el
   * temporizador que estaba por disparar la carga. El spinner giraba para
   * siempre y no llegaba nada.
   */
  const [tandas, setTandas] = useState(0);
  const centinela = useRef<HTMLDivElement>(null);
  // La función cambia en cada render (cierra sobre lo ya acumulado) y no puede
  // ser dependencia del efecto, o el observador se rearmaría sin parar. Se
  // guarda en un ref **desde un efecto**, no durante el render.
  const pedir = useRef(cargarMas);
  useEffect(() => {
    pedir.current = cargarMas;
  });

  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas) return;
    return alLlegarYQuedarQuieto(
      el,
      () => {
        pedir.current().finally(() => {
          setCargando(false);
          setTandas((n) => n + 1);
        });
      },
      () => setCargando(true)
    );
  }, [hayMas, tandas]);

  return { cargando, centinela };
}

export function useScrollInfinito(
  total: number,
  clave: string,
  porTanda: number = POR_TANDA
) {
  const [tanda, setTanda] = useState({ clave, n: porTanda });
  const cuantos = tanda.clave === clave ? tanda.n : porTanda;
  const visibles = Math.min(cuantos, total);
  const hayMas = visibles < total;
  const centinela = useRef<HTMLDivElement>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas) return;
    return alLlegarYQuedarQuieto(
      el,
      () => {
        setTanda((t) => ({
          clave,
          n: (t.clave === clave ? t.n : porTanda) + porTanda,
        }));
        setCargando(false);
      },
      () => setCargando(true)
    );
    // `visibles` está en las dependencias a propósito: al crecer la lista hay
    // que volver a observar. Un `IntersectionObserver` avisa de los *cambios*
    // de intersección, y si el pie seguía visible después de agregar la tanda
    // —porque las filas nuevas no llenaron la pantalla— no volvía a disparar
    // y la lista se quedaba trabada hasta que alguien tocara el scroll.
  }, [hayMas, clave, porTanda, visibles]);

  return { visibles, hayMas, cargando, centinela };
}

/**
 * El pie del listado: lo que dispara la tanda siguiente.
 *
 * Ocupa lugar **solo mientras queda algo por traer**; cuando la lista se
 * terminó desaparece, para que no quede una franja en blanco bajo la última
 * fila. Que se encoja no mueve nada: es el último elemento del scroll, así que
 * todo lo de arriba conserva su posición, y la tanda que entra es siempre más
 * alta que el pie, así que el navegador tampoco tiene que recortar el
 * `scrollTop`.
 *
 * Cuando ya no queda nada no dice nada. El total iba acá —"18 productos"— y
 * sobra: la lista termina y se ve que termina.
 */
export function PieScrollInfinito({
  hayMas,
  cargando,
  centinela,
}: {
  hayMas: boolean;
  /** Se llegó al pie y la tanda entra apenas se termine el envión. */
  cargando?: boolean;
  centinela: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={centinela}
      className={
        hayMas
          ? "flex h-10 flex-none items-center justify-center text-muted-foreground"
          : "h-0"
      }
      aria-hidden={!hayMas}
    >
      {hayMas && (cargando ?? true) && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
    </div>
  );
}
