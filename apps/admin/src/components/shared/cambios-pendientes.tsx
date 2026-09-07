"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface Pendiente {
  guardando: boolean;
  onGuardar: () => void;
  onDescartar: () => void;
}

interface Contexto {
  /** Lo que el header dibuja. `null` = no hay nada sin guardar. */
  pendiente: Pendiente | null;
  publicar: (p: Pendiente | null) => void;
}

const CambiosContext = createContext<Contexto | null>(null);

/**
 * Los cambios sin guardar de la pantalla que está abierta.
 *
 * Vive en el layout porque **la barra de guardar va en el header**, en lugar
 * del buscador: es la de Shopify. Guardar no puede quedar a un scroll de
 * distancia de lo que se acaba de escribir, y una barra propia por página
 * terminaba compitiendo con el header en vez de reemplazarlo.
 */
export function CambiosPendientesProvider({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const publicar = useCallback((p: Pendiente | null) => setPendiente(p), []);
  const valor = useMemo(() => ({ pendiente, publicar }), [pendiente, publicar]);

  return (
    <CambiosContext.Provider value={valor}>{children}</CambiosContext.Provider>
  );
}

/** Lo que lee el header. */
export function useCambiosPendientes(): Pendiente | null {
  return useContext(CambiosContext)?.pendiente ?? null;
}

/**
 * Lo que usa una página para publicar sus cambios sin guardar.
 *
 * Los handlers se recrean en cada tecla —cierran sobre el formulario— así que
 * lo que viaja al contexto son **envoltorios estables** que leen el último por
 * un ref. Sin eso, cada letra tipeada re-renderaría el layout entero; y
 * publicar el handler viejo guardaría lo de hace tres teclas.
 */
export function useRegistrarCambios(
  hayCambios: boolean,
  guardando: boolean,
  onGuardar: () => void,
  onDescartar: () => void
): void {
  const ultimos = useRef({ onGuardar, onDescartar });
  useEffect(() => {
    ultimos.current = { onGuardar, onDescartar };
  });

  const estables = useMemo(
    () => ({
      onGuardar: () => ultimos.current.onGuardar(),
      onDescartar: () => ultimos.current.onDescartar(),
    }),
    []
  );

  const publicar = useContext(CambiosContext)?.publicar;
  useEffect(() => {
    publicar?.(hayCambios ? { guardando, ...estables } : null);
  }, [publicar, hayCambios, guardando, estables]);

  // Al irse de la página no queda una barra ofreciendo guardar algo que ya no
  // está en pantalla.
  useEffect(() => () => publicar?.(null), [publicar]);
}
