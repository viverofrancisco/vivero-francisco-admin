import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wrench, UserCheck, UsersRound, CalendarDays } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth();

  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();
  const inicioMes = new Date(anioActual, mesActual, 1);
  const finMes = new Date(anioActual, mesActual + 1, 1);

  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const isPersonalAdmin = user.role === "PERSONAL_ADMIN";
  const isPersonal = user.role === "PERSONAL";

  // Build visit filter based on role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitaBase: any = { fechaProgramada: { gte: inicioMes, lt: finMes } };

  if (isPersonalAdmin) {
    const sectorIds = await getUserSectorIds(user.id);
    visitaBase.clienteServicio = { cliente: { sectorId: { in: sectorIds } } };
  } else if (isPersonal) {
    const personal = await prisma.personal.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (personal) {
      visitaBase.grupo = { miembros: { some: { personalId: personal.id } } };
    } else {
      visitaBase.id = "none";
    }
  }

  const promises: Promise<number>[] = [];

  if (isAdmin) {
    promises.push(
      prisma.cliente.count({ where: { deletedAt: null } }),
      prisma.servicio.count({ where: { deletedAt: null } }),
      prisma.personal.count({ where: { deletedAt: null } }),
      prisma.grupo.count({ where: { deletedAt: null } }),
    );
  } else if (isPersonalAdmin) {
    const sectorIds = await getUserSectorIds(user.id);
    promises.push(
      prisma.cliente.count({ where: { sectorId: { in: sectorIds }, deletedAt: null } }),
    );
  }

  promises.push(
    prisma.visita.count({ where: { ...visitaBase, deletedAt: null } }),
    prisma.visita.count({ where: { ...visitaBase, deletedAt: null, estado: "PROGRAMADA" } }),
    prisma.visita.count({ where: { ...visitaBase, deletedAt: null, estado: "COMPLETADA" } }),
    prisma.visita.count({ where: { ...visitaBase, deletedAt: null, estado: "INCOMPLETA" } }),
  );

  const counts = await Promise.all(promises);

  let clientesCount = 0, serviciosCount = 0, personalCount = 0, gruposCount = 0;
  let visitasMesTotal: number, visitasProgramadas: number, visitasCompletadas: number, visitasIncompletas: number;

  if (isAdmin) {
    [clientesCount, serviciosCount, personalCount, gruposCount, visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  } else if (isPersonalAdmin) {
    [clientesCount, visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  } else {
    [visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  }

  const adminStats = [
    { label: "Clientes", count: clientesCount, href: "/dashboard/clientes", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Servicios", count: serviciosCount, href: "/dashboard/servicios", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Personal", count: personalCount, href: "/dashboard/personal", icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
    { label: "Grupos", count: gruposCount, href: "/dashboard/grupos", icon: UsersRound, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const mesNombre = now.toLocaleDateString("es-EC", { month: "long" });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Bienvenido, {[user.name, user.apellido].filter(Boolean).join(" ") || "Usuario"}
        </h1>
        <p className="text-gray-500">
          {isAdmin ? "Resumen general del vivero" : isPersonalAdmin ? "Resumen de tus sectores" : "Tus próximas visitas"}
        </p>
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {adminStats.map((stat) => (
            <Link key={stat.href} href={stat.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </CardTitle>
                  <div className={`rounded-md p-2 ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stat.count}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {isPersonalAdmin && (
        <Link href="/dashboard/clientes">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Clientes en tus sectores
              </CardTitle>
              <div className="rounded-md p-2 bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{clientesCount}</p>
            </CardContent>
          </Card>
        </Link>
      )}

      <Link href="/dashboard/visitas">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isPersonal ? "Mis visitas de" : "Visitas de"}{" "}
              <span className="capitalize">{mesNombre}</span> {anioActual}
            </CardTitle>
            <div className="rounded-md p-2 bg-teal-50">
              <CalendarDays className="h-5 w-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{visitasMesTotal}</p>
            <div className="mt-2 flex gap-4 text-sm text-gray-500">
              <span>{visitasProgramadas} pendientes</span>
              <span>{visitasCompletadas} completadas</span>
              {visitasIncompletas > 0 && (
                <span className="text-red-500">{visitasIncompletas} incompletas</span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
