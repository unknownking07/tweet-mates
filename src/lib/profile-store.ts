import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { SearchableImpressionProfile, getImpressionCategory } from './impressions';

const STORE_PATH = path.join(process.cwd(), '.data', 'impression-profiles.json');

function normalizeUsername(username: string): string {
    return username.toLowerCase().replace('@', '').trim();
}

function isValidProfile(value: unknown): value is SearchableImpressionProfile {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const record = value as Record<string, unknown>;
    return (
        typeof record.username === 'string' &&
        typeof record.displayName === 'string' &&
        typeof record.profileImageUrl === 'string' &&
        typeof record.updatedAt === 'string' &&
        typeof record.impressions100dAvg === 'number'
    );
}

export async function listSearchedProfiles(excludeUsername?: string): Promise<SearchableImpressionProfile[]> {
    try {
        const raw = await readFile(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const normalizedExclude = excludeUsername ? normalizeUsername(excludeUsername) : null;

        return parsed
            .filter(isValidProfile)
            .map((profile) => {
                const normalizedUsername = normalizeUsername(profile.username);
                const avg = typeof profile.impressions100dAvg === 'number' ? profile.impressions100dAvg : 0;
                const category = profile.category || getImpressionCategory(avg);
                const tweetsInWindow = typeof profile.tweetsInWindow === 'number' ? profile.tweetsInWindow : 0;

                return {
                    ...profile,
                    username: normalizedUsername,
                    impressions100dAvg: avg,
                    tweetsInWindow,
                    category,
                } as SearchableImpressionProfile;
            })
            .filter((profile) => !normalizedExclude || profile.username !== normalizedExclude);
    } catch {
        return [];
    }
}

export async function upsertSearchedProfile(profile: SearchableImpressionProfile): Promise<void> {
    const normalizedProfile: SearchableImpressionProfile = {
        ...profile,
        username: normalizeUsername(profile.username),
        category: profile.category || getImpressionCategory(profile.impressions100dAvg),
    };

    const existing = await listSearchedProfiles();
    const withoutCurrent = existing.filter((entry) => entry.username !== normalizedProfile.username);

    const updated = [normalizedProfile, ...withoutCurrent].slice(0, 500);

    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}
