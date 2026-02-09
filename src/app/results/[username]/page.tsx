"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { getShareUrl, generateShareText, getStatsCardUrl } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface UserData {
    user: {
        id: string;
        username: string;
        displayName: string;
        profileImageUrl: string;
    };
    impressionMetrics: {
        avgImpressions100d: number;
        totalEstimatedImpressions100d: number;
        tweetsInWindow: number;
        hasEngagementData: boolean;
    };
    category: {
        key: string;
        label: string;
        range: string;
        description: string;
    };
    matches: Match[];
    source: "api_v2" | "scraping";
}

interface Match {
    username: string;
    displayName: string;
    profileImageUrl: string;
    impressions100dAvg: number;
    category: string;
    categoryLabel: string;
    compatibilityReason: string;
    matchScore: number;
}

export default function ResultsPage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = use(params);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError("");

                const userRes = await fetch("/api/fetch-user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username }),
                });

                const data = await userRes.json();
                if (!userRes.ok) {
                    throw new Error(data.error || "Failed to analyze account");
                }

                setUserData(data);
                trackEvent("profile_analysis_success", {
                    source: data.source || "unknown",
                    tweets_in_window: data.impressionMetrics?.tweetsInWindow || 0,
                    category: data.category?.key || "unknown",
                });
            } catch (err) {
                trackEvent("profile_analysis_error", {
                    handle_length: username.length,
                    error_type: err instanceof Error ? "request_failed" : "unknown",
                });
                setError(err instanceof Error ? err.message : "Something went wrong");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [username]);

    if (loading) {
        return <LoadingState username={username} />;
    }

    if (error) {
        return <ErrorState error={error} username={username} />;
    }

    if (!userData) {
        return <ErrorState error="No data found" username={username} />;
    }

    const { user, matches, source, impressionMetrics, category } = userData;
    const topMatch = matches[0];

    const shareText = generateShareText(
        user.username,
        impressionMetrics.avgImpressions100d,
        category.label,
        topMatch?.username,
        topMatch?.matchScore
    );
    const shareUrl = getShareUrl(shareText);
    const statsCardUrl = getStatsCardUrl({
        username: user.username,
        displayName: user.displayName,
        avgImpressions100d: impressionMetrics.avgImpressions100d,
        totalEstimatedImpressions100d: impressionMetrics.totalEstimatedImpressions100d,
        tweetsInWindow: impressionMetrics.tweetsInWindow,
        categoryLabel: category.label,
        source,
        matchUsername: topMatch?.username,
        matchScore: topMatch?.matchScore,
    });

    const copyShareCaption = async () => {
        try {
            await navigator.clipboard.writeText(shareText);
            trackEvent("share_caption_copied");
            setCopyStatus("copied");
        } catch {
            trackEvent("share_caption_copy_failed");
            setCopyStatus("failed");
        } finally {
            setTimeout(() => setCopyStatus("idle"), 1800);
        }
    };

    return (
        <main className="min-h-screen px-4 py-8">
            <div className="max-w-3xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <Link
                        href="/"
                        className="text-gray-400 hover:text-white transition flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        Back
                    </Link>
                    <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="twitter-share text-sm"
                        onClick={() => trackEvent("share_caption_x_clicked", { location: "header" })}
                    >
                        Share
                    </a>
                </div>
            </div>

            <div className="max-w-3xl mx-auto">
                <div className="card glow p-8 mb-8 fade-in">
                    <div className="flex items-center gap-4 mb-6">
                        {user.profileImageUrl ? (
                            <Image
                                src={user.profileImageUrl}
                                alt={user.displayName}
                                width={72}
                                height={72}
                                unoptimized
                                className="w-20 h-20 rounded-full border-2 border-rose-500/30"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-2xl font-bold text-white">
                                {user.displayName[0]?.toUpperCase() || "?"}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
                            <p className="text-gray-400">@{user.username}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Source: {source === "api_v2" ? "X API" : "Scraping"} · {impressionMetrics.tweetsInWindow} posts analyzed
                            </p>
                        </div>
                    </div>

                    <div className="card mb-5 p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                            Estimated 100d Avg Impressions / Day
                        </p>
                        <p className="text-2xl font-bold text-rose-300">
                            {formatCompact(impressionMetrics.avgImpressions100d)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Total est. impressions (100d): {formatCompact(impressionMetrics.totalEstimatedImpressions100d)}
                        </p>
                    </div>

                    <div className="mb-3">
                        <span className={`badge badge-${category.key} text-sm px-4 py-2`}>
                            {category.label}
                        </span>
                        <p className="text-gray-300 mt-3">{category.description}</p>
                        <p className="text-xs text-gray-500 mt-1">Range: {category.range}</p>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-5 text-white">Your Impression Matches</h2>
                    {matches.length > 0 ? (
                        <div className="space-y-3">
                            {matches.slice(0, 3).map((match, index) => (
                                <MatchCard key={match.username} match={match} rank={index + 1} />
                            ))}
                        </div>
                    ) : (
                        <div className="card text-sm text-gray-400">
                            No match pool yet. Search a few more accounts and retry to get impression-based matches.
                        </div>
                    )}
                </div>

                <div className="card p-5 mb-8">
                    <h3 className="text-lg font-semibold text-white mb-2">Share-Ready CT Card</h3>
                    <p className="text-sm text-gray-400 mb-4">
                        Post this visual with your caption for better attention on the timeline.
                    </p>

                    <Image
                        src={statsCardUrl}
                        alt={`Share card for @${user.username}`}
                        width={1200}
                        height={630}
                        unoptimized
                        className="w-full rounded-xl border border-white/10 mb-4"
                    />

                    <div className="flex flex-wrap gap-3 justify-center">
                        <a
                            href={statsCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            onClick={() => trackEvent("share_card_open_clicked")}
                        >
                            Open Card
                        </a>
                        <a
                            href={statsCardUrl}
                            download={`${user.username}-tweetmates-card.png`}
                            className="btn-secondary"
                            onClick={() => trackEvent("share_card_download_clicked")}
                        >
                            Download Card
                        </a>
                        <button
                            type="button"
                            onClick={copyShareCaption}
                            className="btn-secondary"
                        >
                            {copyStatus === "copied"
                                ? "Caption Copied"
                                : copyStatus === "failed"
                                    ? "Copy Failed"
                                    : "Copy Caption"}
                        </button>
                        <a
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="twitter-share"
                            onClick={() => trackEvent("share_caption_x_clicked", { location: "card" })}
                        >
                            Post Caption on X
                        </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                        Tip: attach the card image when posting to make the stat instantly legible.
                    </p>
                </div>

                <div className="text-center">
                    <Link href="/" className="text-rose-400 hover:text-rose-300 transition">
                        Check another username
                    </Link>
                </div>
            </div>
        </main>
    );
}

function MatchCard({ match, rank }: { match: Match; rank: number }) {
    return (
        <div
            className="match-card card flex items-start gap-4 slide-in"
            style={{ animationDelay: `${rank * 100}ms` }}
        >
            <div className="w-8 text-center text-gray-500 font-medium">#{rank}</div>

            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-white">@{match.username}</span>
                    <span className={`badge badge-${match.category} text-xs py-0.5`}>{match.categoryLabel}</span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{match.compatibilityReason}</p>
                <p className="text-xs text-gray-500 mb-2">
                    100d avg est. impressions/day: {formatCompact(match.impressions100dAvg)}
                </p>
            </div>

            <div className="text-right">
                <div className="text-xl font-bold text-rose-400">{match.matchScore}%</div>
                <div className="text-xs text-gray-500">match</div>
            </div>
        </div>
    );
}

function LoadingState({ username }: { username: string }) {
    const [dots, setDots] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((d) => (d.length >= 3 ? "" : d + "."));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
                    <svg className="spinner w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24">
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
                </div>
                <h2 className="text-xl font-medium text-white mb-2">@{username}</h2>
                <p className="text-gray-500">Analyzing impressions{dots}</p>
            </div>
        </main>
    );
}

function ErrorState({ error, username }: { error: string; username: string }) {
    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-6">
                    <span className="text-rose-400 text-2xl">!</span>
                </div>
                <h2 className="text-xl font-medium text-white mb-2">Could not analyze @{username}</h2>
                <p className="text-gray-500 mb-6 text-sm">{error}</p>
                <Link href="/" className="btn-primary inline-block">
                    Try Again
                </Link>
            </div>
        </main>
    );
}

function formatCompact(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }

    return `${Math.round(value)}`;
}
