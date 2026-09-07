import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";
import { CambiosPendientesProvider } from "@/components/shared/cambios-pendientes";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await getEmpresaConfig();
  const branding = { logoUrl: cfg.logoUrl, nombre: cfg.nombre };
  return (
    // El provider envuelve al header **y** al contenido: una pantalla con
    // cambios sin guardar los publica desde adentro y el header los dibuja
    // arriba, en lugar del buscador.
    <CambiosPendientesProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar branding={branding} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header branding={branding} />
          <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
        </div>
      </div>
    </CambiosPendientesProvider>
  );
}
