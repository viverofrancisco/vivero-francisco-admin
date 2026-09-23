import { InitialsAvatar } from "@/components/shared/initials-avatar";

/**
 * La foto del grupo, o las iniciales del nombre mientras no tenga una. Redonda
 * y del tamaño que se le pida, para la lista, el encabezado y el formulario.
 */
export function AvatarDeChat({
  nombre,
  imagenUrl,
  size = 40,
  className,
}: {
  nombre: string;
  imagenUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (!imagenUrl) {
    return <InitialsAvatar name={nombre} size={size} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imagenUrl}
      alt=""
      className={`flex-none rounded-full object-cover ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
