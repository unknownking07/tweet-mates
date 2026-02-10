import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tweetmates.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TweetMates - Impression Match for CT",
  description: "Get matched with CT accounts based on estimated impressions from the latest 10 posts.",
  keywords: ["crypto", "twitter", "x", "ct", "impressions", "matching", "web3"],
  authors: [{ name: "TweetMates" }],
  openGraph: {
    title: "TweetMates - Impression Match for CT",
    description: "Get matched with CT accounts based on estimated impressions from the latest 10 posts.",
    url: "/",
    siteName: "TweetMates",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "TweetMates - Impression Match for CT",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TweetMates - Impression Match for CT",
    description: "Get matched with CT accounts based on estimated impressions from the latest 10 posts.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <div className="gradient-bg" />
        {children}
      </body>
    </html>
  );
}
