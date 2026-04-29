import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { NotificacionHistorial } from "@/components/configuracion/notificacion-historial";
import { WhatsAppToggle } from "@/components/configuracion/whatsapp-toggle";
import { MensajesEntrantesConfig } from "@/components/configuracion/mensajes-entrantes-config";
import { Users, Shield, ArrowRight } from "lucide-react";

export default async function NotificacionesPage() {
  await requireAdmin();

  const notificacionConfig = await prisma.notificacionConfig.findFirst();

  if (!notificacionConfig) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p>Las notificaciones no están configuradas.</p>
          <p className="text-sm mt-1">
            Ejecuta{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded">
              npx tsx scripts/seed-notificaciones.ts
            </code>{" "}
            para inicializar la configuración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-gray-500">
            Configura las notificaciones por WhatsApp
          </p>
        </div>
        <WhatsAppToggle activo={notificacionConfig.whatsappActivo} />
      </div>

      {/* Audience Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/configuracion/notificaciones/clientes">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Para Clientes</CardTitle>
                    <CardDescription>
                      Confirmaciones y recordatorios de visitas
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/configuracion/notificaciones/admin">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Shield className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Para Administradores
                    </CardTitle>
                    <CardDescription>
                      Resúmenes diarios y alertas de visitas
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Incoming messages config */}
      <MensajesEntrantesConfig
        config={{
          autoRespuestaActiva: notificacionConfig.autoRespuestaActiva,
          autoRespuestaContenido: notificacionConfig.autoRespuestaContenido,
          forwardActivo: notificacionConfig.forwardActivo,
          forwardTelefono: notificacionConfig.forwardTelefono,
        }}
      />

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Historial de envíos</h2>
        <NotificacionHistorial />
      </div>
    </div>
  );
}
