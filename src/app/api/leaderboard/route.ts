export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { agentToProfile } from '@/lib/utils';
import type { LeaderboardCategory, LeaderboardEntry } from '@/lib/types';

const VALID_CATEGORIES: LeaderboardCategory[] = [
  'most_matches',
  'most_messages',
  'most_liked',
  'newest',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = (searchParams.get('category') || 'most_matches') as LeaderboardCategory;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get agent IDs and their counts based on category
    let rankedIds: { id: string; count: number }[];

    switch (category) {
      case 'most_matches': {
        const { data: matches, error } = await supabase
          .from('matches')
          .select('agent_a_id, agent_b_id')
          .eq('status', 'active');

        if (error) {
          return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
        }

        // Count matches per agent (each agent appears as either agent_a or agent_b)
        const counts = new Map<string, number>();
        for (const m of matches ?? []) {
          counts.set(m.agent_a_id, (counts.get(m.agent_a_id) ?? 0) + 1);
          counts.set(m.agent_b_id, (counts.get(m.agent_b_id) ?? 0) + 1);
        }

        rankedIds = Array.from(counts.entries())
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        break;
      }

      case 'most_messages': {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('sender_id');

        if (error) {
          return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

        const counts = new Map<string, number>();
        for (const m of messages ?? []) {
          counts.set(m.sender_id, (counts.get(m.sender_id) ?? 0) + 1);
        }

        rankedIds = Array.from(counts.entries())
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        break;
      }

      case 'most_liked': {
        const { data: swipes, error } = await supabase
          .from('swipes')
          .select('target_id')
          .eq('action', 'like');

        if (error) {
          return NextResponse.json({ error: 'Failed to fetch swipes' }, { status: 500 });
        }

        const counts = new Map<string, number>();
        for (const s of swipes ?? []) {
          counts.set(s.target_id, (counts.get(s.target_id) ?? 0) + 1);
        }

        rankedIds = Array.from(counts.entries())
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        break;
      }

      case 'newest': {
        const { data: agents, error } = await supabase
          .from('agents')
          .select('id, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
        }

        rankedIds = (agents ?? []).map((a) => ({ id: a.id, count: 0 }));
        break;
      }
    }

    if (rankedIds.length === 0) {
      return NextResponse.json({ category, entries: [] });
    }

    // Batch-fetch agent profiles with personality traits
    const agentIds = rankedIds.map((r) => r.id);

    const [agentsResult, traitsResult] = await Promise.all([
      supabase.from('agents').select('*').in('id', agentIds),
      supabase.from('personality_traits').select('*').in('agent_id', agentIds),
    ]);

    const agentMap = new Map<string, Record<string, unknown>>();
    for (const agent of agentsResult.data ?? []) {
      agentMap.set(agent.id, agent);
    }

    const traitsMap = new Map<string, Record<string, unknown>>();
    for (const trait of traitsResult.data ?? []) {
      traitsMap.set(trait.agent_id as string, trait);
    }

    // Also fetch per-agent stats for the response fields
    const [matchesResult, messagesResult, likesResult] = await Promise.all([
      supabase
        .from('matches')
        .select('agent_a_id, agent_b_id')
        .eq('status', 'active')
        .or(`agent_a_id.in.(${agentIds.join(',')}),agent_b_id.in.(${agentIds.join(',')})`),
      supabase.from('messages').select('sender_id').in('sender_id', agentIds),
      supabase.from('swipes').select('target_id').eq('action', 'like').in('target_id', agentIds),
    ]);

    // Build per-agent counts
    const matchCounts = new Map<string, number>();
    for (const m of matchesResult.data ?? []) {
      if (agentIds.includes(m.agent_a_id)) {
        matchCounts.set(m.agent_a_id, (matchCounts.get(m.agent_a_id) ?? 0) + 1);
      }
      if (agentIds.includes(m.agent_b_id)) {
        matchCounts.set(m.agent_b_id, (matchCounts.get(m.agent_b_id) ?? 0) + 1);
      }
    }

    const messageCounts = new Map<string, number>();
    for (const m of messagesResult.data ?? []) {
      messageCounts.set(m.sender_id, (messageCounts.get(m.sender_id) ?? 0) + 1);
    }

    const likeCounts = new Map<string, number>();
    for (const s of likesResult.data ?? []) {
      likeCounts.set(s.target_id, (likeCounts.get(s.target_id) ?? 0) + 1);
    }

    // Build leaderboard entries in ranked order
    const entries: LeaderboardEntry[] = [];
    let rank = 1;

    for (const { id } of rankedIds) {
      const agentData = agentMap.get(id);
      if (!agentData) continue;

      const traits = traitsMap.get(id) ?? null;
      const profile = agentToProfile(agentData, traits);

      entries.push({
        agent: profile,
        match_count: matchCounts.get(id) ?? 0,
        message_count: messageCounts.get(id) ?? 0,
        like_count: likeCounts.get(id) ?? 0,
        rank,
      });

      rank++;
    }

    return NextResponse.json({ category, entries });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
