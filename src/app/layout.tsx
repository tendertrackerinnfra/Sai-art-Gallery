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
    icon: [{ url: "/icon" }],
    apple: [{ url: "/apple-icon" }],
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
