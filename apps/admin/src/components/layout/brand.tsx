import { cn } from "@/lib/utils";

/**
 * Sprout logo mark — botanical green tile with a 3-leaf sprout.
 * Mirrors the design system's LogoMark (vf-kit). Used as the default brand
 * mark when no company logo has been uploaded.
 */
export function LogoMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center bg-primary text-primary-foreground",
        className
      )}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 22V11"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M12 13C12 9 9.5 6.2 5 6c-.3 4 1.4 7.2 7 7.4z"
          fill="currentColor"
        />
        <path
          d="M12.6 11.2C12.6 7.6 14.9 4.8 19 4.6c.3 3.7-1.3 7-6.4 7.1z"
          fill="currentColor"
          fillOpacity="0.78"
        />
      </svg>
    </div>
  );
}

export function Brand({
  logoUrl,
  nombre,
  className,
  markSize = 36,
  subtitle = true,
}: {
  logoUrl: string | null;
  nombre: string | null;
  className?: string;
  markSize?: number;
  /** Show the "Paisajismo & Mantenimiento" subtitle under the wordmark. */
  subtitle?: boolean;
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
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={markSize} />
      <div className="leading-none">
        <div className="truncate text-[15px] font-extrabold tracking-tight text-green-deep">
          {nombre ?? "Vivero Francisco"}
        </div>
        {subtitle && (
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Paisajismo &amp; Mantenimiento
          </div>
        )}
      </div>
    </div>
  );
}
