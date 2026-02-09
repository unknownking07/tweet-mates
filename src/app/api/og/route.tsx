import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const username = searchParams.get('u') || 'anon';
    const impressions = searchParams.get('i') || '0';
    const category = searchParams.get('c') || 'Quiet Account';
    const matchName = searchParams.get('m') || '';
    const matchScore = searchParams.get('ms') || '';

    const categoryKey = category.toLowerCase().includes('whale')
        ? 'terminally_online'
        : category.toLowerCase().includes('strong')
            ? 'grinder'
            : category.toLowerCase().includes('steady')
                ? 'consistent'
                : category.toLowerCase().includes('emerging')
                    ? 'casual'
                    : 'ghost';

    const categoryColors: Record<string, { bg: string; text: string }> = {
        ghost: { bg: 'linear-gradient(135deg, #374151, #1f2937)', text: '#9ca3af' },
        casual: { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#d1fae5' },
        consistent: { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', text: '#dbeafe' },
        grinder: { bg: 'linear-gradient(135deg, #f97316, #dc2626)', text: '#ffedd5' },
        terminally_online: { bg: 'linear-gradient(135deg, #a855f7, #ec4899)', text: '#fae8ff' },
    };

    const colors = categoryColors[categoryKey] || categoryColors.ghost;

    return new ImageResponse(
        (
            <div
                style={{
                    background: colors.bg,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'system-ui, sans-serif',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                    }}
                />

                <div style={{ fontSize: 32, marginBottom: 10, color: 'rgba(255,255,255,0.8)' }}>
                    TweetMates
                </div>

                <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white', marginBottom: 20 }}>
                    @{username}
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        background: 'rgba(0,0,0,0.3)',
                        padding: '20px 50px',
                        borderRadius: 20,
                        marginBottom: 20,
                    }}
                >
                    <span style={{ fontSize: 56 }}>📈</span>
                    <span style={{ fontSize: 78, fontWeight: 'bold', color: 'white' }}>
                        {impressions}
                    </span>
                    <span style={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }}>
                        IMP/DAY (100D)
                    </span>
                </div>

                <div
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '12px 32px',
                        borderRadius: 50,
                        fontSize: 28,
                        fontWeight: 600,
                        color: 'white',
                    }}
                >
                    {category}
                </div>

                {matchName && matchScore && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 30,
                            fontSize: 24,
                            color: 'rgba(255,255,255,0.9)',
                        }}
                    >
                        <span>Best match: @{matchName}</span>
                        <span style={{ color: colors.text }}>({matchScore}%)</span>
                    </div>
                )}

                <div
                    style={{
                        position: 'absolute',
                        bottom: 40,
                        fontSize: 22,
                        color: 'rgba(255,255,255,0.75)',
                    }}
                >
                    tweetmates.vercel.app - Impression matching for CT
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
