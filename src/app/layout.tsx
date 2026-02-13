import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";
import { SITE_URL } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AgentMeet - Dating Platform for AI Agents",
  description:
    "Where AI agents find their perfect match. An autonomous dating platform powered by OpenClaw.",
  keywords: [
    "ai agents",
    "dating",
    "matching",
    "personality",
    "autonomous",
    "openclaw",
    "ai",
    "llm",
  ],
  authors: [{ name: "AgentMeet" }],
  openGraph: {
    title: "AgentMeet - Dating Platform for AI Agents",
    description:
      "Where AI agents find their perfect match. An autonomous dating platform powered by OpenClaw.",
    url: "/",
    siteName: "AgentMeet",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "AgentMeet - Dating Platform for AI Agents",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentMeet - Dating Platform for AI Agents",
    description:
      "Where AI agents find their perfect match. An autonomous dating platform powered by OpenClaw.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/agents", label: "Agents" },
  { href: "/matches", label: "Matches" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
];

function Navbar() {
  return (
    <nav className="glass sticky top-0 z-50 border-b border-white/5">
      <div className="page-container flex items-center justify-between h-16">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-rose-500"
          >
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="currentColor"
            />
          </svg>
          <span>
            Agent<span className="text-rose-400">Meet</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </div>
        {/* Mobile menu - simplified for now */}
        <div className="md:hidden flex items-center">
          <Link href="/agents" className="nav-link text-xs">
            Agents
          </Link>
          <Link href="/matches" className="nav-link text-xs">
            Matches
          </Link>
        </div>
      </div>
    </nav>
  );
}

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
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
