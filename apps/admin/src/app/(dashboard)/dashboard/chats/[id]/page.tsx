import { notFound } from "next/navigation";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { getChat, listMensajes } from "@/lib/services/chat.service";
import { NotFoundError, ForbiddenError } from "@/lib/services/errors";
import { Conversacion } from "@/components/chats/conversacion";

/**
 * Una conversación.
 *
 * La primera página de mensajes viene con el HTML: abrir un chat y ver un
 * blanco mientras el navegador pide lo que el servidor ya tenía a mano es la
 * mitad del "esto va lento".
 */
export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; mensaje?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const { from, mensaje } = await searchParams;
  const viewer = await viewerFromSession();

  // Los datos se piden adentro del `try` y el JSX se arma afuera: un error de
  // render no lo atrapa un try/catch —React no renderiza en el momento en que
  // se escribe el JSX— y el lint lo avisa.
  let datos;
  try {
    datos = await Promise.all([
      getChat(viewer, id),
      // Llegando desde el buscador, la conversación se abre **alrededor** de
      // ese mensaje y no por el final.
      listMensajes(viewer, id, mensaje ? { alrededorDe: mensaje } : {}),
    ]);
  } catch (error) {
    // Un chat en el que no estás y uno que no existe son lo mismo desde
    // afuera: decir "no estás en este" ya cuenta que existe.
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }
  const [chat, mensajes] = datos;

  return (
    // En el teléfono el margen es el de cualquier página; en el escritorio la
    // conversación llena su columna, como en WhatsApp.
    <div className="flex h-full flex-col p-3 md:p-0">
      <Conversacion
        chat={{
          id: chat.id,
          nombre: chat.nombre,
          imagenUrl: chat.imagenUrl,
          medios: chat.medios,
          puedeEditar: chat.puedeEditar,
          miembros: chat.miembros,
        }}
        mensajes={mensajes.items.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
        cursor={mensajes.cursor}
        from={from}
        destacado={mensaje}
      />
    </div>
  );
}
