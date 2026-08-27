import { NextResponse } from "next/server";
import { ServiceError, httpStatusForServiceError } from "@/lib/services/errors";
import type { MobileUser } from "@/lib/mobile/auth";
import type { Viewer } from "@/lib/services/viewer";

export function viewerFromMobileUser(user: MobileUser): Viewer {
  return {
    id: user.id,
    role: user.role,
    personalId: user.personalId,
    clienteId: user.clienteId,
    nombre: [user.name, user.apellido].filter(Boolean).join(" ") || null,
  };
}

export function serviceErrorResponse(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: httpStatusForServiceError(error) }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
