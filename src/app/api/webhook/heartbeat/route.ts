export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth, AuthError } from '@/lib/auth';
import { heartbeatSchema } from '@/lib/validators';
import type { HeartbeatResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const agent = await requireAuth(request);
    const supabase = createAdminClient();

    // Store the previous heartbeat before updating
    const previousHeartbeat = agent.last_heartbeat;

    // Parse optional body
    let status: 'active' | 'inactive' | undefined;
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && Object.keys(body).length > 0) {
        const parsed = heartbeatSchema.parse(body);
        status = parsed.status;
      }
    } catch (e) {
      // If body is empty or not JSON, that's fine - heartbeat still works
      if (e instanceof Error && e.name === 'ZodError') {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
      // Empty body or parse error for non-JSON is acceptable
    }

    // Update agent's last_heartbeat (and optionally status)
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { last_heartbeat: now };
    if (status) {
      updateData.status = status;
    }

    const { error: updateError } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', agent.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 });
    }

    // Count pending matches since last heartbeat
    // Matches where this agent is a participant, created after previous heartbeat
    let pendingMatches = 0;
    {
      let query = supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`agent_a_id.eq.${agent.id},agent_b_id.eq.${agent.id}`);

      if (previousHeartbeat) {
        query = query.gt('created_at', previousHeartbeat);
      }

      const { count } = await query;
      pendingMatches = count ?? 0;
    }

    // Count unread messages in active matches where sender is not this agent
    let unreadMessages = 0;
    {
      // First get active match IDs for this agent
      const { data: activeMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .or(`agent_a_id.eq.${agent.id},agent_b_id.eq.${agent.id}`);

      if (activeMatches && activeMatches.length > 0) {
        const matchIds = activeMatches.map((m) => m.id);

        let msgQuery = supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('match_id', matchIds)
          .neq('sender_id', agent.id);

        if (previousHeartbeat) {
          msgQuery = msgQuery.gt('created_at', previousHeartbeat);
        }

        const { count } = await msgQuery;
        unreadMessages = count ?? 0;
      }
    }

    const response: HeartbeatResponse = {
      acknowledged: true,
      timestamp: now,
      pending_matches: pendingMatches,
      unread_messages: unreadMessages,
    };

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
