import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { InviteForm } from "@/components/configuracion/invite-form";
import { UsersTable } from "@/components/configuracion/users-table";

export default async function UsuariosPage() {
  const actual = await requireAdmin();

  const [users, sectores] = await Promise.all([
    prisma.user.findMany({
      // CLIENTE users live in this table only as auth shadows; their identity
      // is on Cliente. They're managed from the Clientes section, not here.
      where: { role: { not: "CLIENTE" } },
      select: {
        id: true,
        name: true,
        apellido: true,
        email: true,
        role: true,
        createdAt: true,
        // Solo para saber si ya eligió contraseña. El hash no sale de acá:
        // se convierte en un booleano antes de llegar al cliente.
        password: true,
        accesoRevocadoEl: true,
        // Un enlace vivo significa "ya le mandamos la invitación, falta que la
        // use". Sin esto, alguien revocado al que acaban de reinvitar se ve
        // exactamente igual que uno al que nadie tocó.
        _count: {
          select: {
            setPasswordTokens: {
              where: {
                usedAt: null,
                anuladoEl: null,
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sector.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* El botón a la altura del título, como en el resto del portal. En
          móvil se esconde detrás del ⋯, igual que las demás pantallas: al lado
          del título no entra sin partirlo en dos renglones. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <InviteForm sectores={sectores} />
      </div>

      <UsersTable
        usuarioActualId={actual.id}
        users={users.map(({ password, accesoRevocadoEl, _count, ...u }) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          tieneContrasena: password !== null,
          revocado: accesoRevocadoEl !== null,
          enlacePendiente: _count.setPasswordTokens > 0,
        }))}
      />
    </div>
  );
}
