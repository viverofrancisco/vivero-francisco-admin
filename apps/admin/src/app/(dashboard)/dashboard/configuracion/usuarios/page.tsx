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
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground">Administra los usuarios del sistema</p>
      </div>

      <div className="flex justify-end">
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
