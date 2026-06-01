import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await getEmpresaConfig();
  const branding = { logoUrl: cfg.logoUrl, nombre: cfg.nombre };
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar branding={branding} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header branding={branding} />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
