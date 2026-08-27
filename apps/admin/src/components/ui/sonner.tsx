"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Arriba a la derecha: abajo tapaban la paginación de los listados y la
      // barra de acciones de los formularios, que es justo lo que uno acaba de
      // tocar cuando aparece el aviso.
      position="top-right"
      // Verde para lo que salió bien, rojo para lo que no. `richColors` es lo
      // que hace que sonner mire el tipo del aviso; los colores son los de la
      // paleta, definidos en globals.css.
      richColors
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--toast-ok)",
          "--success-border": "var(--toast-ok-border)",
          "--success-text": "var(--toast-ok-foreground)",
          "--error-bg": "var(--toast-error)",
          "--error-border": "var(--toast-error-border)",
          "--error-text": "var(--toast-error-foreground)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
