import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  enviarRecordatorioCliente,
  enviarResumenDiarioAdmin,
} from "@/lib/whatsapp/service";
import { pushRecordatorioCliente } from "@/lib/push/triggers";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = await prisma.notificacionConfig.findFirst();
  if (!config?.whatsappActivo) {
    return NextResponse.json({ message: "WhatsApp desactivado" });
  }

  const results = { recordatorios: 0, digest: false, errors: [] as string[] };

  // 1. Send client reminders for visits scheduled in `diasAnticipacion` days
  try {
    const targetDate = new Date();
    // Adjust to Ecuador timezone
    const ecuadorNow = new Date(
      targetDate.toLocaleString("en-US", { timeZone: config.zonaHoraria })
    );
    const reminderDate = new Date(
      ecuadorNow.getFullYear(),
      ecuadorNow.getMonth(),
      ecuadorNow.getDate() + config.diasAnticipacion
    );
    const nextDay = new Date(reminderDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const visitas = await prisma.visita.findMany({
      where: {
        fechaProgramada: { gte: reminderDate, lt: nextDay },
        estado: "PROGRAMADA",
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const visita of visitas) {
      try {
        await enviarRecordatorioCliente(visita.id);
        results.recordatorios++;
      } catch (err) {
        results.errors.push(
          `Recordatorio ${visita.id}: ${err instanceof Error ? err.message : "Error"}`
        );
      }
      pushRecordatorioCliente(visita.id).catch((err) => {
        results.errors.push(
          `Push ${visita.id}: ${err instanceof Error ? err.message : "Error"}`
        );
      });
    }
  } catch (err) {
    results.errors.push(
      `Recordatorios: ${err instanceof Error ? err.message : "Error"}`
    );
  }

  // 2. Send daily digest to admins
  try {
    await enviarResumenDiarioAdmin();
    results.digest = true;
  } catch (err) {
    results.errors.push(
      `Digest: ${err instanceof Error ? err.message : "Error"}`
    );
  }

  return NextResponse.json({
    message: "Cron ejecutado",
    ...results,
  });
}
