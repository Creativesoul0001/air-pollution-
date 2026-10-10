import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dhuan Detective",
  description:
    "Street-level air quality attribution for Delhi — why is the air bad on my street right now?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
