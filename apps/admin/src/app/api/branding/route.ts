import { NextResponse } from "next/server";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";

// Public branding info — readable without auth so login screens and the mobile
// app can display the logo/name before the user signs in.
export async function GET() {
  const cfg = await getEmpresaConfig();
  return NextResponse.json({
    nombre: cfg.nombre,
    logoUrl: cfg.logoUrl,
  });
}
