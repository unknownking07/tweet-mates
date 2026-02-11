import { Tweet } from './twitter';

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_POSTS = 10;

export type ImpressionCategory =
    | 'ghost'
    | 'casual'
    | 'consistent'
    | 'grinder'
    | 'terminally_online';

export interface ImpressionMetrics {
    avgImpressions100d: number;
    totalEstimatedImpressions100d: number;
    tweetsInWindow: number;
    hasEngagementData: boolean;
}

export interface ImpressionCategoryInfo {
    key: ImpressionCategory;
    label: string;
    range: string;
    description: string;
}

export interface SearchableImpressionProfile {
    username: string;
    displayName: string;
    profileImageUrl: string;
    impressions100dAvg: number;
    tweetsInWindow: number;
    category: ImpressionCategory;
    updatedAt: string;
}

export interface ImpressionMatch {
    username: string;
    displayName: string;
    profileImageUrl: string;
    impressions100dAvg: number;
    category: ImpressionCategory;
    categoryLabel: string;
    compatibilityReason: string;
    matchScore: number;
}

const CATEGORY_INFO: Record<ImpressionCategory, ImpressionCategoryInfo> = {
    ghost: {
        key: 'ghost',
        label: 'Quiet Account',
        range: '0 - 199/day',
        description: 'Low reach right now. Mostly niche or inactive timeline presence.',
    },
    casual: {
        key: 'casual',
        label: 'Emerging Reach',
        range: '200 - 999/day',
        description: 'Early momentum with occasional posts getting distribution.',
    },
    consistent: {
        key: 'consistent',
        label: 'Steady Reach',
        range: '1K - 4.9K/day',
        description: 'Consistent distribution and predictable timeline visibility.',
    },
    grinder: {
        key: 'grinder',
        label: 'Strong Reach',
        range: '5K - 19.9K/day',
        description: 'High visibility with regular engagement and amplification.',
    },
    terminally_online: {
        key: 'terminally_online',
        label: 'Whale Reach',
        range: '20K+/day',
        description: 'Large account-level distribution and outsized CT attention.',
    },
};

function clamp(value: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, value));
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

function estimateTweetImpressions(tweet: Tweet): { value: number; hasMetrics: boolean } {
    if (tweet.metrics) {
        const likes = Math.max(0, tweet.metrics.like_count || 0);
        const replies = Math.max(0, tweet.metrics.reply_count || 0);
        const retweets = Math.max(0, tweet.metrics.retweet_count || 0);

        const value = 120 + likes * 18 + replies * 34 + retweets * 42;
        return { value, hasMetrics: true };
    }

    // Scraped sources often miss engagement counts. Use a conservative baseline.
    return { value: tweet.is_reply ? 85 : 140, hasMetrics: false };
}

function getEligibleTweets(tweets: Tweet[]): Array<{ tweet: Tweet; timestamp: number }> {
    return tweets
        .filter((tweet) => !tweet.is_retweet)
        .map((tweet) => {
            const timestamp = new Date(tweet.created_at).getTime();
            return { tweet, timestamp };
        })
        .filter((entry) => Number.isFinite(entry.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp);
}

export function estimateImpressionMetrics(tweets: Tweet[]): ImpressionMetrics {
    if (!tweets || tweets.length === 0) {
        return {
            avgImpressions100d: 0,
            totalEstimatedImpressions100d: 0,
            tweetsInWindow: 0,
            hasEngagementData: false,
        };
    }

    const eligibleTweets = getEligibleTweets(tweets);
    if (eligibleTweets.length === 0) {
        return {
            avgImpressions100d: 0,
            totalEstimatedImpressions100d: 0,
            tweetsInWindow: 0,
            hasEngagementData: false,
        };
    }

    const analysisSample = eligibleTweets.slice(0, Math.min(ANALYSIS_POSTS, eligibleTweets.length));

    let total = 0;
    let hasEngagementData = false;

    for (const { tweet } of analysisSample) {
        const estimate = estimateTweetImpressions(tweet);
        total += estimate.value;
        hasEngagementData = hasEngagementData || estimate.hasMetrics;
    }

    let observedDays = 1;
    if (analysisSample.length > 1) {
        const newestTimestamp = analysisSample[0].timestamp;
        const oldestTimestamp = analysisSample[analysisSample.length - 1].timestamp;
        observedDays = Math.max(1, Math.ceil((newestTimestamp - oldestTimestamp) / DAY_MS) + 1);
    }

    return {
        // Legacy field names kept for API compatibility; values now represent 10-post sampling.
        avgImpressions100d: Math.round(total / observedDays),
        totalEstimatedImpressions100d: Math.round(total),
        tweetsInWindow: analysisSample.length,
        hasEngagementData,
    };
}

export function getImpressionCategory(avgImpressions100d: number): ImpressionCategory {
    if (avgImpressions100d < 200) return 'ghost';
    if (avgImpressions100d < 1_000) return 'casual';
    if (avgImpressions100d < 5_000) return 'consistent';
    if (avgImpressions100d < 20_000) return 'grinder';
    return 'terminally_online';
}

export function getImpressionCategoryInfo(avgImpressions100d: number): ImpressionCategoryInfo {
    return CATEGORY_INFO[getImpressionCategory(avgImpressions100d)];
}

function impressionSimilarityScore(targetAvg: number, candidateAvg: number): number {
    const mine = Math.max(0, targetAvg);
    const theirs = Math.max(0, candidateAvg);

    if (mine === 0 && theirs === 0) {
        return 100;
    }

    const diff = Math.abs(Math.log10(mine + 10) - Math.log10(theirs + 10));
    return clamp(Math.round(100 - diff * 78));
}

function matchReason(targetAvg: number, candidate: SearchableImpressionProfile): string {
    const mine = Math.max(0, targetAvg);
    const theirs = Math.max(0, candidate.impressions100dAvg);
    const delta = Math.abs(mine - theirs);
    const pctDelta = mine > 0 ? Math.round((delta / mine) * 100) : 0;

    return `~${formatCompact(theirs)} est. impressions/day (latest 10 posts), ${pctDelta}% from your level.`;
}

export function getImpressionMatches(
    targetAvgImpressions100d: number,
    username: string,
    candidates: SearchableImpressionProfile[],
    limit = 5
): ImpressionMatch[] {
    const targetCategory = getImpressionCategory(targetAvgImpressions100d);

    return candidates
        .filter((candidate) => candidate.username.toLowerCase() !== username.toLowerCase())
        .map((candidate) => {
            const base = impressionSimilarityScore(targetAvgImpressions100d, candidate.impressions100dAvg);
            const sameCategoryBonus = candidate.category === targetCategory ? 6 : 0;
            const volumeConfidence = Math.min(6, Math.floor(candidate.tweetsInWindow / 2));
            const matchScore = clamp(base + sameCategoryBonus + volumeConfidence);

            return {
                username: candidate.username,
                displayName: candidate.displayName,
                profileImageUrl: candidate.profileImageUrl,
                impressions100dAvg: candidate.impressions100dAvg,
                category: candidate.category,
                categoryLabel: CATEGORY_INFO[candidate.category].label,
                compatibilityReason: matchReason(targetAvgImpressions100d, candidate),
                matchScore,
            };
        })
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
}
