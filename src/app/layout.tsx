import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import TimeZoneSync from "@/components/TimeZoneSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  // cover: extend the page under the iOS home indicator so the fixed tab bar's
  // background fills it; the bar and body pad by env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5e6ad2" },
    { media: "(prefers-color-scheme: dark)", color: "#6e79d6" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Life Tracker",
    template: "%s — Life Tracker",
  },
  description: "Personal life tracker for to-dos, people, and knowledge.",
  appleWebApp: { title: "Life Tracker", statusBarStyle: "default" },
  icons: {
    apple: {
      url: "/icons/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TimeZoneSync />
        <Nav />
        {/* Bottom padding below sm clears Nav's fixed tab bar (h-12 + safe area). */}
        <main className="flex flex-1 flex-col pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
