import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Pronunciation Practice",
  description: "Pronunciation feedback for Vietnamese English learners.",
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
