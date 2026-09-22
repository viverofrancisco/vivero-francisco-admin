"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FILA_MOVIL } from "@/components/shared/lista-movil";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { aca } from "@/lib/filtros-url";
import { ChatForm } from "./chat-form";
import { fechaRelativaCorta } from "./formato";

export interface ChatEnLista {
  id: string;
  nombre: string;
  miembros: number;
  sinLeer: number;
  ultimo: {
    texto: string | null;
    autorNombre: string;
    createdAt: string;
    fotos: number;
  } | null;
}

/**
 * Los chats del equipo.
 *
 * Una sola lista para los dos tamaños —la misma que la app—: una conversación
 * es un renglón con su nombre, lo último que se dijo y cuántos quedaron sin
 * leer, y eso no mejora repartido en columnas.
 */
export function ChatsPageClient({
  chats,
  puedeCrear,
}: {
  chats: ChatEnLista[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

  return (
    <>
      <PageHeader
        title="Chats"
        actions={
          puedeCrear
            ? [
                {
                  label: "Nuevo chat",
                  icon: "plus",
                  onClick: () => setCreando(true),
                  primary: true,
                },
              ]
            : []
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {chats.length === 0 ? (
          <EmptyState
            message={
              puedeCrear
                ? "Todavía no hay chats. Creá el primero y elegí quién está adentro."
                : "Todavía no estás en ningún chat."
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {chats.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/chats/${c.id}?from=${aca()}`}
                className={`${FILA_MOVIL} bg-card`}
              >
                <InitialsAvatar name={c.nombre} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                      {c.nombre}
                    </span>
                    {c.ultimo ? (
                      <span className="flex-none text-[11px] font-medium text-muted-foreground">
                        {fechaRelativaCorta(c.ultimo.createdAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.ultimo
                      ? `${c.ultimo.autorNombre}: ${
                          c.ultimo.texto ??
                          (c.ultimo.fotos === 1
                            ? "📷 Foto"
                            : `📷 ${c.ultimo.fotos} fotos`)
                        }`
                      : `${c.miembros} ${c.miembros === 1 ? "persona" : "personas"} · sin mensajes`}
                  </span>
                </span>
                {c.sinLeer > 0 ? (
                  <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {c.sinLeer}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>

      {creando ? (
        <ChatForm
          chat={null}
          onClose={() => setCreando(false)}
          onGuardado={(id) => {
            setCreando(false);
            router.push(`/dashboard/chats/${id}`);
          }}
        />
      ) : null}
    </>
  );
}
