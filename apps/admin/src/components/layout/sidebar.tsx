"use client";

import Link from "next/link";
import { ETIQUETA_DE_ROL } from "@vivero/shared";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  LayoutDashboard,
  Users,
  Tag,
  UserCheck,
  UsersRound,
  CalendarDays,
  FileText,
  Settings,
  MapPin,
  ChevronDown,
  Receipt,
  RefreshCw,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import { Brand } from "./brand";

/** Lo que va debajo del nombre cuando no hay correo. Las mismas palabras
 *  que la página de Cuenta. */
const ROL: Record<string, string> = ETIQUETA_DE_ROL;

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
  // Sin el jardinero: su panel era una lista de sus visitas con otro nombre,
  // y `/dashboard` ahora lo manda directo a Visitas.
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF"] },
  {
    label: "Clientes",
    href: "/dashboard/clientes",
    icon: Users,
    roles: ["ADMIN", "STAFF"],
    // Lo que los clientes piden desde la app: visitas y cotizaciones.
    children: [{ label: "Solicitudes", href: "/dashboard/clientes/solicitudes" }],
  },
  {
    label: "Productos",
    href: "/dashboard/productos",
    icon: Tag,
    roles: ["ADMIN", "STAFF"],
    children: [{ label: "Categorías", href: "/dashboard/productos/categorias" }],
  },
  {
    label: "Visitas",
    href: "/dashboard/visitas",
    icon: CalendarDays,
    children: [
      {
        label: "Tareas",
        href: "/dashboard/visitas/tareas",
        roles: ["ADMIN", "STAFF"],
      },
    ],
  },
  // Sin `roles`: el jardinero también tiene chats, y es de las dos cosas que
  // abre todos los días.
  { label: "Chats", href: "/dashboard/chats", icon: MessageCircle },
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
    roles: ["ADMIN", "STAFF"],
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
      { label: "Facturación electrónica", href: "/dashboard/configuracion/facturacion" },
    ],
  },
  // Cuenta no está acá: en el escritorio es el bloque con el nombre al pie
  // de la barra. En el teléfono sí es una entrada del menú.
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
  /**
   * De quién es la sesión, según el servidor.
   *
   * No sale de `useSession()`: ese hook no tiene el rol en el primer render
   * del cliente, así que el menú se dibujaba más corto de lo que mandó el
   * servidor y se corrían los `useId` de todo lo que viene después.
   */
  role: UserRole;
}

export function Sidebar({ branding, role }: BrandingProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.roles || (role && item.roles.includes(role)));

  const mainVisible = visible(mainItems);

  const abierta = seccionAbierta(pathname, mainItems);

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const isExpanded = abierta === item.href;
    // Solo cuentan los hijos que este rol puede ver: "Tareas" es de oficina, y
    // al jardinero le quedaba una flechita en Visitas sin nada debajo.
    const hijosVisibles = (item.children ?? []).filter(
      (c) => !c.roles || c.roles.includes(role)
    );
    const hasChildren = hijosVisibles.length > 0;

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
  // El jardinero no tiene correo: debajo del nombre va lo que es.
  const debajo = session?.user?.email || ROL[role] || "";
  const enCuenta = pathname.startsWith("/dashboard/cuenta");

  return (
    <aside className="hidden h-dvh min-h-0 bg-sidebar md:flex md:w-64 md:flex-col md:border-r">
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

      {/* El bloque con el nombre **es** la entrada a Cuenta: abría un menú
          con el nombre otra vez y "Cerrar sesión", que ya está en esa página.
          Como en la app y en el teléfono, donde Cuenta es una pestaña más. */}
      <div className="flex-none p-3">
        <Link
          href="/dashboard/cuenta"
          aria-current={enCuenta ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors",
            enCuenta
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "bg-sidebar-accent hover:bg-sidebar-accent/70"
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold",
              enCuenta
                ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            {userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate text-[13px] font-bold",
                enCuenta ? "" : "text-foreground"
              )}
            >
              {userName}
            </div>
            <div
              className={cn(
                "truncate text-[11px] font-semibold",
                enCuenta
                  ? "text-sidebar-primary-foreground/80"
                  : "text-muted-foreground"
              )}
            >
              {debajo}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
