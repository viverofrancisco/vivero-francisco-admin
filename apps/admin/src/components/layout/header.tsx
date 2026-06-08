"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { GlobalSearch } from "./global-search";

interface BrandingProps {
  branding: { logoUrl: string | null; nombre: string | null };
}

export function Header({ branding }: BrandingProps) {
  const { data: session } = useSession();
  const userName =
    [session?.user?.name, session?.user?.apellido].filter(Boolean).join(" ") ||
    "Usuario";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="relative z-30 flex h-20 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md md:px-6">
      <MobileNav branding={branding} />

      <GlobalSearch className="w-full max-w-md" />

      <div className="flex-1" />

      {/* Profile lives in the sidebar footer on desktop; only shown here on
          mobile, where the sidebar is hidden. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" />}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-primary text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[240px] max-w-[320px]">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground break-all leading-snug">
                {session?.user?.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
