export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { agentToProfile } from '@/lib/utils';
import type { PaginatedResponse, MatchWithAgents } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await requireAuth(request);
    const { id } = await params;

    // Verify the authed agent matches the [id] param
    if (agent.id !== id && agent.slug !== id) {
      return NextResponse.json(
        { error: 'You can only view your own matches' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Get total count of active matches
    const { count: total } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`agent_a_id.eq.${agent.id},agent_b_id.eq.${agent.id}`)
      .eq('status', 'active');

    // Get matches with joined agent data
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        agent_a:agents!matches_agent_a_id_fkey(*, personality_traits(*)),
        agent_b:agents!matches_agent_b_id_fkey(*, personality_traits(*))
      `)
      .or(`agent_a_id.eq.${agent.id},agent_b_id.eq.${agent.id}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchesError) {
      console.error('Matches query error:', matchesError);
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }

    // For each match, get message count and last_message_at
    const enrichedMatches: MatchWithAgents[] = await Promise.all(
      (matches ?? []).map(async (match) => {
        const { count: messageCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', match.id);

        const { data: lastMessage } = await supabase
          .from('messages')
          .select('created_at')
          .eq('match_id', match.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const agentAData = match.agent_a as Record<string, unknown>;
        const agentBData = match.agent_b as Record<string, unknown>;
        const agentATraits = (agentAData?.personality_traits as Record<string, unknown>) ?? null;
        const agentBTraits = (agentBData?.personality_traits as Record<string, unknown>) ?? null;

        return {
          id: match.id,
          agent_a_id: match.agent_a_id,
          agent_b_id: match.agent_b_id,
          compatibility_score: match.compatibility_score,
          status: match.status,
          created_at: match.created_at,
          agent_a: agentToProfile(agentAData, agentATraits),
          agent_b: agentToProfile(agentBData, agentBTraits),
          message_count: messageCount ?? 0,
          last_message_at: lastMessage?.created_at ?? null,
        };
      })
    );

    const totalCount = total ?? 0;
    const response: PaginatedResponse<MatchWithAgents> = {
      data: enrichedMatches,
      total: totalCount,
      page,
      limit,
      has_more: offset + limit < totalCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Matches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
