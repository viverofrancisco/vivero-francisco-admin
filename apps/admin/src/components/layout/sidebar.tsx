"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import { Brand } from "./brand";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users, roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"] },
  {
    label: "Servicios",
    href: "/dashboard/servicios",
    icon: Wrench,
    roles: ["ADMIN", "STAFF"],
    children: [
      { label: "Ver Servicios", href: "/dashboard/servicios" },
      { label: "Asignar a Clientes", href: "/dashboard/servicios/asignar" },
    ],
  },
  {
    label: "Visitas",
    href: "/dashboard/visitas",
    icon: CalendarDays,
    children: [
      { label: "Ver Visitas", href: "/dashboard/visitas" },
      { label: "Nueva Visita", href: "/dashboard/visitas/nueva" },
    ],
  },
  { label: "Mensajes", href: "/dashboard/mensajes", icon: MessageSquare },
  {
    label: "Informes",
    href: "/dashboard/informes",
    icon: FileText,
    roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"],
    children: [
      { label: "Ver informes", href: "/dashboard/informes" },
      { label: "Generar nuevo", href: "/dashboard/informes/nuevo" },
      { label: "Tipos de actividad", href: "/dashboard/configuracion/tipos-actividad" },
      { label: "Firmantes", href: "/dashboard/configuracion/firmantes" },
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

interface BrandingProps {
  branding: { logoUrl: string | null; nombre: string | null };
}

export function Sidebar({ branding }: BrandingProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const filteredItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  // Initialize expanded state: auto-expand if currently on a child route
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children) {
        initial[item.href] =
          pathname === item.href ||
          pathname.startsWith(item.href + "/");
      }
    }
    return initial;
  });

  const toggleExpanded = (href: string) => {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-white h-screen min-h-0">
      <div className="flex h-20 flex-none items-center justify-center border-b px-4">
        <Brand logoUrl={branding.logoUrl} nombre={branding.nombre} />
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 p-4">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isExpanded = expanded[item.href] ?? false;
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.href}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )}
              {hasChildren && isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition-colors",
                        pathname === child.href
                          ? "text-primary font-medium"
                          : "text-gray-500 hover:text-gray-900"
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
    </aside>
  );
}
