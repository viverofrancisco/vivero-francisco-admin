import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { listChats } from "@/lib/services/chat.service";
import { ChatsPageClient } from "@/components/chats/chats-page-client";

/**
 * Los chats del equipo. **Sin `requireStaff`**: el jardinero también tiene los
 * suyos, y estar adentro es lo único que da acceso a cada uno.
 */
export default async function ChatsPage() {
  await requireAuth();
  const viewer = await viewerFromSession();
  const chats = await listChats(viewer);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <ChatsPageClient
        chats={chats.map((c) => ({
          ...c,
          ultimo: c.ultimo
            ? { ...c.ultimo, createdAt: c.ultimo.createdAt.toISOString() }
            : null,
        }))}
        puedeCrear={viewer.role === "ADMIN"}
      />
    </div>
  );
}
