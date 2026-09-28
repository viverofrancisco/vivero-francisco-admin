"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UNIDADES_DE_PESO, UNIDAD_PESO_LABEL, gananciaDeVenta, type UnidadPeso } from "@vivero/shared";
import { Check, ChevronRight, ImagePlus, Minus, Plus, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import type { VarianteFila } from "../producto-variantes";
import type { ImagenProducto } from "../producto-imagenes";
import { SelectorFotoDeVariante } from "../selector-foto-de-variante";
import type { MediaItem } from "../media-library";
import {
  CabeceraDeHoja,
  CampoEnCaja,
  Casilla,
  Fila,
  HojaCompleta,
  PastillaDeHoja,
  Seccion,
  dinero,
  nombreDeVariante,
  numero,
  pedir,
  pesoTexto,
  precioTexto,
} from "./piezas";

/** Lo que las hojas necesitan del producto. */
export interface ProductoParaVariantes {
  id: string;
  nombre: string;
  imagenes: ImagenProducto[];
}

/**
 * Lo que se vende, como lo muestra Shopify en la variante y como lo dibuja
 * la app: el precio como un renglón que abre su hoja, y el inventario como
 * una sección con *Editar* y la cantidad en una pastilla que abre *Ajustar
 * stock*. Es el cuerpo de la ficha de la variante **y** de la ficha de un
 * bien sin opciones. Cada hoja guarda en el acto y la página se refresca.
 */
export function CuerpoDeVarianteMovil({ variante }: { variante: VarianteFila }) {
  const [hoja, setHoja] = useState<"precio" | "inventario" | "stock" | null>(null);
  const cuenta = gananciaDeVenta(variante.precio, variante.costo);
  const pierde = cuenta !== null && cuenta.ganancia < 0;
  const ambar = pierde ? "font-semibold text-amber-700" : "";

  return (
    <>
      <Seccion titulo="Precio">
        <Fila etiqueta="Precio de lista" valor={precioTexto(variante.precio)} onClick={() => setHoja("precio")} />
        <Fila etiqueta="Costo por unidad" valor={variante.costo === null ? "—" : dinero(variante.costo)} onClick={() => setHoja("precio")} />
        {cuenta ? (
          <Fila etiqueta="Ganancia" valor={<span className={ambar}>{cuenta.ganancia > 0 ? "+" : ""}{dinero(cuenta.ganancia)}</span>} />
        ) : null}
        {cuenta ? (
          <Fila etiqueta="Margen" valor={<span className={ambar}>{cuenta.margen === null ? "—" : `${cuenta.margen > 0 ? "+" : ""}${cuenta.margen}%`}</span>} />
        ) : null}
        <Fila etiqueta="Cobrar IVA" valor={variante.cobraIva ? "Sí" : "No"} onClick={() => setHoja("precio")} />
      </Seccion>

      <Seccion titulo="Inventario" accion={{ etiqueta: "Editar", onClick: () => setHoja("inventario") }}>
        {variante.manejaInventario ? (
          <Fila
            etiqueta="Disponible"
            valor={
              <button
                type="button"
                onClick={() => setHoja("stock")}
                className={`min-w-14 rounded-full border px-4 py-1 text-center text-base font-semibold active:bg-muted ${
                  variante.stock <= 0 ? "text-amber-700" : ""
                }`}
              >
                {variante.stock}
              </button>
            }
          />
        ) : (
          <Fila etiqueta="Disponible" valor="No se cuenta" />
        )}
        {variante.manejaInventario ? <Fila etiqueta="Vender sin stock" valor={variante.permiteNegativo ? "Sí" : "No"} /> : null}
        <Fila etiqueta="SKU" valor={variante.sku || "—"} />
        <Fila etiqueta="Peso" valor={pesoTexto(variante)} />
      </Seccion>

      {hoja === "precio" ? <HojaPrecioMovil variante={variante} onCerrar={() => setHoja(null)} /> : null}
      {hoja === "inventario" ? <HojaInventarioMovil variante={variante} onCerrar={() => setHoja(null)} /> : null}
      {hoja === "stock" ? <HojaAjustarStockMovil variante={variante} onCerrar={() => setHoja(null)} /> : null}
    </>
  );
}

/** Guarda por el `PATCH` de la variante y refresca la página. */
function useGuardar(varianteId: string, onCerrar: () => void, fallo: string) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const guardar = async (body: Record<string, unknown>) => {
    setGuardando(true);
    try {
      await pedir(`/api/variantes/${varianteId}`, { method: "PATCH", body });
      router.refresh();
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallo);
      setGuardando(false);
    }
  };
  return { guardar, guardando };
}

/** El precio: precio y costo en sus cajas, el margen y la ganancia en tarjetas, y la casilla del IVA. */
function HojaPrecioMovil({ variante, onCerrar }: { variante: VarianteFila; onCerrar: () => void }) {
  const [precio, setPrecio] = useState(String(variante.precio));
  const [costo, setCosto] = useState(variante.costo === null ? "" : String(variante.costo));
  const [cobraIva, setCobraIva] = useState(variante.cobraIva);
  const { guardar, guardando } = useGuardar(variante.id, onCerrar, "No pudimos guardar el precio");
  const nPrecio = numero(precio);
  const nCosto = numero(costo);
  const cuenta = gananciaDeVenta(nPrecio ?? 0, nCosto);
  const pierde = cuenta !== null && cuenta.ganancia < 0;
  const hayCambios = (nPrecio ?? variante.precio) !== variante.precio || nCosto !== variante.costo || cobraIva !== variante.cobraIva;

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo="Precio"
        subtitulo={nombreDeVariante(variante.valores, "")}
        onCerrar={onCerrar}
        cerrando={hayCambios ? "cancelar" : "cerrar"}
        derecha={
          <PastillaDeHoja
            texto="Guardar"
            primaria
            disabled={!hayCambios}
            cargando={guardando}
            onClick={() => {
              if (precio.trim() !== "" && (nPrecio === null || nPrecio < 0)) return toast.error("El precio no es un número válido");
              if (costo.trim() !== "" && (nCosto === null || nCosto < 0)) return toast.error("El costo no es un número válido");
              void guardar({ precio: nPrecio ?? variante.precio, costo: nCosto, cobraIva });
            }}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <CampoEnCaja etiqueta="Precio de lista" valor={precio} onCambio={setPrecio} prefijo="$" inputMode="decimal" placeholder="0.00" />
        <CampoEnCaja etiqueta="Costo por unidad" valor={costo} onCambio={setCosto} prefijo="$" inputMode="decimal" />
        <p className="-mt-1 mb-3 px-1 text-[13px] text-muted-foreground">Lo que costó tenerla. No se imprime en ningún lado.</p>
        <div className="mb-2 flex gap-3">
          <div className="flex-1 rounded-xl bg-muted px-3.5 py-3">
            <p className="text-[15px] font-semibold text-muted-foreground">Margen</p>
            <p className={`text-lg font-bold ${pierde ? "text-amber-700" : ""}`}>{cuenta && cuenta.margen !== null ? `${cuenta.margen}%` : "—"}</p>
          </div>
          <div className="flex-1 rounded-xl bg-muted px-3.5 py-3">
            <p className="text-[15px] font-semibold text-muted-foreground">Ganancia</p>
            <p className={`text-lg font-bold ${pierde ? "text-amber-700" : ""}`}>{cuenta ? dinero(cuenta.ganancia) : "—"}</p>
          </div>
        </div>
        <Casilla etiqueta="Cobrar IVA" nota="La tasa es la del producto." marcada={cobraIva} onCambio={setCobraIva} />
      </div>
    </HojaCompleta>
  );
}

/** El inventario: si se cuenta, si se vende sin stock, el SKU y el peso con su unidad. */
function HojaInventarioMovil({ variante, onCerrar }: { variante: VarianteFila; onCerrar: () => void }) {
  const [manejaInventario, setManejaInventario] = useState(variante.manejaInventario);
  const [permiteNegativo, setPermiteNegativo] = useState(variante.permiteNegativo);
  const [sku, setSku] = useState(variante.sku ?? "");
  const [peso, setPeso] = useState(variante.peso === null ? "" : String(variante.peso));
  const [pesoUnidad, setPesoUnidad] = useState<UnidadPeso>(variante.pesoUnidad);
  const { guardar, guardando } = useGuardar(variante.id, onCerrar, "No pudimos guardar el inventario");
  const nPeso = numero(peso);
  const hayCambios =
    manejaInventario !== variante.manejaInventario ||
    permiteNegativo !== variante.permiteNegativo ||
    (sku.trim() || null) !== variante.sku ||
    nPeso !== variante.peso ||
    pesoUnidad !== variante.pesoUnidad;

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo="Inventario"
        subtitulo={nombreDeVariante(variante.valores, "")}
        onCerrar={onCerrar}
        cerrando={hayCambios ? "cancelar" : "cerrar"}
        derecha={
          <PastillaDeHoja
            texto="Guardar"
            primaria
            disabled={!hayCambios}
            cargando={guardando}
            onClick={() => {
              if (peso.trim() !== "" && (nPeso === null || nPeso < 0)) return toast.error("El peso no es un número válido");
              void guardar({ manejaInventario, permiteNegativo, sku: sku.trim() || null, peso: nPeso, pesoUnidad });
            }}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <Casilla etiqueta="Se cuenta" nota="Apagado, se puede vender siempre. Con stock cargado, primero llévalo a cero." marcada={manejaInventario} onCambio={setManejaInventario} />
        {manejaInventario ? (
          <Casilla etiqueta="Vender sin stock" nota="Contra pedido: deja que la cantidad quede en negativo." marcada={permiteNegativo} onCambio={setPermiteNegativo} />
        ) : null}
        <p className="mt-3 mb-2 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">SKU</p>
        <CampoEnCaja etiqueta="SKU" valor={sku} onCambio={setSku} />
        <p className="-mt-1 mb-3 px-1 text-[13px] text-muted-foreground">Sale impreso en la factura y es lo que va en la etiqueta.</p>
        <p className="mb-2 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">Peso</p>
        <CampoEnCaja etiqueta="Peso" valor={peso} onCambio={setPeso} inputMode="decimal" />
        <CustomSelect
          value={pesoUnidad}
          onChange={(u) => setPesoUnidad(u as UnidadPeso)}
          options={UNIDADES_DE_PESO.map((u) => ({ value: u, label: UNIDAD_PESO_LABEL[u] }))}
        />
        <p className="mt-2 px-1 text-[13px] text-muted-foreground">Lo que pesa una unidad, como lo dice la bolsa o la etiqueta.</p>
      </div>
    </HojaCompleta>
  );
}

type Motivo = "AJUSTE" | "CONTEO" | "INGRESO";
const MOTIVOS: { clave: Motivo; etiqueta: string }[] = [
  { clave: "AJUSTE", etiqueta: "Corrección (predeterminado)" },
  { clave: "CONTEO", etiqueta: "Conteo" },
  { clave: "INGRESO", etiqueta: "Entró mercadería" },
];

/**
 * Ajustar stock, la pantalla de Shopify: el número grande con − y +, que es
 * en cuánto va a quedar; el motivo en un renglón que abre la lista; y la
 * tarjeta con el antes y el después. Al guardar se traduce al libro: *Conteo*
 * manda cuánto hay y los otros dos la diferencia.
 */
function HojaAjustarStockMovil({ variante, onCerrar }: { variante: VarianteFila; onCerrar: () => void }) {
  const router = useRouter();
  const [texto, setTexto] = useState(String(variante.stock));
  const [motivo, setMotivo] = useState<Motivo>("AJUSTE");
  const [nota, setNota] = useState("");
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nuevo = numero(texto);
  const valido = nuevo !== null && Number.isInteger(nuevo);
  const diferencia = valido ? nuevo - variante.stock : 0;
  const hayCambios = valido && diferencia !== 0;
  const impedimento = !valido
    ? "Escribe un número entero."
    : nuevo < 0 && !variante.permiteNegativo
      ? "Esta variante no se vende sin stock: no puede quedar en negativo."
      : motivo === "INGRESO" && diferencia < 0
        ? "Entró mercadería solo suma. Para restar, elige Corrección."
        : null;

  const mover = (paso: number) => setTexto(String((valido ? nuevo : variante.stock) + paso));

  const guardar = async () => {
    if (!hayCambios || impedimento || nuevo === null) return;
    setGuardando(true);
    try {
      await pedir(`/api/variantes/${variante.id}/movimientos`, {
        method: "POST",
        body:
          motivo === "CONTEO"
            ? { motivo, contado: nuevo, nota: nota.trim() || null }
            : { motivo, cantidad: diferencia, nota: nota.trim() || null },
      });
      router.refresh();
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar el movimiento");
      setGuardando(false);
    }
  };

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo={nombreDeVariante(variante.valores, "Ajustar stock")}
        onCerrar={onCerrar}
        cerrando="cancelar"
        derecha={<PastillaDeHoja texto="Guardar" primaria onClick={() => void guardar()} disabled={!hayCambios || !!impedimento} cargando={guardando} />}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="text-center text-[13px] font-semibold text-muted-foreground">Disponible</p>
        <div className="flex items-center justify-center gap-4 py-4">
          <button type="button" onClick={() => mover(-1)} aria-label="Uno menos" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-60">
            <Minus className="h-[22px] w-[22px]" />
          </button>
          <div className="flex h-[60px] min-w-[136px] items-center justify-center rounded-full border px-5">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              inputMode={variante.permiteNegativo ? "text" : "numeric"}
              onFocus={(e) => e.target.select()}
              className={`w-24 bg-transparent text-center text-3xl font-bold tabular-nums outline-none ${nuevo !== null && nuevo < 0 ? "text-amber-700" : ""}`}
            />
          </div>
          <button type="button" onClick={() => mover(1)} aria-label="Uno más" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-60">
            <Plus className="h-[22px] w-[22px]" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setEligiendo(true)}
          className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] active:bg-muted"
        >
          <span>Motivo</span>
          <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="truncate">{MOTIVOS.find((m) => m.clave === motivo)?.etiqueta}</span>
            <ChevronRight className="h-4 w-4 flex-none" />
          </span>
        </button>
        <div className="mb-3 overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between bg-primary/5 px-3.5 py-3 text-[15px]">
            <span className="font-semibold">Disponible</span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="font-semibold">{variante.stock}</span>
              <span className="text-muted-foreground">→</span>
              <span className={`font-bold ${nuevo !== null && nuevo < 0 ? "text-amber-700" : "text-primary"}`}>{valido ? nuevo : "—"}</span>
            </span>
          </div>
          <div className="flex items-center justify-between border-t px-3.5 py-3 text-[15px] text-muted-foreground">
            <span>Diferencia</span>
            <span className="tabular-nums">{valido ? `${diferencia > 0 ? "+" : ""}${diferencia}` : "—"}</span>
          </div>
        </div>
        <CampoEnCaja etiqueta="Nota" valor={nota} onCambio={setNota} placeholder="Opcional" />
        {impedimento && hayCambios ? <p className="text-sm text-destructive">{impedimento}</p> : null}
      </div>

      <Sheet open={eligiendo} onOpenChange={(o) => !o && setEligiendo(false)}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetTitle className="px-4 pt-5 pb-1 text-center text-[17px] font-bold">Motivo del ajuste</SheetTitle>
          <div className="py-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.clave}
                type="button"
                onClick={() => {
                  setMotivo(m.clave);
                  setEligiendo(false);
                }}
                className="flex w-full items-center justify-between border-t px-4 py-3.5 text-left text-[16px] active:bg-muted"
              >
                {m.etiqueta}
                {motivo === m.clave ? <Check className="h-5 w-5" /> : null}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </HojaCompleta>
  );
}

/** La lista de variantes: miniatura, nombre, "$16.00 • 578 disponibles", SKU, y un filtro. */
export function ListaDeVariantesMovil({
  producto,
  variantes,
  onCerrar,
}: {
  producto: ProductoParaVariantes;
  variantes: VarianteFila[];
  onCerrar: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const q = filtro.trim().toLowerCase();
  const filas = q
    ? variantes.filter((v) => nombreDeVariante(v.valores, producto.nombre).toLowerCase().includes(q) || (v.sku ?? "").toLowerCase().includes(q))
    : variantes;
  const abierta = variantes.find((v) => v.id === abiertaId) ?? null;
  const fotoDe = (v: VarianteFila) => producto.imagenes.find((i) => i.id === v.imagenId) ?? producto.imagenes[0] ?? null;

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja titulo="Variantes" subtitulo={`${variantes.length} ${variantes.length === 1 ? "variante" : "variantes"}`} onCerrar={onCerrar} />
      <div className="flex-none px-3 py-2">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar variantes" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filas.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Ninguna variante coincide.</p> : null}
        {filas.map((v) => {
          const foto = fotoDe(v);
          return (
            <button key={v.id} type="button" onClick={() => setAbiertaId(v.id)} className="flex w-full items-center gap-3.5 border-b px-4 py-3 text-left active:bg-muted">
              <span className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[10px] border bg-muted">
                {foto ? <Image src={foto.url} alt="" fill sizes="52px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus className="h-5 w-5" /></span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{nombreDeVariante(v.valores, producto.nombre)}</span>
                <span className="block truncate text-[15px] text-muted-foreground">
                  {precioTexto(v.precio)} • {v.manejaInventario ? `${v.stock} disponibles` : "No se cuenta"}
                </span>
                <span className="block truncate text-sm text-muted-foreground">{v.sku ? `SKU ${v.sku}` : "Sin SKU"}</span>
              </span>
              <ChevronRight className="h-[18px] w-[18px] flex-none text-muted-foreground" />
            </button>
          );
        })}
      </div>
      {abierta ? <FichaDeVarianteMovil variante={abierta} producto={producto} onCerrar={() => setAbiertaId(null)} /> : null}
    </HojaCompleta>
  );
}

/** La ficha de una variante: la foto con el nombre, qué valor tiene en cada eje, y el cuerpo. */
export function FichaDeVarianteMovil({
  variante,
  producto,
  onCerrar,
}: {
  variante: VarianteFila;
  producto: ProductoParaVariantes;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const foto = producto.imagenes.find((i) => i.id === variante.imagenId) ?? producto.imagenes[0] ?? null;

  /** El archivo elegido, como fila del producto: si no la tiene, se le suma en el acto. */
  const elegirFoto = async (media: MediaItem | null) => {
    setEligiendoFoto(false);
    try {
      let imagenId: string | null = null;
      if (media) {
        const enElProducto = producto.imagenes.find((i) => i.mediaId === media.id);
        if (enElProducto) imagenId = enElProducto.id;
        else {
          const { imagenes } = await pedir<{ imagenes: ImagenProducto[] }>(`/api/servicios/${producto.id}/imagenes`, {
            method: "POST",
            body: { mediaIds: [media.id] },
          });
          imagenId = imagenes.find((i) => i.mediaId === media.id)?.id ?? null;
        }
      }
      await pedir(`/api/variantes/${variante.id}`, { method: "PATCH", body: { imagenId } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar la foto");
    }
  };

  return (
    <HojaCompleta onCerrar={onCerrar} className="bg-background">
      <CabeceraDeHoja titulo="" onCerrar={onCerrar} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <div className="flex items-center gap-4 pt-3">
          <button type="button" onClick={() => setEligiendoFoto(true)} aria-label="Elegir la foto de la variante" className="relative h-[88px] w-[88px] flex-none overflow-hidden rounded-[14px] border bg-muted active:opacity-70">
            {foto ? <Image src={foto.url} alt="" fill sizes="88px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center"><Plus className="h-6 w-6" /></span>}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold">{nombreDeVariante(variante.valores, producto.nombre)}</p>
            <p className="truncate text-base text-muted-foreground">{producto.nombre}</p>
          </div>
        </div>
        {variante.valores.length > 0 ? (
          <Seccion titulo="Opciones">
            {variante.valores.map((v) => (
              <Fila key={v.valorId} etiqueta={v.opcion} valor={v.valor} />
            ))}
          </Seccion>
        ) : null}
        <CuerpoDeVarianteMovil variante={variante} />
      </div>
      {eligiendoFoto ? (
        <SelectorFotoDeVariante imagenes={producto.imagenes} imagenId={variante.imagenId} onListo={(media) => void elegirFoto(media)} onCerrar={() => setEligiendoFoto(false)} />
      ) : null}
    </HojaCompleta>
  );
}
