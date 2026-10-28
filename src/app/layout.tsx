import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGFCO — Gestão de Frotas e Controles Operacionais",
  description:
    "Sistema Integrado de Gestão de Frotas e Controles Operacionais: viagens, frota, motoristas, despesas, manutenção, documentos e rastreio GPS autónomo. Porto da Beira • EN6 • corredores da África Austral.",
  applicationName: "SIGFCO",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SIGFCO", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
