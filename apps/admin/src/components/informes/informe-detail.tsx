"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { useAca } from "@/lib/filtros-url";
import { propiedadesDeVisitas } from "@vivero/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  MoreHorizontal,
  User,
  X,
} from "lucide-react";
import { useEsMovil } from "@/lib/use-es-movil";
import {
  FilaFichaMovil,
  SeccionFichaMovil,
} from "@/components/shared/seccion-ficha-movil";
import { toast } from "sonner";

export interface InformeDetailData {
  id: string;
  numero: number;
  titulo: string;
  /** La que sale impresa, `YYYY-MM-DD`. */
  fecha: string;
  /** El período que cubren sus visitas, si las tiene. */
  fechaDesde: string | null;
  fechaHasta: string | null;
  generatedAt: string;
  pdfUrl: string;
  cliente: { id: string; nombre: string };
  generadoPor: string | null;
  /** En qué versión va. 1 = nunca se editó. */
  versionActual: number;
  actualizadoEl: string | null;
  actualizadoPor: string | null;
  /** De la más nueva a la más vieja. La primera es la que se está mirando. */
  versiones: Array<{
    id: string;
    version: number;
    titulo: string;
    fecha: string;
    pdfUrl: string;
    generatedAt: string;
    generadoPor: string | null;
    nota: string | null;
    /**
     * Se puede volver a abrir en el asistente.
     *
     * Las versiones anteriores a que se guardara el contenido quedaron sin él:
     * de esas solo hay PDF para mirar.
     */
    retomable: boolean;
  }>;
  firmantes: Array<{ nombre: string; cedula: string | null }>;
  visitas: Array<{
    id: string;
    numero: number;
    estado: string;
    fecha: string;
    /** Dónde pasó. De acá sale la propiedad del informe: no tiene una propia. */
    propiedad: { id: string; nombre: string } | null;
  }>;
  secciones: Array<{ titulo: string; fotos: number }>;
}

/**
 * La ficha de un informe: el PDF y de qué está hecho.
 *
 * **Se edita, y editarlo no pisa lo entregado.** Cada generación deja su
 * archivo como versión, así que el PDF que el cliente tiene en la mano se sigue
 * pudiendo abrir. Esa era exactamente la razón por la que antes no se editaba
 * —quedaba circulando un documento que ya no coincidía con el nuestro— y es lo
 * que las versiones desarman. El `numero` no cambia: es el mismo informe
 * corregido, no uno nuevo.
 *
 * Las **visitas** se editan aparte, sin generar versión: no salen impresas —el
 * renderizador ni las mira— son el vínculo con el trabajo que el informe
 * cuenta.
 */
export function InformeDetail({
  informe,
  backHref,
}: {
  informe: InformeDetailData;
  backHref: string;
}) {
  const router = useRouter();
  const aca = useAca();
  const [borrando, setBorrando] = useState(false);
  /** En qué propiedades pasó lo que cuenta: lo dicen sus visitas. */
  const propiedades = propiedadesDeVisitas(informe.visitas);
  const [eliminando, setEliminando] = useState(false);
  /**
   * Debajo de `md` la ficha es la de la app: un árbol u otro por el hook y
   * no por clases, porque los dos llevan un `<iframe>` con el PDF y con
   * `md:hidden` se cargaría dos veces.
   */
  const esMovil = useEsMovil();
  const [viendoPdf, setViendoPdf] = useState(false);
  /**
   * En Android, Chrome no dibuja un PDF dentro de un `<iframe>` —ofrece
   * bajarlo—, así que ahí el teléfono lo pide por el visor de Google, que
   * funciona porque la URL es pública; iOS lo dibuja solo. Es lo mismo que
   * hace la app en su WebView. Por `useSyncExternalStore` y no en el render,
   * que en el servidor no hay `navigator` y sería un error de hidratación.
   */
  const enAndroid = useSyncExternalStore(
    () => () => {},
    () => /Android/i.test(navigator.userAgent),
    () => false
  );
  const pdfParaElTelefono = enAndroid
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(informe.pdfUrl)}`
    : informe.pdfUrl;

  async function eliminar() {
    setEliminando(true);
    try {
      const res = await fetch(`/api/admin/informes/${informe.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Informe eliminado");
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("No pudimos eliminar");
      setEliminando(false);
    }
  }

  const dialogo = (
      <Dialog open={borrando} onOpenChange={(v) => !v && setBorrando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar el informe #{informe.numero}</DialogTitle>
            <DialogDescription>
              Se borra el informe de {informe.cliente.nombre}, sus secciones y
              el PDF. El enlace deja de abrir, también para quien ya lo haya
              recibido. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBorrando(false)}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  if (esMovil) {
    const secciones = informe.secciones;
    return (
      <div className="-mx-4 -mt-4 min-h-full bg-page">
        {/* La cabecera de la ficha en el teléfono: la flecha, el nombre del
            cliente y el ⋯ con lo que se hace con el informe —editar, ver el
            PDF, eliminar—. La misma que la app. */}
        <div className="sticky top-0 z-20 flex items-center gap-1.5 border-b bg-card px-4 pt-1.5 pb-2">
          <Link
            href={backHref}
            aria-label="Volver"
            className="-ml-2.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl active:bg-muted"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-0.4px]">
            {informe.cliente.nombre}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Acciones"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-border text-ink-2 active:bg-muted"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem
                render={
                  <Link
                    href={`/dashboard/informes/${informe.id}/editar?from=${aca}`}
                  />
                }
              >
                Editar informe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViendoPdf(true)}>
                Ver PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setBorrando(true)}
                className="text-destructive"
              >
                Eliminar informe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-3 pt-3 pb-10">
          {/* La miniatura del PDF y, al lado, lo que identifica al informe.
              Tocar la tarjeta abre el PDF. */}
          <button
            type="button"
            onClick={() => setViendoPdf(true)}
            className="flex w-full gap-3.5 rounded-xl border bg-card p-3 text-left active:opacity-70"
          >
            <div className="h-[150px] w-[110px] flex-none overflow-hidden rounded-lg border bg-white">
              {/* Sin `scrollbar=0`: con él, el visor de Chrome pinta negro
                  cuando el marco es así de chico. */}
              <iframe
                src={enAndroid ? pdfParaElTelefono : `${informe.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                title="Primera página"
                tabIndex={-1}
                className="pointer-events-none block h-full w-full border-0"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-[17px] font-bold">
                Informe #{informe.numero}
                {informe.versionActual > 1 ? ` · v${informe.versionActual}` : ""}
              </p>
              <p className="line-clamp-2 text-[13px] text-ink-2">{informe.titulo}</p>
              <p className="text-xs text-muted-foreground">
                Fecha impresa: {fechaLarga(informe.fecha)}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                Generado: {informe.generadoPor ? `${informe.generadoPor} · ` : ""}
                {generadoEl(informe.generatedAt)}
              </p>
              {informe.actualizadoEl ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  Actualizado: {informe.actualizadoPor ? `${informe.actualizadoPor} · ` : ""}
                  {generadoEl(informe.actualizadoEl)}
                </p>
              ) : null}
              <span className="mt-auto flex items-center gap-1 text-[13px] font-semibold text-primary">
                <FileText className="h-4 w-4" /> Ver PDF
              </span>
            </div>
          </button>

          {/* Las visitas: el período y las propiedades que salen de ellas, y
              debajo cada una, para saltar a su ficha. */}
          <SeccionFichaMovil titulo={`Visitas (${informe.visitas.length})`}>
            {informe.fechaDesde && informe.fechaHasta ? (
              <FilaFichaMovil
                etiqueta="Período"
                valor={`${fechaCorta(informe.fechaDesde)} — ${fechaCorta(informe.fechaHasta)}`}
              />
            ) : null}
            {propiedades.length > 0 ? (
              <FilaFichaMovil
                etiqueta={propiedades.length === 1 ? "Propiedad" : "Propiedades"}
                valor={propiedades.map((p) => p.nombre).join(", ")}
              />
            ) : null}
            {informe.visitas.length === 0 ? (
              <p className="py-2.5 text-[13px] text-muted-foreground">
                Este informe no cubre ninguna visita.
              </p>
            ) : null}
            {informe.visitas.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard/visitas/${v.id}?from=${aca}`}
                className="flex items-center gap-3 border-t py-2.5 first:border-t-0 active:opacity-70"
              >
                <CalendarDays className="h-5 w-5 flex-none text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">
                    Visita #{v.numero} · {fechaCorta(v.fecha)}
                  </span>
                  {v.propiedad ? (
                    <span className="block text-[13px] text-muted-foreground">
                      {v.propiedad.nombre}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-[18px] w-[18px] flex-none text-muted-foreground" />
              </Link>
            ))}
          </SeccionFichaMovil>

          <SeccionFichaMovil titulo={`Secciones (${secciones.length})`}>
            {secciones.map((sec, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-t py-2.5 first:border-t-0"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {sec.titulo || "Sin título"}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    {sec.fotos === 1 ? "1 foto" : `${sec.fotos} fotos`}
                  </span>
                </span>
              </div>
            ))}
          </SeccionFichaMovil>

          {informe.firmantes.length > 0 ? (
            <SeccionFichaMovil titulo="Firmantes">
              {informe.firmantes.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-t py-2.5 first:border-t-0"
                >
                  <User className="h-5 w-5 flex-none text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{f.nombre}</span>
                    {f.cedula ? (
                      <span className="block text-[13px] text-muted-foreground">
                        {f.cedula}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </SeccionFichaMovil>
          ) : null}
        </div>

        {/* El PDF a pantalla completa, como el visor de la app: la ✕ y el
            número, y el documento debajo. */}
        <Dialog open={viendoPdf} onOpenChange={(v) => !v && setViendoPdf(false)}>
          <DialogContent
            showCloseButton={false}
            pantallaCompletaEnMovil
            className="gap-0 p-0"
          >
            <div className="flex flex-none items-center gap-2 px-3 pt-3 pb-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setViendoPdf(false)}
                aria-label="Cerrar"
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
              <DialogTitle className="flex-1 text-center text-[17px] font-bold">
                Informe #{informe.numero}
              </DialogTitle>
              <span className="h-10 w-10" aria-hidden />
            </div>
            <iframe
              src={enAndroid ? pdfParaElTelefono : `${informe.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Informe #${informe.numero}`}
              className="min-h-0 flex-1 border-0 bg-neutral-200"
            />
          </DialogContent>
        </Dialog>
        {dialogo}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:h-full">
      <div className="flex flex-none items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              Informe #{informe.numero}
            </h1>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {informe.cliente.nombre} · {informe.titulo}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {/* Un solo menú y no cuatro botones: son acciones de la misma cosa
              y en fila competían con el título por la atención. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              Acciones <ChevronDown className="ml-1.5 h-4 w-4" />
            </DropdownMenuTrigger>
            {/* Ancho propio: por defecto el menú toma el del botón que lo
                abre (`w-(--anchor-width)`), y con un botón chico cada opción se
                partía en dos renglones. Sin iconos: son cuatro acciones con
                nombre, y el icono no agrega nada que el texto no diga. */}
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                render={
                  <a
                    href={informe.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Abrir en una pestaña
              </DropdownMenuItem>
              {/* Por nuestra ruta y no directo a R2: `download` no funciona
                  entre dominios, así que el enlace crudo abría el PDF en vez
                  de guardarlo. */}
              <DropdownMenuItem
                render={
                  <a href={`/api/admin/informes/${informe.id}/descargar`} />
                }
              >
                Descargar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <Link
                    href={`/dashboard/informes/${informe.id}/editar?from=${aca}`}
                  />
                }
              >
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setBorrando(true)}
                className="text-destructive"
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3">
        {/* El PDF es el informe: ocupa la columna grande. */}
        <div className="flex flex-col lg:col-span-2 lg:min-h-0">
          <div className="h-[65vh] overflow-hidden rounded-lg border bg-neutral-200 lg:h-auto lg:min-h-[60vh] lg:flex-1">
            <iframe
              src={`${informe.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Informe #${informe.numero}`}
              className="block h-full w-full border-0"
            />
          </div>
        </div>

        <div className="space-y-6 lg:overflow-y-auto">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Dato etiqueta="Cliente">
                <Link
                  href={`/dashboard/clientes/${informe.cliente.id}?from=${aca}`}
                  className="font-medium hover:underline"
                >
                  {informe.cliente.nombre}
                </Link>
              </Dato>
              {/* Dónde. Sale de las visitas que el informe cuenta, así que un
                  informe sin visitas no muestra el renglón: no hay nada que
                  decir, que no es lo mismo que un guión. */}
              {propiedades.length > 0 ? (
                <Dato
                  etiqueta={
                    propiedades.length === 1 ? "Propiedad" : "Propiedades"
                  }
                >
                  {propiedades.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/clientes/${informe.cliente.id}/propiedades/${p.id}?from=${aca}`}
                      className="block font-medium hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  ))}
                </Dato>
              ) : null}
              {/* Dos fechas distintas a propósito: la impresa es la que dice
                  el documento, la de generado es cuándo se armó. */}
              <Dato etiqueta="Fecha del informe">{fechaLarga(informe.fecha)}</Dato>
              <Dato etiqueta="Creado">
                {/* Quién lo hizo va abajo y no detrás de un punto: son dos
                    datos distintos, y juntos en un renglón el corte caía en
                    cualquier lado. */}
                <span className="block">{generadoEl(informe.generatedAt)}</span>
                {informe.generadoPor ? (
                  <span className="block text-muted-foreground">
                    {informe.generadoPor}
                  </span>
                ) : null}
              </Dato>
              {/* Solo si alguien lo editó. Repetir al creador como "última
                  actualización" diría que lo tocó después, y no pasó. */}
              {informe.actualizadoEl ? (
                <Dato etiqueta="Última edición">
                  <span className="block">
                    {generadoEl(informe.actualizadoEl)}
                  </span>
                  {informe.actualizadoPor ? (
                    <span className="block text-muted-foreground">
                      {informe.actualizadoPor}
                    </span>
                  ) : null}
                </Dato>
              ) : null}
            </CardContent>
          </Card>

          {/* Solo cuando hay más de una: con una sola, "versiones" es una
              palabra grande para decir que nadie lo tocó. */}
          {informe.versiones.length > 1 ? (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">
                  Versiones ({informe.versiones.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {informe.versiones.map((v, i) => (
                  <div key={v.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">Versión {v.version}</span>
                      {i === 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Actual
                        </Badge>
                      ) : (
                        <>
                          {/* En otra pestaña: es un archivo distinto del que
                              muestra la ficha, y reemplazarlo aquí haría creer
                              que se volvió a esa versión. */}
                          <a
                            href={v.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Ver el PDF
                          </a>
                          {/* Retomar es cómo se deshace una corrección: se
                              abre la que estaba bien y al guardar sale una
                              nueva. El historial no se toca. */}
                          {v.retomable ? (
                            <Link
                              href={`/dashboard/informes/${informe.id}/editar?version=${v.version}&from=${aca}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Partir de esta
                            </Link>
                          ) : null}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {generadoEl(v.generatedAt)}
                      {v.generadoPor ? ` · ${v.generadoPor}` : ""}
                    </p>
                    {v.nota ? (
                      <p className="text-xs text-foreground">{v.nota}</p>
                    ) : null}
                    {v.titulo !== informe.titulo ? (
                      <p className="text-xs text-muted-foreground">
                        Se llamaba <span className="font-medium">{v.titulo}</span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Visitas incluidas ({informe.visitas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y text-sm">
                {informe.visitas.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/dashboard/visitas/${v.id}?from=${aca}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-medium tabular-nums">
                          #{v.numero}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {fechaCorta(v.fecha)}
                          {/* El lugar solo cuando hay más de uno: repetir la
                              misma casa en cada fila no distingue nada. */}
                          {propiedades.length > 1 && v.propiedad
                            ? ` · ${v.propiedad.nombre}`
                            : ""}
                        </span>
                      </span>
                      <StatusBadge
                        estado={v.estado as EstadoVisitaUI}
                        size="sm"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Secciones ({informe.secciones.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y text-sm">
                {informe.secciones.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="truncate font-medium" title={s.titulo}>
                      {s.titulo}
                    </span>
                    <span className="flex flex-none items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {s.fotos}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Firman</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {informe.firmantes.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{f.nombre}</span>
                  {f.cedula ? (
                    <Badge variant="outline" className="flex-none tabular-nums">
                      {f.cedula}
                    </Badge>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {dialogo}

    </div>
  );
}

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/** "26 ago 2026" — entra en un renglón de la columna. */
function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "26 ago" — en una lista alcanza. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "26 ago 2026, 11:33" — con hora, que es lo que distingue dos del mismo día. */
function generadoEl(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
