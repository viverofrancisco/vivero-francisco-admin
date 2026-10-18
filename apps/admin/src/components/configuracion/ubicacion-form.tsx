"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, MoreHorizontal } from "lucide-react";
import {
  DIAS_DE_LA_SEMANA,
  HORARIO_POR_DEFECTO,
  HORAS_DEL_HORARIO,
  horaLegible,
  textoDelHorario,
  type HorarioSemanal,
  type Ubicacion,
} from "@vivero/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import { SelectorCiudad } from "@/components/shared/selector-ciudad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TarjetaSeccion } from "@/components/shared/tarjeta-seccion";
import { EncabezadoFormularioMovil } from "@/components/shared/encabezado-formulario-movil";
import { BOTON_REDONDO_MOVIL, ICONO_BOTON_REDONDO } from "@/components/shared/boton-redondo-movil";

/** El editor del pin de las propiedades: busca y mueve el mapa, el pin lo pone el dedo. */
const MapaPropiedad = dynamic(
  () => import("@/components/clientes/mapa-propiedad").then((m) => m.MapaPropiedad),
  { ssr: false, loading: () => <div className="h-[450px] animate-pulse rounded-xl bg-muted" /> }
);

type Campos = {
  nombre: string;
  direccion: string;
  ciudad: string;
  referencia: string;
  telefono: string;
  horarios: HorarioSemanal;
  lat: number | null;
  lng: number | null;
  retiro: boolean;
  activa: boolean;
};

function desde(u: Ubicacion | null): Campos {
  return {
    nombre: u?.nombre ?? "",
    direccion: u?.direccion ?? "",
    ciudad: u?.ciudad ?? "Guayaquil",
    referencia: u?.referencia ?? "",
    telefono: u?.telefono ?? "",
    // Una sin horario cargado arranca con el de siempre, listo para corregir.
    // Las claves en un orden fijo: Postgres guarda el JSON reordenado
    // (`desde`, `hasta`, `abierto`) y la comparación de "hay cambios" daba
    // siempre que sí, así que la barra no se apagaba al guardar.
    horarios: (u?.horarios ?? HORARIO_POR_DEFECTO).map((d) => ({
      abierto: d.abierto,
      desde: d.desde,
      hasta: d.hasta,
    })),
    lat: u?.lat ?? null,
    lng: u?.lng ?? null,
    retiro: u?.retiro ?? true,
    activa: u?.activa ?? true,
  };
}

const FORM_ID = "ubicacion-form";

/**
 * Crear o editar una ubicación, el *Add location* de Shopify: el nombre, la
 * dirección con su pin, el teléfono y el horario —lo que el cliente ve al
 * elegir dónde retirar— y dos interruptores: si se ofrece para **retiro** y si
 * está **activa**. En dos columnas —datos y mapa a la izquierda; retiro,
 * estado y horario a la derecha—. Con cambios, la fila del nombre se vuelve
 * *Cambios sin guardar* con *Descartar* / *Guardar*, fija arriba. Guardar **se queda en la ficha**; crear lleva a la de la nueva.
 */
export function UbicacionForm({
  ubicacion,
  volverA,
}: {
  /** `null` para crear una nueva. */
  ubicacion: Ubicacion | null;
  volverA: string;
}) {
  const router = useRouter();
  /** Lo guardado: el punto de partida, que pasa a ser lo nuevo al guardar. */
  const [inicial, setInicial] = useState<Campos>(() => desde(ubicacion));
  const [c, setC] = useState<Campos>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const nueva = ubicacion === null;
  const cambio = JSON.stringify(c) !== JSON.stringify(inicial);
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((x) => ({ ...x, [k]: v }));

  /** Qué impide guardar, dicho como se arregla. */
  const falta = !c.nombre.trim()
    ? "Ponle un nombre"
    : c.horarios.some((d) => d.abierto && d.desde >= d.hasta)
      ? "Revisa el horario: un día cierra antes de abrir"
      : null;

  async function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (falta) {
      toast.error(falta);
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(nueva ? "/api/ubicaciones" : `/api/ubicaciones/${ubicacion.id}`, {
        method: nueva ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, nombre: c.nombre.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      toast.success(nueva ? "Ubicación creada" : "Ubicación guardada");
      if (nueva) {
        // A la ficha de la que se acaba de crear, con la misma vuelta.
        router.replace(
          `/dashboard/configuracion/ubicaciones/${data.id}?from=${encodeURIComponent(volverA)}`
        );
      } else {
        // Se queda: lo que volvió del servidor pasa a ser el punto de partida
        // —la barra de cambios se apaga— y la página se vuelve a pedir para el
        // título y la lista.
        const guardada = desde(data as Ubicacion);
        setInicial(guardada);
        setC(guardada);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!ubicacion) return;
    setBorrando(true);
    try {
      const res = await fetch(`/api/ubicaciones/${ubicacion.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      // Con pedidos el servidor no la borra y dice que se desactive.
      if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar");
      toast.success("Ubicación eliminada");
      router.push(volverA);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
      setBorrando(false);
      setConfirmando(false);
    }
  }

  const titulo = nueva ? "Nueva ubicación" : ubicacion.nombre;

  return (
    <form id={FORM_ID} onSubmit={guardar} className="pb-6">
      <EncabezadoFormularioMovil
        titulo={titulo}
        accion={nueva ? "Crear" : "Guardar"}
        cargando={guardando}
        deshabilitado={!nueva && !cambio}
        onCancelar={() => router.push(volverA)}
      />

      <div className="mx-auto max-w-6xl space-y-4 p-3 md:p-6">
        {/* El nombre con *Acciones* y, al lado, *Cancelar* / *Guardar*: fija
            arriba mientras se baja por el mapa y el horario, así guardar
            nunca queda lejos. */}
        {/* Con cambios —o al crear—, la fila del nombre **se vuelve** la de
            guardar: *Cambios sin guardar* con *Descartar* / *Guardar*. Sin
            cambios, el nombre y *Acciones*. Fijo arriba, con el fondo **de la
            página** (`bg-gray-50`, el del `<main>`): con el blanco de las
            tarjetas se veía como una franja. */}
        {nueva || cambio ? (
          <div className="sticky top-0 z-10 -mx-3 hidden h-14 items-center gap-3 bg-gray-50 px-3 md:-mx-6 md:flex md:px-6">
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
              {nueva ? "Nueva ubicación" : "Cambios sin guardar"}
            </h1>
            {falta ? <span className="text-sm text-muted-foreground">{falta}</span> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={guardando}
              onClick={() => (nueva ? router.push(volverA) : setC(inicial))}
            >
              {nueva ? "Cancelar" : "Descartar"}
            </Button>
            <Button type="submit" size="sm" disabled={guardando || !!falta}>
              {guardando ? "Guardando…" : nueva ? "Crear" : "Guardar"}
            </Button>
          </div>
        ) : (
          <div className="sticky top-0 z-10 -mx-3 hidden h-14 items-center gap-3 bg-gray-50 px-3 md:-mx-6 md:flex md:px-6">
            <Link href={volverA} aria-label="Volver" className={BOTON_REDONDO_MOVIL}>
              <ChevronLeft className={ICONO_BOTON_REDONDO} />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{titulo}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
                Acciones
                <ChevronDown className="ml-1 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem onClick={() => setConfirmando(true)} className="text-destructive">
                  Eliminar ubicación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {!nueva ? (
          // En el teléfono el encabezado es el del formulario: el ⋯ va aparte.
          <div className="flex justify-end md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" aria-label="Más acciones" className={BOTON_REDONDO_MOVIL} />}
              >
                <MoreHorizontal className={ICONO_BOTON_REDONDO} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem onClick={() => setConfirmando(true)} className="text-destructive">
                  Eliminar ubicación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        {/* Dos columnas, como la ficha de un producto: lo que se escribe a la
            izquierda (los datos y el mapa) y lo que se decide a la derecha
            (retiro, estado y horario). En el teléfono, una debajo de otra. */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <TarjetaSeccion titulo="Datos de la ubicación">
              <div className="space-y-4">
                <Campo id="u-nombre" etiqueta="Nombre" valor={c.nombre} onCambio={(v) => set("nombre", v)} placeholder="Vivero Hipódromo" autoFocus={nueva} />
                <Campo id="u-direccion" etiqueta="Dirección" valor={c.direccion} onCambio={(v) => set("direccion", v)} placeholder="Calle, número, urbanización" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Ciudad</Label>
                    <SelectorCiudad value={c.ciudad} onChange={(v) => set("ciudad", v)} clearable={false} />
                  </div>
                  <Campo id="u-telefono" etiqueta="Teléfono" valor={c.telefono} onCambio={(v) => set("telefono", v)} placeholder="Opcional" />
                </div>
                <Campo id="u-referencia" etiqueta="Referencia" valor={c.referencia} onCambio={(v) => set("referencia", v)} placeholder="Frente a…, junto a…" />
              </div>
            </TarjetaSeccion>
            <TarjetaSeccion titulo="En el mapa">
              <MapaPropiedad
                lat={c.lat}
                lng={c.lng}
                onCambio={(p) => setC((x) => ({ ...x, lat: p?.lat ?? null, lng: p?.lng ?? null }))}
              />
            </TarjetaSeccion>
          </div>
          <div className="space-y-4">
            <TarjetaSeccion titulo="Retiro y estado">
              <div className="divide-y">
                <Interruptor
                  id="u-retiro"
                  titulo="Retiro en este local"
                  nota="El cliente puede elegirlo para retirar su pedido en la app."
                  valor={c.retiro}
                  onCambio={(v) => set("retiro", v)}
                />
                <Interruptor
                  id="u-activa"
                  titulo="Activa"
                  nota="Apagada no se ofrece en ningún lado, pero sigue nombrando sus pedidos."
                  valor={c.activa}
                  onCambio={(v) => set("activa", v)}
                />
              </div>
              {!nueva && ubicacion.pedidos > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {ubicacion.pedidos === 1
                    ? "1 pedido para retirar aquí."
                    : `${ubicacion.pedidos} pedidos para retirar aquí.`}
                </p>
              ) : null}
            </TarjetaSeccion>
            <TarjetaSeccion
              titulo="Horario"
              subtitulo={`El cliente lo ve así: ${textoDelHorario(c.horarios)}`}
            >
              <EditorDeHorario valor={c.horarios} onCambio={(h) => set("horarios", h)} />
            </TarjetaSeccion>
          </div>
        </div>
      </div>

      <Dialog open={confirmando} onOpenChange={(o) => !o && !borrando && setConfirmando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar {ubicacion?.nombre}?</DialogTitle>
            <DialogDescription>
              Deja de ofrecerse para retirar. Si algún pedido la cita no se puede eliminar:
              desactívala en su lugar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)} disabled={borrando}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={eliminar} disabled={borrando}>
              {borrando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  valor,
  onCambio,
  placeholder,
  autoFocus,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
    </div>
  );
}

function Interruptor({
  id,
  titulo,
  nota,
  valor,
  onCambio,
}: {
  id: string;
  titulo: string;
  nota: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{nota}</span>
      </span>
      <Switch id={id} checked={valor} onCheckedChange={(v) => onCambio(!!v)} />
    </label>
  );
}

/**
 * El horario de la semana, un día por renglón: el interruptor de abierto y,
 * abierto, de qué hora a qué hora. Cómo lo lee el cliente va bajo el título.
 */
const OPCIONES_DE_HORA = HORAS_DEL_HORARIO.map((h) => ({ value: h, label: horaLegible(h) }));

/**
 * Las horas de la lista, más la guardada si no cae en el 5 (17:01, de antes
 * de la lista): sin ella el desplegable no la encuentra y dice "Seleccionar".
 */
function opcionesCon(h: string) {
  return HORAS_DEL_HORARIO.includes(h)
    ? OPCIONES_DE_HORA
    : [...OPCIONES_DE_HORA, { value: h, label: horaLegible(h) }].sort((a, b) =>
        a.value.localeCompare(b.value)
      );
}

function EditorDeHorario({
  valor,
  onCambio,
}: {
  valor: HorarioSemanal;
  onCambio: (h: HorarioSemanal) => void;
}) {
  const cambiarDia = (i: number, cambio: Partial<HorarioSemanal[number]>) =>
    onCambio(valor.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  return (
    <div className="space-y-3">
      <div className="divide-y">
        {DIAS_DE_LA_SEMANA.map((dia, i) => {
          const d = valor[i];
          const malo = d.abierto && d.desde >= d.hasta;
          return (
            <div key={dia} className="py-2">
              {/* Todo en un renglón: el día, el interruptor y las dos horas. */}
              <div className="flex items-center gap-2">
                <span className="w-[4.75rem] flex-none text-sm font-medium">{dia}</span>
                <Switch
                  checked={d.abierto}
                  onCheckedChange={(v) => cambiarDia(i, { abierto: !!v })}
                  aria-label={`${dia} abierto`}
                />
                {d.abierto ? (
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                    {/* Un desplegable de horas cada 5 minutos, que se busca
                        escribiendo ("5:15"), y no el campo de
                        hora del navegador: el suyo, con "08:00 AM" y su reloj,
                        no entraba en la columna y se cortaba. */}
                    <CustomSelect
                      value={d.desde}
                      onChange={(v) => cambiarDia(i, { desde: v })}
                      options={opcionesCon(d.desde)}
                      searchable
                      searchPlaceholder="Escribe la hora"
                      anchoMinimo={150}
                      className="w-[5.25rem]"
                    />
                    <span className="text-sm text-muted-foreground">–</span>
                    <div className={`w-[5.25rem] rounded-md ${malo ? "ring-1 ring-destructive" : ""}`}>
                      <CustomSelect
                        value={d.hasta}
                        onChange={(v) => cambiarDia(i, { hasta: v })}
                        options={opcionesCon(d.hasta)}
                        searchable
                        searchPlaceholder="Escribe la hora"
                        anchoMinimo={150}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="flex-1 text-right text-sm text-muted-foreground">Cerrado</span>
                )}
              </div>
              {malo ? (
                <p className="mt-1 text-xs text-destructive">
                  La hora de cierre tiene que ser después de la de apertura.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
