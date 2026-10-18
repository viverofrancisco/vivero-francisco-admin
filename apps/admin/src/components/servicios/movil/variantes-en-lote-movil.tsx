"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import {
  ACCIONES_DE_VARIANTES_EN_LOTE,
  TITULO_DE_CAMPO_EN_LOTE,
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  cambiosDelLote,
  editableEnLote,
  resumenDelLote,
  valorInicialEnLote,
  type AccionDeVariantesEnLote,
  type CampoDeVarianteEnLote,
  type UnidadPeso,
} from "@vivero/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import type { VarianteFila } from "../producto-variantes";
import { CabeceraDeHoja, HojaCompleta, PastillaDeHoja, nombreDeVariante, pedir } from "./piezas";

interface RespuestaDelLote {
  editadas: number;
  errores: { id: string; nombre: string | null; motivo: string }[];
}

/** Manda el lote y avisa, nombrando lo que no se pudo. Es el de la app. */
async function mandarLote(productoId: string, cambios: Record<string, unknown>[]): Promise<boolean> {
  try {
    const r = await pedir<RespuestaDelLote>(`/api/servicios/${productoId}/variantes`, {
      method: "PATCH",
      body: { cambios },
    });
    const { titulo, detalle } = resumenDelLote(r);
    if (detalle) toast.error(titulo, { description: detalle });
    else toast.success(titulo);
    return r.editadas > 0;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    return false;
  }
}

/**
 * El drawer de *Editar* de la barra de selección, el de la app: las acciones
 * de `ACCIONES_DE_VARIANTES_EN_LOTE`. Un campo abre su pantalla; un
 * interruptor se aplica a todas las elegidas en el acto.
 */
export function AccionesDeVariantesEnLoteMovil({
  abierta,
  productoId,
  ids,
  onCerrar,
  onCampo,
}: {
  abierta: boolean;
  productoId: string;
  ids: string[];
  onCerrar: () => void;
  onCampo: (campo: CampoDeVarianteEnLote) => void;
}) {
  const router = useRouter();
  const [aplicando, setAplicando] = useState(false);

  async function elegir(a: AccionDeVariantesEnLote) {
    if (a.tipo === "campo") {
      onCerrar();
      setTimeout(() => onCampo(a.campo), 250);
      return;
    }
    setAplicando(true);
    const ok = await mandarLote(productoId, ids.map((id) => ({ id, [a.campo]: a.valor })));
    setAplicando(false);
    onCerrar();
    if (ok) router.refresh();
  }

  return (
    <Sheet open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetTitle className="px-4 pt-5 pb-1 text-center text-[17px] font-bold">
          {ids.length === 1 ? "1 variante" : `${ids.length} variantes`}
        </SheetTitle>
        <div className="max-h-[70vh] overflow-y-auto py-2">
          {ACCIONES_DE_VARIANTES_EN_LOTE.map((a, i) => (
            <button
              key={a.etiqueta}
              type="button"
              disabled={aplicando}
              onClick={() => elegir(a)}
              className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px] active:bg-muted disabled:opacity-50 ${
                a.tipo === "interruptor" && ACCIONES_DE_VARIANTES_EN_LOTE[i - 1]?.tipo === "campo"
                  ? "border-t-4 border-muted"
                  : "border-t"
              }`}
            >
              {a.etiqueta}
              {a.tipo === "campo" ? <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" /> : null}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * *Editar en lote* un campo, la pantalla de la app: cada variante con su caja,
 * **Aplicar a todas** arriba y *Guardar* en la cabecera, que manda solo lo que
 * cambió. El stock es un conteo.
 */
export function EditarVariantesEnLoteMovil({
  campo,
  productoId,
  productoNombre,
  variantes,
  onCerrar,
}: {
  campo: CampoDeVarianteEnLote;
  productoId: string;
  productoNombre: string;
  variantes: VarianteFila[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(variantes.map((v) => [v.id, valorInicialEnLote(v, campo)]))
  );
  const [todas, setTodas] = useState("");
  const [unidad, setUnidad] = useState<UnidadPeso>(variantes[0]?.pesoUnidad ?? "KG");
  const [guardando, setGuardando] = useState(false);

  const cambios = cambiosDelLote(campo, variantes, textos, campo === "peso" ? unidad : undefined);
  const numerico = campo !== "sku";
  const prefijo = campo === "precio" || campo === "costo" ? "$" : null;

  async function guardar() {
    if (cambios.length === 0) return onCerrar();
    setGuardando(true);
    const ok = await mandarLote(productoId, cambios);
    setGuardando(false);
    if (ok) {
      router.refresh();
      onCerrar();
    }
  }

  const caja = (valor: string, onChange: (t: string) => void, etiqueta: string, ancha = false) => (
    <span
      className={`flex h-10 items-center gap-1 rounded-[10px] border bg-card px-2.5 ${ancha ? "min-w-0 flex-1" : "w-32 flex-none"}`}
    >
      {prefijo ? <span className="text-muted-foreground">{prefijo}</span> : null}
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        inputMode={campo === "stock" ? "numeric" : numerico ? "decimal" : "text"}
        aria-label={etiqueta}
        autoCapitalize="none"
        className={`min-w-0 flex-1 bg-transparent text-base outline-none ${numerico ? "text-right tabular-nums" : ""}`}
      />
      {campo === "peso" && !ancha ? (
        <span className="text-sm text-muted-foreground">{UNIDAD_PESO_LABEL[unidad]}</span>
      ) : null}
    </span>
  );

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo={TITULO_DE_CAMPO_EN_LOTE[campo]}
        subtitulo={variantes.length === 1 ? "1 variante" : `${variantes.length} variantes`}
        cerrando="cancelar"
        onCerrar={onCerrar}
        derecha={
          <PastillaDeHoja
            texto="Guardar"
            primaria
            onClick={guardar}
            cargando={guardando}
            disabled={cambios.length === 0}
          />
        }
      />
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
        <div className="space-y-2 rounded-xl bg-muted p-3">
          <p className="text-[13px] font-semibold text-muted-foreground">Aplicar a todas</p>
          <div className="flex items-center gap-2">
            {caja(todas, setTodas, "Aplicar a todas", true)}
            <button
              type="button"
              disabled={todas.trim() === ""}
              onClick={() =>
                setTextos((t) =>
                  Object.fromEntries(
                    variantes.map((v) => [v.id, editableEnLote(v, campo) ? todas : (t[v.id] ?? "")])
                  )
                )
              }
              className="h-10 rounded-[10px] border border-primary bg-card px-3.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
          {campo === "peso" ? (
            <CustomSelect
              value={unidad}
              onChange={(u) => setUnidad(u as UnidadPeso)}
              options={UNIDADES_DE_PESO.map((u) => ({ value: u, label: UNIDAD_PESO_LABEL[u] }))}
            />
          ) : null}
        </div>

        <div className="divide-y rounded-xl border px-3">
          {variantes.map((v) => {
            const nombre = nombreDeVariante(v.valores, productoNombre);
            return (
              <div key={v.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-[15px]">{nombre}</span>
                {editableEnLote(v, campo) ? (
                  caja(textos[v.id] ?? "", (t) => setTextos((x) => ({ ...x, [v.id]: t })), nombre)
                ) : (
                  <span className="text-[13px] text-muted-foreground">No lleva inventario</span>
                )}
              </div>
            );
          })}
        </div>
        {campo === "stock" ? (
          <p className="text-[13px] text-muted-foreground">
            Escribe cuántas hay en el estante: el inventario anota la diferencia como un conteo.
          </p>
        ) : null}
      </div>
    </HojaCompleta>
  );
}
