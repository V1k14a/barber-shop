import type { Metadata, Viewport } from "next";
import "@fontsource-variable/jost";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Salon de Choix — Hair, beard & nails", template: "%s · Salon de Choix" },
  description: "Hairdresser, barber and nail salon in Copenhagen. Book your appointment online.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
