import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { JardineroForm } from "@/components/jardineros/jardinero-form";

export default async function EditarJardineroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const jardinero = await prisma.jardinero.findUnique({ where: { id } });

  if (!jardinero) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <JardineroForm initialData={jardinero} />
    </div>
  );
}
