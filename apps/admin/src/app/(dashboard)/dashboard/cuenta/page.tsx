import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CuentaPage } from "@/components/cuenta/cuenta-page";

/**
 * Mi cuenta. Para cualquiera que esté adentro; en el teléfono es una de las
 * tres pestañas del jardinero, igual que en la app.
 */
export default async function Page() {
  const sesion = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: sesion.id },
    select: { name: true, apellido: true, usuario: true, email: true, role: true },
  });

  const nombre =
    `${user?.name ?? ""} ${user?.apellido ?? ""}`.trim() || "Mi cuenta";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 md:gap-6 md:p-6">
      <CuentaPage
        usuario={{
          nombre,
          rol: user?.role ?? "STAFF",
          usuario: user?.usuario ?? null,
          email: user?.email ?? null,
        }}
      />
    </div>
  );
}
