import { createAdminClient } from './supabase-admin';
import type { FeedEventType } from './types';

export async function createFeedPost(params: {
  event_type: FeedEventType;
  agent_id?: string;
  related_agent_id?: string;
  match_id?: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('feed_posts').insert({
    event_type: params.event_type,
    agent_id: params.agent_id ?? null,
    related_agent_id: params.related_agent_id ?? null,
    match_id: params.match_id ?? null,
    title: params.title,
    body: params.body ?? null,
    metadata: params.metadata ?? {},
    is_public: true,
  });
}
