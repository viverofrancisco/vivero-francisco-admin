/**
 * La numeración de cada serie del SRI, contra la base.
 *
 * La librería exige que el proveedor de secuenciales sea de uno y no trae uno
 * de producción a propósito: un contador en memoria pierde la cuenta al
 * reiniciar el proceso, y en serverless eso pasa todo el tiempo. Un número
 * repetido lo rechaza el SRI, y uno salteado deja un hueco que hay que
 * justificar.
 *
 * `UPDATE ... RETURNING` en una sola sentencia: dos emisiones simultáneas se
 * serializan en la fila y cada una se lleva un número distinto. Un `SELECT` y
 * después un `UPDATE` no daría esa garantía.
 */
import { prisma } from "@/lib/prisma";

/** El próximo número de la serie, ya en los 9 dígitos que pide el XML. */
export async function siguienteSecuencial(
  emisorId: string,
  establecimiento: string,
  puntoEmision: string,
  tipoDocumento: string
): Promise<string> {
  const filas = await prisma.$queryRaw<{ valor: number }[]>`
    INSERT INTO "SecuencialSri" ("id", "emisorId", "establecimiento", "puntoEmision", "tipoDocumento", "valor")
    VALUES (gen_random_uuid()::text, ${emisorId}, ${establecimiento}, ${puntoEmision}, ${tipoDocumento}, 1)
    ON CONFLICT ("emisorId", "establecimiento", "puntoEmision", "tipoDocumento")
    DO UPDATE SET "valor" = "SecuencialSri"."valor" + 1
    RETURNING "valor"
  `;
  return String(filas[0].valor).padStart(9, "0");
}

/**
 * Devuelve el número a la serie cuando el SRI rechazó en recepción.
 *
 * Un comprobante devuelto **no existe** para el SRI —nunca se autorizó—, así
 * que su número queda libre. Sin esto cada estructura mal armada dejaría un
 * hueco permanente en la numeración.
 *
 * Solo baja si nadie tomó un número después: si ya avanzó, restarlo entregaría
 * dos veces el mismo.
 */
export async function devolverSecuencial(
  emisorId: string,
  establecimiento: string,
  puntoEmision: string,
  tipoDocumento: string,
  valorUsado: number
): Promise<void> {
  await prisma.secuencialSri.updateMany({
    where: {
      emisorId,
      establecimiento,
      puntoEmision,
      tipoDocumento,
      valor: valorUsado,
    },
    data: { valor: valorUsado - 1 },
  });
}

/**
 * Desde qué número arranca una serie.
 *
 * Hace falta cuando el RUC ya emitió por fuera —hoy, por Contífico— y el portal
 * tiene que continuar la numeración en vez de volver a empezar en 1, que sería
 * pedirle al SRI números ya usados.
 */
export async function fijarSecuencial(
  emisorId: string,
  establecimiento: string,
  puntoEmision: string,
  tipoDocumento: string,
  ultimoEmitido: number
): Promise<void> {
  await prisma.secuencialSri.upsert({
    where: {
      emisorId_establecimiento_puntoEmision_tipoDocumento: {
        emisorId,
        establecimiento,
        puntoEmision,
        tipoDocumento,
      },
    },
    create: {
      emisorId,
      establecimiento,
      puntoEmision,
      tipoDocumento,
      valor: ultimoEmitido,
    },
    update: { valor: ultimoEmitido },
  });
}
