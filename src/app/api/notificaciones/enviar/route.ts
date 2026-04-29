import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { enviarManualSchema } from "@/lib/validations/notificacion";
import {
  enviarConfirmacionVisita,
  enviarRecordatorioCliente,
  enviarResumenDiarioAdmin,
  enviarAlertaVisitaCompletada,
  enviarAlertaVisitaIncompleta,
} from "@/lib/whatsapp/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = enviarManualSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const { tipo, visitaId } = result.data;

  try {
    switch (tipo) {
      case "CONFIRMACION_VISITA_CLIENTE":
        if (!visitaId) {
          return NextResponse.json(
            { error: "Se requiere visitaId" },
            { status: 400 }
          );
        }
        await enviarConfirmacionVisita(visitaId);
        break;
      case "RECORDATORIO_VISITA_CLIENTE":
        if (!visitaId) {
          return NextResponse.json(
            { error: "Se requiere visitaId" },
            { status: 400 }
          );
        }
        await enviarRecordatorioCliente(visitaId);
        break;
      case "RESUMEN_DIARIO_ADMIN":
        await enviarResumenDiarioAdmin();
        break;
      case "ALERTA_VISITA_COMPLETADA":
        if (!visitaId) {
          return NextResponse.json(
            { error: "Se requiere visitaId" },
            { status: 400 }
          );
        }
        await enviarAlertaVisitaCompletada(visitaId);
        break;
      case "ALERTA_VISITA_INCOMPLETA":
        if (!visitaId) {
          return NextResponse.json(
            { error: "Se requiere visitaId" },
            { status: 400 }
          );
        }
        await enviarAlertaVisitaIncompleta(visitaId);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar" },
      { status: 500 }
    );
  }
}
