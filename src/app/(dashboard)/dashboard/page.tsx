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
  const isJardineroAdmin = user.role === "JARDINERO_ADMIN";
  const isJardinero = user.role === "JARDINERO";

  // Build visit filter based on role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitaBase: any = { fechaProgramada: { gte: inicioMes, lt: finMes } };

  if (isJardineroAdmin) {
    const sectorIds = await getUserSectorIds(user.id);
    visitaBase.clienteServicio = { cliente: { sectorId: { in: sectorIds } } };
  } else if (isJardinero) {
    const jardinero = await prisma.jardinero.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (jardinero) {
      visitaBase.grupo = { miembros: { some: { jardineroId: jardinero.id } } };
    } else {
      visitaBase.id = "none";
    }
  }

  const promises: Promise<number>[] = [];

  if (isAdmin) {
    promises.push(
      prisma.cliente.count(),
      prisma.servicio.count(),
      prisma.jardinero.count(),
      prisma.grupoJardinero.count(),
    );
  } else if (isJardineroAdmin) {
    const sectorIds = await getUserSectorIds(user.id);
    promises.push(
      prisma.cliente.count({ where: { sectorId: { in: sectorIds } } }),
    );
  }

  promises.push(
    prisma.visita.count({ where: visitaBase }),
    prisma.visita.count({ where: { ...visitaBase, estado: "PROGRAMADA" } }),
    prisma.visita.count({ where: { ...visitaBase, estado: "COMPLETADA" } }),
    prisma.visita.count({ where: { ...visitaBase, estado: "INCOMPLETA" } }),
  );

  const counts = await Promise.all(promises);

  let clientesCount = 0, serviciosCount = 0, jardinerosCount = 0, gruposCount = 0;
  let visitasMesTotal: number, visitasProgramadas: number, visitasCompletadas: number, visitasIncompletas: number;

  if (isAdmin) {
    [clientesCount, serviciosCount, jardinerosCount, gruposCount, visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  } else if (isJardineroAdmin) {
    [clientesCount, visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  } else {
    [visitasMesTotal, visitasProgramadas, visitasCompletadas, visitasIncompletas] = counts;
  }

  const adminStats = [
    { label: "Clientes", count: clientesCount, href: "/dashboard/clientes", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Servicios", count: serviciosCount, href: "/dashboard/servicios", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Jardineros", count: jardinerosCount, href: "/dashboard/jardineros", icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Grupos", count: gruposCount, href: "/dashboard/grupos", icon: UsersRound, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const mesNombre = now.toLocaleDateString("es-EC", { month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Bienvenido, {user.name ?? "Usuario"}
        </h1>
        <p className="text-gray-500">
          {isAdmin ? "Resumen general del vivero" : isJardineroAdmin ? "Resumen de tus sectores" : "Tus próximas visitas"}
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

      {isJardineroAdmin && (
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
              {isJardinero ? "Mis visitas de" : "Visitas de"}{" "}
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
