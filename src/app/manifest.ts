import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sai Art Gallery",
    short_name: "SAG",
    description: "Jewellery business operations for inventory, sales, customers, expenses, and finance.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f7",
    theme_color: "#9f1239",
    orientation: "portrait",
    lang: "en-IN",
    icons: [
      {
        src: "/branding/icon-192.png?v=20260701",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/branding/icon-512.png?v=20260701",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png?v=20260701",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
