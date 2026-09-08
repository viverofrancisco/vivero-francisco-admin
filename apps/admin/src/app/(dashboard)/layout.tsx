import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";
import { requireAuth } from "@/lib/auth-helpers";
import { CambiosPendientesProvider } from "@/components/shared/cambios-pendientes";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await getEmpresaConfig();
  const branding = { logoUrl: cfg.logoUrl, nombre: cfg.nombre };
  // El rol viaja desde el servidor en vez de salir de `useSession()` en cada
  // nav. Ese hook no tiene el rol en el primer render del cliente, así que la
  // lista de secciones salía más corta que la que mandó el servidor: cambiaba
  // la cantidad de hijos del `<nav>` y con eso se corrían los `useId` de todo
  // lo que viene después —de ahí los avisos de hidratación de Base UI—. De
  // paso, el menú deja de parpadear al cargar.
  const { role } = await requireAuth();
  return (
    // El provider envuelve al header **y** al contenido: una pantalla con
    // cambios sin guardar los publica desde adentro y el header los dibuja
    // arriba, en lugar del buscador.
    //
    // `h-dvh` y no `h-screen`: en el navegador del teléfono `100vh` cuenta la
    // barra de direcciones, así que el nav de abajo quedaba fuera de la
    // pantalla hasta que uno scrolleaba.
    <CambiosPendientesProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar branding={branding} role={role} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header branding={branding} />
          {/* El único que scrollea. Header arriba y nav abajo son `flex-none`,
              y el alto del medio es lo que sobra. */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">
            {children}
          </main>
          <MobileNav branding={branding} role={role} />
        </div>
      </div>
    </CambiosPendientesProvider>
  );
}
