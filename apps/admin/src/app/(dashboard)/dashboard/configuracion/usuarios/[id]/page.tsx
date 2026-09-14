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

  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        apellido: true,
        email: true,
        role: true,
        createdAt: true,
      },
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
      />
    </div>
  );
}
