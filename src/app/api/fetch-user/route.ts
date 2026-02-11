import { NextRequest, NextResponse } from 'next/server';
import { fetchTweets, Tweet, ScrapeDiagnostics } from '@/lib/twitter';
import { fetchTweetsV2, isTwitterApiV2Available } from '@/lib/twitter-v2';
import {
    estimateImpressionMetrics,
    getImpressionCategory,
    getImpressionCategoryInfo,
    getImpressionMatches,
    ImpressionCategoryInfo,
    ImpressionMatch,
    ImpressionMetrics,
    SearchableImpressionProfile,
} from '@/lib/impressions';
import { listSearchedProfiles, upsertSearchedProfile } from '@/lib/profile-store';
import { createClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

const MATCH_TARGET = 5;

async function loadSupabaseCandidates(
    supabase: SupabaseClient,
    excludeUsername: string,
): Promise<SearchableImpressionProfile[]> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, display_name, profile_image_url, impressions_100d_avg, tweets_in_window, category')
            .not('impressions_100d_avg', 'is', null)
            .neq('username', excludeUsername)
            .order('last_checked_at', { ascending: false })
            .limit(200);

        if (error || !data) {
            console.error('Failed to load Supabase candidates:', error);
            return [];
        }

        return data
            .filter((row) => typeof row.impressions_100d_avg === 'number')
            .map((row) => ({
                username: row.username,
                displayName: row.display_name || row.username,
                profileImageUrl: row.profile_image_url || '',
                impressions100dAvg: row.impressions_100d_avg,
                tweetsInWindow: row.tweets_in_window || 0,
                category: row.category || getImpressionCategory(row.impressions_100d_avg),
                updatedAt: '',
            }));
    } catch (error) {
        console.error('Supabase candidates fetch error:', error);
        return [];
    }
}

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
        let diagnostics: ScrapeDiagnostics | undefined;

        if (isTwitterApiV2Available()) {
            // Diagnostics will be filled in by fetchTweets if we fall through,
            // but for v2 we pass a temporary diagnostics object.
            const tempDiag: ScrapeDiagnostics = {
                username: cleanUsername,
                startedAt: Date.now(),
                durationMs: 0,
                v2: { attempted: false, success: false, tweetCount: 0 },
                syndication: { attempted: false, success: false, tweetCount: 0 },
                nitter: { attempted: false, success: false, tweetCount: 0, instanceResults: [] },
                finalTweetCount: 0,
                source: 'none',
                cacheHit: false,
            };
            const v2Result = await fetchTweetsV2(cleanUsername, tempDiag);

            if (v2Result && v2Result.tweets.length > 0) {
                tweets = v2Result.tweets;
                user = v2Result.user;
                source = 'api_v2';
                tempDiag.finalTweetCount = tweets.length;
                tempDiag.source = 'api_v2';
                tempDiag.durationMs = Date.now() - tempDiag.startedAt;
                diagnostics = tempDiag;
                console.log(`\n[Scrape ✅ SUCCESS] @${cleanUsername} via API v2 (${tempDiag.durationMs}ms, ${tweets.length} tweets)`);
            } else {
                // V2 failed — fall through to scraping, but carry v2 diagnostics forward
                diagnostics = tempDiag;
            }
        }

        if (tweets.length === 0) {
            const scraped = await fetchTweets(cleanUsername);
            tweets = scraped.tweets;
            cached = scraped.cached;

            // Merge v2 diagnostics into the scraping diagnostics
            if (diagnostics && scraped.diagnostics) {
                scraped.diagnostics.v2 = diagnostics.v2;
            }
            diagnostics = scraped.diagnostics;

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
            console.error(`[fetch-user] ❌ No tweets found for @${cleanUsername}. Full diagnostics:`, JSON.stringify(diagnostics, null, 2));
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
                        impressions_100d_avg: impressionMetrics.avgImpressions100d,
                        tweets_in_window: impressionMetrics.tweetsInWindow,
                        category: category.key,
                        last_checked_at: new Date().toISOString(),
                    }, { onConflict: 'username' });
            } catch (error) {
                console.error('Failed to store user in Supabase:', error);
            }
        }

        // If the local pool didn't produce enough matches, expand from Supabase.
        let finalMatches = matches;
        if (matches.length < MATCH_TARGET && supabase) {
            try {
                const supabaseCandidates = await loadSupabaseCandidates(supabase, cleanUsername);
                if (supabaseCandidates.length > 0) {
                    // Merge local + Supabase candidates, deduplicate by username.
                    const localUsernames = new Set(priorProfiles.map((p) => p.username));
                    const extraCandidates = supabaseCandidates.filter((c) => !localUsernames.has(c.username));
                    const combinedPool = [...priorProfiles, ...extraCandidates];

                    finalMatches = getImpressionMatches(
                        impressionMetrics.avgImpressions100d,
                        cleanUsername,
                        combinedPool,
                        MATCH_TARGET,
                    );
                    console.log(`[matches] Expanded pool: ${priorProfiles.length} local + ${extraCandidates.length} Supabase = ${combinedPool.length} candidates → ${finalMatches.length} matches`);
                }
            } catch (error) {
                console.error('Failed to expand match pool from Supabase:', error);
            }
        }

        return NextResponse.json({
            user,
            impressionMetrics,
            category,
            matches: finalMatches,
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
