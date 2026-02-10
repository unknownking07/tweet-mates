import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function clampText(value: string | null | undefined, fallback: string, maxLength: number): string {
    const text = (value || fallback).trim();
    if (!text) {
        return fallback;
    }

    return text.slice(0, maxLength);
}

function parseIntOr(value: string | null | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, parsed);
}

function formatCompact(value: number): string {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const username = clampText(searchParams.get('username')?.replace('@', ''), 'unknown', 24);
    const displayName = clampText(searchParams.get('displayName'), username, 28);
    const tier = clampText(searchParams.get('tier'), 'Unranked', 20);
    const source = clampText(searchParams.get('source'), 'Scraping', 20);
    const match = clampText(searchParams.get('match'), '', 24);

    const avg = parseIntOr(searchParams.get('avg'), 0);
    const total = parseIntOr(searchParams.get('total'), 0);
    const posts = parseIntOr(searchParams.get('posts'), 0);
    const matchScore = parseIntOr(searchParams.get('matchScore'), 0);

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background:
                        'radial-gradient(circle at 15% 10%, rgba(225,29,72,0.42), transparent 34%), radial-gradient(circle at 85% 88%, rgba(251,113,133,0.28), transparent 40%), #090809',
                    color: '#fff',
                    fontFamily: 'Inter, ui-sans-serif, system-ui',
                    padding: '44px',
                    border: '1px solid rgba(255,255,255,0.12)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 24, color: '#fb7185', fontWeight: 700 }}>TweetMates</div>
                        <div style={{ fontSize: 16, color: '#a1a1aa' }}>10-day CT distribution card</div>
                    </div>
                    <div style={{ fontSize: 20, color: '#cbd5e1' }}>@{username}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '26px' }}>
                    <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.05 }}>
                        {formatCompact(avg)} impressions/day
                    </div>
                    <div style={{ fontSize: 24, color: '#d4d4d8' }}>{displayName} | Tier: {tier}</div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '14px',
                        marginBottom: '22px',
                    }}
                >
                    <Stat label="10d total est." value={formatCompact(total)} />
                    <Stat label="Posts analyzed" value={String(posts)} />
                    <Stat label="Data source" value={source} />
                </div>

                {match ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid rgba(251,113,133,0.35)',
                            background: 'rgba(190,18,60,0.2)',
                            borderRadius: '14px',
                            padding: '14px 18px',
                            fontSize: 24,
                            color: '#ffe4e6',
                            marginBottom: 'auto',
                        }}
                    >
                        Top match: @{match}{matchScore > 0 ? ` (${matchScore}% fit)` : ''}
                    </div>
                ) : (
                    <div style={{ marginBottom: 'auto' }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#cbd5e1' }}>
                    <div>Attention compounds. Distribution is your moat.</div>
                    <div>tweetmates.vercel.app</div>
                </div>
            </div>
        ),
        {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
        }
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '14px',
                padding: '14px',
            }}
        >
            <div style={{ fontSize: 16, color: '#a1a1aa', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>{value}</div>
        </div>
    );
}
