"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { RichText } from "@/components/ui/rich-text";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { SelectorCategorias } from "./selector-categorias";
import { ArrowLeft } from "lucide-react";

interface Categoria {
  id: string;
  nombre: string;
}

/**
 * Dar de alta un producto: la misma pantalla que su ficha, pero vacía.
 *
 * **Solo el nombre hace falta.** Todo lo demás se puede completar después, en la
 * ficha, y exigirlo acá obliga a decidir el código, la categoría y el IVA antes
 * de tener el producto — cuando muchas veces se lo está creando justo para poder
 * seguir con otra cosa.
 *
 * Lo que **no** está acá son las fotos, el inventario y las variantes: todas
 * necesitan un producto ya creado al que colgarse. Aparecen en la ficha, adonde
 * se llega al guardar.
 *
 * Se guarda desde la barra de arriba, igual que en la ficha: no hay un botón
 * *Crear* al pie porque entonces habría dos formas de guardar un producto según
 * en qué pantalla se esté.
 */
export function ServicioForm({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  const vacio = {
    nombre: "",
    codigo: "",
    descripcion: "",
    tipo: "SERVICIO" as "SERVICIO" | "BIEN",
    estado: "ACTIVO" as "ACTIVO" | "BORRADOR",
    categoriaIds: [] as string[],
  };
  const [form, setForm] = useState(vacio);

  // Cualquier cosa escrita cuenta: en una pantalla de alta no hay "lo guardado"
  // contra qué comparar, y descartar tiene que poder limpiar lo tipeado.
  const hayCambios = JSON.stringify(form) !== JSON.stringify(vacio);

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error("El producto necesita un nombre");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          // Vacío es vacío, no cadena vacía: el código es único y dos productos
          // con "" chocarían entre sí.
          codigo: form.codigo.trim() || null,
          descripcion: form.descripcion || null,
          tipo: form.tipo,
          estado: form.estado,
          categoriaIds: form.categoriaIds,
        }),
      });
      const data: { id?: string; error?: string } = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "No pudimos crearlo");
      }
      toast.success("Producto creado");
      // A su ficha y no al listado: recién ahí están las fotos, las variantes y
      // el inventario, que es lo que sigue después de darlo de alta.
      router.push(`/dashboard/productos/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crearlo");
      setGuardando(false);
    }
  }

  useRegistrarCambios(hayCambios, guardando, guardar, () => setForm(vacio));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/productos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        {/* El nombre a medida que se escribe, como en la ficha: la pantalla es
            la misma y el título tiene que comportarse igual. */}
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {form.nombre.trim() || "Nuevo producto"}
        </h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Poda de setos"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ej: MANT-01"
                />
                <p className="text-xs text-muted-foreground">
                  Sale impreso en la factura. Vacío, se usa uno derivado del
                  producto.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <RichText
                  value={form.descripcion}
                  onChange={(html) => setForm({ ...form, descripcion: html })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Las fotos, el inventario y las variantes necesitan un producto al
              que colgarse. Decirlo es mejor que dejar la pantalla más corta que
              la ficha sin explicar por qué. */}
          <p className="text-sm text-muted-foreground">
            Las fotos
            {form.tipo === "BIEN" ? ", las variantes y el inventario" : ""} se
            cargan después de guardar.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                value={form.estado}
                onChange={(v) =>
                  setForm({ ...form, estado: v as "ACTIVO" | "BORRADOR" })
                }
                options={[
                  { value: "ACTIVO", label: "Activo" },
                  {
                    value: "BORRADOR",
                    label: "Borrador",
                    hint: "No aparece al armar una orden",
                  },
                ]}
              />
              <div className="space-y-2 border-t pt-3">
                <Label>Tipo *</Label>
                {/* Acá sí se elige: después de creado es inmutable, porque
                    cambiarlo dejaría suscripciones, visitas y líneas de orden
                    con una semántica que ya no corresponde. */}
                <CustomSelect
                  value={form.tipo}
                  onChange={(v) =>
                    setForm({ ...form, tipo: v as "SERVICIO" | "BIEN" })
                  }
                  options={[
                    {
                      value: "SERVICIO",
                      label: "Servicio",
                      hint: "Un trabajo. No lleva inventario",
                    },
                    {
                      value: "BIEN",
                      label: "Bien",
                      hint: "Se cuenta y puede tener variantes",
                    },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  No se puede cambiar después.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay categorías creadas.
                </p>
              ) : (
                <SelectorCategorias
                  categorias={categorias}
                  value={form.categoriaIds}
                  onChange={(ids) => setForm({ ...form, categoriaIds: ids })}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
