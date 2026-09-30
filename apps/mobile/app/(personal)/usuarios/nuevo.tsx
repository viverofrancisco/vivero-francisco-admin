import { useState } from "react";
import { useRouter } from "expo-router";
import { UsuarioForm } from "@/components/UsuarioForm";
import { HojaDeEnlace } from "@/components/personal/HojaDeEnlace";
import { apiRequest } from "@/lib/api";
import type { EnlaceGenerado, UsuarioDelEquipo } from "@/lib/types";

/**
 * Crear una cuenta del equipo. Nada sale solo: al crearla aparece su enlace
 * de invitación para copiarlo, compartirlo o mandarlo por correo, como en el
 * portal; al cerrar esa hoja se vuelve a la lista.
 */
export default function UsuarioNuevoScreen() {
  const router = useRouter();
  const [creado, setCreado] = useState<
    (EnlaceGenerado & { usuario: UsuarioDelEquipo }) | null
  >(null);

  return (
    <>
      <UsuarioForm
        titulo="Nuevo usuario"
        accion="Crear"
        onCancelar={() => router.back()}
        onSubmit={async (valores) => {
          setCreado(
            await apiRequest<EnlaceGenerado & { usuario: UsuarioDelEquipo }>(
              "/api/mobile/users",
              { method: "POST", body: valores }
            )
          );
        }}
      />
      <HojaDeEnlace
        datos={creado}
        nombre={[creado?.usuario.name, creado?.usuario.apellido].filter(Boolean).join(" ")}
        tipo="invitacion"
        correo={creado?.usuario.email}
        userId={creado?.usuario.id}
        onCerrar={() => {
          setCreado(null);
          router.back();
        }}
      />
    </>
  );
}
