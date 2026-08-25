"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * `session` viene resuelta en el servidor desde el layout raíz. Sin ella,
 * `useSession()` queda vacío durante el SSR y los componentes que filtran por
 * rol (el sidebar, por ejemplo) renderizan un árbol distinto en el servidor y
 * en el cliente, lo que rompe la hidratación.
 */
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
