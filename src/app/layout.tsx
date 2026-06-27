import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sai Art Gallery",
  description: "Local handmade jewellery business management system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
