import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motionroom — AI Creative Studio",
  description: "Generate cinematic video from still images and create high-resolution images from text.",
  other: {
    "codex-preview": "motionroom-studio",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
