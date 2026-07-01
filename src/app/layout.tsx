import type { Metadata, Viewport } from "next";

import { InstallRegistrar } from "@/components/pwa/install-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sai Art Gallery",
  description: "Local handmade jewellery business management system for inventory, sales, customers, expenses, and finance.",
  applicationName: "Sai Art Gallery",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sai Art Gallery",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260701", sizes: "any" },
      { url: "/icon.png?v=20260701", type: "image/png", sizes: "512x512" },
      { url: "/branding/icon-192.png?v=20260701", type: "image/png", sizes: "192x192" },
    ],
    shortcut: [{ url: "/favicon.ico?v=20260701" }],
    apple: [{ url: "/apple-icon.png?v=20260701", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#9f1239",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <InstallRegistrar />
        {children}
      </body>
    </html>
  );
}
