import { getEmpresaConfig } from "@/lib/services/empresa-config.service";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const cfg = await getEmpresaConfig();
  return (
    <LoginForm
      logoUrl={cfg.logoUrl}
      nombre={cfg.nombre ?? "Vivero Francisco"}
    />
  );
}
