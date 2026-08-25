/**
 * Validación de cédula y RUC ecuatorianos.
 *
 * Contífico rechaza las cédulas inválidas al emitir (`Cedula Incorrecta`,
 * cod_error 1508). Validar acá evita que el error aparezca recién al facturar,
 * que es el peor momento para descubrirlo.
 */

/** Dígito verificador de cédula (módulo 10). */
function digitoVerificadorCedula(primerosNueve: string): number {
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let producto = Number(primerosNueve[i]) * coeficientes[i];
    if (producto > 9) producto -= 9;
    suma += producto;
  }
  return (10 - (suma % 10)) % 10;
}

export function esCedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  // Provincias 1–24, más 30 para ecuatorianos registrados en el exterior.
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;
  // El tercer dígito < 6 identifica a una persona natural.
  if (Number(cedula[2]) >= 6) return false;
  return digitoVerificadorCedula(cedula.slice(0, 9)) === Number(cedula[9]);
}

/**
 * RUC: 13 dígitos terminados en 001. Los de persona natural son la cédula más
 * el sufijo; los de sociedad usan otro dígito verificador que no validamos acá
 * porque Contífico ya lo hace del lado suyo.
 */
export function esRucValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const provincia = Number(ruc.slice(0, 2));
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;
  const tercero = Number(ruc[2]);
  if (tercero < 6) return esCedulaValida(ruc.slice(0, 10));
  return tercero === 6 || tercero === 9;
}

/** Mensaje de error, o null si la identificación sirve para facturar. */
export function validarIdentificacion(
  cedula: string | null,
  ruc: string | null
): string | null {
  if (ruc?.trim()) {
    return esRucValido(ruc.trim()) ? null : "El RUC no es válido.";
  }
  if (cedula?.trim()) {
    return esCedulaValida(cedula.trim()) ? null : "La cédula no es válida.";
  }
  return "El cliente necesita cédula o RUC para poder facturar.";
}
