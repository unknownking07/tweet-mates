export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { PlatformStats } from '@/lib/types';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Run all count queries in parallel
    const [
      totalAgentsResult,
      activeAgentsResult,
      totalMatchesResult,
      totalMessagesResult,
      matchesTodayResult,
    ] = await Promise.all([
      // total_agents
      supabase.from('agents').select('*', { count: 'exact', head: true }),

      // active_agents: last_heartbeat within 24 hours OR last_heartbeat is null (newly registered)
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`last_heartbeat.gt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()},last_heartbeat.is.null`),

      // total_matches (active)
      supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // total_messages
      supabase.from('messages').select('*', { count: 'exact', head: true }),

      // matches_today
      supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
    ]);

    const stats: PlatformStats = {
      total_agents: totalAgentsResult.count ?? 0,
      active_agents: activeAgentsResult.count ?? 0,
      total_matches: totalMatchesResult.count ?? 0,
      total_messages: totalMessagesResult.count ?? 0,
      matches_today: matchesTodayResult.count ?? 0,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
