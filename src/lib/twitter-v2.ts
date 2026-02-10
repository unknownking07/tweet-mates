import { Tweet } from './twitter';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TARGET_TWEETS = 100;
const TIMELINE_PAGE_SIZE = 100;
const MAX_TIMELINE_PAGES = 5;

interface TwitterV2Response {
    data?: Array<{
        id: string;
        text: string;
        created_at: string;
        author_id: string;
        referenced_tweets?: Array<{
            type: string;
            id: string;
        }>;
        public_metrics?: {
            retweet_count: number;
            reply_count: number;
            like_count: number;
        };
    }>;
    includes?: {
        users?: Array<{
            id: string;
            username: string;
            name: string;
            profile_image_url: string;
        }>;
    };
    meta?: {
        result_count: number;
        next_token?: string;
    };
    errors?: Array<{
        detail: string;
        title: string;
        type: string;
    }>;
}

export async function fetchTweetsV2(username: string): Promise<{
    user: {
        id: string;
        username: string;
        displayName: string;
        profileImageUrl: string;
    };
    tweets: Tweet[];
} | null> {
    if (!TWITTER_BEARER_TOKEN) {
        console.log('Twitter API v2: No bearer token configured');
        return null;
    }

    try {
        // First, get user ID from username
        const userResponse = await fetch(
            `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url,name`,
            {
                headers: {
                    'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
                },
            }
        );

        if (!userResponse.ok) {
            const errorData = await userResponse.json();
            console.error('Twitter API v2 user lookup failed:', errorData);
            return null;
        }

        const userData = await userResponse.json();

        if (!userData.data) {
            console.log('Twitter API v2: User not found');
            return null;
        }

        const user = {
            id: userData.data.id,
            username: userData.data.username,
            displayName: userData.data.name,
            profileImageUrl: userData.data.profile_image_url?.replace('_normal', '_400x400') || '',
        };

        const collectedTweets: NonNullable<TwitterV2Response['data']> = [];
        let nextToken: string | undefined;

        // Keep paginating while data is available so low first-page counts still backfill.
        for (let page = 0; page < MAX_TIMELINE_PAGES; page++) {
            const params = new URLSearchParams({
                max_results: String(TIMELINE_PAGE_SIZE),
                'tweet.fields': 'created_at,referenced_tweets,public_metrics',
                exclude: 'retweets',
            });

            if (nextToken) {
                params.set('pagination_token', nextToken);
            }

            const tweetsResponse = await fetch(
                `https://api.twitter.com/2/users/${user.id}/tweets?${params.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
                    },
                }
            );

            if (!tweetsResponse.ok) {
                const errorData = await tweetsResponse.json();
                console.error('Twitter API v2 tweets fetch failed:', errorData);

                if (collectedTweets.length === 0) {
                    return null;
                }

                break;
            }

            const tweetsData: TwitterV2Response = await tweetsResponse.json();
            if (tweetsData.data?.length) {
                collectedTweets.push(...tweetsData.data);
            }

            nextToken = tweetsData.meta?.next_token;
            if (!nextToken || collectedTweets.length >= TARGET_TWEETS) {
                break;
            }
        }

        if (collectedTweets.length === 0) {
            return {
                user,
                tweets: [],
            };
        }

        const dedupedTweets = Array.from(
            new Map(collectedTweets.map((tweet) => [tweet.id, tweet])).values()
        );

        // Convert to our Tweet format
        const tweets: Tweet[] = dedupedTweets.map((tweet) => {
            const isReply = tweet.referenced_tweets?.some(ref => ref.type === 'replied_to') || false;
            const isRetweet = tweet.referenced_tweets?.some(ref => ref.type === 'retweeted') || false;

            return {
                id: tweet.id,
                text: tweet.text,
                created_at: tweet.created_at,
                is_reply: isReply,
                is_retweet: isRetweet,
                metrics: {
                    like_count: tweet.public_metrics?.like_count || 0,
                    reply_count: tweet.public_metrics?.reply_count || 0,
                    retweet_count: tweet.public_metrics?.retweet_count || 0,
                },
                user: {
                    name: user.displayName,
                    screen_name: user.username,
                    profile_image_url: user.profileImageUrl,
                },
            };
        });

        return {
            user,
            tweets,
        };
    } catch (error) {
        console.error('Twitter API v2 error:', error);
        return null;
    }
}

export function isTwitterApiV2Available(): boolean {
    return !!TWITTER_BEARER_TOKEN;
}
