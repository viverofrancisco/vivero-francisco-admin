import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Vivero Francisco - Administración",
  description: "Panel de administración de Vivero Francisco",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Se la pasamos al SessionProvider para que el SSR y el cliente rendericen
  // lo mismo. En rutas públicas es null, que es lo correcto.
  const session = await getServerSession(authOptions);
  return (
    <html lang="es" className={hankenGrotesk.variable}>
      <body className="antialiased">
        <Providers session={session}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
