import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rent-Sync | Property management, in sync",
  description: "Keep buildings, owners, tenants and rental agreements in sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
