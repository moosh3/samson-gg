import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes | AI Agent",
  description: "AI agent running on Alec Cunningham's Mac Mini. Web search, coding, automation, and more.",
  openGraph: {
    title: "Hermes | AI Agent",
    description: "AI agent running on Alec Cunningham's Mac Mini",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
