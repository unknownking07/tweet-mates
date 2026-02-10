import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "TweetMates - Impression Match for CT",
  description: "Get matched with CT accounts based on estimated 100-day average impressions.",
  keywords: ["crypto", "twitter", "x", "ct", "impressions", "matching", "web3"],
  authors: [{ name: "TweetMates" }],
  openGraph: {
    title: "TweetMates - Impression Match for CT",
    description: "Get matched with CT accounts based on estimated 100-day average impressions.",
    url: "https://tweetmates.vercel.app",
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
    description: "Get matched with CT accounts based on estimated 100-day average impressions.",
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
