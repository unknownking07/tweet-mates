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

// Fetch tweets using Twitter Syndication API (free, public)
export async function fetchTweets(username: string): Promise<{ tweets: Tweet[]; user: TwitterUser | null }> {
    const cleanUsername = username.toLowerCase().replace('@', '').trim();

    try {
        // Try Twitter Syndication API first
        const tweets = await fetchFromSyndication(cleanUsername);
        if (tweets.length > 0) {
            return {
                tweets,
                user: tweets[0].user as TwitterUser
            };
        }
    } catch (error) {
        console.error('Syndication fetch failed:', error);
    }

    // Fallback to Nitter
    try {
        const tweets = await fetchFromNitter(cleanUsername);
        if (tweets.length > 0) {
            return {
                tweets,
                user: tweets[0].user as TwitterUser
            };
        }
    } catch (error) {
        console.error('Nitter fetch failed:', error);
    }

    return { tweets: [], user: null };
}

async function fetchFromSyndication(username: string): Promise<Tweet[]> {
    // Using Twitter's timeline embed endpoint
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        },
        next: { revalidate: 1800 }, // Cache for 30 min
    });

    if (!response.ok) {
        throw new Error(`Syndication API failed: ${response.status}`);
    }

    const html = await response.text();
    return parseSyndicationHTML(html, username);
}

function parseSyndicationHTML(html: string, username: string): Tweet[] {
    const tweets: Tweet[] = [];

    // Extract JSON data from script tags
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);

    if (scriptMatch) {
        try {
            const data = JSON.parse(scriptMatch[1]);
            const entries = data?.props?.pageProps?.timeline?.entries || [];

            for (const entry of entries) {
                const tweet = entry?.content?.tweet;
                if (tweet) {
                    tweets.push({
                        id: tweet.id_str || tweet.id,
                        text: tweet.full_text || tweet.text || '',
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
            }
        } catch (e) {
            console.error('Failed to parse syndication JSON:', e);
        }
    }

    // Fallback: parse HTML directly
    if (tweets.length === 0) {
        const tweetCardRegex = /<div[^>]*data-tweet-id="([^"]+)"[^>]*>[\s\S]*?<time[^>]*datetime="([^"]+)"[^>]*>/g;
        let match;

        while ((match = tweetCardRegex.exec(html)) !== null) {
            const [, tweetId, datetime] = match;

            // Extract tweet text
            const textMatch = html.substring(match.index).match(/<div[^>]*class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '') : '';

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
    // List of Nitter instances to try
    const nitterInstances = [
        'nitter.privacydev.net',
        'nitter.poast.org',
        'nitter.1d4.us',
    ];

    for (const instance of nitterInstances) {
        try {
            const url = `https://${instance}/${username}/rss`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; TweetMates/1.0)',
                },
                next: { revalidate: 1800 },
            });

            if (response.ok) {
                const rss = await response.text();
                return parseNitterRSS(rss, username);
            }
        } catch (error) {
            console.error(`Nitter instance ${instance} failed:`, error);
            continue;
        }
    }

    return [];
}

function parseNitterRSS(rss: string, username: string): Tweet[] {
    const tweets: Tweet[] = [];

    // Parse RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(rss)) !== null) {
        const item = match[1];

        const guidMatch = item.match(/<guid[^>]*>([^<]+)<\/guid>/);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
            item.match(/<title>([^<]+)<\/title>/);
        if (guidMatch && pubDateMatch) {
            const guid = guidMatch[1];
            const tweetId = guid.split('/').pop() || guid;
            const text = titleMatch ? titleMatch[1].trim() : '';

            tweets.push({
                id: tweetId.replace('#m', ''),
                text: text.replace(/<[^>]+>/g, ''),
                created_at: pubDateMatch[1],
                is_reply: text.toLowerCase().startsWith('r to @') || text.startsWith('@'),
                is_retweet: text.toLowerCase().startsWith('rt @'),
                user: {
                    name: username,
                    screen_name: username,
                    profile_image_url: '',
                },
            });
        }
    }

    // Extract profile image if available
    const imageMatch = rss.match(/<url>([^<]*profile[^<]*)<\/url>/i);
    if (imageMatch && tweets.length > 0) {
        tweets.forEach(t => {
            t.user.profile_image_url = imageMatch[1];
        });
    }

    return tweets;
}
