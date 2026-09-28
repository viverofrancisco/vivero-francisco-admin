"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UNIDADES_DE_PESO, UNIDAD_PESO_LABEL, gananciaDeVenta, type UnidadPeso } from "@vivero/shared";
import { CustomSelect } from "@/components/ui/custom-select";
import { Textarea } from "@/components/ui/textarea";
import type { VarianteFila } from "../producto-variantes";
import { CabeceraDeHoja, CampoEnCaja, Casilla, HojaCompleta, PastillaDeHoja, dinero, numero, pedir } from "./piezas";

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 mb-2 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">{children}</p>
  );
}

export interface ProductoEditable {
  id: string;
  nombre: string;
  tipo: string;
  descripcionPlana: string;
  estado: "ACTIVO" | "BORRADOR";
  categoriaIds: string[];
}

/**
 * Editar el producto desde el teléfono: el formulario de la app, como una
 * hoja. Nombre, descripción y estado del producto, el SKU cuando hay una
 * sola variante y, en un bien sin opciones, lo de su variante única —precio,
 * costo con su ganancia, IVA, se cuenta, vender sin stock y peso—. El
 * producto va por `PUT` y la variante por su `PATCH`; con opciones cada
 * combinación lleva lo suyo en su ficha.
 *
 * La descripción se edita como texto plano, como en la app: el editor con
 * formato queda para el escritorio.
 */
export function EditarProductoMovil({
  producto,
  variante,
  onCerrar,
}: {
  producto: ProductoEditable;
  /** La única, si la hay: es la que se lee como del producto. */
  variante: VarianteFila | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const esBien = producto.tipo === "BIEN";
  const v = esBien ? variante : null;
  const [nombre, setNombre] = useState(producto.nombre);
  const [descripcion, setDescripcion] = useState(producto.descripcionPlana);
  const [estado, setEstado] = useState(producto.estado);
  const [codigo, setCodigo] = useState(variante?.sku ?? "");
  const [precio, setPrecio] = useState(v ? String(v.precio) : "");
  const [costo, setCosto] = useState(v?.costo != null ? String(v.costo) : "");
  const [cobraIva, setCobraIva] = useState(v?.cobraIva ?? true);
  const [manejaInventario, setManejaInventario] = useState(v?.manejaInventario ?? true);
  const [permiteNegativo, setPermiteNegativo] = useState(v?.permiteNegativo ?? false);
  const [peso, setPeso] = useState(v?.peso != null ? String(v.peso) : "");
  const [pesoUnidad, setPesoUnidad] = useState<UnidadPeso>(v?.pesoUnidad ?? "KG");
  const [guardando, setGuardando] = useState(false);

  const nPrecio = numero(precio);
  const nCosto = numero(costo);
  const nPeso = numero(peso);
  const cuenta = v ? gananciaDeVenta(nPrecio ?? 0, nCosto) : null;

  const guardar = async () => {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");
    if (v) {
      if (precio.trim() !== "" && (nPrecio === null || nPrecio < 0)) return toast.error("El precio no es un número válido");
      if (costo.trim() !== "" && (nCosto === null || nCosto < 0)) return toast.error("El costo no es un número válido");
      if (peso.trim() !== "" && (nPeso === null || nPeso < 0)) return toast.error("El peso no es un número válido");
    }
    setGuardando(true);
    try {
      await pedir(`/api/servicios/${producto.id}`, {
        method: "PUT",
        body: {
          nombre: nombre.trim(),
          tipo: producto.tipo,
          descripcion: descripcion.trim(),
          estado,
          categoriaIds: producto.categoriaIds,
          ...(variante ? { codigo: codigo.trim() || null } : {}),
        },
      });
      if (v) {
        await pedir(`/api/variantes/${v.id}`, {
          method: "PATCH",
          body: {
            precio: nPrecio ?? v.precio,
            costo: nCosto,
            cobraIva,
            manejaInventario,
            permiteNegativo,
            peso: nPeso,
            pesoUnidad,
          },
        });
      }
      router.refresh();
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar los cambios");
      setGuardando(false);
    }
  };

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo="Editar producto"
        onCerrar={onCerrar}
        cerrando="cancelar"
        derecha={<PastillaDeHoja texto="Guardar" primaria onClick={() => void guardar()} disabled={!nombre.trim()} cargando={guardando} />}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <Rotulo>Producto</Rotulo>
        <CampoEnCaja etiqueta="Nombre *" valor={nombre} onCambio={setNombre} limpiable={false} />
        <div className="mb-2.5 rounded-xl border bg-card px-3 pt-1.5 pb-1">
          <p className="text-xs text-muted-foreground">Descripción</p>
          <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} className="border-0 px-0 shadow-none focus-visible:ring-0" />
        </div>

        <Rotulo>Tipo</Rotulo>
        <div className="rounded-xl bg-muted px-3.5 py-3">
          <p className="text-base font-medium">{esBien ? "Bien" : "Servicio"}</p>
          <p className="text-xs text-muted-foreground">No se puede cambiar después de crear el producto.</p>
        </div>

        <Rotulo>Estado</Rotulo>
        <CustomSelect
          value={estado}
          onChange={(e) => setEstado(e as "ACTIVO" | "BORRADOR")}
          options={[
            { value: "ACTIVO", label: "Activo" },
            { value: "BORRADOR", label: "Borrador", hint: "No aparece al armar una orden" },
          ]}
        />

        {variante ? (
          <>
            <Rotulo>SKU</Rotulo>
            <CampoEnCaja etiqueta="SKU" valor={codigo} onCambio={setCodigo} />
            <p className="-mt-1 px-1 text-[13px] text-muted-foreground">Sale impreso en la factura y es lo que va en la etiqueta.</p>
          </>
        ) : null}

        {v ? (
          <>
            <Rotulo>Precio e inventario</Rotulo>
            <CampoEnCaja etiqueta="Precio de lista" valor={precio} onCambio={setPrecio} prefijo="$" inputMode="decimal" placeholder="0.00" />
            <CampoEnCaja etiqueta="Costo por unidad" valor={costo} onCambio={setCosto} prefijo="$" inputMode="decimal" />
            <p className="-mt-1 mb-2 px-1 text-[13px] text-muted-foreground">
              Lo que costó tenerla. No se imprime en ningún lado.
              {cuenta ? ` Ganancia ${cuenta.ganancia > 0 ? "+" : ""}${dinero(cuenta.ganancia)}${cuenta.margen === null ? "" : ` · Margen ${cuenta.margen > 0 ? "+" : ""}${cuenta.margen}%`}` : ""}
            </p>
            <Casilla etiqueta="Cobrar IVA" nota="La tasa es la del producto." marcada={cobraIva} onCambio={setCobraIva} />
            <Casilla etiqueta="Se cuenta" nota="Apagado, se puede vender siempre." marcada={manejaInventario} onCambio={setManejaInventario} />
            {manejaInventario ? (
              <Casilla etiqueta="Vender sin stock" nota="Contra pedido: deja que la cantidad quede en negativo." marcada={permiteNegativo} onCambio={setPermiteNegativo} />
            ) : null}
            <Rotulo>Peso</Rotulo>
            <CampoEnCaja etiqueta="Peso" valor={peso} onCambio={setPeso} inputMode="decimal" />
            <CustomSelect value={pesoUnidad} onChange={(u) => setPesoUnidad(u as UnidadPeso)} options={UNIDADES_DE_PESO.map((u) => ({ value: u, label: UNIDAD_PESO_LABEL[u] }))} />
            <p className="mt-2 px-1 text-[13px] text-muted-foreground">Lo que pesa una unidad, como lo dice la bolsa o la etiqueta.</p>
          </>
        ) : null}
        {esBien && !variante ? (
          <p className="mt-4 px-1 text-[13px] text-muted-foreground">
            Este producto tiene opciones: el precio, el costo, el stock y el peso son de cada variante.
          </p>
        ) : null}
      </div>
    </HojaCompleta>
  );
}
