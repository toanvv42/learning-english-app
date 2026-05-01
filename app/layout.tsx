import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LingoFlow | Master Your English Pronunciation",
    template: "%s | LingoFlow"
  },
  description: "AI-powered English pronunciation practice designed specifically for Vietnamese learners. Get instant, accurate feedback to speak with confidence.",
  keywords: ["English pronunciation", "Vietnamese English learners", "AI feedback", "speak English confidently", "LingoFlow"],
  icons: {
    icon: "/favicon.ico",
  },
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
