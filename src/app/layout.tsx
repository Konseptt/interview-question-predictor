import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Question Predictor",
  description:
    "Paste a job description and generate likely interview questions with frameworks and red flags.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
