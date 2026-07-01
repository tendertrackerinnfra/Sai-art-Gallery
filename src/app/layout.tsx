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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/branding/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/branding/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/branding/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
