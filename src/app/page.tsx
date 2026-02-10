"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export default function Home() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    const cleanUsername = username.replace("@", "").trim();
    trackEvent("search_submit", {
      handle_length: cleanUsername.length,
    });
    router.push(`/results/${cleanUsername}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        {/* Logo */}
        <div className="mb-6">
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            Tweet<span className="text-rose-500">Mates</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-xl md:text-2xl text-gray-300 text-center max-w-xl mb-3 font-light">
          Find your CT soulmate based on your
          <span className="text-rose-400 font-medium"> 10-day average impressions </span>
        </p>
        <p className="text-gray-500 text-center mb-12 text-sm">
          No login required. Just vibes.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-md mb-16">
          <div className="relative mb-4">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your X username"
              className="input-field"
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="spinner w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Finding your match...
              </>
            ) : (
              "Find My Match"
            )}
          </button>
        </form>

        {/* How It Works */}
        <div className="w-full max-w-3xl">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-rose-400 font-bold">1</span>
              </div>
              <h3 className="font-medium text-white mb-2">Enter Username</h3>
              <p className="text-gray-500 text-sm">
                Just your X handle, nothing else
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-rose-400 font-bold">2</span>
              </div>
              <h3 className="font-medium text-white mb-2">Estimate Reach</h3>
              <p className="text-gray-500 text-sm">
                We estimate your 10-day avg impressions/day
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-rose-400 font-bold">3</span>
              </div>
              <h3 className="font-medium text-white mb-2">Get CT Matches</h3>
              <p className="text-gray-500 text-sm">
                Match with accounts in a similar impression band
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impression Categories */}
      <section className="px-4 py-16 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-center text-white mb-3">
            Impression Categories
          </h2>
          <p className="text-gray-500 text-center mb-10 text-sm">
            Your estimated 10d avg impressions/day determines your category
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { tier: "ghost", label: "Quiet", range: "0-199/day" },
              { tier: "casual", label: "Emerging", range: "200-999/day" },
              { tier: "consistent", label: "Steady", range: "1K-4.9K/day" },
              { tier: "grinder", label: "Strong", range: "5K-19.9K/day" },
              { tier: "terminally_online", label: "Whale", range: "20K+/day" },
            ].map((t) => (
              <div key={t.tier} className="card text-center py-4 px-3">
                <div className={`badge badge-${t.tier} text-xs mb-2 mx-auto`}>
                  {t.label}
                </div>
                <p className="text-gray-500 text-xs">{t.range}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-600 text-sm border-t border-white/5">
        <p>
          Built for CT by CT
        </p>
      </footer>
    </main>
  );
}
