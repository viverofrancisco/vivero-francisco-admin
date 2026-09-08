"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Users,
  Tag,
  UserCheck,
  UsersRound,
  CalendarDays,
  FileText,
  MessageSquare,
  Settings,
  MapPin,
  Menu,
  LogOut,
  ChevronDown,
  X,
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

/** El menú completo — el mismo del sidebar, que es lo que abre "Más". */
const navItems: NavItem[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Clientes",
    href: "/dashboard/clientes",
    icon: Users,
    roles: ["ADMIN", "STAFF", "PERSONAL_ADMIN"],
  },
  {
    label: "Productos",
    href: "/dashboard/productos",
    icon: Tag,
    roles: ["ADMIN", "STAFF"],
    children: [{ label: "Categorías", href: "/dashboard/productos/categorias" }],
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
      { label: "Facturación electrónica", href: "/dashboard/configuracion/facturacion" },
    ],
  },
];

/**
 * Los cuatro atajos de la barra, en orden. El quinto siempre es "Más".
 *
 * Son los cuatro del día a día, y por eso van estos y no los del menú
 * completo: el catálogo se toca de vez en cuando —se carga un producto y no se
 * vuelve— mientras que los informes se consultan seguido. Productos sigue a un
 * toque, en "Más".
 */
const HREFS_TAB = [
  "/dashboard/clientes",
  "/dashboard/visitas",
  "/dashboard/ordenes",
  "/dashboard/informes",
];

const CUPOS = HREFS_TAB.length;

/**
 * Qué va en la barra para este rol.
 *
 * Son cuatro cupos fijos: un `PERSONAL` no ve Clientes ni Productos ni
 * Órdenes, y dejar el hueco —o peor, un tab que responde 403— es peor que
 * rellenarlo con lo primero que sí puede abrir. El orden preferido manda y el
 * resto entra por el orden del menú.
 */
function tabsVisibles(items: NavItem[]): NavItem[] {
  const tabs: NavItem[] = [];
  for (const href of HREFS_TAB) {
    const item = items.find((i) => i.href === href);
    if (item) tabs.push(item);
  }
  for (const item of items) {
    if (tabs.length >= CUPOS) break;
    if (!tabs.includes(item)) tabs.push(item);
  }
  return tabs.slice(0, CUPOS);
}

function esActivo(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

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
  /**
   * De quién es la sesión, según el servidor.
   *
   * No sale de `useSession()`: ese hook no tiene el rol en el primer render
   * del cliente, así que el menú se dibujaba más corto de lo que mandó el
   * servidor y se corrían los `useId` de todo lo que viene después.
   */
  role: UserRole;
}

/**
 * La navegación de móvil: una barra de cinco al pie.
 *
 * No está flotando sobre el contenido — es el último hijo de la columna del
 * layout, así que el alto lo reparte el flex y el único que scrollea es el
 * `main`. Un nav `fixed` obliga a que cada página se acuerde de dejarle
 * espacio abajo, y la que se olvida esconde su última fila.
 */
export function MobileNav({ branding, role }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Navegar cierra el menú, y por eso el estado recuerda desde qué ruta se
  // abrió en vez de ser un booleano suelto: el clic en un item ya lo cierra,
  // pero el gesto de "atrás" del teléfono cambia la ruta sin pasar por ningún
  // onClick, y ahí el menú quedaba tapando la pantalla a la que se volvió.
  const [menu, setMenu] = useState({
    abierto: false,
    ruta: pathname,
    expandidas: {} as Record<string, boolean>,
  });
  const open = menu.abierto && menu.ruta === pathname;
  // Abrir y cerrar arranca de cero: el menú vuelve mostrando la sección de la
  // página en la que uno está, no la que dejó desplegada hace media hora.
  const setOpen = (valor: boolean) =>
    setMenu({ abierto: valor, ruta: pathname, expandidas: {} });

  const visibles = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );
  const tabs = tabsVisibles(visibles);

  // La sección de la página actual arranca desplegada; después manda lo que se
  // haya tocado. Al revés —derivarla de la ruta y nada más, como hace el
  // sidebar— la flechita no tendría nada que hacer: ver los hijos de otra
  // sección obligaría a entrar en ella primero.
  const seccionDeLaRuta = seccionAbierta(pathname, navItems);
  const expandida = (href: string) =>
    menu.expandidas[href] ?? href === seccionDeLaRuta;
  const alternar = (href: string) =>
    setMenu((m) => ({
      ...m,
      expandidas: {
        ...m.expandidas,
        [href]: !(m.expandidas[href] ?? href === seccionDeLaRuta),
      },
    }));

  // "Más" queda marcado cuando lo que se está viendo no es ninguno de los
  // cuatro atajos: si no, estar en Informes no se refleja en ningún lado.
  const enOtraParte = !tabs.some((t) => esActivo(pathname, t.href));

  const userName =
    [session?.user?.name, session?.user?.apellido].filter(Boolean).join(" ") ||
    "Usuario";
  const iniciales = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const claseTab = (activo: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
      activo ? "text-primary" : "text-muted-foreground"
    );

  return (
    <>
      <nav
        className="flex-none border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegación principal"
      >
        <div className="flex h-16 items-stretch">
          {tabs.map((item) => {
            const activo = esActivo(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={claseTab(activo)}
              >
                <item.icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={activo ? 2.4 : 1.9}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={claseTab(enOtraParte)}
          >
            <Menu
              className="h-[22px] w-[22px]"
              strokeWidth={enOtraParte ? 2.4 : 1.9}
            />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {/* El menú completo ocupa la pantalla entera: un off-canvas al 75% deja
          una franja de contenido a la derecha que invita a tocarla y a cerrar
          sin querer, y encima recorta las etiquetas largas. */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Popup
            className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0 md:hidden"
            aria-label="Menú"
          >
            <DialogPrimitive.Title className="sr-only">
              Menú
            </DialogPrimitive.Title>

            <div className="flex h-16 flex-none items-center justify-between border-b border-border px-4">
              {/* Mismo tamaño que en el header: la franja de arriba mide lo
                  mismo en los dos, y el logo del sidebar (h-14) la llena
                  entera. */}
              <Brand
                logoUrl={branding.logoUrl}
                nombre={branding.nombre}
                markSize={34}
                compacto
              />
              <DialogPrimitive.Close
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {visibles.map((item) => {
                const activo = esActivo(pathname, item.href);
                const hijos = (item.children ?? []).filter(
                  (child) => !child.roles || (role && child.roles.includes(role))
                );
                const abierta = hijos.length > 0 && expandida(item.href);

                return (
                  <div key={item.href} className="mb-1">
                    {/* La palabra y la flecha son dos blancos distintos: tocar
                        el nombre lleva a la página, tocar la flecha muestra lo
                        que cuelga de ella. Un solo blanco obliga a elegir cuál
                        de las dos cosas hace el tap, y la otra queda sin
                        manera de pedirse. */}
                    <div className="flex items-center gap-1">
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors",
                          activo
                            ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                            : "font-medium text-foreground hover:bg-secondary"
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-none" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                      {hijos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => alternar(item.href)}
                          aria-expanded={abierta}
                          aria-label={`${abierta ? "Ocultar" : "Mostrar"} las secciones de ${item.label}`}
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform",
                              abierta && "rotate-180"
                            )}
                          />
                        </button>
                      )}
                    </div>
                    {abierta && (
                      <div className="mt-1 space-y-1 pl-11">
                        {hijos.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-sm transition-colors",
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
            </div>

            <div className="flex-none border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent p-2.5">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {iniciales}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-foreground">
                    {userName}
                  </div>
                  <div className="truncate text-[11px] font-semibold text-muted-foreground">
                    {session?.user?.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
