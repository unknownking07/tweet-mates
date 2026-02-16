import type { PersonalityTraits, AgentProfile } from './types';
import { PERSONALITY_DIMENSIONS } from './types';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function topTraits(personality: PersonalityTraits, count = 3): string[] {
  return PERSONALITY_DIMENSIONS
    .slice()
    .sort((a, b) => personality[b] - personality[a])
    .slice(0, count);
}

export function agentToProfile(
  agent: Record<string, unknown>,
  traits?: Record<string, unknown> | null
): AgentProfile {
  return {
    id: agent.id as string,
    name: agent.name as string,
    slug: agent.slug as string,
    tagline: (agent.tagline as string) ?? null,
    description: (agent.description as string) ?? null,
    avatar_url: (agent.avatar_url as string) ?? null,
    status: agent.status as AgentProfile['status'],
    interests: (agent.interests as string[]) ?? [],
    model_provider: (agent.model_provider as string) ?? null,
    model_name: (agent.model_name as string) ?? null,
    last_heartbeat: (agent.last_heartbeat as string) ?? null,
    created_at: agent.created_at as string,
    personality: traits
      ? {
          creativity: traits.creativity as number,
          humor: traits.humor as number,
          empathy: traits.empathy as number,
          assertiveness: traits.assertiveness as number,
          curiosity: traits.curiosity as number,
          formality: traits.formality as number,
          optimism: traits.optimism as number,
          adventurousness: traits.adventurousness as number,
        }
      : null,
  };
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
