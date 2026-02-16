export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { agentToProfile } from '@/lib/utils';
import type { AgentProfile, PaginatedResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const sort = searchParams.get('sort') ?? 'newest';
    const search = searchParams.get('search');
    const interestsParam = searchParams.get('interests');

    const offset = (page - 1) * limit;
    const supabase = createAdminClient();

    // Build base query with personality traits join
    let query = supabase
      .from('agents')
      .select('*, personality_traits(*)', { count: 'exact' })
      .eq('status', 'active');

    // Search filter: name or tagline ILIKE
    if (search) {
      query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%`);
    }

    // Interests filter: array overlap
    if (interestsParam) {
      const interests = interestsParam.split(',').map((i) => i.trim()).filter(Boolean);
      if (interests.length > 0) {
        query = query.overlaps('interests', interests);
      }
    }

    // Sort order
    switch (sort) {
      case 'popular':
        // For popular sort, we order by created_at as a fallback
        // The true "popular" ordering would need a match count subquery
        // which Supabase REST doesn't support directly. We use a two-step approach.
        query = query.order('created_at', { ascending: false });
        break;
      case 'active':
        query = query.order('last_heartbeat', { ascending: false, nullsFirst: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: agents, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If sort is 'popular', do a secondary sort by match count
    let sortedAgents = agents ?? [];
    if (sort === 'popular' && sortedAgents.length > 0) {
      const agentIds = sortedAgents.map((a) => a.id);
      const { data: matchCounts } = await supabase
        .from('matches')
        .select('agent_a_id, agent_b_id')
        .or(
          agentIds.map((id) => `agent_a_id.eq.${id}`).join(',') +
            ',' +
            agentIds.map((id) => `agent_b_id.eq.${id}`).join(',')
        );

      const countMap: Record<string, number> = {};
      for (const m of matchCounts ?? []) {
        countMap[m.agent_a_id] = (countMap[m.agent_a_id] ?? 0) + 1;
        countMap[m.agent_b_id] = (countMap[m.agent_b_id] ?? 0) + 1;
      }

      sortedAgents = sortedAgents.sort(
        (a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0)
      );
    }

    const total = count ?? 0;

    const profiles: AgentProfile[] = sortedAgents.map((agent) => {
      // personality_traits comes as an array from the join; take the first element
      const traits = Array.isArray(agent.personality_traits)
        ? agent.personality_traits[0] ?? null
        : agent.personality_traits ?? null;
      return agentToProfile(agent, traits);
    });

    const response: PaginatedResponse<AgentProfile> = {
      data: profiles,
      total,
      page,
      limit,
      has_more: offset + limit < total,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
