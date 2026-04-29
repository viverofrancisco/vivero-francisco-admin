import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { testWhatsappSchema } from "@/lib/validations/notificacion";
import { createMetaProvider } from "@/lib/whatsapp/meta-provider";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = testWhatsappSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const provider = createMetaProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "Variables de entorno WHATSAPP_API_TOKEN y WHATSAPP_PHONE_NUMBER_ID no configuradas",
      },
      { status: 400 }
    );
  }

  const formatted = formatForWhatsApp(result.data.telefono);

  // Use the default "hello_world" template that Meta provides for testing.
  // Free-form text messages only work within a 24h conversation window
  // (i.e., after the user messages you first), so templates are required
  // for business-initiated messages.
  const sendResult = await provider.sendTemplate(
    formatted,
    "hello_world",
    "en_US",
    []
  );

  if (!sendResult.success) {
    return NextResponse.json(
      { error: sendResult.error || "Error al enviar mensaje de prueba" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: sendResult.messageId,
  });
}
