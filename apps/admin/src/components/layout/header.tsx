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
import Link from "next/link";
import { Brand } from "./brand";
import { BuscadorMovil, GlobalSearch } from "./global-search";
import { useCambiosPendientes } from "@/components/shared/cambios-pendientes";
import { Loader2 } from "lucide-react";

interface BrandingProps {
  branding: { logoUrl: string | null; nombre: string | null };
}

export function Header({ branding }: BrandingProps) {
  const { data: session } = useSession();
  const cambios = useCambiosPendientes();
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
    <header className="relative z-30 flex h-16 flex-none items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md md:h-20 md:px-6">
      {/* En escritorio el logo vive arriba del sidebar; en móvil no hay
          sidebar, así que va acá — y compacto, porque el ancho lo comparte
          con el buscador. */}
      {!cambios && (
        <Link
          href="/dashboard"
          className="flex-none md:hidden"
          aria-label="Inicio"
        >
          <Brand
            logoUrl={branding.logoUrl}
            nombre={branding.nombre}
            markSize={34}
            compacto
          />
        </Link>
      )}

      {/* Con cambios sin guardar, el buscador se va y queda esto: buscar otra
          cosa mientras hay algo a medio escribir no es lo que alguien está por
          hacer, y guardar tiene que estar donde siempre se mira. */}
      {cambios ? (
        <div className="flex flex-1 items-center gap-3">
          <span className="min-w-0 truncate text-sm font-medium">
            {/* Qué falta, cuando falta algo: un botón gris sin explicación deja
                a alguien probando campos a ver cuál lo destraba. */}
            {cambios.motivo ?? "Cambios sin guardar"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={cambios.onDescartar}
              disabled={cambios.guardando}
            >
              Descartar
            </Button>
            <Button
              type="button"
              onClick={cambios.onGuardar}
              disabled={cambios.guardando || !cambios.puedeGuardar}
            >
              {cambios.guardando && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* En móvil el campo no cabe: el ancho lo comparte con el logo y el
              avatar. Ahí va un ícono que abre la búsqueda a pantalla completa. */}
          <GlobalSearch className="hidden w-full max-w-md md:block" />
          <div className="flex-1" />
          <BuscadorMovil />
        </>
      )}

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
