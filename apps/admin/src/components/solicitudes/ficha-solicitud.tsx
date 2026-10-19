"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Mail, MoreHorizontal, Phone, Play } from "lucide-react";
import { fechaSola, nombresDeServicios, type SolicitudItem } from "@vivero/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaViewer, type MediaViewerSource } from "@/components/ui/media-viewer";
import {
  BOTON_REDONDO_MOVIL,
  ICONO_BOTON_REDONDO,
  VolverRedondo,
} from "@/components/shared/boton-redondo-movil";
import { cn } from "@/lib/utils";

/** Un instante, en la hora de Ecuador: lo mismo en el servidor y en el navegador. */
export function cuandoSolicitud(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EstadoSolicitud({ atendida }: { atendida: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        atendida ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800"
      )}
    >
      {atendida ? "Atendida" : "Pendiente"}
    </span>
  );
}

/**
 * Las fotos y los videos de una solicitud en miniaturas que **se abren en el
 * portal** (`MediaViewer`), no en otra pestaña: lo mismo que la app.
 */
export function MiniaturasDeSolicitud({ adjuntos }: { adjuntos: SolicitudItem["adjuntos"] }) {
  const [abierto, setAbierto] = useState<MediaViewerSource | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {adjuntos.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAbierto({ url: a.url, tipo: a.tipo })}
            title={a.nombre ?? undefined}
            aria-label={a.tipo === "video" ? "Ver video" : "Ver foto"}
            className="relative block h-20 w-20 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 hover:opacity-90 active:opacity-60"
          >
            {a.tipo === "video" ? (
              <span className="flex h-full w-full items-center justify-center bg-neutral-800">
                <Play className="h-6 w-6 fill-white text-white" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.nombre ?? "Foto"} className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
      <MediaViewer media={abierto} onClose={() => setAbierto(null)} />
    </>
  );
}

/** El rótulo en versalitas y la caja gris redondeada, como en la app. */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <p className="mb-1.5 pl-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{titulo}</p>
      {children}
    </section>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return <div className="divide-y rounded-xl bg-muted/50 px-3.5">{children}</div>;
}

const LINEA = "flex w-full items-center gap-3 py-3 text-left text-sm";

/**
 * Una solicitud, como la pantalla de la app del equipo: quién la mandó —con su
 * número para llamar—, y en el orden del formulario del cliente los
 * servicios, los detalles, las fotos o videos y dónde; luego las visitas que
 * salieron de ella y si ya se atendió. *Marcar atendida* y *Crear visita*
 * van en el ⋯ del encabezado.
 */
export function FichaSolicitud({
  solicitud: s,
  volverA,
}: {
  solicitud: SolicitudItem;
  volverA: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const servicios = nombresDeServicios(s);
  const donde = [s.propiedad?.nombre, s.direccion].filter(Boolean).join(" · ");

  async function marcar(atendida: boolean) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/solicitudes/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atendida }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo guardar");
      }
      toast.success(atendida ? "Marcada como atendida" : "Volvió a pendiente");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-full bg-card pb-10">
      <div className="sticky top-0 z-20 flex h-12 items-center gap-2.5 bg-card/95 px-3 backdrop-blur-sm md:h-14 md:px-6">
        <VolverRedondo href={volverA} />
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold md:text-xl">Solicitud #{s.numero}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Acciones" disabled={guardando} className={BOTON_REDONDO_MOVIL} />
            }
          >
            <MoreHorizontal className={ICONO_BOTON_REDONDO} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => void marcar(!s.atendidaEl)}>
              {s.atendidaEl ? "Volver a pendiente" : "Marcar atendida"}
            </DropdownMenuItem>
            {/* El asistente con su cliente y su propiedad puestos; la de un
                invitado arranca en *Cliente nuevo* con sus datos. */}
            <DropdownMenuItem onClick={() => router.push(`/dashboard/visitas/nueva?solicitud=${s.id}`)}>
              Crear visita
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-auto max-w-xl px-4 pt-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-muted-foreground">Enviada {cuandoSolicitud(s.createdAt)}</p>
          <EstadoSolicitud atendida={!!s.atendidaEl} />
        </div>

        <Seccion titulo="Cliente">
          <Caja>
            {s.cliente ? (
              <Link href={`/dashboard/clientes/${s.cliente.id}`} className={cn(LINEA, "active:opacity-60")}>
                <span className="flex-1 font-semibold">{s.contacto.nombre}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : (
              <div className={LINEA}>
                <span className="flex-1">
                  <span className="block font-semibold">{s.contacto.nombre}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    Sin cuenta: al crear la visita se le crea su ficha con estos datos
                  </span>
                </span>
              </div>
            )}
            {s.contacto.telefono ? (
              <a href={`tel:${s.contacto.telefono}`} className={cn(LINEA, "active:opacity-60")}>
                <Phone className="h-[18px] w-[18px] text-primary" />
                <span className="flex-1 font-semibold text-primary">{s.contacto.telefono}</span>
              </a>
            ) : null}
            {s.contacto.email ? (
              <a href={`mailto:${s.contacto.email}`} className={cn(LINEA, "active:opacity-60")}>
                <Mail className="h-[18px] w-[18px] text-muted-foreground" />
                <span className="flex-1 truncate">{s.contacto.email}</span>
              </a>
            ) : null}
          </Caja>
        </Seccion>

        {servicios.length ? (
          <Seccion titulo="Servicios">
            <Caja>
              {servicios.map((nombre) => (
                <div key={nombre} className={cn(LINEA, "font-semibold")}>
                  {nombre}
                </div>
              ))}
            </Caja>
          </Seccion>
        ) : null}

        <Seccion titulo="Detalles">
          <Caja>
            <p className="whitespace-pre-wrap py-3 text-sm">{s.mensaje}</p>
          </Caja>
        </Seccion>

        {s.adjuntos.length ? (
          <Seccion titulo="Fotos o videos">
            <MiniaturasDeSolicitud adjuntos={s.adjuntos} />
          </Seccion>
        ) : null}

        {donde ? (
          <Seccion titulo="Dónde">
            <Caja>
              <div className={LINEA}>{donde}</div>
              {s.lat !== null && s.lng !== null ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(LINEA, "font-semibold text-primary active:opacity-60")}
                >
                  Ver en el mapa
                </a>
              ) : null}
            </Caja>
          </Seccion>
        ) : null}

        {s.visitas.length > 0 ? (
          <Seccion titulo={s.visitas.length === 1 ? "Visita" : "Visitas"}>
            <Caja>
              {s.visitas.map((v) => (
                <Link key={v.id} href={`/dashboard/visitas/${v.id}`} className={cn(LINEA, "active:opacity-60")}>
                  <span className="flex-1">
                    #{v.numero} · {fechaSola(v.fechaProgramada)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </Caja>
          </Seccion>
        ) : null}

        {s.atendidaEl ? (
          <p className="mt-4 pl-1 text-[13px] text-muted-foreground">
            Atendida {cuandoSolicitud(s.atendidaEl)}
            {s.atendidaPorNombre ? ` por ${s.atendidaPorNombre}` : ""}
          </p>
        ) : null}

      </div>
    </div>
  );
}
