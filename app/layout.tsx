import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://neonfluid.martincasais.com"),
  title: {
    default: "Neon Fluid",
    template: "%s | Neon Fluid",
  },
  description:
    "A neon fluid-platformer. Guide a glowing liquid character through 100 levels using real fluid physics and mouse-driven wave mechanics.",
  applicationName: "Neon Fluid",
  keywords: ["platformer", "fluid simulation", "WebGL", "browser game", "neon", "puzzle platformer"],
  authors: [{ name: "casaisdev" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "Neon Fluid",
    description:
      "A neon fluid-platformer. Guide a glowing liquid character through 100 levels using real fluid physics and mouse-driven wave mechanics.",
    type: "website",
    siteName: "Neon Fluid",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Neon Fluid" }],
  },
  twitter: {
    card: "summary",
    title: "Neon Fluid",
    description:
      "A neon fluid-platformer. Guide a glowing liquid character through 100 levels using real fluid physics and mouse-driven wave mechanics.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
