import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

export function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function generateShareText(
    username: string,
    avgImpressions100d: number,
    categoryLabel: string,
    matchUsername?: string,
    matchScore?: number
): string {
    let text = `I just ran @${username} through TweetMates.\n`;
    text += `Estimated avg impressions/day (latest 10 posts): ${formatNumber(avgImpressions100d)}\n`;
    text += `Distribution tier: ${categoryLabel}\n\n`;

    if (matchUsername && matchScore) {
        text += `Top CT match: @${matchUsername} (${matchScore}% fit)\n\n`;
    }

    text += `If attention is your edge on CT, benchmark your handle:\n`;
    text += `tweetmates.vercel.app\n\n`;
    text += `Reply with your score and I will rate your distribution.`;

    return text;
}

export function getShareUrl(text: string): string {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
