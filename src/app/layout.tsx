import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getRequestLocale } from "@/lib/i18n/server-locale";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Racik EventMu", template: "%s · Racik EventMu" },
  description: "Event pages, registration forms, QR tickets and door check-in.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
