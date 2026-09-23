import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { listChats } from "@/lib/services/chat.service";
import { ChatsMarco } from "@/components/chats/chats-marco";

/**
 * Los chats del equipo. **Sin `requireStaff`**: el jardinero también tiene los
 * suyos, y estar adentro es lo único que da acceso a cada uno.
 *
 * La lista vive en el layout y no en la página para que en el escritorio
 * quede al lado de la conversación abierta, y para que abrir un chat no la
 * vuelva a pedir: el layout se queda mientras se navega entre sus hijos.
 */
export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const chats = await listChats(viewer);

  return (
    <ChatsMarco
      chats={chats.map((c) => ({
        ...c,
        ultimo: c.ultimo
          ? { ...c.ultimo, createdAt: c.ultimo.createdAt.toISOString() }
          : null,
      }))}
      puedeCrear={viewer.role === "ADMIN"}
    >
      {children}
    </ChatsMarco>
  );
}
