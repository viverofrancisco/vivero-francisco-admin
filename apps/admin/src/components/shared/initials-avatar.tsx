import { cn } from "@/lib/utils";

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Round initials avatar in the botanical-green style (green-100 tile,
 * green-700 text). Server-safe — used in tables and the dashboard.
 */
export function InitialsAvatar({
  name,
  size = 34,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-green-100 font-bold text-green-700",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
