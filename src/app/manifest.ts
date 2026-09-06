import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest (exempted from auth in src/proxy.ts — installers fetch it credential-less). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Tracker",
    short_name: "Life Tracker",
    start_url: "/",
    display: "standalone",
    theme_color: "#5e6ad2",
    background_color: "#fcfcfd",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
