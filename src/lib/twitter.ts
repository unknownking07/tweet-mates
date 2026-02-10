export interface Tweet {
    id: string;
    text: string;
    created_at: string;
    is_reply: boolean;
    is_retweet: boolean;
    metrics?: {
        like_count: number;
        reply_count: number;
        retweet_count: number;
    };
    user: {
        name: string;
        screen_name: string;
        profile_image_url: string;
    };
}

export interface TwitterUser {
    name: string;
    screen_name: string;
    profile_image_url: string;
    description?: string;
}

type FetchTimelineResult = {
    tweets: Tweet[];
    user: TwitterUser | null;
};

type NextFetchInit = RequestInit & {
    next?: {
        revalidate?: number;
    };
};

const SCRAPE_REVALIDATE_SECONDS = 1800;
const SCRAPE_TIMEOUT_MS = 9000;
const SCRAPE_RETRY_ATTEMPTS = 2;
const SCRAPE_TARGET_TWEETS = 100;
const SCRAPE_SUCCESS_CACHE_TTL_MS = 5 * 60 * 1000;
const SCRAPE_EMPTY_CACHE_TTL_MS = 60 * 1000;
const SCRAPE_CACHE_MAX_ENTRIES = 300;
const NITTER_BATCH_SIZE = 3;

const NITTER_INSTANCES = [
    'nitter.privacydev.net',
    'nitter.poast.org',
    'nitter.1d4.us',
    'nitter.esmailelbob.xyz',
    'nitter.woodland.cafe',
    'nitter.kylrth.com',
];

interface CacheEntry {
    value: FetchTimelineResult;
    expiresAt: number;
}

class HttpStatusError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpStatusError';
        this.status = status;
    }
}

const timelineCache = new Map<string, CacheEntry>();
const inflightTimelineFetches = new Map<string, Promise<FetchTimelineResult>>();

function normalizeUsername(username: string): string {
    return username.toLowerCase().replace('@', '').trim();
}

function parseTimestamp(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function sanitizeText(value: string): string {
    return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function dedupeAndSortTweets(tweets: Tweet[]): Tweet[] {
    const unique = new Map<string, Tweet>();

    for (const tweet of tweets) {
        if (!tweet?.id || unique.has(tweet.id)) {
            continue;
        }

        unique.set(tweet.id, tweet);
    }

    return Array.from(unique.values()).sort(
        (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
    );
}

function getCachedTimeline(username: string): FetchTimelineResult | null {
    const cached = timelineCache.get(username);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt <= Date.now()) {
        timelineCache.delete(username);
        return null;
    }

    return cached.value;
}

function setCachedTimeline(username: string, value: FetchTimelineResult, ttlMs: number): void {
    timelineCache.set(username, {
        value,
        expiresAt: Date.now() + ttlMs,
    });

    if (timelineCache.size > SCRAPE_CACHE_MAX_ENTRIES) {
        const oldestKey = timelineCache.keys().next().value;
        if (oldestKey) {
            timelineCache.delete(oldestKey);
        }
    }
}

function shouldRetryRequest(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
        return error.status === 429 || error.status >= 500;
    }

    if (error instanceof Error && error.name === 'AbortError') {
        return true;
    }

    return true;
}

async function fetchTextWithTimeout(url: string, init: NextFetchInit): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new HttpStatusError(response.status, `Request failed (${response.status}) for ${url}`);
        }

        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchTextWithRetry(url: string, init: NextFetchInit, attempts = SCRAPE_RETRY_ATTEMPTS): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fetchTextWithTimeout(url, init);
        } catch (error) {
            lastError = error;
            if (attempt >= attempts || !shouldRetryRequest(error)) {
                break;
            }

            await sleep(attempt * 250);
        }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

// Fetch tweets using Twitter Syndication API + Nitter fallback (free, public).
export async function fetchTweets(username: string): Promise<{ tweets: Tweet[]; user: TwitterUser | null; cached: boolean }> {
    const cleanUsername = normalizeUsername(username);
    const cached = getCachedTimeline(cleanUsername);

    if (cached) {
        return {
            ...cached,
            cached: true,
        };
    }

    const inflight = inflightTimelineFetches.get(cleanUsername);
    if (inflight) {
        try {
            const shared = await inflight;
            return {
                ...shared,
                cached: true,
            };
        } catch (error) {
            console.error('Shared timeline fetch failed:', error);
            return {
                tweets: [],
                user: null,
                cached: true,
            };
        }
    }

    const fetchPromise = fetchFromPublicSources(cleanUsername);
    inflightTimelineFetches.set(cleanUsername, fetchPromise);

    try {
        const result = await fetchPromise;
        setCachedTimeline(
            cleanUsername,
            result,
            result.tweets.length > 0 ? SCRAPE_SUCCESS_CACHE_TTL_MS : SCRAPE_EMPTY_CACHE_TTL_MS
        );

        return {
            ...result,
            cached: false,
        };
    } catch (error) {
        console.error('Public timeline fetch failed:', error);
        const fallback = { tweets: [], user: null };
        setCachedTimeline(cleanUsername, fallback, SCRAPE_EMPTY_CACHE_TTL_MS);
        return {
            ...fallback,
            cached: false,
        };
    } finally {
        inflightTimelineFetches.delete(cleanUsername);
    }
}

async function fetchFromPublicSources(username: string): Promise<FetchTimelineResult> {
    let syndicationTweets: Tweet[] = [];

    try {
        syndicationTweets = await fetchFromSyndication(username);
    } catch (error) {
        console.error('Syndication fetch failed:', error);
    }

    if (syndicationTweets.length >= SCRAPE_TARGET_TWEETS) {
        return {
            tweets: syndicationTweets,
            user: (syndicationTweets[0]?.user as TwitterUser) || null,
        };
    }

    let nitterTweets: Tweet[] = [];
    try {
        nitterTweets = await fetchFromNitter(username);
    } catch (error) {
        console.error('Nitter fetch failed:', error);
    }

    const mergedTweets = dedupeAndSortTweets([...syndicationTweets, ...nitterTweets]);
    return {
        tweets: mergedTweets,
        user: (syndicationTweets[0]?.user as TwitterUser) || (nitterTweets[0]?.user as TwitterUser) || null,
    };
}

async function fetchFromSyndication(username: string): Promise<Tweet[]> {
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(username)}`;

    const html = await fetchTextWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml',
        },
        next: { revalidate: SCRAPE_REVALIDATE_SECONDS },
    });

    return dedupeAndSortTweets(parseSyndicationHTML(html, username));
}

function parseSyndicationHTML(html: string, username: string): Tweet[] {
    const tweets: Tweet[] = [];

    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);

    if (scriptMatch?.[1]) {
        try {
            const data = JSON.parse(scriptMatch[1]);
            const entries = data?.props?.pageProps?.timeline?.entries || [];

            for (const entry of entries) {
                const tweet = entry?.content?.tweet;
                if (!tweet) {
                    continue;
                }

                tweets.push({
                    id: tweet.id_str || tweet.id,
                    text: sanitizeText(tweet.full_text || tweet.text || ''),
                    created_at: tweet.created_at,
                    is_reply: !!tweet.in_reply_to_status_id_str,
                    is_retweet: !!tweet.retweeted_status,
                    metrics: {
                        like_count: Number(tweet.favorite_count || 0),
                        reply_count: Number(tweet.reply_count || 0),
                        retweet_count: Number(tweet.retweet_count || 0),
                    },
                    user: {
                        name: tweet.user?.name || username,
                        screen_name: tweet.user?.screen_name || username,
                        profile_image_url: tweet.user?.profile_image_url_https || '',
                    },
                });
            }
        } catch (error) {
            console.error('Failed to parse syndication JSON:', error);
        }
    }

    if (tweets.length === 0) {
        const tweetCardRegex = /<div[^>]*data-tweet-id="([^"]+)"[^>]*>[\s\S]*?<time[^>]*datetime="([^"]+)"[^>]*>/g;
        let match: RegExpExecArray | null;

        while ((match = tweetCardRegex.exec(html)) !== null) {
            const [, tweetId, datetime] = match;
            const cardSlice = html.slice(match.index, match.index + 12000);
            const textMatch = cardSlice.match(/<div[^>]*class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            const text = textMatch ? sanitizeText(textMatch[1]) : '';

            tweets.push({
                id: tweetId,
                text,
                created_at: datetime,
                is_reply: text.startsWith('@'),
                is_retweet: false,
                user: {
                    name: username,
                    screen_name: username,
                    profile_image_url: '',
                },
            });
        }
    }

    return tweets;
}

async function fetchFromNitter(username: string): Promise<Tweet[]> {
    for (let i = 0; i < NITTER_INSTANCES.length; i += NITTER_BATCH_SIZE) {
        const batch = NITTER_INSTANCES.slice(i, i + NITTER_BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map((instance) => fetchFromNitterInstance(instance, username))
        );

        let best: Tweet[] = [];

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > best.length) {
                best = result.value;
            }
        }

        if (best.length > 0) {
            return best;
        }
    }

    return [];
}

async function fetchFromNitterInstance(instance: string, username: string): Promise<Tweet[]> {
    const url = `https://${instance}/${encodeURIComponent(username)}/rss`;
    const rss = await fetchTextWithRetry(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TweetMates/1.0)',
            Accept: 'application/rss+xml,application/xml,text/xml',
        },
        next: { revalidate: SCRAPE_REVALIDATE_SECONDS },
    }, 1);

    return dedupeAndSortTweets(parseNitterRSS(rss, username));
}

function parseNitterRSS(rss: string, username: string): Tweet[] {
    const tweets: Tweet[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(rss)) !== null) {
        const item = match[1];
        const guidMatch = item.match(/<guid[^>]*>([^<]+)<\/guid>/);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
            item.match(/<title>([\s\S]*?)<\/title>/);
        const descriptionMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
            item.match(/<description>([\s\S]*?)<\/description>/);

        if (!guidMatch || !pubDateMatch) {
            continue;
        }

        const guid = guidMatch[1];
        const tweetId = guid.split('/').pop() || guid;
        const rawText = titleMatch?.[1] || descriptionMatch?.[1] || '';
        const text = sanitizeText(rawText);
        const lower = text.toLowerCase();

        tweets.push({
            id: tweetId.replace('#m', ''),
            text,
            created_at: pubDateMatch[1],
            is_reply: lower.startsWith('r to @') || text.startsWith('@'),
            is_retweet: lower.startsWith('rt @'),
            user: {
                name: username,
                screen_name: username,
                profile_image_url: '',
            },
        });
    }

    const imageMatch = rss.match(/<url>([^<]*profile[^<]*)<\/url>/i);
    if (imageMatch && tweets.length > 0) {
        for (const tweet of tweets) {
            tweet.user.profile_image_url = imageMatch[1];
        }
    }

    return tweets;
}
