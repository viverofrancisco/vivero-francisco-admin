"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Wrench,
  UserCheck,
  UsersRound,
  CalendarDays,
  FileText,
  MessageSquare,
  Settings,
  MapPin,
  ChevronDown,
  LogOut,
  Receipt,
  RefreshCw,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Brand } from "./brand";

interface NavChild {
  label: string;
  href: string;
  roles?: UserRole[];
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  children?: NavChild[];
}

const mainItems: NavItem[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Clientes",
    href: "/dashboard/clientes",
    icon: Users,
    roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"],
  },
  // Sin `children`: un desplegable de un solo ítem es un clic de más. "Nueva
  // visita" ya está dentro de la propia página de visitas.
  {
    label: "Productos",
    href: "/dashboard/productos",
    icon: Wrench,
    roles: ["ADMIN", "STAFF"],
  },
  { label: "Visitas", href: "/dashboard/visitas", icon: CalendarDays },
  { label: "Mensajes", href: "/dashboard/mensajes", icon: MessageSquare },
  {
    label: "Informes",
    href: "/dashboard/informes",
    icon: FileText,
    roles: ["ADMIN", "STAFF"],
    children: [
      { label: "Generar nuevo", href: "/dashboard/informes/nuevo" },
      { label: "Firmantes", href: "/dashboard/configuracion/firmantes" },
    ],
  },
  {
    label: "Suscripciones",
    href: "/dashboard/suscripciones",
    icon: RefreshCw,
    roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"],
  },
  {
    label: "Órdenes",
    href: "/dashboard/ordenes",
    icon: Receipt,
    roles: ["ADMIN", "STAFF"],
    children: [
      { label: "Borradores", href: "/dashboard/ordenes/borradores" },
      { label: "Por cobrar", href: "/dashboard/ordenes/por-cobrar" },
    ],
  },
  { label: "Personal", href: "/dashboard/personal", icon: UserCheck, roles: ["ADMIN", "STAFF"] },
  { label: "Grupos", href: "/dashboard/grupos", icon: UsersRound, roles: ["ADMIN", "STAFF"] },
  { label: "Sectores", href: "/dashboard/sectores", icon: MapPin, roles: ["ADMIN"] },
  {
    label: "Configuración",
    href: "/dashboard/configuracion",
    icon: Settings,
    roles: ["ADMIN"],
    children: [
      { label: "Empresa", href: "/dashboard/configuracion/empresa" },
      { label: "Usuarios", href: "/dashboard/configuracion/usuarios" },
      { label: "Notificaciones", href: "/dashboard/configuracion/notificaciones" },
    ],
  },
];

/**
 * Qué sección del menú está abierta.
 *
 * Se deriva de la ruta en vez de guardarse en estado: el padre navega a su
 * propia página, así que "la sección de la ruta actual" y "la sección abierta"
 * son lo mismo. De ahí sale solo que haya una sola abierta a la vez, y que
 * nunca se desincronice con lo que se está viendo.
 *
 * Gana la coincidencia más larga, que es lo que resuelve los hijos alojados
 * bajo otra rama: `/dashboard/configuracion/firmantes` cuelga de Informes, y
 * sin esto abriría Configuración.
 */
function seccionAbierta(pathname: string, items: NavItem[]): string | null {
  const alcanza = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  let mejor: { href: string; puntaje: number } | null = null;
  for (const item of items) {
    if (!item.children?.length) continue;
    const candidatos = [item.href, ...item.children.map((c) => c.href)];
    const puntaje = Math.max(
      0,
      ...candidatos.filter(alcanza).map((href) => href.length)
    );
    if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje)) {
      mejor = { href: item.href, puntaje };
    }
  }
  return mejor?.href ?? null;
}

interface BrandingProps {
  branding: { logoUrl: string | null; nombre: string | null };
}

export function Sidebar({ branding }: BrandingProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.roles || (role && item.roles.includes(role)));

  const mainVisible = visible(mainItems);

  const abierta = seccionAbierta(pathname, mainItems);

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const isExpanded = abierta === item.href;
    const hasChildren = item.children && item.children.length > 0;

    const baseClasses =
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors";
    const stateClasses = isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
      : "text-muted-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

    return (
      <div key={item.href}>
        {/* Siempre un Link, tenga hijos o no: el clic navega, y abrir la
            sección es consecuencia de haber llegado ahí. */}
        <Link href={item.href} className={cn(baseClasses, stateClasses)}>
          <item.icon className="h-[18px] w-[18px]" />
          <span className="flex-1 text-left">{item.label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </Link>
        {hasChildren && isExpanded && (
          <div className="ml-8 mt-1 space-y-1">
            {item
              .children!.filter(
                (child) => !child.roles || (role && child.roles.includes(role))
              )
              .map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                    pathname === child.href
                      ? "font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {child.label}
                </Link>
              ))}
          </div>
        )}
      </div>
    );
  };

  const userName =
    [session?.user?.name, session?.user?.apellido].filter(Boolean).join(" ") ||
    "Usuario";

  return (
    <aside className="hidden h-screen min-h-0 bg-sidebar md:flex md:w-64 md:flex-col md:border-r">
      <div className="flex h-20 flex-none items-center border-b px-5">
        <Brand
          logoUrl={branding.logoUrl}
          nombre={branding.nombre}
          subtitle={false}
        />
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {mainVisible.map(renderItem)}
      </nav>

      {/* Footer user menu */}
      <div className="flex-none p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl bg-sidebar-accent p-2.5 text-left transition-colors hover:bg-sidebar-accent/70"
              />
            }
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-foreground">
                {userName}
              </div>
              <div className="truncate text-[11px] font-semibold text-muted-foreground">
                {session?.user?.email}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="min-w-[230px]"
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="break-all text-xs leading-snug text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
