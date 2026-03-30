import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual Sitemap",
  description: "Genera un mapa visual de tu sitio web a partir de un sitemap.xml",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
