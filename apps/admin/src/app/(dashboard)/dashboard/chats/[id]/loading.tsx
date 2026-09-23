"use client";

import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SkeletonDetalle } from "@/components/shared/page-skeletons";
import { Conversacion } from "@/components/chats/conversacion";
import { leerChat, suscribir } from "@/components/chats/cache-de-chats";

/**
 * Mientras Next trae la página del chat, la conversación **guardada** en vez
 * de un esqueleto: el último snapshot que dejó `Conversacion`, en modo solo
 * vista, con la misma forma que va a tener lo que llega. Cambiar de chat en
 * el escritorio deja de parpadear, y en el teléfono se abre al instante.
 *
 * El snapshot se lee con `useSyncExternalStore` y no en el render a secas:
 * en el servidor no hay `localStorage`, así que el HTML lleva el esqueleto y
 * el navegador recién pone la copia después de hidratar — leerlo directo
 * daba un HTML distinto del cliente, que es un error de hidratación.
 */
export default function Loading() {
  const { id } = useParams<{ id: string }>();
  // Llegando desde el buscador la página se abre alrededor de un mensaje, y
  // el snapshot —que es el final del chat— sería otra cosa.
  const buscado = useSearchParams().get("mensaje");
  const cache = useSyncExternalStore(
    suscribir,
    () => (buscado ? null : leerChat(id)),
    () => null
  );
  if (!cache) return <SkeletonDetalle />;
  return (
    <div className="flex h-full flex-col p-3 md:p-0">
      <Conversacion
        chat={cache.chat}
        mensajes={cache.mensajes}
        cursor={cache.cursor}
        soloVista
      />
    </div>
  );
}
