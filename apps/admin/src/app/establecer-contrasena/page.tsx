import { Suspense } from "react";
import { SetPasswordForm } from "./set-password-form";

export const metadata = {
  title: "Crear contraseña — Vivero Francisco",
};

export default function EstablecerContrasenaPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
