"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Users,
  Wrench,
  UserCheck,
  UsersRound,
  CalendarDays,
  Settings,
  MapPin,
  Menu,
  ChevronDown,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
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

const navItems: NavItem[] = [
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
    roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"],
    children: [
      { label: "Borradores", href: "/dashboard/ordenes/borradores" },
      { label: "Por cobrar", href: "/dashboard/ordenes/por-cobrar" },
    ],
  },
  { label: "Personal", href: "/dashboard/personal", icon: UserCheck, roles: ["ADMIN", "STAFF"] },
  { label: "Grupos", href: "/dashboard/grupos", icon: UsersRound, roles: ["ADMIN", "STAFF"] },
  { label: "Sectores", href: "/dashboard/sectores", icon: MapPin, roles: ["ADMIN"] },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings, roles: ["ADMIN"] },
];

/**
 * Qué sección del menú está abierta. Igual que en el sidebar: se deriva de la
 * ruta, así hay una sola abierta y nunca queda desincronizada de lo que se ve.
 * Gana la coincidencia más larga, para los hijos alojados bajo otra rama.
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

interface MobileNavProps {
  branding: { logoUrl: string | null; nombre: string | null };
}

export function MobileNav({ branding }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const role = session?.user?.role;

  const filteredItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const abierta = seccionAbierta(pathname, navItems);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-20 items-center justify-center border-b px-4">
          <Brand logoUrl={branding.logoUrl} nombre={branding.nombre} />
        </div>
        <nav className="space-y-1 p-4">
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const isExpanded = abierta === item.href;
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.href}>
                {/* Siempre un Link: el clic navega, y abrir la sección es
                    consecuencia de haber llegado ahí. */}
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
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
                        (child) =>
                          !child.roles || (role && child.roles.includes(role))
                      )
                      .map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
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
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
