export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

function canTrack(): boolean {
    return typeof window !== 'undefined' && !!GA_MEASUREMENT_ID && typeof window.gtag === 'function';
}

export function trackPageView(url: string): void {
    if (!canTrack()) {
        return;
    }

    window.gtag('event', 'page_view', {
        page_location: window.location.origin + url,
        page_path: url,
    });
}

export function trackEvent(eventName: string, params: Record<string, string | number | boolean> = {}): void {
    if (!canTrack()) {
        return;
    }

    window.gtag('event', eventName, params);
}
