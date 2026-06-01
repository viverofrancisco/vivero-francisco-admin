export function Brand({
  logoUrl,
  nombre,
  className,
}: {
  logoUrl: string | null;
  nombre: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={nombre ?? "Empresa"}
        className={className ?? "h-14 max-w-[220px] object-contain"}
      />
    );
  }
  return (
    <h1 className={className ?? "text-lg font-bold text-primary truncate"}>
      {nombre ?? "Vivero Francisco"}
    </h1>
  );
}
