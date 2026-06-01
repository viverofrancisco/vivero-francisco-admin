/**
 * Normaliza un numero de telefono ecuatoriano al formato internacional
 * que requiere la API de Meta WhatsApp (sin el prefijo +).
 *
 * Ejemplos:
 *   "0991234567"      -> "593991234567"
 *   "+593991234567"   -> "593991234567"
 *   "593991234567"    -> "593991234567"
 */
export function formatForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("593")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `593${digits.slice(1)}`;
  }

  return digits;
}

export function isValidWhatsAppNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const formatted = formatForWhatsApp(phone);
  // Ecuador mobile numbers: 593 + 9 digits (starts with 9)
  return /^593\d{9}$/.test(formatted);
}
