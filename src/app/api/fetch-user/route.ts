import { NextRequest, NextResponse } from 'next/server';
import { fetchTweets, Tweet } from '@/lib/twitter';
import { fetchTweetsV2, isTwitterApiV2Available } from '@/lib/twitter-v2';
import {
    estimateImpressionMetrics,
    getImpressionCategoryInfo,
    getImpressionMatches,
    ImpressionCategoryInfo,
    ImpressionMatch,
    ImpressionMetrics,
    SearchableImpressionProfile,
} from '@/lib/impressions';
import { listSearchedProfiles, upsertSearchedProfile } from '@/lib/profile-store';
import { createClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FetchUserResponse {
    user: {
        id: string;
        username: string;
        displayName: string;
        profileImageUrl: string;
    };
    impressionMetrics: ImpressionMetrics;
    category: ImpressionCategoryInfo;
    matches: ImpressionMatch[];
    cached: boolean;
    source: 'api_v2' | 'scraping';
}

export async function POST(request: NextRequest) {
    try {
        const { username } = await request.json();

        const cleanUsername = username?.toLowerCase().replace('@', '').trim();

        if (!cleanUsername || !/^[a-zA-Z0-9_]{1,15}$/.test(cleanUsername)) {
            return NextResponse.json(
                { error: 'Invalid username. Please enter a valid X handle.' },
                { status: 400 }
            );
        }

        let supabase;
        try {
            if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                supabase = createClient();
            }
        } catch {
            // Supabase is optional.
        }

        let tweets: Tweet[] = [];
        let user: {
            id: string;
            username: string;
            displayName: string;
            profileImageUrl: string;
        } | null = null;
        let source: 'api_v2' | 'scraping' = 'scraping';
        let cached = false;

        if (isTwitterApiV2Available()) {
            const v2Result = await fetchTweetsV2(cleanUsername);

            if (v2Result && v2Result.tweets.length > 0) {
                tweets = v2Result.tweets;
                user = v2Result.user;
                source = 'api_v2';
            }
        }

        if (tweets.length === 0) {
            const scraped = await fetchTweets(cleanUsername);
            tweets = scraped.tweets;
            cached = scraped.cached;

            if (scraped.user) {
                user = {
                    id: cleanUsername,
                    username: scraped.user.screen_name || cleanUsername,
                    displayName: scraped.user.name || cleanUsername,
                    profileImageUrl: scraped.user.profile_image_url?.replace('_normal', '_200x200') || '',
                };
            }
        }

        if (tweets.length === 0) {
            return NextResponse.json(
                { error: 'Could not fetch timeline posts. Profile may be private, suspended, or unavailable.' },
                { status: 404 }
            );
        }

        if (!user) {
            user = {
                id: cleanUsername,
                username: cleanUsername,
                displayName: cleanUsername,
                profileImageUrl: '',
            };
        }

        const impressionMetrics = estimateImpressionMetrics(tweets);
        const category = getImpressionCategoryInfo(impressionMetrics.avgImpressions100d);

        const searchableProfile: SearchableImpressionProfile = {
            username: cleanUsername,
            displayName: user.displayName,
            profileImageUrl: user.profileImageUrl,
            impressions100dAvg: impressionMetrics.avgImpressions100d,
            tweetsInWindow: impressionMetrics.tweetsInWindow,
            category: category.key,
            updatedAt: new Date().toISOString(),
        };

        await upsertSearchedProfile(searchableProfile);
        const priorProfiles = await listSearchedProfiles(cleanUsername);
        const matches = getImpressionMatches(
            impressionMetrics.avgImpressions100d,
            cleanUsername,
            priorProfiles,
            5
        );

        if (supabase) {
            try {
                await supabase
                    .from('users')
                    .upsert({
                        username: cleanUsername,
                        display_name: user.displayName,
                        profile_image_url: user.profileImageUrl,
                        last_checked_at: new Date().toISOString(),
                    }, { onConflict: 'username' });
            } catch (error) {
                console.error('Failed to store user in Supabase:', error);
            }
        }

        return NextResponse.json({
            user,
            impressionMetrics,
            category,
            matches,
            cached,
            source,
        });
    } catch (error) {
        console.error('Fetch user error:', error);
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        );
    }
}
