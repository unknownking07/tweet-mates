# TweetMates

Find CT-style matches based on estimated 100-day average impressions.

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

4. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Timeline fetch tries official X API v2 first, then falls back to scraping sources.
- Matching is based on estimated 100-day average impressions/day and impression category.
- Match candidates come from accounts that have already been searched in this app.
- Supabase config is optional and only used for persistence/matches cache.
