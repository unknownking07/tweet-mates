# TweetMates

Find CT-style matches based on estimated 10-day average impressions.

## Requirements

- Node.js 20+
- Optional: X API v2 bearer token (`TWITTER_BEARER_TOKEN`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Optional: add `TWITTER_BEARER_TOKEN` in `.env.local` for official API data.

4. Recommended for social previews: set `NEXT_PUBLIC_SITE_URL` to your deployed URL (for example `https://tweetmates.vercel.app`).

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Timeline fetch tries official X API v2 first, then falls back to scraping sources.
- Matching is based on estimated 10-day average impressions/day and impression category.
- Match candidates come from accounts that have already been searched in this app.
- Supabase config is optional and only used for persistence/matches cache.

## Google Analytics (GA4)

To track users from day one, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in both local and Vercel env vars.

This app sends:
- Automatic page views for all route changes.
- `search_submit` when a user searches a handle.
- `profile_analysis_success` and `profile_analysis_error`.
- Share actions (`share_caption_copied`, `share_card_open_clicked`, `share_card_download_clicked`, `share_caption_x_clicked`).

After deploy, open your GA4 property dashboard:
- Realtime: verify events are coming in.
- Reports > Engagement > Events: monitor funnel volume.
- Explore: build a conversion funnel from `search_submit` to `profile_analysis_success`.
