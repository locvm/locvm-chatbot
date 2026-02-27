import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "locvm-chatbot",
  description: "Minimal FAQ chatbot MVP",
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
