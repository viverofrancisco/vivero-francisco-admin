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
  Users,
  Wrench,
  UserCheck,
  UsersRound,
  CalendarDays,
  Settings,
  MapPin,
  Menu,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users, roles: ["ADMIN", "STAFF", "JARDINERO_ADMIN"] },
  { label: "Servicios", href: "/dashboard/servicios", icon: Wrench, roles: ["ADMIN", "STAFF"] },
  { label: "Visitas", href: "/dashboard/visitas", icon: CalendarDays },
  { label: "Jardineros", href: "/dashboard/jardineros", icon: UserCheck, roles: ["ADMIN", "STAFF"] },
  { label: "Grupos", href: "/dashboard/grupos", icon: UsersRound, roles: ["ADMIN", "STAFF"] },
  { label: "Sectores", href: "/dashboard/sectores", icon: MapPin, roles: ["ADMIN"] },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings, roles: ["ADMIN"] },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const role = session?.user?.role;

  const filteredItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-lg font-bold text-green-700">Vivero Francisco</h1>
        </div>
        <nav className="space-y-1 p-4">
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
