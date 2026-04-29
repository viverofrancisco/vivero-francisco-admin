import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { UserDetail } from "@/components/configuracion/user-detail";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [user, sectores] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        apellido: true,
        email: true,
        role: true,
        createdAt: true,
        sectorAdmins: {
          select: {
            sector: { select: { id: true, nombre: true } },
          },
        },
      },
    }),
    prisma.sector.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div>
      <UserDetail
        user={{
          id: user.id,
          name: user.name,
          apellido: user.apellido,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        }}
        assignedSectors={user.sectorAdmins.map((sa) => sa.sector)}
        allSectors={sectores}
      />
    </div>
  );
}
