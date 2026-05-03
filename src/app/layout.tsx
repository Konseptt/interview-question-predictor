import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Interview Question Forecaster",
  description:
    "Generate likely interview questions from any job description, including answer frameworks and red flags.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Interview Question Forecaster",
    description:
      "Paste a job description and instantly generate interview questions, answer frameworks, and red flags.",
    url: "/",
    siteName: "Interview Prep Studio",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Interview Question Forecaster preview card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Question Forecaster",
    description:
      "Generate interview questions, frameworks, and red flags from any job description.",
    images: ["/twitter-image"],
  },
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
