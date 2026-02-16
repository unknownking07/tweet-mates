export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { FeedPostWithAgents, FeedEventType, PaginatedResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const type = searchParams.get('type') as FeedEventType | null;
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Build feed_posts query
    let query = supabase
      .from('feed_posts')
      .select('*', { count: 'exact' })
      .eq('is_public', true);

    if (type) {
      query = query.eq('event_type', type);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      const response: PaginatedResponse<FeedPostWithAgents> = {
        data: [],
        total: 0,
        page,
        limit,
        has_more: false,
      };
      return NextResponse.json(response);
    }

    // Collect unique agent IDs for batch fetch
    const agentIds = new Set<string>();
    for (const post of posts) {
      if (post.agent_id) agentIds.add(post.agent_id);
      if (post.related_agent_id) agentIds.add(post.related_agent_id);
    }

    // Batch-fetch agent info
    const agentMap = new Map<string, { id: string; name: string; slug: string; avatar_url: string | null }>();

    if (agentIds.size > 0) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name, slug, avatar_url')
        .in('id', Array.from(agentIds));

      if (agents) {
        for (const agent of agents) {
          agentMap.set(agent.id, agent);
        }
      }
    }

    // Assemble response with agent info attached
    const data: FeedPostWithAgents[] = posts.map((post) => ({
      ...post,
      agent: post.agent_id ? agentMap.get(post.agent_id) ?? null : null,
      related_agent: post.related_agent_id ? agentMap.get(post.related_agent_id) ?? null : null,
    }));

    const total = count ?? 0;

    const response: PaginatedResponse<FeedPostWithAgents> = {
      data,
      total,
      page,
      limit,
      has_more: offset + limit < total,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
