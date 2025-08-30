import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Read.Video",
  description: "Interactive space-themed landing page",
};

// Preload Google Fonts for better performance
const fontLinks = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  { 
    rel: "stylesheet", 
    href: "https://fonts.googleapis.com/css2?family=Sixtyfour:SCAN@-37&display=swap" 
  }
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {fontLinks.map((link, index) => (
          <link key={index} {...link} />
        ))}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
