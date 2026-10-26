import type { Metadata } from "next";
import { Sixtyfour } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Read.Video",
  description: "Interactive space-themed landing page",
};

// Self-hosted at build time — replaces the render-blocking Google Fonts
// stylesheet + preconnects. BLED axis bleeds the pixel blocks together so the
// glyphs render solid (no hairline gaps on the pixel grid); SCAN stays off.
const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  weight: "variable",
  axes: ["BLED"],
  display: "swap",
  variable: "--font-sixtyfour",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sixtyfour.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
