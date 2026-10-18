import { Suspense } from "react";
import { SetPasswordForm } from "@/app/establecer-contrasena/set-password-form";

export const metadata = {
  title: "Crear contraseña — Vivero Francisco",
};

/**
 * El enlace de acceso de **alguien del equipo**: la misma página que el del
 * cliente, en otra ruta para que en el teléfono lo abra Vivero Francisco Admin
 * y no la app de clientes (`enlaces-a-la-app.ts`).
 */
export default function EstablecerContrasenaDelEquipoPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
