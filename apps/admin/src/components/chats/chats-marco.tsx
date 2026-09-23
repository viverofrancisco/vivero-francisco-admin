"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { ChatsPageClient, type ChatEnLista } from "./chats-page-client";

/**
 * Las dos columnas de los chats en el escritorio, como WhatsApp Desktop: la
 * lista de conversaciones a la izquierda y la abierta a la derecha. Ir de un
 * chat a otro no vuelve a la lista: la lista nunca se fue.
 *
 * En el teléfono son dos pantallas, como en la app: la lista, o el chat. Qué
 * se muestra lo dice la ruta —`[id]` abierto es el chat—, así que no hay
 * estado que se pueda desincronizar de la URL.
 */
export function ChatsMarco({
  chats,
  puedeCrear,
  children,
}: {
  chats: ChatEnLista[];
  puedeCrear: boolean;
  children: React.ReactNode;
}) {
  const abierto = useSelectedLayoutSegment() !== null;
  return (
    <div className="flex h-full min-h-0">
      <aside
        className={`min-h-0 flex-col gap-3 p-3 md:flex md:w-[360px] md:flex-none md:gap-3 md:border-r md:border-border md:bg-card md:p-3 lg:w-[400px] ${
          abierto ? "hidden" : "flex flex-1 md:flex-none"
        }`}
      >
        <ChatsPageClient chats={chats} puedeCrear={puedeCrear} />
      </aside>
      <section
        className={`min-h-0 min-w-0 flex-1 flex-col bg-card ${
          abierto ? "flex" : "hidden md:flex"
        }`}
      >
        {children}
      </section>
    </div>
  );
}
