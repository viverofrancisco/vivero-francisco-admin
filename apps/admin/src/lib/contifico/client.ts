/**
 * Cliente HTTP de Contífico.
 *
 * Particularidades verificadas contra la API real, que explican varias
 * decisiones de este módulo:
 *
 * - La autenticación es el API key crudo en `Authorization`, sin `Bearer`.
 * - `GET /producto/` **sin filtro se cuelga** (timeout a 240s) porque intenta
 *   devolver el catálogo entero. Siempre hay que mandar `filtro`, `codigo`,
 *   `categoria_id` o `fecha_inicial`.
 * - Las fechas van en `DD/MM/YYYY`, salvo `fecha_inicial` que va `YYYY-MM-DD`.
 * - Crear un producto con un código repetido devuelve 409 **con el id del que
 *   ya existe**, lo que hace que la sincronización sea idempotente sin buscar.
 */

const BASE = "https://api.contifico.com/sistema/api/v1";

export class ContificoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codError?: number,
    /** Contífico devuelve el id del recurso en conflicto en algunos 409. */
    readonly id?: string
  ) {
    super(message);
    this.name = "ContificoError";
  }
}

/** `true` si el error es "el producto ya existe" (código 1123). */
export function esProductoDuplicado(error: unknown): error is ContificoError {
  return error instanceof ContificoError && error.codError === 1123;
}

/**
 * `true` si el número de documento ya está usado.
 *
 * Pasa cuando la serie del portal ya tiene documentos emitidos por fuera: el
 * secuencial se deriva de lo que emitió el portal, y Contífico puede tener más.
 */
export function esDocumentoDuplicado(error: unknown): error is ContificoError {
  return (
    error instanceof ContificoError &&
    /documento ya existe/i.test(error.message)
  );
}

function apiKey(): string {
  const key = process.env.CONTIFICO_API_KEY;
  if (!key) {
    throw new ContificoError("Falta CONTIFICO_API_KEY en el entorno.", 0);
  }
  return key;
}

/** El campo `pos` que exige cada documento. Es el token, no el API key. */
export function posToken(): string {
  const token = process.env.CONTIFICO_TOKEN;
  if (!token) {
    throw new ContificoError("Falta CONTIFICO_TOKEN en el entorno.", 0);
  }
  return token;
}

export function contificoConfigurado(): boolean {
  return Boolean(process.env.CONTIFICO_API_KEY && process.env.CONTIFICO_TOKEN);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Timeout en ms. Contífico puede tardar; el default cubre el caso normal. */
  timeoutMs?: number;
}

export async function contificoRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: apiKey(),
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ContificoError(
        "Contífico no respondió a tiempo. Intentá de nuevo.",
        0
      );
    }
    throw new ContificoError(
      `No se pudo conectar con Contífico: ${(error as Error).message}`,
      0
    );
  } finally {
    clearTimeout(timeout);
  }

  const texto = await res.text();
  let datos: unknown = texto;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    // Se queda como texto; abajo se usa para el mensaje de error.
  }

  if (!res.ok) {
    const cuerpo = datos as
      | { mensaje?: string; cod_error?: number; id?: string }
      | undefined;
    throw new ContificoError(
      cuerpo?.mensaje ?? `Contífico respondió ${res.status}`,
      res.status,
      cuerpo?.cod_error,
      cuerpo?.id
    );
  }

  return datos as T;
}

/** Fecha en el formato que espera la mayoría de los endpoints: DD/MM/YYYY. */
export function fechaContifico(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
