import { NextRequest, NextResponse } from 'next/server';
import { getImpressionMatches } from '@/lib/impressions';
import { listSearchedProfiles } from '@/lib/profile-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username')?.toLowerCase().replace('@', '').trim();

        if (!username) {
            return NextResponse.json(
                { error: 'Username is required' },
                { status: 400 }
            );
        }

        const profiles = await listSearchedProfiles();
        const current = profiles.find((profile) => profile.username === username);

        if (!current) {
            return NextResponse.json(
                { error: 'Profile not found in search pool yet. Search this user first.' },
                { status: 404 }
            );
        }

        const matches = getImpressionMatches(
            current.impressions100dAvg,
            username,
            profiles,
            10
        );

        return NextResponse.json({
            matches,
            totalUsers: profiles.length,
        });
    } catch (error) {
        console.error('Matches error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch matches' },
            { status: 500 }
        );
    }
}
